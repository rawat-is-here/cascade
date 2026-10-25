import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  assertHlcTuple,
  compareHlc,
  CurrencyCode,
  DeviceId,
  EntityInput,
  EntityRow,
  HlcTuple,
  LedgerEntryInput,
  LedgerEntryRow,
  ResolvedEntityRow,
  ResolvedInventoryRow,
  ResolvedLedgerRow,
} from './dbTypes';

export interface DatabaseOptions {
  readonly filename?: string;
  readonly deviceId: DeviceId;
}

interface HlcState {
  wall: number;
  logical: number;
}

const REQUIRED_SCHEMA_OBJECTS = [
  'entities', 'raw_evidence', 'ledger_entries', 'inventory_state',
  'resolved_entities', 'resolved_ledger', 'resolved_inventory',
] as const;

const schemaPath = join(__dirname, 'init_db.sql');

export class ProbabilisticLedgerDatabase {
  private readonly connection: Database.Database;
  private hlcState: HlcState = { wall: 0, logical: 0 };

  private constructor(connection: Database.Database, private readonly deviceId: DeviceId) {
    this.connection = connection;
  }

  static open(options: DatabaseOptions): ProbabilisticLedgerDatabase {
    const filename = options.filename ?? join(process.cwd(), 'data', 'cascade.sqlite');
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });

    const connection = new Database(filename);
    const database = new ProbabilisticLedgerDatabase(connection, options.deviceId);
    try {
      database.initialize();
      return database;
    } catch (error) {
      connection.close();
      throw error;
    }
  }

  private initialize(): void {
    if (!existsSync(schemaPath)) throw new Error(`Bundled canonical initializer is missing: ${schemaPath}`);
    this.connection.exec(readFileSync(schemaPath, 'utf8'));
    this.connection.pragma('foreign_keys = ON');
    if (this.connection.pragma('foreign_keys', { simple: true }) !== 1) throw new Error('SQLite foreign keys are not enabled');
    const found = this.connection.prepare(`SELECT name FROM sqlite_master WHERE name IN (${REQUIRED_SCHEMA_OBJECTS.map(() => '?').join(',')})`).all(...REQUIRED_SCHEMA_OBJECTS) as Array<{ name: string }>;
    if (found.length !== REQUIRED_SCHEMA_OBJECTS.length) throw new Error('SQLite initialization did not create the required schema objects');
  }

  close(): void {
    this.connection.close();
  }

  nextHlc(now = Date.now()): HlcTuple {
    const wall = Math.max(now, this.hlcState.wall);
    this.hlcState = wall === this.hlcState.wall
      ? { wall, logical: this.hlcState.logical + 1 }
      : { wall, logical: 0 };
    return assertHlcTuple({ hlc_wall_ms: this.hlcState.wall, hlc_logical: this.hlcState.logical, device_id: this.deviceId });
  }

  observeHlc(remote: HlcTuple, now = Date.now()): void {
    const received = assertHlcTuple(remote);
    const wall = Math.max(now, this.hlcState.wall, received.hlc_wall_ms);
    const logical = wall === this.hlcState.wall && wall === received.hlc_wall_ms
      ? Math.max(this.hlcState.logical, received.hlc_logical) + 1
      : wall === this.hlcState.wall ? this.hlcState.logical + 1
      : wall === received.hlc_wall_ms ? received.hlc_logical + 1
      : 0;
    this.hlcState = { wall, logical };
  }

  getResolvedEntity(entityId: string): ResolvedEntityRow | undefined {
    return this.connection.prepare('SELECT * FROM resolved_entities WHERE entity_id = ?').get(entityId) as ResolvedEntityRow | undefined;
  }

  listResolvedEntities(): readonly ResolvedEntityRow[] {
    return this.connection.prepare('SELECT * FROM resolved_entities ORDER BY canonical_name COLLATE NOCASE, entity_id').all() as ResolvedEntityRow[];
  }

  getResolvedLedger(entryId: string): ResolvedLedgerRow | undefined {
    return this.connection.prepare('SELECT * FROM resolved_ledger WHERE entry_id = ?').get(entryId) as ResolvedLedgerRow | undefined;
  }

  listResolvedInventory(): readonly ResolvedInventoryRow[] {
    return this.connection.prepare('SELECT * FROM resolved_inventory ORDER BY sku COLLATE NOCASE, location_code, inventory_id').all() as ResolvedInventoryRow[];
  }

  upsertEntity(input: EntityInput): boolean {
    const hlc = assertHlcTuple(input.hlc);
    const result = this.connection.prepare(`
      INSERT INTO entities (entity_id, canonical_name, entity_type, aliases_json, notes, hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted)
      VALUES (@entity_id, @canonical_name, @entity_type, @aliases_json, @notes, @hlc_wall_ms, @hlc_logical, @device_id, @updated_at, @is_deleted)
      ON CONFLICT(entity_id) DO UPDATE SET
        canonical_name = excluded.canonical_name, entity_type = excluded.entity_type, aliases_json = excluded.aliases_json, notes = excluded.notes,
        hlc_wall_ms = excluded.hlc_wall_ms, hlc_logical = excluded.hlc_logical, device_id = excluded.device_id,
        updated_at = excluded.updated_at, is_deleted = excluded.is_deleted
      WHERE excluded.hlc_wall_ms > entities.hlc_wall_ms
         OR (excluded.hlc_wall_ms = entities.hlc_wall_ms AND excluded.hlc_logical > entities.hlc_logical)
         OR (excluded.hlc_wall_ms = entities.hlc_wall_ms AND excluded.hlc_logical = entities.hlc_logical AND excluded.device_id > entities.device_id)
    `).run({
      entity_id: input.entity_id, canonical_name: input.canonical_name, entity_type: input.entity_type,
      aliases_json: JSON.stringify(input.aliases), notes: input.notes ?? null,
      ...hlc, updated_at: hlc.hlc_wall_ms, is_deleted: input.is_deleted ?? 0,
    });
    this.observeHlc(hlc);
    return result.changes === 1;
  }

  insertLedgerEntry(input: LedgerEntryInput): boolean {
    const hlc = assertHlcTuple(input.hlc);
    const result = this.connection.prepare(`
      INSERT INTO ledger_entries (entry_id, occurred_at, debit_account, credit_account, amount_minor, currency_code, counterparty_entity_id, evidence_id, memo, hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted)
      VALUES (@entry_id, @occurred_at, @debit_account, @credit_account, @amount_minor, @currency_code, @counterparty_entity_id, @evidence_id, @memo, @hlc_wall_ms, @hlc_logical, @device_id, @updated_at, @is_deleted)
      ON CONFLICT(entry_id) DO UPDATE SET
        occurred_at = excluded.occurred_at, debit_account = excluded.debit_account, credit_account = excluded.credit_account,
        amount_minor = excluded.amount_minor, currency_code = excluded.currency_code, counterparty_entity_id = excluded.counterparty_entity_id,
        evidence_id = excluded.evidence_id, memo = excluded.memo, hlc_wall_ms = excluded.hlc_wall_ms,
        hlc_logical = excluded.hlc_logical, device_id = excluded.device_id, updated_at = excluded.updated_at, is_deleted = excluded.is_deleted
      WHERE excluded.hlc_wall_ms > ledger_entries.hlc_wall_ms
         OR (excluded.hlc_wall_ms = ledger_entries.hlc_wall_ms AND excluded.hlc_logical > ledger_entries.hlc_logical)
         OR (excluded.hlc_wall_ms = ledger_entries.hlc_wall_ms AND excluded.hlc_logical = ledger_entries.hlc_logical AND excluded.device_id > ledger_entries.device_id)
    `).run({
      ...input, currency_code: input.currency_code ?? ('INR' as CurrencyCode), counterparty_entity_id: input.counterparty_entity_id ?? null,
      evidence_id: input.evidence_id ?? null, memo: input.memo ?? null, ...hlc, updated_at: hlc.hlc_wall_ms, is_deleted: input.is_deleted ?? 0,
    });
    this.observeHlc(hlc);
    return result.changes === 1;
  }

  transaction<T>(operation: () => T): T {
    return this.connection.transaction(operation)();
  }

  isStrictlyNewer(candidate: HlcTuple, stored: HlcTuple): boolean {
    return compareHlc(candidate, stored) > 0;
  }
}

let singleton: ProbabilisticLedgerDatabase | undefined;

export function initializeDatabase(): ProbabilisticLedgerDatabase {
  if (!singleton) {
    const configuredDeviceId = process.env.DEVICE_ID?.trim() || 'server';
    singleton = ProbabilisticLedgerDatabase.open({
      filename: process.env.DATABASE_PATH,
      deviceId: configuredDeviceId as DeviceId,
    });
  }
  return singleton;
}
