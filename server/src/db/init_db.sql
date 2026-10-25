-- Production initializer: offline-first probabilistic ledger (SQLite 3.37+).
-- Re-runnable for a new database. Execute as one script; enable foreign_keys on
-- every application connection as it is connection-scoped.

-- 1. PRAGMAs
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;
PRAGMA cache_size = -20000;
PRAGMA temp_store = MEMORY;
PRAGMA wal_autocheckpoint = 1000;
PRAGMA journal_size_limit = 67108864;
PRAGMA trusted_schema = OFF;
PRAGMA optimize = 0x10002;

-- 2. CORE TABLES. HLC wall times are UTC milliseconds and must be >= 2000-01-01.
CREATE TABLE IF NOT EXISTS entities (
 entity_id TEXT PRIMARY KEY NOT NULL, canonical_name TEXT NOT NULL COLLATE NOCASE,
 entity_type TEXT NOT NULL CHECK(entity_type IN ('customer','supplier','vendor','person','business','unknown')),
 aliases_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(aliases_json)), notes TEXT,
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0),
 device_id TEXT NOT NULL CHECK(length(trim(device_id))>0), updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms),
 is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)), CHECK(length(entity_id)>0)
) STRICT;

CREATE TABLE IF NOT EXISTS raw_evidence (
 evidence_id TEXT PRIMARY KEY NOT NULL,
 evidence_type TEXT NOT NULL CHECK(evidence_type IN ('text','voice','image','receipt','location','sensor','import','other')),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 content_sha256 TEXT CHECK(content_sha256 IS NULL OR (length(content_sha256)=64 AND content_sha256 NOT GLOB '*[^0-9A-Fa-f]*')),
 observed_at INTEGER CHECK(observed_at IS NULL OR observed_at>=946684800000),
 source_entity_id TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
 confidence_ppm INTEGER NOT NULL DEFAULT 500000 CHECK(confidence_ppm BETWEEN 0 AND 1000000),
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0),
 device_id TEXT NOT NULL CHECK(length(trim(device_id))>0), updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms),
 is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)), CHECK(length(evidence_id)>0)
) STRICT;

CREATE TABLE IF NOT EXISTS event_fusion (
 fusion_id TEXT PRIMARY KEY NOT NULL,
 event_kind TEXT NOT NULL CHECK(event_kind IN ('sale','purchase','stock_count','loss','production','payment','other')),
 occurred_at INTEGER NOT NULL CHECK(occurred_at>=946684800000),
 reconciled_payload_json TEXT NOT NULL CHECK(json_valid(reconciled_payload_json)),
 contradiction_summary_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(contradiction_summary_json)),
 fusion_confidence_score INTEGER NOT NULL CHECK(fusion_confidence_score BETWEEN 0 AND 1000000),
 resolution_method TEXT NOT NULL CHECK(resolution_method IN ('manual','rule','model','hybrid')),
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0),
 device_id TEXT NOT NULL CHECK(length(trim(device_id))>0), updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms),
 is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)), CHECK(length(fusion_id)>0)
) STRICT;

CREATE TABLE IF NOT EXISTS ledger_entries (
 entry_id TEXT PRIMARY KEY NOT NULL, occurred_at INTEGER NOT NULL CHECK(occurred_at>=946684800000),
 debit_account TEXT NOT NULL CHECK(length(trim(debit_account))>0), credit_account TEXT NOT NULL CHECK(length(trim(credit_account))>0),
 amount_minor INTEGER NOT NULL CHECK(amount_minor>0), currency_code TEXT NOT NULL DEFAULT 'INR' CHECK(length(currency_code)=3 AND currency_code=upper(currency_code)),
 counterparty_entity_id TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
 evidence_id TEXT REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED, memo TEXT,
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0),
 device_id TEXT NOT NULL CHECK(length(trim(device_id))>0), updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms),
 is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 CHECK(length(entry_id)>0), CHECK(debit_account<>credit_account)
) STRICT;

CREATE TABLE IF NOT EXISTS inventory_state (
 inventory_id TEXT PRIMARY KEY NOT NULL, sku TEXT NOT NULL COLLATE NOCASE, location_code TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
 quantity_microunits INTEGER NOT NULL, unit_cost_minor INTEGER CHECK(unit_cost_minor IS NULL OR unit_cost_minor>=0),
 currency_code TEXT NOT NULL DEFAULT 'INR' CHECK(length(currency_code)=3 AND currency_code=upper(currency_code)),
 owner_entity_id TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
 evidence_id TEXT REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0),
 device_id TEXT NOT NULL CHECK(length(trim(device_id))>0), updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms),
 is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 CHECK(length(inventory_id)>0), UNIQUE(sku,location_code,owner_entity_id)
) STRICT;

