import { VendorEvent } from '../../../shared/types';

export interface AuditRecord {
  id: string;
  ts: number;
  event: VendorEvent;
  status: 'ok' | 'ignored';
}

export class LedgerStorage {
  records: Map<string, AuditRecord> = new Map();
  clock = 0;

  save(event: VendorEvent): AuditRecord {
    this.clock++;
    const rec: AuditRecord = {
      id: 'rec_' + Date.now() + '_' + this.clock,
      ts: Date.now(),
      event,
      status: 'ok'
    };

    this.records.set(rec.id, rec);
    return rec;
  }

  all() {
    return Array.from(this.records.values());
  }

  stats() {
    const list = this.all();
    return {
      total: list.length,
      clock: this.clock
    };
  }
}
