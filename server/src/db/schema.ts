import { DataPayload, EngineResult } from '../../../shared/types';

export interface AuditRecord {
  id: string;
  createdAt: number;
  payload: DataPayload;
  result: EngineResult;
  committedState: 'COMMITTED' | 'ABSTAINED' | 'REJECTED';
}

export interface StateStore {
  records: Map<string, AuditRecord>;
  logicalClock: number;
}