CREATE TABLE IF NOT EXISTS event_fusion_evidence (
 fusion_id TEXT NOT NULL REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED,
 evidence_id TEXT NOT NULL REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
 evidence_role TEXT NOT NULL CHECK(evidence_role IN ('supporting','contradicting','context')),
 weight_ppm INTEGER NOT NULL CHECK(weight_ppm BETWEEN 0 AND 1000000),
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0),
 device_id TEXT NOT NULL CHECK(length(trim(device_id))>0), updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms),
 is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 PRIMARY KEY(fusion_id,evidence_id)
) STRICT, WITHOUT ROWID;

-- Probabilistic extensions retain ranges and distributions; they never overwrite facts.
CREATE TABLE IF NOT EXISTS probabilistic_ledger_estimates (
 estimate_id TEXT PRIMARY KEY NOT NULL, entry_id TEXT REFERENCES ledger_entries(entry_id) DEFERRABLE INITIALLY DEFERRED,
 fusion_id TEXT REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED, occurred_at INTEGER NOT NULL CHECK(occurred_at>=946684800000),
 debit_account TEXT NOT NULL, credit_account TEXT NOT NULL, expected_amount_minor INTEGER NOT NULL CHECK(expected_amount_minor>=0),
 min_amount_minor INTEGER NOT NULL CHECK(min_amount_minor>=0), max_amount_minor INTEGER NOT NULL CHECK(max_amount_minor>=0),
 confidence_score INTEGER NOT NULL CHECK(confidence_score BETWEEN 0 AND 1000000), distribution_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(distribution_json)),
 currency_code TEXT NOT NULL DEFAULT 'INR' CHECK(length(currency_code)=3 AND currency_code=upper(currency_code)),
 counterparty_entity_id TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
 inference_method TEXT NOT NULL CHECK(inference_method IN ('manual','heuristic','model','fusion')),
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0), device_id TEXT NOT NULL CHECK(length(trim(device_id))>0),
 updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 CHECK(debit_account<>credit_account), CHECK(min_amount_minor<=expected_amount_minor AND expected_amount_minor<=max_amount_minor)
) STRICT;

CREATE TABLE IF NOT EXISTS probabilistic_inventory_estimates (
 estimate_id TEXT PRIMARY KEY NOT NULL, inventory_id TEXT REFERENCES inventory_state(inventory_id) DEFERRABLE INITIALLY DEFERRED,
 fusion_id TEXT REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED, sku TEXT NOT NULL COLLATE NOCASE, location_code TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
 expected_quantity_microunits INTEGER NOT NULL, min_quantity_microunits INTEGER NOT NULL, max_quantity_microunits INTEGER NOT NULL,
 confidence_score INTEGER NOT NULL CHECK(confidence_score BETWEEN 0 AND 1000000), distribution_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(distribution_json)),
 observed_at INTEGER NOT NULL CHECK(observed_at>=946684800000), inference_method TEXT NOT NULL CHECK(inference_method IN ('manual','heuristic','model','fusion')),
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0), device_id TEXT NOT NULL CHECK(length(trim(device_id))>0),
 updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 CHECK(min_quantity_microunits<=expected_quantity_microunits AND expected_quantity_microunits<=max_quantity_microunits)
) STRICT;

CREATE TABLE IF NOT EXISTS stock_loss_attribution (
 loss_id TEXT PRIMARY KEY NOT NULL, inventory_id TEXT REFERENCES inventory_state(inventory_id) DEFERRABLE INITIALLY DEFERRED,
 fusion_id TEXT REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED, sku TEXT NOT NULL COLLATE NOCASE,
 detected_at INTEGER NOT NULL CHECK(detected_at>=946684800000), expected_loss_microunits INTEGER NOT NULL CHECK(expected_loss_microunits>=0),
 min_loss_microunits INTEGER NOT NULL CHECK(min_loss_microunits>=0), max_loss_microunits INTEGER NOT NULL CHECK(max_loss_microunits>=0),
 spoilage_prob INTEGER NOT NULL CHECK(spoilage_prob BETWEEN 0 AND 1000000), theft_prob INTEGER NOT NULL CHECK(theft_prob BETWEEN 0 AND 1000000),
 personal_use_prob INTEGER NOT NULL CHECK(personal_use_prob BETWEEN 0 AND 1000000), other_loss_prob INTEGER NOT NULL DEFAULT 0 CHECK(other_loss_prob BETWEEN 0 AND 1000000),
 environmental_covariates TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(environmental_covariates)), distribution_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(distribution_json)),
 confidence_score INTEGER NOT NULL CHECK(confidence_score BETWEEN 0 AND 1000000),
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0), device_id TEXT NOT NULL CHECK(length(trim(device_id))>0),
 updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 CHECK(min_loss_microunits<=expected_loss_microunits AND expected_loss_microunits<=max_loss_microunits),
 CHECK(spoilage_prob+theft_prob+personal_use_prob+other_loss_prob=1000000)
) STRICT;

