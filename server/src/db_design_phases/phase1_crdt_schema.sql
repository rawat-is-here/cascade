-- Phase 1: offline-first SQLite schema.
-- Application startup should execute: PRAGMA foreign_keys = ON;
-- Timestamps and HLC physical values use UTC Unix milliseconds.
-- 946684800000 = 2000-01-01T00:00:00Z; values earlier than this reject reset-to-1970 clocks.

CREATE TABLE IF NOT EXISTS entities (
    entity_id           TEXT PRIMARY KEY NOT NULL,
    canonical_name      TEXT NOT NULL COLLATE NOCASE,
    entity_type         TEXT NOT NULL CHECK (entity_type IN
                            ('customer', 'supplier', 'vendor', 'person', 'business', 'unknown')),
    aliases_json        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases_json)),
    notes               TEXT,
    hlc_wall_ms         INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical         INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id           TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at          INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted          INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(entity_id) > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_entities_name_live
    ON entities(canonical_name COLLATE NOCASE, updated_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_entities_sync
    ON entities(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS raw_evidence (
    evidence_id         TEXT PRIMARY KEY NOT NULL,
    evidence_type       TEXT NOT NULL CHECK (evidence_type IN
                            ('text', 'voice', 'image', 'receipt', 'location', 'sensor', 'import', 'other')),
    payload_json        TEXT NOT NULL CHECK (json_valid(payload_json)),
    content_sha256      TEXT CHECK (content_sha256 IS NULL OR
                            (length(content_sha256) = 64 AND content_sha256 NOT GLOB '*[^0-9A-Fa-f]*')),
    observed_at         INTEGER CHECK (observed_at IS NULL OR observed_at >= 946684800000),
    source_entity_id    TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
    confidence_ppm      INTEGER NOT NULL DEFAULT 500000 CHECK (confidence_ppm BETWEEN 0 AND 1000000),
    hlc_wall_ms         INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical         INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id           TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at          INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted          INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(evidence_id) > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_raw_evidence_observed_live
    ON raw_evidence(observed_at DESC, evidence_type)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_raw_evidence_source_live
    ON raw_evidence(source_entity_id, observed_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_raw_evidence_sync
    ON raw_evidence(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
    entry_id            TEXT PRIMARY KEY NOT NULL,
    occurred_at         INTEGER NOT NULL CHECK (occurred_at >= 946684800000),
    debit_account       TEXT NOT NULL CHECK (length(trim(debit_account)) > 0),
    credit_account      TEXT NOT NULL CHECK (length(trim(credit_account)) > 0),
    amount_minor        INTEGER NOT NULL CHECK (amount_minor > 0),
    currency_code       TEXT NOT NULL DEFAULT 'INR' CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
    counterparty_entity_id TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
    evidence_id         TEXT REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
    memo                TEXT,
    hlc_wall_ms         INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical         INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id           TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at          INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted          INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(entry_id) > 0),
    CHECK (debit_account <> credit_account)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_ledger_occurred_live
    ON ledger_entries(occurred_at DESC, entry_id)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_ledger_debit_live
    ON ledger_entries(debit_account, occurred_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_ledger_credit_live
    ON ledger_entries(credit_account, occurred_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_ledger_counterparty_live
    ON ledger_entries(counterparty_entity_id, occurred_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_ledger_sync
    ON ledger_entries(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS inventory_state (
    inventory_id        TEXT PRIMARY KEY NOT NULL,
    sku                 TEXT NOT NULL COLLATE NOCASE,
    location_code       TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
    quantity_microunits INTEGER NOT NULL,
    unit_cost_minor     INTEGER CHECK (unit_cost_minor IS NULL OR unit_cost_minor >= 0),
    currency_code       TEXT NOT NULL DEFAULT 'INR' CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
    owner_entity_id     TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
    evidence_id         TEXT REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
    hlc_wall_ms         INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical         INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id           TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at          INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted          INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(inventory_id) > 0),
    UNIQUE (sku, location_code, owner_entity_id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_inventory_sku_live
    ON inventory_state(sku COLLATE NOCASE, location_code COLLATE NOCASE)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_inventory_owner_live
    ON inventory_state(owner_entity_id, sku COLLATE NOCASE)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_inventory_sync
    ON inventory_state(hlc_wall_ms, hlc_logical, device_id);
