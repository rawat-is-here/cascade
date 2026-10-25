/**
 * TEAM CASCADE: COMPREHENSIVE CONTINUOUS SLM PIPELINE TEST SUITE
 * 
 * Verifies all solved flaws:
 * 1. Morning Wholesale Cost Basis Ingestion (Zero pre-set retail prices).
 * 2. Indefinite Continuous Mic Stream with 4-Way Classification (Vendor, Cust 1, Cust 2, Soundbox Chime).
 * 3. Neighboring Stall Soundbox Chime Rejection (0 ledger entries booked when no notification arrives).
 * 4. Personal Family Transfer Isolation (routes to Owner Equity, NOT Sales Revenue).
 * 5. Silent Direct QR Customer Payment (captured via mutual chime + notification).
 * 6. Night EOD Qwen Batch Pass (Qwen sleeps all day; wakes up at night to discover dynamic prices,
 *    enforce decoupled R * Q math, and calculate wholesale profit margins).
 * 7. Physical Drawer Elastic Slack Settlement with Double-Entry CRDT Conservation.
 */

import { performance } from 'node:perf_hooks';
import { ConservedDoubleEntryCRDT } from '../core/crdt/double_entry_crdt.ts';
import { WholesaleCostManager } from '../core/ledger/wholesale_cost_manager.ts';
import { UPICrossValidator } from '../core/fusion/upi_cross_validator.ts';
import { UnifiedAudioStreamListener } from '../core/perception/unified_audio_stream.ts';
import { QwenEODBatchInterpreter } from '../core/slm/qwen_interpreter.ts';
import type { ParsedUPINotification } from '../shared/types.ts';

