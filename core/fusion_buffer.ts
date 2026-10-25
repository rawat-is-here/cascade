import { VendorEvent, TxPosting } from '../shared/types';

interface RawSignal {
  id: string;
  kind: 'speech' | 'sms' | 'paper';
  amount: number;
  text: string;
  ts: number;
  done: boolean;
}

export class FusionBuffer {
  queue: RawSignal[] = [];
  windowMs = 600000;

  push(kind: 'speech' | 'sms' | 'paper', amount: number, text: string): VendorEvent | null {
    const now = Date.now();
    const item: RawSignal = {
      id: 'sig_' + now + '_' + Math.random().toString(36).slice(2, 6),
      kind,
      amount,
      text,
      ts: now,
      done: false
    };

    this.queue = this.queue.filter(s => now - s.ts <= this.windowMs);

    const matchIdx = this.queue.findIndex(s => !s.done && s.amount === amount && s.kind !== kind);

    if (matchIdx !== -1) {
      const other = this.queue[matchIdx];
      other.done = true;
      item.done = true;

      const entries: TxPosting[] = [{
        debit: 'cash',
        credit: 'sales',
        amount,
        confidence: 0.98
      }];

      return {
        id: 'fused_' + other.id + '_' + item.id,
        type: 'sms',
        raw: other.text + ' + ' + item.text,
        entries,
        timestamp: now,
        clock: 0
      };
    }

    this.queue.push(item);
    return null;
  }

  pending() {
    return this.queue.filter(s => !s.done);
  }
}
