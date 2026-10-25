import { AuditRecord, StateStore } from './schema';
import { DataPayload, EngineResult } from '../../../shared/types';

/**
 * Aryan's Database & Persistence Layer
 * Provides high-speed in-memory caching with append-only causal audit ledger.
 */
export class LedgerStorage {
  private store: StateStore = {
    records: new Map(),
    logicalClock: 0
  };

  public save(payload: DataPayload, result: EngineResult): AuditRecord {
    this.store.logicalClock++;
    const record: AuditRecord = {
      id: `rec-${Date.now()}-${this.store.logicalClock}`,
      createdAt: Date.now(),
      payload,
      result,
      committedState: result.abstained ? 'ABSTAINED' : 'COMMITTED'
    };

    this.store.records.set(record.id, record);
    return record;
  }

  public getAll(): AuditRecord[] {
    return Array.from(this.store.records.values());
  }

  public getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      committed: all.filter(r => r.committedState === 'COMMITTED').length,
      abstained: all.filter(r => r.committedState === 'ABSTAINED').length,
      latestLogicalClock: this.store.logicalClock
    };
  }
}
