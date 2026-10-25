import { Router } from 'express';

// Tier 2 Continuous Core Engines
import { WholesaleCostManager, type WholesaleItemPurchase } from '../../../core/ledger/wholesale_cost_manager';
import { UPICrossValidator } from '../../../core/fusion/upi_cross_validator';
import { QwenEODBatchInterpreter } from '../../../core/slm/qwen_interpreter';
import { ConservedDoubleEntryCRDT } from '../../../core/crdt/double_entry_crdt';
import type { RawTranscriptRecord } from '../../../core/perception/unified_audio_stream';
import type { ParsedUPINotification } from '../../../shared/types';
import { initializeDatabase } from '../db/database';
import { broadcast } from '../broadcast';

// Backwards-Compatible Legacy Prototype Engines
import { LexiconParser } from '../../../core/lexicon';
import { RecipeTracker } from '../../../core/recipe_inference';
import { LossEstimator } from '../../../core/loss_attribution';
import { CrdtLedger } from '../../../core/crdt_ledger';
import { FusionBuffer } from '../../../core/fusion_buffer';
import { ProfitEngine } from '../../../core/accrual_engine';

export const vendorRouter = Router();

// ============================================================================
// SINGLETON TIER-2 CONTINUOUS INSTANCES
// ============================================================================
const crdtLedger = new ConservedDoubleEntryCRDT('stall_primary');
const wholesaleManager = new WholesaleCostManager(10.0, crdtLedger); // 10% spice/fuel overhead
const upiValidator = new UPICrossValidator(crdtLedger);
const qwenInterpreter = new QwenEODBatchInterpreter(wholesaleManager, crdtLedger);

// In-memory transcript buffer (also flushed into SQLite WAL)
let shiftTranscripts: RawTranscriptRecord[] = [];
let sequenceCounter = 0;

// Lazy DB handle
function getDb() {
  try {
    return initializeDatabase();
  } catch (err) {
    console.warn('[DB] SQLite initialize skipped or running in-memory fallback:', err);
    return null;
  }
}

// ============================================================================
// NEW TIER-2 CONTINUOUS PIPELINE ENDPOINTS
// ============================================================================

/**
 * 1. Morning Wholesale Mandi Bill Ingestion
 * POST /api/vendor/wholesale/bill
 */
vendorRouter.post('/wholesale/bill', (req, res) => {
  try {
    const { items, paidViaCash, vendorId, source } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: 'items array is required' });
    }

    // Normalize input formats (supports both { name, quantityKg, ratePerKg } and { itemName, bulkQuantity, totalCost })
    const purchases: WholesaleItemPurchase[] = items.map((raw: any) => {
      const itemName = String(raw.name || raw.itemName || 'unknown').toLowerCase();
      const bulkQuantity = Number(raw.quantityKg ?? raw.bulkQuantity ?? raw.quantity ?? 1);
      const unit = String(raw.unit || 'kg');
      const rate = Number(raw.ratePerKg ?? raw.unitRate ?? 0);
      const totalCost = Number(raw.totalCost ?? (rate > 0 ? rate * bulkQuantity : 0));

      return {
        itemName,
        bulkQuantity,
        unit,
        totalCost,
        supplierName: raw.supplierName || 'Mandi Wholesale'
      };
    });

    const isCash = paidViaCash !== false;
    const deltas = wholesaleManager.ingestWholesaleBill(purchases, isCash);
    const inventory = wholesaleManager.getAllInventory();

    // Broadcast update over WebSocket
    broadcast({
      type: 'WHOLESALE_BILL_INGESTED',
      vendorId: vendorId || 'STALL_PRIMARY',
      source: source || 'MANUAL',
      deltasCommitted: deltas.length,
      inventory
    });

    res.json({
      ok: true,
      deltasCommitted: deltas.length,
      inventorySummary: inventory,
      message: 'Morning wholesale cost basis established. Zero retail preset prices active.'
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || 'Wholesale bill ingestion failed' });
  }
});

/**
 * 2. Continuous Daytime Audio Turn Logging
 * POST /api/vendor/audio/turn
 */
