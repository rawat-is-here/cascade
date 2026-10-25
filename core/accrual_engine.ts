import { CrdtLedger } from './crdt_ledger';
import { ProfitBounds } from '../shared/types';

export class ProfitEngine {
  calc(ledger: CrdtLedger, countedCash: number): ProfitBounds {
    const b = ledger.getBalances();

    const revenue = b.sales;
    const cogs = b.cogs;
    const loss = b.spoilage + b.theft;
    const debt = b.supplier;
    const unpaidCredit = b.credit;
    const personalDraw = b.personal;

    const net = revenue - cogs - loss - debt;
    const delta = Math.max(25, Math.round(net * 0.08));

    const min = Math.round(net - delta);
    const max = Math.round(net + delta);

    return {
      drawerCash: countedCash,
      revenue,
      cogs,
      debt,
      unpaidCredit,
      spoilageCost: loss,
      personalDraw,
      profitRange: [min, max],
      note: `Cash in hand is ₹${countedCash}, true accrual net is ₹${min} to ₹${max} (pending bills: ₹${debt}, uncollected credit: ₹${unpaidCredit}).`
    };
  }
}
