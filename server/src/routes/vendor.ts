import { Router } from 'express';
import { LexiconParser } from '../../../core/lexicon';
import { RecipeTracker } from '../../../core/recipe_inference';
import { LossEstimator } from '../../../core/loss_attribution';
import { CrdtLedger } from '../../../core/crdt_ledger';
import { FusionBuffer } from '../../../core/fusion_buffer';
import { ProfitEngine } from '../../../core/accrual_engine';

export const vendorRouter = Router();

const parser = new LexiconParser();
const recipes = new RecipeTracker();
const loss = new LossEstimator();
const ledger = new CrdtLedger('stall_primary');
const fusion = new FusionBuffer();
const profit = new ProfitEngine();

vendorRouter.post('/utterance', (req, res) => {
  const { text, clock } = req.body;
  const evt = parser.parse(text || '', clock || 1);
  const node = ledger.addEvent(evt);
  const balances = ledger.getBalances();

  res.json({
    ok: true,
    event: evt,
    node,
    balances
  });
});

vendorRouter.post('/loss', (req, res) => {
  const { item, qty, unit, env } = req.body;
  const report = loss.estimate(
    item || 'tomato',
    qty || 4,
    unit || 'kg',
    env || { temp: 39, hrs: 7, hour: 14, devices: 2 }
  );

  res.json({ ok: true, report });
});

vendorRouter.post('/fuse', (req, res) => {
  const { kind, amount, text } = req.body;
  const fused = fusion.push(kind, amount, text);

  if (fused) {
    ledger.addEvent(fused);
  }

  res.json({
    ok: true,
    fused: !!fused,
    event: fused,
    pending: fusion.pending().length
  });
});

vendorRouter.post('/sync', (req, res) => {
  const { nodes } = req.body;
  const result = ledger.merge(nodes || []);
  const balances = ledger.getBalances();

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
  const resData = profit.calc(ledger, cash || 2500);

  res.json({ ok: true, data: resData });
});