vendorRouter.post('/audio/turn', (req, res) => {
  try {
    const { speaker, text, timestamp, confidence, noiseDb } = req.body;
    const timeMs = Number(timestamp) || Date.now();
    const cleanText = String(text || '').trim();

    sequenceCounter++;
    const turnId = `CHUNK_${timeMs}_${sequenceCounter}`;

    const validRole = (['VENDOR', 'CUST_1', 'CUST_2', 'SOUNDBOX_CHIME'].includes(speaker))
      ? speaker
      : 'CUST_1';

    const turnRecord: RawTranscriptRecord = {
      id: turnId,
      timestamp: timeMs,
      rawText: cleanText,
      speakerClassification: validRole,
      noiseDb: Number(noiseDb) || 65,
      processedStatus: 'PENDING'
    };

    shiftTranscripts.push(turnRecord);

    // Persist into SQLite WAL if available
    const db = getDb();
    if (db) {
      try {
        db.insertRawEvidence({
          evidence_id: turnId,
          evidence_type: 'voice',
          payload_json: JSON.stringify({
            speaker: validRole,
            text: cleanText,
            timestamp: timeMs,
            confidence: confidence ?? 0.95
          }),
          observed_at: Math.max(timeMs, 946684800000),
          confidence_ppm: Math.round((Number(confidence) || 0.95) * 1_000_000)
        });
      } catch (dbErr) {
        console.warn('[DB] Failed to insert raw evidence:', dbErr);
      }
    }

    // Broadcast turn to UI for live transcript display
    broadcast({
      type: 'AUDIO_TURN',
      turn: turnRecord,
      bufferedTurns: shiftTranscripts.length
    });

    res.json({
      ok: true,
      evidenceId: turnId,
      bufferedTurns: shiftTranscripts.length
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || 'Audio turn logging failed' });
  }
});

/**
 * 3. Dual UPI Cross-Validation (Chime + Notification)
 * POST /api/vendor/upi/event
 */