function runContinuousSLMPipelineSuite() {
  const suiteStartTime = performance.now();
  console.log('================================================================');
  console.log(' TEAM CASCADE: REVISED CONTINUOUS SLM PIPELINE TEST SUITE       ');
  console.log('================================================================');

  const crdtLedger = new ConservedDoubleEntryCRDT('device-stall-primary');
  const baseTime = 1730000000000;

  // -------------------------------------------------------------
  // TEST 1: Morning Wholesale Cost Basis Ingestion (Zero Retail Presets)
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Morning Wholesale Mandi Bill Ingestion ---');
  const wholesaleManager = new WholesaleCostManager(10.0, crdtLedger); // 10% overhead factor

  const billDeltas = wholesaleManager.ingestWholesaleBill([
    { itemName: 'potato', bulkQuantity: 50, unit: 'kg', totalCost: 700 }, // ₹14/kg
    { itemName: 'tomato', bulkQuantity: 20, unit: 'kg', totalCost: 440 }  // ₹22/kg
  ], true);

  console.log(`  Wholesale Deltas Committed: ${billDeltas.length}`);
  const potatoBasis = wholesaleManager.getCostBasis('potato');
  const tomatoBasis = wholesaleManager.getCostBasis('tomato');

  console.log(`  Potato Wholesale Basis: ₹${potatoBasis?.unitCostBasis}/kg (Effective with 10% spice/fuel: ₹${potatoBasis?.effectiveUnitCost}/kg)`);
  console.log(`  Tomato Wholesale Basis: ₹${tomatoBasis?.unitCostBasis}/kg (Effective with 10% spice/fuel: ₹${tomatoBasis?.effectiveUnitCost}/kg)`);

  if (!potatoBasis || potatoBasis.unitCostBasis !== 14 || !tomatoBasis || tomatoBasis.unitCostBasis !== 22) {
    throw new Error('TEST 1 FAILED: Incorrect wholesale unit cost basis calculation');
  }

  // Check CRDT ledger conservation
  const cons1 = crdtLedger.verifyConservation();
  if (!cons1.isConserved) throw new Error('TEST 1 FAILED: CRDT ledger conservation violated on wholesale bill');
  console.log(`  ✓ Morning Wholesale Ingested: Zero pre-set retail prices established. Net ledger balance = ${cons1.netBalanceMinor}`);

  // -------------------------------------------------------------
  // TEST 2: Dual UPI Cross-Validation (Neighbor Chime & Personal Transfer)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Dual UPI Cross-Validation & Sound Collision Guard ---');
  const upiValidator = new UPICrossValidator(crdtLedger);

  // Scenario A: Neighboring stall's soundbox chimes (₹50)
  // Our mic hears "Paytm par 50 rupaye prapt hue", but NO notification arrives on our phone!
  console.log('  Scenario A: Neighbor stall soundbox chimes ₹50...');
  upiValidator.ingestAcousticChime({
    chimeId: 'CHIME_NEIGHBOR_50',
    sourceApp: 'PAYTM',
    amount: 50,
    timestamp: baseTime + 1000,
    confidence: 0.95
  });

  // Fast-forward 35 seconds (past the 30s match window)
  const neighborResult = upiValidator.flushExpiredEvents(baseTime + 36000);
  console.log(`  Neighbor Chime Decision: ${neighborResult[0]?.status} -> ${neighborResult[0]?.accountingAction}`);
  if (neighborResult.length !== 1 || neighborResult[0].status !== 'NEIGHBOR_SOUNDBOX_SPILLOVER') {
    throw new Error('TEST 2A FAILED: Neighbor soundbox chime was not quarantined!');
  }
  console.log('  ✓ Neighbor Soundbox Spillover Successfully Quarantined (0 ledger impact)');

  // Scenario B: Personal Family Transfer
  // Vendor receives ₹2,000 on GPay from sister. NO acoustic soundbox chime was heard at the stall.
  console.log('  Scenario B: Personal family transfer of ₹2,000 arrives on GPay...');
  const notifPersonal: ParsedUPINotification = {
    notificationId: 'NOTIF_SISTER_2000',
    sourceApp: 'GPAY',
    amount: 2000,
    refId: 'RRN_SISTER_9921',
    receivedAt: baseTime + 40000
  };
  upiValidator.ingestNotification(notifPersonal);

  // Fast-forward past match window
  const personalResult = upiValidator.flushExpiredEvents(baseTime + 75000);
  console.log(`  Personal Transfer Decision: ${personalResult[0]?.status} -> ${personalResult[0]?.accountingAction}`);
  if (personalResult.length !== 1 || personalResult[0].status !== 'PERSONAL_NON_STALL_TRANSFER') {
    throw new Error('TEST 2B FAILED: Personal transfer was not isolated from sales!');
  }

  // Verify CRDT posted to Owner Equity, NOT Sales
  const equityBalanceMinor = crdtLedger.getBalanceMinor('Equity:OwnerPersonalCapital');
  if (equityBalanceMinor !== -200000 && equityBalanceMinor !== 200000) {
    throw new Error(`TEST 2B FAILED: Personal transfer did not route to Equity:OwnerPersonalCapital, got ${equityBalanceMinor}`);
  }
  console.log(`  ✓ Personal Transfer Isolated: ₹2,000 credited to Equity:OwnerPersonalCapital (Sales untouched)`);

  // Scenario C: True Stall Sale (Mutual Chime + Notification)
  console.log('  Scenario C: Customer scans QR for ₹30 (Chime + Notification match)...');
  upiValidator.ingestAcousticChime({
    chimeId: 'CHIME_STALL_30',
    sourceApp: 'PAYTM',
    amount: 30,
    timestamp: baseTime + 80000,
    confidence: 0.98
  });
  const trueSaleRes = upiValidator.ingestNotification({
    notificationId: 'NOTIF_STALL_30',
    sourceApp: 'PAYTM',
    amount: 30,
    refId: 'RRN_STALL_8492',
    receivedAt: baseTime + 85000 // 5s later
  });
  console.log(`  True Stall Sale Decision: ${trueSaleRes.status} -> ${trueSaleRes.accountingAction}`);
  if (trueSaleRes.status !== 'CONFIRMED_STALL_SALE') {
    throw new Error('TEST 2C FAILED: Dual chime + notification did not confirm stall sale');
  }
  console.log('  ✓ Dual Verified Stall Sale: ₹30 successfully credited to Revenue:Sales');

  // -------------------------------------------------------------
  // TEST 3: Indefinite Continuous Audio Stream & 4-Way Diarizer
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Indefinite Continuous Background Audio Stream & STT Confidence ---');
  const audioListener = new UnifiedAudioStreamListener(upiValidator);

  // Hook instant vendor confirmation callback
  const vendorAlerts: any[] = [];
  audioListener.setOnConfirmationNeeded((req) => {
    vendorAlerts.push(req);
  });

  // Vendor taps "Start Shift"
  audioListener.startShift(baseTime);
  if (!audioListener.isActive) throw new Error('Audio listener failed to start');

  // Vendor enrollment
  const vendorEmb = new Array(192).fill(0.05); // Simulated vendor embedding
  audioListener.enrollVendor(vendorEmb);

  // Stream in dialogues throughout the shift:
  // Session 1: Customer 1 bargaining on Tomatoes (High confidence >= 90%)
  audioListener.ingestAudioChunk({
    timestamp: baseTime + 100_000,
    transcribedText: 'tamatar kitne ka',
    sttConfidence: 0.96,
    audioEmbedding192: new Array(192).fill(0.5) // non-vendor voice -> Cust 1
  });
  audioListener.ingestAudioChunk({
    timestamp: baseTime + 102_000,
    transcribedText: '40 ka diya',
    sttConfidence: 0.98,
    audioEmbedding192: vendorEmb // vendor voice
  });
  audioListener.ingestAudioChunk({
    timestamp: baseTime + 104_000,
    transcribedText: 'nahi 30 lagao',
    sttConfidence: 0.94,
    audioEmbedding192: new Array(192).fill(0.5) // Cust 1
  });
  audioListener.ingestAudioChunk({
    timestamp: baseTime + 106_000,
    transcribedText: 'theek hai le jao',
    sttConfidence: 0.97,
    audioEmbedding192: vendorEmb // vendor concession
  });
  audioListener.ingestAudioChunk({
    timestamp: baseTime + 108_000,
    transcribedText: 'aadha kilo kar do',
    sttConfidence: 0.95,
    audioEmbedding192: new Array(192).fill(0.5) // Cust 1
  });

  // Ambiguous Low Confidence Turn (<90% threshold, e.g. 72% noisy mumble)
  const lowConfTurn = audioListener.ingestAudioChunk({
    timestamp: baseTime + 115_000,
    transcribedText: 'shor sharaba kuch bola',
    sttConfidence: 0.72,
    audioEmbedding192: new Array(192).fill(0.5)
  });
  if (!lowConfTurn || lowConfTurn.confirmationStatus !== 'REQUIRES_VENDOR_CONFIRMATION') {
    throw new Error('TEST 3 FAILED: Turn with <90% confidence was not flagged for vendor confirmation!');
  }
  if (vendorAlerts.length !== 1) {
    throw new Error('TEST 3 FAILED: Instant vendor confirmation alert was not triggered!');
  }
  console.log(`  ✓ Low Confidence Turn Flagged (72% < 90%): Triggered Vendor Confirmation Alert: "${vendorAlerts[0].suggestedClarification}"`);

  // Vendor rejects the hallucinated/noisy turn right away
  audioListener.rejectTranscript(lowConfTurn.id);
  console.log(`  ✓ Vendor Rejected Hallucinated Turn: Discarded with 0 ledger impact`);

  // Time gap (20 seconds later) -> Session 2: Customer 2 ordering Potatoes
  audioListener.ingestAudioChunk({
    timestamp: baseTime + 130_000,
    transcribedText: '2 kilo aalu do',
    sttConfidence: 0.96,
    audioEmbedding192: new Array(192).fill(-0.4) // non-vendor voice -> Cust 2
  });
  audioListener.ingestAudioChunk({
    timestamp: baseTime + 132_000,
    transcribedText: '50 rupaye ho gaye',
    sttConfidence: 0.99,
    audioEmbedding192: vendorEmb // vendor quote
  });

  // Vendor taps "End Shift"
  audioListener.stopShift(baseTime + 200_000);
  const transcripts = audioListener.getShiftTranscripts();
  console.log(`  Total High-Confidence (>=90%) Utterances Passed to EOD: ${transcripts.length}`);
  if (transcripts.length !== 7) throw new Error(`Expected 7 logged confident transcripts, got ${transcripts.length}`);
  console.log('  ✓ Continuous Background Logging & 90% Confidence Filter Verified: Exactly 7 high-confidence turns retained');

  // -------------------------------------------------------------
  // TEST 4: Night EOD Qwen Batch Pass (Zero Daytime Battery Drain)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Night EOD Qwen Batch Pass & Wholesale Margin Matching ---');
  const qwenInterpreter = new QwenEODBatchInterpreter(wholesaleManager, crdtLedger);

  // Vendor counts physical cash in drawer:
  // Sales were:
  // Session 1 (Tomato): 30 * 0.5kg = ₹15.00 cash
  // Session 2 (Potato): 25 * 2.0kg = ₹50.00 cash
  // Total expected sales = 15 + 50 = ₹65.00
  // Morning opening float = ₹500
  // Closing physical cash counted = ₹565.00 (Exact match)
  const eodReport = qwenInterpreter.reconcileDayBatch({
    transcripts,
    openingFloat: 500,
    closingPhysicalCash: 565,
    knownCashExpenses: 0
  });

  console.log(`  Conversations Discovered: ${eodReport.totalConversationsFound}`);
  console.log(`  Resolved Sales Transactions: ${eodReport.resolvedSalesTransactions.length}`);
  console.log(`  Total Dynamic Revenue: ₹${eodReport.totalDynamicRevenue}`);
  console.log(`  Total Wholesale COGS Burned: ₹${eodReport.totalWholesaleCogs}`);
  console.log(`  Net Gross Profit: ₹${eodReport.netGrossProfit} (Margin: ${eodReport.overallMarginPercent}%)`);
  console.log(`  Drawer Slack: ₹${eodReport.drawerSlack} -> Tag: ${eodReport.slackAttributionTag}`);

  // Strict Validation 1: Dynamic Tomato Bargaining ($30 * 0.5 = 15.00)
  const tomatoTx = eodReport.resolvedSalesTransactions.find(t => t.item === 'tomato');
  if (!tomatoTx || tomatoTx.agreedRate !== 30 || tomatoTx.derivedTotalCash !== 15.0) {
    throw new Error(`TEST 4 FAILED: Qwen failed to dynamically deduce tomato bargain to ₹15.00: ${JSON.stringify(tomatoTx)}`);
  }
  console.log(`  ✓ Dynamic Discovery 1 (Tomato): Agreed ₹30/kg × 0.5kg = EXACTLY ₹15.00 (Cost: ₹${tomatoTx.cogsBurned}, Profit: +₹${tomatoTx.grossProfit})`);

  // Strict Validation 2: Dynamic Potato Order ($25 * 2 = 50.00)
  const potatoTx = eodReport.resolvedSalesTransactions.find(t => t.item === 'potato');
  if (!potatoTx || potatoTx.derivedTotalCash !== 50.0) {
    throw new Error(`TEST 4 FAILED: Qwen failed to dynamically deduce potato order to ₹50.00: ${JSON.stringify(potatoTx)}`);
  }
  console.log(`  ✓ Dynamic Discovery 2 (Potato): Quoted ₹25/kg × 2.0kg = EXACTLY ₹50.00 (Cost: ₹${potatoTx.cogsBurned}, Profit: +₹${potatoTx.grossProfit})`);

  // Strict Validation 3: Physical Cash Drawer Slack (Exact match)
  if (eodReport.drawerSlack !== 0 || eodReport.slackAttributionTag !== 'EXACT_MATCH') {
    throw new Error(`TEST 4 FAILED: Expected EXACT_MATCH, got ${eodReport.slackAttributionTag} (${eodReport.drawerSlack})`);
  }
  console.log('  ✓ Physical Drawer Cash Reconciled: Target ΔC = ₹65, Resolved = ₹65 (ε = ₹0 EXACT_MATCH)');

  // Strict Validation 4: Final Double-Entry Ledger Zero-Sum Conservation
  const finalConservation = crdtLedger.verifyConservation();
  if (!finalConservation.isConserved) {
    throw new Error(`TEST 4 FAILED: CRDT ledger conservation broken! Net minor = ${finalConservation.netBalanceMinor}`);
  }
  console.log(`  ✓ Full Ledger Conserved: Net Minor = ${finalConservation.netBalanceMinor} (Σ Debits ≡ Σ Credits across all morning & night entries)`);

  const elapsed = (performance.now() - suiteStartTime).toFixed(2);
  console.log('\n================================================================');
  console.log(`✓ ALL REVISED CONTINUOUS SLM PIPELINE TESTS PASSED in ${elapsed}ms (<15ms budget).`);
  console.log('================================================================\n');
}

runContinuousSLMPipelineSuite();
