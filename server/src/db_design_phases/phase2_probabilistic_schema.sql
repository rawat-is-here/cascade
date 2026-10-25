-- Phase 2: probabilistic inference extension for the offline-first SQLite schema.
-- Execute phase1_crdt_schema.sql first and enable foreign keys per connection.
-- All probabilities use parts-per-million (ppm): 0..1000000. Monetary and quantity
-- expectations use integer minor/micro units to preserve deterministic replication.

CREATE TABLE IF NOT EXISTS probabilistic_ledger_estimates (
    estimate_id             TEXT PRIMARY KEY NOT NULL,
    entry_id                TEXT REFERENCES ledger_entries(entry_id) DEFERRABLE INITIALLY DEFERRED,
    fusion_id               TEXT REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED,
    occurred_at             INTEGER NOT NULL CHECK (occurred_at >= 946684800000),
    debit_account           TEXT NOT NULL CHECK (length(trim(debit_account)) > 0),
    credit_account          TEXT NOT NULL CHECK (length(trim(credit_account)) > 0),
    expected_amount_minor   INTEGER NOT NULL CHECK (expected_amount_minor >= 0),
    min_amount_minor        INTEGER NOT NULL CHECK (min_amount_minor >= 0),
    max_amount_minor        INTEGER NOT NULL CHECK (max_amount_minor >= 0),
    confidence_score        INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 1000000),
    distribution_json       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(distribution_json)),
    currency_code           TEXT NOT NULL DEFAULT 'INR' CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
    counterparty_entity_id  TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
    inference_method        TEXT NOT NULL CHECK (inference_method IN ('manual', 'heuristic', 'model', 'fusion')),
    hlc_wall_ms             INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical             INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id               TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at              INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted              INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(estimate_id) > 0),
    CHECK (debit_account <> credit_account),
    CHECK (min_amount_minor <= expected_amount_minor AND expected_amount_minor <= max_amount_minor)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_prob_ledger_occurred_live
    ON probabilistic_ledger_estimates(occurred_at DESC, confidence_score DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_prob_ledger_entry_live
    ON probabilistic_ledger_estimates(entry_id, updated_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_prob_ledger_sync
    ON probabilistic_ledger_estimates(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS probabilistic_inventory_estimates (
    estimate_id                 TEXT PRIMARY KEY NOT NULL,
    inventory_id                TEXT REFERENCES inventory_state(inventory_id) DEFERRABLE INITIALLY DEFERRED,
    fusion_id                   TEXT REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED,
    sku                         TEXT NOT NULL COLLATE NOCASE,
    location_code               TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
    expected_quantity_microunits INTEGER NOT NULL,
    min_quantity_microunits     INTEGER NOT NULL,
    max_quantity_microunits     INTEGER NOT NULL,
    confidence_score            INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 1000000),
    distribution_json           TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(distribution_json)),
    observed_at                 INTEGER NOT NULL CHECK (observed_at >= 946684800000),
    inference_method            TEXT NOT NULL CHECK (inference_method IN ('manual', 'heuristic', 'model', 'fusion')),
    hlc_wall_ms                 INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical                 INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id                   TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at                  INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted                  INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(estimate_id) > 0),
    CHECK (min_quantity_microunits <= expected_quantity_microunits
       AND expected_quantity_microunits <= max_quantity_microunits)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_prob_inventory_sku_live
    ON probabilistic_inventory_estimates(sku COLLATE NOCASE, location_code COLLATE NOCASE, observed_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_prob_inventory_sync
    ON probabilistic_inventory_estimates(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS stock_loss_attribution (
    loss_id                  TEXT PRIMARY KEY NOT NULL,
    inventory_id             TEXT REFERENCES inventory_state(inventory_id) DEFERRABLE INITIALLY DEFERRED,
    fusion_id                TEXT REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED,
    sku                      TEXT NOT NULL COLLATE NOCASE,
    detected_at              INTEGER NOT NULL CHECK (detected_at >= 946684800000),
    expected_loss_microunits INTEGER NOT NULL CHECK (expected_loss_microunits >= 0),
    min_loss_microunits      INTEGER NOT NULL CHECK (min_loss_microunits >= 0),
    max_loss_microunits      INTEGER NOT NULL CHECK (max_loss_microunits >= 0),
    spoilage_prob             INTEGER NOT NULL CHECK (spoilage_prob BETWEEN 0 AND 1000000),
    theft_prob                INTEGER NOT NULL CHECK (theft_prob BETWEEN 0 AND 1000000),
    personal_use_prob         INTEGER NOT NULL CHECK (personal_use_prob BETWEEN 0 AND 1000000),
    other_loss_prob           INTEGER NOT NULL DEFAULT 0 CHECK (other_loss_prob BETWEEN 0 AND 1000000),
    environmental_covariates  TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(environmental_covariates)),
    distribution_json         TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(distribution_json)),
    confidence_score          INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 1000000),
    hlc_wall_ms               INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical               INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id                 TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at                INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted                INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(loss_id) > 0),
    CHECK (min_loss_microunits <= expected_loss_microunits
       AND expected_loss_microunits <= max_loss_microunits),
    CHECK (spoilage_prob + theft_prob + personal_use_prob + other_loss_prob = 1000000)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_stock_loss_sku_live
    ON stock_loss_attribution(sku COLLATE NOCASE, detected_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_stock_loss_sync
    ON stock_loss_attribution(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS portion_inference (
    inference_id                    TEXT PRIMARY KEY NOT NULL,
    fusion_id                       TEXT REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED,
    source_evidence_id              TEXT REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
    material_sku                    TEXT NOT NULL COLLATE NOCASE,
    inferred_output_sku             TEXT COLLATE NOCASE,
    window_started_at               INTEGER NOT NULL CHECK (window_started_at >= 946684800000),
    window_ended_at                 INTEGER NOT NULL CHECK (window_ended_at >= window_started_at),
    input_burn_microunits           INTEGER NOT NULL CHECK (input_burn_microunits > 0),
    inferred_portions_expected      INTEGER NOT NULL CHECK (inferred_portions_expected >= 0),
    inferred_portions_min           INTEGER NOT NULL CHECK (inferred_portions_min >= 0),
    inferred_portions_max           INTEGER NOT NULL CHECK (inferred_portions_max >= 0),
    portion_size_expected_microunits INTEGER NOT NULL CHECK (portion_size_expected_microunits >= 0),
    portion_size_min_microunits      INTEGER NOT NULL CHECK (portion_size_min_microunits >= 0),
    portion_size_max_microunits      INTEGER NOT NULL CHECK (portion_size_max_microunits >= 0),
    context_json                    TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json)),
    confidence_score                INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 1000000),
    model_version                   TEXT NOT NULL,
    hlc_wall_ms                     INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical                     INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id                       TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at                      INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted                      INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(inference_id) > 0),
    CHECK (inferred_portions_min <= inferred_portions_expected
       AND inferred_portions_expected <= inferred_portions_max),
    CHECK (portion_size_min_microunits <= portion_size_expected_microunits
       AND portion_size_expected_microunits <= portion_size_max_microunits)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_portion_inference_material_live
    ON portion_inference(material_sku COLLATE NOCASE, window_ended_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_portion_inference_sync
    ON portion_inference(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS event_fusion (
    fusion_id                  TEXT PRIMARY KEY NOT NULL,
    event_kind                 TEXT NOT NULL CHECK (event_kind IN
                                 ('sale', 'purchase', 'stock_count', 'loss', 'production', 'payment', 'other')),
    occurred_at                INTEGER NOT NULL CHECK (occurred_at >= 946684800000),
    reconciled_payload_json    TEXT NOT NULL CHECK (json_valid(reconciled_payload_json)),
    contradiction_summary_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(contradiction_summary_json)),
    fusion_confidence_score    INTEGER NOT NULL CHECK (fusion_confidence_score BETWEEN 0 AND 1000000),
    resolution_method          TEXT NOT NULL CHECK (resolution_method IN ('manual', 'rule', 'model', 'hybrid')),
    hlc_wall_ms                INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical                INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id                  TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at                 INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted                 INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(fusion_id) > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_event_fusion_occurred_live
    ON event_fusion(occurred_at DESC, event_kind, fusion_confidence_score DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_event_fusion_sync
    ON event_fusion(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS event_fusion_evidence (
    fusion_id       TEXT NOT NULL REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED,
    evidence_id     TEXT NOT NULL REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
    evidence_role   TEXT NOT NULL CHECK (evidence_role IN ('supporting', 'contradicting', 'context')),
    weight_ppm      INTEGER NOT NULL CHECK (weight_ppm BETWEEN 0 AND 1000000),
    hlc_wall_ms     INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical     INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id       TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at      INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted      INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    PRIMARY KEY (fusion_id, evidence_id),
    CHECK (length(fusion_id) > 0 AND length(evidence_id) > 0)
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_fusion_evidence_evidence_live
    ON event_fusion_evidence(evidence_id, fusion_id)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_fusion_evidence_sync
    ON event_fusion_evidence(hlc_wall_ms, hlc_logical, device_id);