CREATE TABLE IF NOT EXISTS portion_inference (
 inference_id TEXT PRIMARY KEY NOT NULL, fusion_id TEXT REFERENCES event_fusion(fusion_id) DEFERRABLE INITIALLY DEFERRED,
 source_evidence_id TEXT REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED, material_sku TEXT NOT NULL COLLATE NOCASE,
 inferred_output_sku TEXT COLLATE NOCASE, window_started_at INTEGER NOT NULL CHECK(window_started_at>=946684800000),
 window_ended_at INTEGER NOT NULL CHECK(window_ended_at>=window_started_at), input_burn_microunits INTEGER NOT NULL CHECK(input_burn_microunits>0),
 inferred_portions_expected INTEGER NOT NULL CHECK(inferred_portions_expected>=0), inferred_portions_min INTEGER NOT NULL CHECK(inferred_portions_min>=0), inferred_portions_max INTEGER NOT NULL CHECK(inferred_portions_max>=0),
 portion_size_expected_microunits INTEGER NOT NULL CHECK(portion_size_expected_microunits>=0), portion_size_min_microunits INTEGER NOT NULL CHECK(portion_size_min_microunits>=0), portion_size_max_microunits INTEGER NOT NULL CHECK(portion_size_max_microunits>=0),
 context_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(context_json)), confidence_score INTEGER NOT NULL CHECK(confidence_score BETWEEN 0 AND 1000000), model_version TEXT NOT NULL,
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0), device_id TEXT NOT NULL CHECK(length(trim(device_id))>0),
 updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 CHECK(inferred_portions_min<=inferred_portions_expected AND inferred_portions_expected<=inferred_portions_max),
 CHECK(portion_size_min_microunits<=portion_size_expected_microunits AND portion_size_expected_microunits<=portion_size_max_microunits)
) STRICT;

CREATE TABLE IF NOT EXISTS lexicon_terms (
 term_id TEXT PRIMARY KEY NOT NULL, surface_form TEXT NOT NULL COLLATE NOCASE, normalized_form TEXT NOT NULL COLLATE NOCASE, language_tag TEXT NOT NULL DEFAULT 'und',
 term_kind TEXT NOT NULL CHECK(term_kind IN ('unit','entity_alias','material_alias','action','other')), canonical_unit TEXT,
 baseline_expected_microunits INTEGER CHECK(baseline_expected_microunits IS NULL OR baseline_expected_microunits>=0),
 baseline_min_microunits INTEGER CHECK(baseline_min_microunits IS NULL OR baseline_min_microunits>=0), baseline_max_microunits INTEGER CHECK(baseline_max_microunits IS NULL OR baseline_max_microunits>=0),
 unit_variance_range TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(unit_variance_range)), context_confidence INTEGER NOT NULL CHECK(context_confidence BETWEEN 0 AND 1000000),
 context_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(context_json)), canonical_entity_id TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
 canonical_sku TEXT COLLATE NOCASE, source_evidence_id TEXT REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0), device_id TEXT NOT NULL CHECK(length(trim(device_id))>0),
 updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 CHECK((baseline_min_microunits IS NULL AND baseline_expected_microunits IS NULL AND baseline_max_microunits IS NULL) OR (baseline_min_microunits<=baseline_expected_microunits AND baseline_expected_microunits<=baseline_max_microunits)),
 CHECK(term_kind<>'unit' OR (canonical_unit IS NOT NULL AND baseline_expected_microunits IS NOT NULL))
) STRICT;

