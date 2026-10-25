import { LexiconParser } from '../core/lexicon';
import { CrdtLedger } from '../core/crdt_ledger';
import { FusionBuffer } from '../core/fusion_buffer';
import { LossEstimator } from '../core/loss_attribution';
import { ProfitEngine } from '../core/accrual_engine';
import { VendorEvent } from '../shared/types';

function run() {
  console.log('Testing Invisible Worker modules...\n');

  // 1. parser
  const parser = new LexiconParser();
  const text = 'Bhai 3 kilo tamatar liya 180 mein… Sharma ji ka 40 jama kar, aur 7 plate poha de.';
  const evt = parser.parse(text, 1);
  console.log('1. Parsed entries:', evt.entries.length);
  if (evt.entries.length !== 3) throw new Error('Expected 3 parsed entries');

  // 2. crdt ledger
  const ledger = new CrdtLedger('dev1');
  ledger.addEvent(evt);
  const bal = ledger.getBalances();
  console.log('2. Double-entry balanced:', bal.balanced, `(diff: ${bal.diff})`);
  if (!bal.balanced) throw new Error('Ledger out of balance');

  // 3. 1970 clock reset test
  const deadPhoneEvent: VendorEvent = {
    id: 'evt_dead_clock',
    type: 'speech',
    raw: 'Chai 5 cup bechi 50 rupaye mein',
    timestamp: 0,
    clock: 2,
    entries: [{
      debit: 'cash',
      credit: 'sales',
      amount: 50,
      confidence: 0.95
    }]
  };

  const sync = ledger.merge([{
    nodeId: 'dev_son_reset',
    clock: 2,
    parents: [ledger.getAll()[0].hash],
    hash: 'hash_1970_test',
    event: deadPhoneEvent
  }]);
  console.log('3. Merged 1970 node:', sync.count > 0, '| Balances valid:', ledger.getBalances().balanced);

  // 4. fusion buffer
  const buf = new FusionBuffer();
  buf.push('speech', 140, '7 plate poha 140 online');
  const fused = buf.push('sms', 140, 'Paytm 140 chime');
  console.log('4. Fused complementary signals:', !!fused);
  if (!fused) throw new Error('Failed to fuse signals');

  // 5. loss estimate
  const loss = new LossEstimator();
  const report = loss.estimate('tomato', 4, 'kg', { temp: 39, hrs: 7, hour: 14, devices: 2 });
  console.log('5. Spoilage estimate:', report.spoilage, '| Eating:', report.eating, '| Theft:', report.theft);

  // 6. profit engine
  const profit = new ProfitEngine();
  const p = profit.calc(ledger, 2500);
  console.log('6. True profit range:', p.profitRange);

  console.log('\nAll checks passed!');
}

run();
