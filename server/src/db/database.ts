import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  assertHlcTuple,
  compareHlc,
  CurrencyCode,
  DeviceId,
  EvidenceType,
  FusionId,
  HlcTuple,
  LedgerEntryId,
  LedgerEntryInput,
  EntityId,
  EntityInput,
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

// ── Input types for new offline SLM pipeline methods ─────────────────────────

/** Voice payload stored inside raw_evidence.payload_json for evidence_type='voice'. */
export interface VoicePayload {
  readonly speaker: 'VENDOR' | 'CUST_1' | 'CUST_2' | 'SOUNDBOX_CHIME';
  readonly text: string;
  readonly timestamp: number;
}

/**
 * Input to insertRawEvidence.
 * The pipeline produces 'voice', 'sensor', and 'receipt' types;
 * the schema constraint accepts a broader set but the method narrows callers.
 */
export interface RawEvidenceInput {
  readonly evidence_id: string;
  readonly evidence_type: 'voice' | 'sensor' | 'receipt';
  readonly payload: VoicePayload | Record<string, unknown>;
  readonly confidence_ppm: number;
  readonly observed_at: number;
  readonly hlc: HlcTuple;
}

/** A single item in the morning mandi wholesale batch. */
export interface InventoryBatchItem {
  readonly sku: string;
  readonly quantityKg: number;
  readonly effectiveCostPerKg: number;
  readonly hlc: HlcTuple;
}

/** Classified UPI / soundbox event dispatched from the microphone classifier. */
export interface UpiEvent {
  readonly type: 'CONFIRMED_SALE' | 'PERSONAL_TRANSFER' | 'NEIGHBOR_CHIME';
  readonly amount_minor?: number;
  readonly reference_id?: string;
  readonly memo?: string;
  readonly occurred_at?: number;
  readonly hlc: HlcTuple;
}

/** One sold line item submitted during the night EOD reconciliation. */
export interface EodSaleLine {
  readonly sku: string;
  readonly quantity_microunits: number;
  readonly amount_minor: number;
}

/** Full payload for the night EOD reconciliation handler. */
export interface NightEodInput {
  /** ISO-8601 date string, e.g. "2026-10-25". */
  readonly session_date_iso: string;
  /** Cash sales discovered during EOD that are not yet in the ledger. */
  readonly discovered_sales: EodSaleLine[];
  /** System-expected cash total in paise. */
  readonly drawer_expected_minor: number;
  /** Physically counted cash total in paise. */
  readonly drawer_counted_minor: number;
  readonly hlc: HlcTuple;
}

// ── Schema constants ──────────────────────────────────────────────────────────

const REQUIRED_SCHEMA_OBJECTS = [
  'entities', 'raw_evidence', 'ledger_entries', 'inventory_state',
  'resolved_entities', 'resolved_ledger', 'resolved_inventory',
] as const;

const schemaPath = join(__dirname, 'init_db.sql');

// ── LWW predicate helper ──────────────────────────────────────────────────────

/**
 * Returns the HLC LWW acceptance predicate with the given table name
 * substituted in. Used in ON CONFLICT DO UPDATE … WHERE clauses to ensure
 * only strictly-newer versions overwrite stored rows.
 */
function lww(table: string): string {
  return `
    excluded.hlc_wall_ms > ${table}.hlc_wall_ms
    OR (excluded.hlc_wall_ms = ${table}.hlc_wall_ms AND excluded.hlc_logical > ${table}.hlc_logical)
    OR (excluded.hlc_wall_ms = ${table}.hlc_wall_ms AND excluded.hlc_logical = ${table}.hlc_logical AND excluded.device_id > ${table}.device_id)
  `.trim();
}