CREATE TABLE IF NOT EXISTS alias_resolution_candidates (
 resolution_id TEXT PRIMARY KEY NOT NULL, evidence_id TEXT NOT NULL REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
 term_id TEXT REFERENCES lexicon_terms(term_id) DEFERRABLE INITIALLY DEFERRED, mention_text TEXT NOT NULL COLLATE NOCASE,
 mention_start_offset INTEGER CHECK(mention_start_offset IS NULL OR mention_start_offset>=0), mention_end_offset INTEGER CHECK(mention_end_offset IS NULL OR mention_end_offset>=mention_start_offset),
 resolution_kind TEXT NOT NULL CHECK(resolution_kind IN ('entity','material')), candidate_entity_id TEXT REFERENCES entities(entity_id) DEFERRABLE INITIALLY DEFERRED,
 candidate_sku TEXT COLLATE NOCASE, context_confidence INTEGER NOT NULL CHECK(context_confidence BETWEEN 0 AND 1000000),
 unit_variance_range TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(unit_variance_range)), rationale_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(rationale_json)),
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0), device_id TEXT NOT NULL CHECK(length(trim(device_id))>0),
 updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 CHECK((resolution_kind='entity' AND candidate_entity_id IS NOT NULL AND candidate_sku IS NULL) OR (resolution_kind='material' AND candidate_sku IS NOT NULL AND candidate_entity_id IS NULL))
) STRICT;

CREATE TABLE IF NOT EXISTS sync_peers (
 peer_id TEXT PRIMARY KEY NOT NULL, peer_label TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0), device_id TEXT NOT NULL CHECK(length(trim(device_id))>0),
 updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1))
) STRICT;
CREATE TABLE IF NOT EXISTS sync_peer_watermarks (
 peer_id TEXT PRIMARY KEY NOT NULL REFERENCES sync_peers(peer_id) DEFERRABLE INITIALLY DEFERRED,
 ack_hlc_wall_ms INTEGER NOT NULL CHECK(ack_hlc_wall_ms>=946684800000), ack_hlc_logical INTEGER NOT NULL CHECK(ack_hlc_logical>=0), ack_device_id TEXT NOT NULL,
 acknowledged_at INTEGER NOT NULL CHECK(acknowledged_at>=946684800000), hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0),
 device_id TEXT NOT NULL CHECK(length(trim(device_id))>0), updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1))
) STRICT;
CREATE TABLE IF NOT EXISTS evidence_archive_manifest (
 evidence_id TEXT PRIMARY KEY NOT NULL REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
 content_sha256 TEXT, archive_uri TEXT, archive_reason TEXT NOT NULL CHECK(archive_reason IN ('fused_and_ledger_synced','retention_expired','manual')),
 archived_at INTEGER NOT NULL CHECK(archived_at>=946684800000), hlc_wall_ms INTEGER NOT NULL CHECK(hlc_wall_ms>=946684800000), hlc_logical INTEGER NOT NULL CHECK(hlc_logical>=0),
 device_id TEXT NOT NULL CHECK(length(trim(device_id))>0), updated_at INTEGER NOT NULL CHECK(updated_at=hlc_wall_ms), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1))
) STRICT;

