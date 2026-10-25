-- Phase 3: local-language interpretation and CRDT-resolved read models.
-- Execute Phase 1 and Phase 2 schemas first.  Every synchronised row keeps the
-- shared HLC tuple and tombstone controls from Phase 1.

CREATE TABLE IF NOT EXISTS lexicon_terms (
    term_id                    TEXT PRIMARY KEY NOT NULL,
    surface_form               TEXT NOT NULL COLLATE NOCASE,
    normalized_form            TEXT NOT NULL COLLATE NOCASE,
    language_tag               TEXT NOT NULL DEFAULT 'und',
    term_kind                  TEXT NOT NULL CHECK (term_kind IN
                                 ('unit', 'entity_alias', 'material_alias', 'action', 'other')),
    canonical_unit             TEXT,
    baseline_expected_microunits INTEGER CHECK (baseline_expected_microunits IS NULL OR baseline_expected_microunits >= 0),
    baseline_min_microunits    INTEGER CHECK (baseline_min_microunits IS NULL OR baseline_min_microunits >= 0),
    baseline_max_microunits    INTEGER CHECK (baseline_max_microunits IS NULL OR baseline_max_microunits >= 0),
    unit_variance_range        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(unit_variance_range)),
    context_confidence         INTEGER NOT NULL CHECK (context_confidence BETWEEN 0 AND 1000000),
    context_json               TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json)),
    canonical_entity_id        TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
    canonical_sku              TEXT COLLATE NOCASE,
    source_evidence_id         TEXT REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
    hlc_wall_ms                INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical                INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id                  TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at                 INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted                 INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(term_id) > 0),
    CHECK ((baseline_min_microunits IS NULL AND baseline_expected_microunits IS NULL AND baseline_max_microunits IS NULL)
        OR (baseline_min_microunits <= baseline_expected_microunits
            AND baseline_expected_microunits <= baseline_max_microunits)),
    CHECK (term_kind <> 'unit' OR (canonical_unit IS NOT NULL AND baseline_expected_microunits IS NOT NULL))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_lexicon_normalized_live
    ON lexicon_terms(normalized_form COLLATE NOCASE, language_tag, term_kind)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_lexicon_entity_live
    ON lexicon_terms(canonical_entity_id, normalized_form COLLATE NOCASE)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_lexicon_sync
    ON lexicon_terms(hlc_wall_ms, hlc_logical, device_id);

CREATE TABLE IF NOT EXISTS alias_resolution_candidates (
    resolution_id              TEXT PRIMARY KEY NOT NULL,
    evidence_id                TEXT NOT NULL REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
    term_id                    TEXT REFERENCES lexicon_terms(term_id) DEFERRABLE INITIALLY DEFERRED,
    mention_text               TEXT NOT NULL COLLATE NOCASE,
    mention_start_offset       INTEGER CHECK (mention_start_offset IS NULL OR mention_start_offset >= 0),
    mention_end_offset         INTEGER CHECK (mention_end_offset IS NULL OR mention_end_offset >= mention_start_offset),
    resolution_kind            TEXT NOT NULL CHECK (resolution_kind IN ('entity', 'material')),
    candidate_entity_id        TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
    candidate_sku              TEXT COLLATE NOCASE,
    context_confidence         INTEGER NOT NULL CHECK (context_confidence BETWEEN 0 AND 1000000),
    unit_variance_range        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(unit_variance_range)),
    rationale_json             TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(rationale_json)),
    hlc_wall_ms                INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical                INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id                  TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at                 INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted                 INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(resolution_id) > 0),
    CHECK ((resolution_kind = 'entity' AND candidate_entity_id IS NOT NULL AND candidate_sku IS NULL)
        OR (resolution_kind = 'material' AND candidate_sku IS NOT NULL AND candidate_entity_id IS NULL))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_alias_resolution_evidence_live
    ON alias_resolution_candidates(evidence_id, context_confidence DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_alias_resolution_entity_live
    ON alias_resolution_candidates(candidate_entity_id, context_confidence DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_alias_resolution_sku_live
    ON alias_resolution_candidates(candidate_sku COLLATE NOCASE, context_confidence DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_alias_resolution_sync
    ON alias_resolution_candidates(hlc_wall_ms, hlc_logical, device_id);

-- LWW resolution considers tombstones while ranking.  Filtering happens only
-- after a winner is selected, so a newer tombstone hides an older live version.
CREATE VIEW IF NOT EXISTS resolved_entities AS
WITH ranked AS (
    SELECT e.*,
           ROW_NUMBER() OVER (
               PARTITION BY e.entity_id
               ORDER BY e.hlc_wall_ms DESC, e.hlc_logical DESC, e.device_id DESC
           ) AS lww_rank
    FROM entities AS e
)
SELECT entity_id, canonical_name, entity_type, aliases_json, notes,
       hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted
FROM ranked
WHERE lww_rank = 1 AND is_deleted = 0;

CREATE VIEW IF NOT EXISTS resolved_ledger AS
WITH ranked AS (
    SELECT l.*,
           ROW_NUMBER() OVER (
               PARTITION BY l.entry_id
               ORDER BY l.hlc_wall_ms DESC, l.hlc_logical DESC, l.device_id DESC
           ) AS lww_rank
    FROM ledger_entries AS l
)
SELECT entry_id, occurred_at, debit_account, credit_account, amount_minor,
       currency_code, counterparty_entity_id, evidence_id, memo,
       hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted
FROM ranked
WHERE lww_rank = 1 AND is_deleted = 0;

CREATE VIEW IF NOT EXISTS resolved_inventory AS
WITH ranked AS (
    SELECT i.*,
           ROW_NUMBER() OVER (
               PARTITION BY i.inventory_id
               ORDER BY i.hlc_wall_ms DESC, i.hlc_logical DESC, i.device_id DESC
           ) AS lww_rank
    FROM inventory_state AS i
)
SELECT inventory_id, sku, location_code, quantity_microunits, unit_cost_minor,
       currency_code, owner_entity_id, evidence_id,
       hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted
FROM ranked
WHERE lww_rank = 1 AND is_deleted = 0;