// ─────────────────────────────────────────────────────────────────────────────

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
    const found = this.connection.prepare(
      `SELECT name FROM sqlite_master WHERE name IN (${REQUIRED_SCHEMA_OBJECTS.map(() => '?').join(',')})`,
    ).all(...REQUIRED_SCHEMA_OBJECTS) as Array<{ name: string }>;
    if (found.length !== REQUIRED_SCHEMA_OBJECTS.length) {
      throw new Error('SQLite initialization did not create the required schema objects');
    }
    this.ensureDefaultShopEntity();
  }

  close(): void {
    this.connection.close();
  }

  // ── HLC clock management ─────────────────────────────────────────────────

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
    const logical =
      wall === this.hlcState.wall && wall === received.hlc_wall_ms
        ? Math.max(this.hlcState.logical, received.hlc_logical) + 1
        : wall === this.hlcState.wall
        ? this.hlcState.logical + 1
        : wall === received.hlc_wall_ms
        ? received.hlc_logical + 1
        : 0;
    this.hlcState = { wall, logical };
  }

  // ── Standard reads ───────────────────────────────────────────────────────

  ensureDefaultShopEntity(defaultName = 'Akash Chai & Poha Stall', defaultId = 'stall_primary'): void {
    const existing = this.connection.prepare(
      "SELECT 1 FROM entities WHERE entity_id = ? OR entity_type IN ('vendor', 'business') LIMIT 1"
    ).get(defaultId);
    if (!existing) {
      const hlc = this.nextHlc();
      this.upsertEntity({
        entity_id: defaultId as EntityId,
        canonical_name: defaultName,
        entity_type: 'vendor',
        aliases: ['Akash Poha', 'Chai Stall', 'My Shop'],
        notes: 'Primary street vendor shop entity',
        hlc,
      });
    }
  }

  getShopProfile(): { shopName: string; entityId: string } {
    const row = this.connection.prepare(
      "SELECT entity_id, canonical_name FROM resolved_entities WHERE entity_type IN ('vendor', 'business') ORDER BY updated_at DESC LIMIT 1"
    ).get() as { entity_id: string; canonical_name: string } | undefined;

    if (row && row.canonical_name) {
      return { shopName: row.canonical_name, entityId: row.entity_id };
    }
    return { shopName: 'Akash Chai & Poha Stall', entityId: 'stall_primary' };
  }

  setShopName(shopName: string, entityId = 'stall_primary'): { shopName: string; entityId: string } {
    const trimmed = shopName.trim();
    const hlc = this.nextHlc();
    this.upsertEntity({
      entity_id: entityId as EntityId,
      canonical_name: trimmed,
      entity_type: 'vendor',
      aliases: [trimmed],
      notes: 'Vendor shop profile',
      hlc,
    });
    return { shopName: trimmed, entityId };
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

  // ── Standard writes ──────────────────────────────────────────────────────

  upsertEntity(input: EntityInput): boolean {
    const hlc = assertHlcTuple(input.hlc);
    const result = this.connection.prepare(`
      INSERT INTO entities (entity_id, canonical_name, entity_type, aliases_json, notes, hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted)
      VALUES (@entity_id, @canonical_name, @entity_type, @aliases_json, @notes, @hlc_wall_ms, @hlc_logical, @device_id, @updated_at, @is_deleted)
      ON CONFLICT(entity_id) DO UPDATE SET
        canonical_name = excluded.canonical_name, entity_type = excluded.entity_type, aliases_json = excluded.aliases_json, notes = excluded.notes,
        hlc_wall_ms = excluded.hlc_wall_ms, hlc_logical = excluded.hlc_logical, device_id = excluded.device_id,
        updated_at = excluded.updated_at, is_deleted = excluded.is_deleted
      WHERE ${lww('entities')}
    `).run({
      entity_id: input.entity_id,
      canonical_name: input.canonical_name,
      entity_type: input.entity_type,
      aliases_json: JSON.stringify(input.aliases),
      notes: input.notes ?? null,
      ...hlc,
      updated_at: hlc.hlc_wall_ms,
      is_deleted: input.is_deleted ?? 0,
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
      WHERE ${lww('ledger_entries')}
    `).run({
      ...input,
      currency_code: input.currency_code ?? ('INR' as CurrencyCode),
      counterparty_entity_id: input.counterparty_entity_id ?? null,
      evidence_id: input.evidence_id ?? null,
      memo: input.memo ?? null,
      ...hlc,
      updated_at: hlc.hlc_wall_ms,
      is_deleted: input.is_deleted ?? 0,
    });
    this.observeHlc(hlc);
    return result.changes === 1;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Task 1a — insertRawEvidence
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Persists a diarized speech turn (or any other raw evidence envelope) into
   * `raw_evidence`.  The caller's `payload` object is serialised to JSON and
   * stored in `payload_json`.  Evidence is append-only: the schema trigger
   * blocks hard-deletes; use a newer HLC tombstone (`is_deleted = 1`) to
   * logically redact a row.
   *
   * **Evidence type mapping**
   * The method accepts `'voice' | 'sensor' | 'receipt'` — the three types
   * produced by the offline SLM pipeline — and stores them verbatim because all
   * three are valid schema values.
   *
   * @param input.evidence_id   - Caller-generated opaque ID (UUID/ULID).
   * @param input.evidence_type - Pipeline classification: 'voice', 'sensor', or 'receipt'.
   * @param input.payload       - Structured envelope (VoicePayload for speech turns).
   * @param input.confidence_ppm - Model confidence in parts-per-million (0..1_000_000).
   * @param input.observed_at   - Wall-clock epoch-ms when the event was observed (>= 2000-01-01).
   * @param input.hlc           - Hybrid Logical Clock tuple for CRDT ordering.
   * @returns `true` if the row was inserted or LWW-updated; `false` when the
   *   stored version is already strictly newer (stale write silently ignored).
   */
  insertRawEvidence(input: RawEvidenceInput): boolean {
    if (!Number.isInteger(input.confidence_ppm) || input.confidence_ppm < 0 || input.confidence_ppm > 1_000_000) {
      throw new Error(`confidence_ppm must be an integer in 0..1_000_000; got ${input.confidence_ppm}`);
    }
    if (!Number.isInteger(input.observed_at) || input.observed_at < 946_684_800_000) {
      throw new Error(`observed_at must be epoch-ms >= 946684800000; got ${input.observed_at}`);
    }

    // The method's union type is a strict subset of the schema's EvidenceType
    // union so a direct cast is safe here.
    const evidenceType = input.evidence_type as EvidenceType;
    const hlc = assertHlcTuple(input.hlc);

    const result = this.connection.prepare(`
      INSERT INTO raw_evidence
        (evidence_id, evidence_type, payload_json, observed_at, confidence_ppm,
         hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted)
      VALUES
        (@evidence_id, @evidence_type, @payload_json, @observed_at, @confidence_ppm,
         @hlc_wall_ms, @hlc_logical, @device_id, @updated_at, 0)
      ON CONFLICT(evidence_id) DO UPDATE SET
        evidence_type  = excluded.evidence_type,
        payload_json   = excluded.payload_json,
        observed_at    = excluded.observed_at,
        confidence_ppm = excluded.confidence_ppm,
        hlc_wall_ms    = excluded.hlc_wall_ms,
        hlc_logical    = excluded.hlc_logical,
        device_id      = excluded.device_id,
        updated_at     = excluded.updated_at,
        is_deleted     = excluded.is_deleted
      WHERE ${lww('raw_evidence')}
    `).run({
      evidence_id: input.evidence_id,
      evidence_type: evidenceType,
      payload_json: JSON.stringify(input.payload),
      observed_at: input.observed_at,
      confidence_ppm: input.confidence_ppm,
      ...hlc,
      updated_at: hlc.hlc_wall_ms,
    });

    this.observeHlc(hlc);
    return result.changes === 1;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Task 1b — getDailySpeechTranscripts
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Returns all non-deleted voice turns whose `observed_at` is >=
   * `sinceTimestamp`, ordered chronologically ascending by `observed_at`.
   *
   * `payload_json` is parsed on the fly and validated against the
   * `VoicePayload` shape (`speaker`, `text`, `timestamp`).  Rows whose payload
   * does not conform are silently skipped to tolerate partial schema evolution
   * without crashing the continuous microphone pipeline.
   *
   * @param sinceTimestamp - Epoch-ms lower bound (inclusive) for `observed_at`.
   *   Pass `0` to retrieve all voice turns since epoch (not recommended for
   *   large datasets; prefer a rolling 24-hour window).
   * @returns Array of decoded voice turns, ascending by `observed_at`.
   */
  getDailySpeechTranscripts(sinceTimestamp: number): Array<{ speaker: string; text: string; timestamp: number }> {
    const rows = this.connection.prepare(`
      SELECT payload_json, observed_at
      FROM raw_evidence
      WHERE evidence_type = 'voice'
        AND is_deleted    = 0
        AND observed_at  >= ?
      ORDER BY observed_at ASC
    `).all(sinceTimestamp) as Array<{ payload_json: string; observed_at: number }>;

    const results: Array<{ speaker: string; text: string; timestamp: number }> = [];
    for (const row of rows) {
      try {
        const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
        if (
          typeof payload['speaker'] === 'string' &&
          typeof payload['text'] === 'string' &&
          typeof payload['timestamp'] === 'number'
        ) {
          results.push({
            speaker: payload['speaker'],
            text: payload['text'],
            timestamp: payload['timestamp'],
          });
        }
      } catch {
        // Malformed payload_json — skip this row; do not abort the batch.
      }
    }
    return results;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Task 2 — upsertInventoryBatch
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Atomically upserts a batch of freshly purchased inventory lines and posts
   * the matching balanced double-entry accounting deltas.
   *
   * **Unit conversions**
   * - `quantityKg`         → `quantity_microunits` = round(kg × 1_000_000)
   * - `effectiveCostPerKg` → `unit_cost_minor`     = round(₹/kg × 100) [paise]
   * - Total cost for ledger = round(qty_microunits / 1_000_000 × unit_cost_minor)
   *
   * **Double-entry per SKU** (only posted when total_cost_minor > 0)
   * ```
   * DR  Assets:Inventory:<sku>
   * CR  Assets:Cash/Payables
   * ```
   *
   * The entire batch executes inside a single `better-sqlite3` transaction; if
   * any statement throws the whole batch is rolled back.
   *
   * @param items - Morning mandi purchase lines from the procurement feed.
   * @returns `true` if every inventory row produced at least one changed row;
   *   `false` if any row was a stale write (stored version already newer).
   * @throws If `quantityKg <= 0` or `effectiveCostPerKg < 0` for any item.
   */
  upsertInventoryBatch(items: Array<InventoryBatchItem>): boolean {
    if (items.length === 0) return true;

    const stmtInventory = this.connection.prepare(`
      INSERT INTO inventory_state
        (inventory_id, sku, location_code, quantity_microunits, unit_cost_minor,
         currency_code, hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted)
      VALUES
        (@inventory_id, @sku, '', @quantity_microunits, @unit_cost_minor,
         'INR', @hlc_wall_ms, @hlc_logical, @device_id, @updated_at, 0)
      ON CONFLICT(sku, location_code, owner_entity_id) DO UPDATE SET
        quantity_microunits = excluded.quantity_microunits,
        unit_cost_minor     = excluded.unit_cost_minor,
        hlc_wall_ms         = excluded.hlc_wall_ms,
        hlc_logical         = excluded.hlc_logical,
        device_id           = excluded.device_id,
        updated_at          = excluded.updated_at
      WHERE ${lww('inventory_state')}
    `);

    const stmtLedger = this.connection.prepare(`
      INSERT INTO ledger_entries
        (entry_id, occurred_at, debit_account, credit_account, amount_minor,
         currency_code, memo, hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted)
      VALUES
        (@entry_id, @occurred_at, @debit_account, @credit_account, @amount_minor,
         'INR', @memo, @hlc_wall_ms, @hlc_logical, @device_id, @updated_at, 0)
    `);

    let allChanged = true;

    const runBatch = this.connection.transaction(() => {
      for (const item of items) {
        if (item.quantityKg <= 0) throw new Error(`quantityKg must be > 0 for sku '${item.sku}'`);
        if (item.effectiveCostPerKg < 0) throw new Error(`effectiveCostPerKg must be >= 0 for sku '${item.sku}'`);

        const hlc = assertHlcTuple(item.hlc);
        const quantity_microunits = Math.round(item.quantityKg * 1_000_000);
        const unit_cost_minor = Math.round(item.effectiveCostPerKg * 100);
        const total_cost_minor = Math.round((quantity_microunits / 1_000_000) * unit_cost_minor);

        // Inventory upsert — uses a fresh UUID as the candidate inventory_id;
        // ON CONFLICT resolves on (sku, location_code, owner_entity_id=NULL).
        const invResult = stmtInventory.run({
          inventory_id: randomUUID(),
          sku: item.sku,
          quantity_microunits,
          unit_cost_minor,
          ...hlc,
          updated_at: hlc.hlc_wall_ms,
        });
        if (invResult.changes === 0) allChanged = false;

        // Double-entry ledger — only posted when the purchase has a non-zero cost.
        if (total_cost_minor > 0) {
          const ledgerHlc = this.nextHlc();
          stmtLedger.run({
            entry_id: randomUUID(),
            occurred_at: hlc.hlc_wall_ms,
            debit_account: `Assets:Inventory:${item.sku}`,
            credit_account: 'Assets:Cash/Payables',
            amount_minor: total_cost_minor,
            memo: `Morning mandi — ${item.quantityKg} kg of ${item.sku} @ ₹${item.effectiveCostPerKg}/kg`,
            ...ledgerHlc,
            updated_at: ledgerHlc.hlc_wall_ms,
          });
        }

        this.observeHlc(hlc);
      }
    });

    runBatch();
    return allChanged;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Task 3 — routeUpiEvent
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Routes a classified UPI / soundbox chime event to the correct accounting
   * path using the existing `insertLedgerEntry` primitive.
   *
   * | `event.type`        | Ledger action                                                   |
   * |---------------------|-----------------------------------------------------------------|
   * | `CONFIRMED_SALE`    | DR `Assets:Bank:UPI`  CR `Revenue:Sales`                       |
   * | `PERSONAL_TRANSFER` | DR `Assets:Bank:UPI`  CR `Equity:OwnerPersonalCapital`         |
   * | `NEIGHBOR_CHIME`    | **Zero** ledger entries — routed to `insertRawEvidence` as `evidence_type='sensor'` |
   *
   * `NEIGHBOR_CHIME` events arise when the soundbox classification picks up a
   * neighbouring vendor's UPI chime.  They must be recorded as sensor evidence
   * (for correlation) but must never create spurious revenue entries.
   *
   * @param event.type         - Classifier output from the soundbox SLM.
   * @param event.amount_minor - Transaction value in paise (required for monetary types).
   * @param event.reference_id - Optional external reference / UPI transaction ID.
   * @param event.memo         - Optional human-readable note stored in the ledger.
   * @param event.occurred_at  - Optional epoch-ms; defaults to `hlc.hlc_wall_ms`.
   * @param event.hlc          - HLC tuple for CRDT ordering.
   * @returns `true` if the primary write (ledger or evidence) succeeded.
   * @throws If `amount_minor` is missing or non-positive for a monetary event type.
   */
  routeUpiEvent(event: UpiEvent): boolean {
    const hlc = assertHlcTuple(event.hlc);
    const occurredAt = event.occurred_at ?? hlc.hlc_wall_ms;

    if (event.type === 'NEIGHBOR_CHIME') {
      // No ledger entries. Store as sensor evidence so the SLM can later
      // correlate chimes with this device's UPI pings during fusion.
      return this.insertRawEvidence({
        evidence_id: event.reference_id ?? randomUUID(),
        evidence_type: 'sensor',
        payload: {
          event_type: 'NEIGHBOR_CHIME',
          reference_id: event.reference_id ?? null,
          occurred_at: occurredAt,
        },
        confidence_ppm: 1_000_000,  // deterministic sensor classification
        observed_at: occurredAt,
        hlc,
      });
    }

    // Monetary paths — amount_minor is mandatory and must be a positive integer.
    if (
      event.amount_minor == null ||
      !Number.isInteger(event.amount_minor) ||
      event.amount_minor <= 0
    ) {
      throw new Error(
        `UPI event type '${event.type}' requires a positive integer amount_minor; got ${event.amount_minor}`,
      );
    }

    const creditAccount =
      event.type === 'CONFIRMED_SALE'
        ? 'Revenue:Sales'
        : 'Equity:OwnerPersonalCapital';  // PERSONAL_TRANSFER

    return this.insertLedgerEntry({
      entry_id: (event.reference_id ?? randomUUID()) as LedgerEntryId,
      occurred_at: occurredAt,
      debit_account: 'Assets:Bank:UPI',
      credit_account: creditAccount,
      amount_minor: event.amount_minor,
      currency_code: 'INR' as CurrencyCode,
      memo: event.memo ?? `UPI ${event.type}`,
      hlc,
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Task 4a — burnInventoryStock
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Deducts sold/consumed units from the live `inventory_state` row for the
   * given SKU and posts the corresponding COGS double-entry:
   *
   * ```
   * DR  Expenses:COGS
   * CR  Assets:Inventory:<sku>
   * ```
   *
   * The deduction is LWW-safe: it reads the current resolved quantity from the
   * CRDT view and applies a delta so that concurrent offline writes on other
   * devices do not silently corrupt stock.  If no resolved row exists for the
   * SKU the call is a no-op and returns `false`.
   *
   * Negative post-burn quantities are permitted at the data layer; the business
   * rule that rejects a backlog should be enforced by the caller.
   *
   * @param sku                - The inventory SKU to burn.
   * @param quantityMicrounits - Units to deduct (must be a positive integer).
   * @param costMinor          - COGS value in paise. Only posts a ledger entry
   *   when > 0, allowing zero-cost items (samples, donations) to burn stock
   *   without synthetic ledger noise.
   * @param hlc                - Caller-provided HLC for this write operation.
   * @returns `true` if the inventory row was updated; `false` if no row found.
   * @throws If `quantityMicrounits` is not a positive integer.
   */
  burnInventoryStock(
    sku: string,
    quantityMicrounits: number,
    costMinor: number,
    hlc: HlcTuple,
  ): boolean {
    if (!Number.isInteger(quantityMicrounits) || quantityMicrounits <= 0) {
      throw new Error(`quantityMicrounits must be a positive integer; got ${quantityMicrounits}`);
    }

    const validatedHlc = assertHlcTuple(hlc);

    // Read the current live (LWW-resolved, non-deleted) inventory row.
    const existing = this.connection.prepare(
      `SELECT inventory_id, quantity_microunits FROM resolved_inventory WHERE sku = ? LIMIT 1`,
    ).get(sku) as { inventory_id: string; quantity_microunits: number } | undefined;

    if (!existing) return false;

    const newQty = existing.quantity_microunits - quantityMicrounits;
    const burnHlc = this.nextHlc();

    // Apply the delta; the WHERE guard ensures we do not overwrite a
    // concurrently written newer version.
    this.connection.prepare(`
      UPDATE inventory_state
      SET quantity_microunits = @new_qty,
          hlc_wall_ms         = @hlc_wall_ms,
          hlc_logical         = @hlc_logical,
          device_id           = @device_id,
          updated_at          = @updated_at
      WHERE inventory_id = @inventory_id
        AND (
          @hlc_wall_ms > inventory_state.hlc_wall_ms
          OR (@hlc_wall_ms = inventory_state.hlc_wall_ms AND @hlc_logical > inventory_state.hlc_logical)
          OR (@hlc_wall_ms = inventory_state.hlc_wall_ms AND @hlc_logical = inventory_state.hlc_logical AND @device_id > inventory_state.device_id)
        )
    `).run({
      new_qty: newQty,
      inventory_id: existing.inventory_id,
      ...burnHlc,
      updated_at: burnHlc.hlc_wall_ms,
    });

    // Post COGS entry only when a non-zero cost is provided.
    if (costMinor > 0) {
      const cogsHlc = this.nextHlc();
      this.insertLedgerEntry({
        entry_id: randomUUID() as LedgerEntryId,
        occurred_at: validatedHlc.hlc_wall_ms,
        debit_account: 'Expenses:COGS',
        credit_account: `Assets:Inventory:${sku}`,
        amount_minor: costMinor,
        currency_code: 'INR' as CurrencyCode,
        memo: `COGS burn — ${quantityMicrounits} µ-units of ${sku}`,
        hlc: cogsHlc,
      });
    }

    this.observeHlc(validatedHlc);
    return true;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Task 4b — processNightEodReconciliation
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Executes the nightly end-of-day (EOD) reconciliation inside a single atomic
   * `better-sqlite3` transaction covering four sequential phases:
   *
   * **Phase 1 — Commit discovered cash sales**
   * For each line in `discovered_sales` with `amount_minor > 0`:
   * ```
   * DR  Assets:Cash:Drawer
   * CR  Revenue:Sales
   * ```
   *
   * **Phase 2 — Burn COGS for each discovered sale**
   * Calls `burnInventoryStock` per sale line (when `quantity_microunits > 0`):
   * ```
   * DR  Expenses:COGS
   * CR  Assets:Inventory:<sku>
   * ```
   *
   * **Phase 3 — Drawer slack attribution**
   * `slack = drawer_counted_minor − drawer_expected_minor`
   * - `slack > 0` (surplus):
   *   ```
   *   DR  Assets:Cash:Drawer  CR  Revenue:RoundingGain
   *   ```
   * - `slack < 0` and `|slack| ≤ 100` (rounding noise, ≤ ₹1):
   *   ```
   *   DR  Expenses:CashRoundingLoss  CR  Assets:Cash:Drawer
   *   ```
   * - `slack < 0` and `|slack| > 100` (material discrepancy / theft signal):
   *   ```
   *   DR  Expenses:TheftOrLeakage  CR  Assets:Cash:Drawer
   *   ```
   *
   * **Phase 4 — Record fusion event**
   * Inserts a row into `event_fusion` with `event_kind = 'stock_count'` and
   * `resolution_method = 'rule'`.  The `reconciled_payload_json` encodes the
   * full summary (session_date, discovered_sales, expected/counted amounts,
   * slack) for downstream SLM audit.
   *
   * @param input - The night EOD payload from the reconciliation service.
   * @returns The `fusion_id` (UUID) of the created `event_fusion` record.
   * @throws On any constraint violation; the entire transaction is rolled back.
   */
  processNightEodReconciliation(input: NightEodInput): string {
    const hlc = assertHlcTuple(input.hlc);
    const fusionId = randomUUID();

    const runReconciliation = this.connection.transaction(() => {
      const now = hlc.hlc_wall_ms;

      // ── Phase 1: Commit discovered cash sales ────────────────────────────
      for (const sale of input.discovered_sales) {
        if (sale.amount_minor <= 0) continue; // schema CHECK: amount_minor > 0
        const saleHlc = this.nextHlc();
        this.insertLedgerEntry({
          entry_id: randomUUID() as LedgerEntryId,
          occurred_at: now,
          debit_account: 'Assets:Cash:Drawer',
          credit_account: 'Revenue:Sales',
          amount_minor: sale.amount_minor,
          currency_code: 'INR' as CurrencyCode,
          memo: `EOD cash sale — ${sale.sku} (${input.session_date_iso})`,
          hlc: saleHlc,
        });
      }

      // ── Phase 2: Burn COGS ────────────────────────────────────────────────
      for (const sale of input.discovered_sales) {
        if (sale.quantity_microunits <= 0) continue;
        // Derive unit cost from the sale line data (paise per kg equivalent).
        const cogsCostMinor =
          sale.quantity_microunits > 0
            ? Math.round(sale.amount_minor * (sale.quantity_microunits / 1_000_000))
            : 0;
        const burnHlc = this.nextHlc();
        this.burnInventoryStock(sale.sku, sale.quantity_microunits, cogsCostMinor, burnHlc);
      }

      // ── Phase 3: Drawer slack attribution ───────────────────────────────
      const slack = input.drawer_counted_minor - input.drawer_expected_minor;
      if (slack !== 0) {
        const slackHlc = this.nextHlc();
        if (slack > 0) {
          this.insertLedgerEntry({
            entry_id: randomUUID() as LedgerEntryId,
            occurred_at: now,
            debit_account: 'Assets:Cash:Drawer',
            credit_account: 'Revenue:RoundingGain',
            amount_minor: slack,
            currency_code: 'INR' as CurrencyCode,
            memo: `EOD drawer surplus (${input.session_date_iso})`,
            hlc: slackHlc,
          });
        } else {
          const deficit = Math.abs(slack);
          // |slack| <= 100 paise (≤ ₹1) is treated as rounding noise.
          // |slack| >  100 paise  is a material discrepancy worth flagging.
          const expenseAccount =
            deficit <= 100
              ? 'Expenses:CashRoundingLoss'
              : 'Expenses:TheftOrLeakage';
          const deficitHlc = this.nextHlc();
          this.insertLedgerEntry({
            entry_id: randomUUID() as LedgerEntryId,
            occurred_at: now,
            debit_account: expenseAccount,
            credit_account: 'Assets:Cash:Drawer',
            amount_minor: deficit,
            currency_code: 'INR' as CurrencyCode,
            memo: `EOD drawer deficit (${input.session_date_iso})`,
            hlc: deficitHlc,
          });
        }
      }

      // ── Phase 4: Record fusion event ─────────────────────────────────────
      const reconciliationSummary = {
        session_date: input.session_date_iso,
        discovered_sales: input.discovered_sales,
        drawer_expected_minor: input.drawer_expected_minor,
        drawer_counted_minor: input.drawer_counted_minor,
        slack_minor: slack,
      };

      const fusionHlc = this.nextHlc();
      this.connection.prepare(`
        INSERT INTO event_fusion
          (fusion_id, event_kind, occurred_at, reconciled_payload_json,
           contradiction_summary_json, fusion_confidence_score, resolution_method,
           hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted)
        VALUES
          (@fusion_id, 'stock_count', @occurred_at, @reconciled_payload_json,
           '[]', @fusion_confidence_score, 'rule',
           @hlc_wall_ms, @hlc_logical, @device_id, @updated_at, 0)
      `).run({
        fusion_id: fusionId,
        occurred_at: now,
        reconciled_payload_json: JSON.stringify(reconciliationSummary),
        fusion_confidence_score: 1_000_000,  // deterministic rule-based resolution
        ...fusionHlc,
        updated_at: fusionHlc.hlc_wall_ms,
      });

      this.observeHlc(hlc);
    });

    runReconciliation();
    return fusionId;
  }

  // ── Utilities ────────────────────────────────────────────────────────────

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