-- 3. CRDT VIEWS. Rank first, then hide a winning tombstone.
CREATE VIEW IF NOT EXISTS resolved_entities AS
WITH r AS (SELECT e.*,ROW_NUMBER() OVER(PARTITION BY entity_id ORDER BY hlc_wall_ms DESC,hlc_logical DESC,device_id DESC) n FROM entities e)
SELECT entity_id,canonical_name,entity_type,aliases_json,notes,hlc_wall_ms,hlc_logical,device_id,updated_at,is_deleted FROM r WHERE n=1 AND is_deleted=0;
CREATE VIEW IF NOT EXISTS resolved_ledger AS
WITH r AS (SELECT l.*,ROW_NUMBER() OVER(PARTITION BY entry_id ORDER BY hlc_wall_ms DESC,hlc_logical DESC,device_id DESC) n FROM ledger_entries l)
SELECT entry_id,occurred_at,debit_account,credit_account,amount_minor,currency_code,counterparty_entity_id,evidence_id,memo,hlc_wall_ms,hlc_logical,device_id,updated_at,is_deleted FROM r WHERE n=1 AND is_deleted=0;
CREATE VIEW IF NOT EXISTS resolved_inventory AS
WITH r AS (SELECT i.*,ROW_NUMBER() OVER(PARTITION BY inventory_id ORDER BY hlc_wall_ms DESC,hlc_logical DESC,device_id DESC) n FROM inventory_state i)
SELECT inventory_id,sku,location_code,quantity_microunits,unit_cost_minor,currency_code,owner_entity_id,evidence_id,hlc_wall_ms,hlc_logical,device_id,updated_at,is_deleted FROM r WHERE n=1 AND is_deleted=0;
CREATE VIEW IF NOT EXISTS prunable_raw_evidence AS
SELECT r.evidence_id,r.content_sha256,r.hlc_wall_ms,r.hlc_logical,r.device_id FROM raw_evidence r
WHERE r.is_deleted=0 AND EXISTS(SELECT 1 FROM event_fusion_evidence fe JOIN event_fusion f ON f.fusion_id=fe.fusion_id JOIN probabilistic_ledger_estimates pe ON pe.fusion_id=f.fusion_id JOIN ledger_entries l ON l.entry_id=pe.entry_id WHERE fe.evidence_id=r.evidence_id AND fe.is_deleted=0 AND f.is_deleted=0 AND pe.is_deleted=0 AND l.is_deleted=0)
AND NOT EXISTS(SELECT 1 FROM sync_peers sp LEFT JOIN sync_peer_watermarks sw ON sw.peer_id=sp.peer_id AND sw.is_deleted=0 WHERE sp.is_active=1 AND sp.is_deleted=0 AND (sw.peer_id IS NULL OR sw.ack_hlc_wall_ms<r.hlc_wall_ms OR (sw.ack_hlc_wall_ms=r.hlc_wall_ms AND sw.ack_hlc_logical<r.hlc_logical) OR (sw.ack_hlc_wall_ms=r.hlc_wall_ms AND sw.ack_hlc_logical=r.hlc_logical AND sw.ack_device_id<r.device_id)));

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_entities_lww ON entities(entity_id,hlc_wall_ms DESC,hlc_logical DESC,device_id DESC,is_deleted);
CREATE INDEX IF NOT EXISTS idx_ledger_lww ON ledger_entries(entry_id,hlc_wall_ms DESC,hlc_logical DESC,device_id DESC,is_deleted);
CREATE INDEX IF NOT EXISTS idx_inventory_lww ON inventory_state(inventory_id,hlc_wall_ms DESC,hlc_logical DESC,device_id DESC,is_deleted);
CREATE INDEX IF NOT EXISTS idx_evidence_lww ON raw_evidence(evidence_id,hlc_wall_ms DESC,hlc_logical DESC,device_id DESC,is_deleted);
CREATE INDEX IF NOT EXISTS idx_fusion_lww ON event_fusion(fusion_id,hlc_wall_ms DESC,hlc_logical DESC,device_id DESC,is_deleted);
CREATE INDEX IF NOT EXISTS idx_prob_ledger_range ON probabilistic_ledger_estimates(confidence_score DESC,min_amount_minor,max_amount_minor,occurred_at DESC) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_prob_inventory_range ON probabilistic_inventory_estimates(confidence_score DESC,min_quantity_microunits,max_quantity_microunits,observed_at DESC) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_loss_range ON stock_loss_attribution(confidence_score DESC,min_loss_microunits,max_loss_microunits,detected_at DESC) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_portion_range ON portion_inference(material_sku COLLATE NOCASE,confidence_score DESC,portion_size_min_microunits,portion_size_max_microunits) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_lexicon_text ON lexicon_terms(normalized_form COLLATE NOCASE,surface_form COLLATE NOCASE,language_tag,context_confidence DESC) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_alias_mention ON alias_resolution_candidates(mention_text COLLATE NOCASE,resolution_kind,context_confidence DESC) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_alias_entity ON alias_resolution_candidates(candidate_entity_id,context_confidence DESC) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_fusion_evidence ON event_fusion_evidence(evidence_id,fusion_id) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_sync_watermark ON sync_peer_watermarks(peer_id,ack_hlc_wall_ms,ack_hlc_logical,ack_device_id,is_deleted);

-- 5. TRIGGERS. Evidence is redacted through a newer HLC tombstone, never hard-deleted.
CREATE TRIGGER IF NOT EXISTS trg_raw_evidence_no_hard_delete
BEFORE DELETE ON raw_evidence BEGIN SELECT RAISE(ABORT,'raw_evidence must be archived via an HLC tombstone'); END;
CREATE TRIGGER IF NOT EXISTS trg_archive_manifest_no_hard_delete
BEFORE DELETE ON evidence_archive_manifest BEGIN SELECT RAISE(ABORT,'archive manifests are audit records'); END;

-- Safe archival procedure: in one IMMEDIATE transaction, INSERT an archive manifest
-- from prunable_raw_evidence, then UPDATE that evidence with a strictly newer HLC,
-- payload_json=json_object('archived',1,'archive_uri',:archive_uri,'content_sha256',content_sha256), and is_deleted=1.