vendorRouter.post('/upi/event', (req, res) => {
  try {
    const { eventType, amount, timestamp, appName, rrn, rawText, confidence } = req.body;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, error: 'Valid amount is required' });
    }

    const timeMs = Number(timestamp) || Date.now();
    let decision: any;

    if (eventType === 'SOUNDBOX_CHIME') {
      const app = (['PAYTM', 'PHONEPE', 'GPAY', 'BHIM'].includes(appName)) ? appName : 'PAYTM';
      decision = upiValidator.ingestAcousticChime({
        chimeId: `CHIME_${timeMs}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        sourceApp: app,
        amount: amt,
        timestamp: timeMs,
        confidence: Number(confidence) || 0.95
      });
    } else {
      const notif: ParsedUPINotification = {
        notificationId: `NOTIF_${timeMs}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        sourceApp: (['PAYTM', 'PHONEPE', 'GPAY', 'BANK_SMS'].includes(appName)) ? appName : 'PAYTM',
        amount: amt,
        refId: rrn || `UPI-${timeMs}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        payerName: req.body.payerName,
        rawText: rawText || '',
        receivedAt: timeMs
      };
      decision = upiValidator.ingestNotification(notif);
    }

    // Broadcast decision to UI
    broadcast({
      type: 'UPI_EVENT_RESOLVED',
      decision,
      timestamp: timeMs
    });

    res.json({
      ok: true,
      decision: decision || {
        status: 'CHIME_BUFFERED_WAITING_NOTIFICATION',
        amount: amt,
        rationale: 'Chime received; buffering for mutual notification match window (30s).'
      }
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || 'UPI event processing failed' });
  }
});

/**
 * 4. Night EOD Batch Reconciliation Pass
 * POST /api/vendor/eod/reconcile-batch
 */
vendorRouter.post('/eod/reconcile-batch', (req, res) => {
  try {
    const { closingPhysicalCash, openingFloat, knownCashExpenses } = req.body;

    const cCash = parseFloat(closingPhysicalCash);
    if (isNaN(cCash)) {
      return res.status(400).json({ ok: false, error: 'closingPhysicalCash is required' });
    }

    const oFloat = parseFloat(openingFloat) || 0;
    const kExpenses = parseFloat(knownCashExpenses) || 0;

    // Run the Night Qwen Batch Pass
    const report = qwenInterpreter.reconcileDayBatch({
      transcripts: shiftTranscripts,
      openingFloat: oFloat,
      closingPhysicalCash: cCash,
      knownCashExpenses: kExpenses
    });

    // Broadcast EOD Report over WebSocket
    broadcast({
      type: 'EOD_RECONCILIATION_REPORT',
      report
    });

    res.json({
      ok: true,
      report
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || 'EOD batch reconciliation failed' });
  }
});

/**
 * 5. Live Stall & CRDT State
 * GET /api/vendor/state
 */
/**
 * 5. Registered Shop Profile
 * GET /api/vendor/shop
 */
vendorRouter.get('/shop', (req, res) => {
  try {
    const db = getDb();
    const profile = db ? db.getShopProfile() : { shopName: 'Akash Chai & Poha Stall', entityId: 'stall_primary' };
    res.json({ ok: true, shopName: profile.shopName, entityId: profile.entityId });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * Update Shop Name
 * POST /api/vendor/shop
 */
vendorRouter.post('/shop', (req, res) => {
  try {
    const { shopName, entityId } = req.body;
    if (!shopName || typeof shopName !== 'string') {
      return res.status(400).json({ ok: false, error: 'shopName string is required' });
    }
    const db = getDb();
    if (db) {
      const result = db.setShopName(shopName, entityId);
      broadcast({ type: 'shop_updated', ...result });
      return res.json({ ok: true, ...result });
    }
    return res.json({ ok: true, shopName: shopName.trim(), entityId: entityId || 'stall_primary' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * 6. Live Stall & CRDT State
 * GET /api/vendor/state
 */
vendorRouter.get('/state', (req, res) => {
  try {
    const accounts = crdtLedger.getAllAccounts();
    const inventory = wholesaleManager.getAllInventory();
    const conservation = crdtLedger.verifyConservation();
    const db = getDb();
    const profile = db ? db.getShopProfile() : { shopName: 'Akash Chai & Poha Stall', entityId: 'stall_primary' };

    res.json({
      ok: true,
      shopName: profile.shopName,
      entityId: profile.entityId,
      balances: accounts,
      inventory,
      bufferedTurns: shiftTranscripts.length,
      doubleEntryZeroSumConserved: conservation.isConserved,
      netBalanceMinor: conservation.netBalanceMinor,
      epistemicState: 'CONSERVED_CANONICAL'
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// LEGACY BACKWARDS-COMPATIBILITY ENDPOINTS (Guarantees zero breaking changes)
// ============================================================================
const legacyParser = new LexiconParser();
const legacyRecipes = new RecipeTracker();
const legacyLoss = new LossEstimator();
const legacyLedger = new CrdtLedger('stall_primary');
const legacyFusion = new FusionBuffer();
const legacyProfit = new ProfitEngine();

vendorRouter.post('/utterance', (req, res) => {
  const { text, clock } = req.body;
  const evt = legacyParser.parse(text || '', clock || 1);
  const node = legacyLedger.addEvent(evt);
  const balances = legacyLedger.getBalances();

  res.json({ ok: true, event: evt, node, balances });
});

vendorRouter.post('/loss', (req, res) => {
  const { item, qty, unit, env } = req.body;
  const report = legacyLoss.estimate(
    item || 'tomato',
    qty || 4,
    unit || 'kg',
    env || { temp: 39, hrs: 7, hour: 14, devices: 2 }
  );

  res.json({ ok: true, report });
});

vendorRouter.post('/fuse', (req, res) => {
  const { kind, amount, text } = req.body;
  const fused = legacyFusion.push(kind, amount, text);

  if (fused) {
    legacyLedger.addEvent(fused);
  }

  res.json({
    ok: true,
    fused: !!fused,
    event: fused,
    pending: legacyFusion.pending().length
  });
});

vendorRouter.post('/sync', (req, res) => {
  const { nodes } = req.body;
  const result = legacyLedger.merge(nodes || []);
  const balances = legacyLedger.getBalances();

  res.json({
    ok: true,
    merged: result.count,
    clock: result.clock,
    balances,
    balanced: balances.balanced
  });
});

vendorRouter.post('/profit', (req, res) => {
  const { cash } = req.body;
  const resData = legacyProfit.calc(legacyLedger, cash || 2500);

  res.json({ ok: true, data: resData });
});
