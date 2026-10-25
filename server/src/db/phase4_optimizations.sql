-- Phase 4: edge tuning, read-path indexes, and CRDT-safe evidence archival.
-- Execute after Phase 1 through Phase 3.  Connection-scoped PRAGMAs must be
-- issued for every database connection by the application.

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

-- Indexes match the logical-id / descending-HLC ordering used by resolved views.
CREATE INDEX IF NOT EXISTS idx_entities_lww_read
    ON entities(entity_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);
CREATE INDEX IF NOT EXISTS idx_ledger_lww_read
    ON ledger_entries(entry_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);
CREATE INDEX IF NOT EXISTS idx_inventory_lww_read
    ON inventory_state(inventory_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);
CREATE INDEX IF NOT EXISTS idx_evidence_lww_read
    ON raw_evidence(evidence_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);
CREATE INDEX IF NOT EXISTS idx_fusion_lww_read
    ON event_fusion(fusion_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);
CREATE INDEX IF NOT EXISTS idx_lexicon_lww_read
    ON lexicon_terms(term_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);

-- Range estimates: confidence-first queries narrow high-quality candidate sets,
-- then use lower/upper bounds for overlap tests.
CREATE INDEX IF NOT EXISTS idx_prob_ledger_range_live
    ON probabilistic_ledger_estimates(confidence_score DESC, min_amount_minor, max_amount_minor, occurred_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_prob_inventory_range_live
    ON probabilistic_inventory_estimates(confidence_score DESC, min_quantity_microunits, max_quantity_microunits, observed_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_loss_range_live
    ON stock_loss_attribution(confidence_score DESC, min_loss_microunits, max_loss_microunits, detected_at DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_portion_range_live
    ON portion_inference(material_sku COLLATE NOCASE, confidence_score DESC,
                         portion_size_min_microunits, portion_size_max_microunits)
    WHERE is_deleted = 0;

-- Local-language, code-switched term and alias resolution.
CREATE INDEX IF NOT EXISTS idx_lexicon_text_live
    ON lexicon_terms(normalized_form COLLATE NOCASE, surface_form COLLATE NOCASE,
                     language_tag, context_confidence DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_alias_mention_text_live
    ON alias_resolution_candidates(mention_text COLLATE NOCASE, resolution_kind,
                                   context_confidence DESC)
    WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_entity_alias_search_live
    ON entities(canonical_name COLLATE NOCASE, entity_type, updated_at DESC)
    WHERE is_deleted = 0;

-- A peer is an enrolled replica that must acknowledge a globally ordered HLC
-- position before bulky evidence may be redacted locally.
CREATE TABLE IF NOT EXISTS sync_peers (
    peer_id              TEXT PRIMARY KEY NOT NULL,
    peer_label           TEXT,
    is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    hlc_wall_ms          INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical          INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id            TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at           INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted           INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    CHECK (length(peer_id) > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_sync_peers_active
    ON sync_peers(is_active, is_deleted, peer_id);
CREATE INDEX IF NOT EXISTS idx_sync_peers_lww
    ON sync_peers(peer_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);

CREATE TABLE IF NOT EXISTS sync_peer_watermarks (
    peer_id                 TEXT PRIMARY KEY NOT NULL REFERENCES sync_peers(peer_id) DEFERRABLE INITIALLY DEFERRED,
    ack_hlc_wall_ms         INTEGER NOT NULL CHECK (ack_hlc_wall_ms >= 946684800000),
    ack_hlc_logical         INTEGER NOT NULL CHECK (ack_hlc_logical >= 0),
    ack_device_id           TEXT NOT NULL CHECK (length(trim(ack_device_id)) > 0),
    acknowledged_at         INTEGER NOT NULL CHECK (acknowledged_at >= 946684800000),
    hlc_wall_ms             INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical             INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id               TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at              INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted              INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_sync_watermarks_ack
    ON sync_peer_watermarks(peer_id, ack_hlc_wall_ms, ack_hlc_logical, ack_device_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_sync_watermarks_lww
    ON sync_peer_watermarks(peer_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);

-- Manifest records the immutable hash and archive location before an evidence
-- envelope is redacted.  It deliberately retains the evidence ID for audit/FK use.
CREATE TABLE IF NOT EXISTS evidence_archive_manifest (
    evidence_id             TEXT PRIMARY KEY NOT NULL REFERENCES raw_evidence(evidence_id) DEFERRABLE INITIALLY DEFERRED,
    content_sha256          TEXT CHECK (content_sha256 IS NULL OR
                            (length(content_sha256) = 64 AND content_sha256 NOT GLOB '*[^0-9A-Fa-f]*')),
    archive_uri             TEXT,
    archive_reason          TEXT NOT NULL CHECK (archive_reason IN ('fused_and_ledger_synced', 'retention_expired', 'manual')),
    archived_at             INTEGER NOT NULL CHECK (archived_at >= 946684800000),
    hlc_wall_ms             INTEGER NOT NULL CHECK (hlc_wall_ms >= 946684800000),
    hlc_logical             INTEGER NOT NULL CHECK (hlc_logical >= 0),
    device_id               TEXT NOT NULL CHECK (length(trim(device_id)) > 0),
    updated_at              INTEGER NOT NULL CHECK (updated_at = hlc_wall_ms),
    is_deleted              INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_evidence_archive_lww
    ON evidence_archive_manifest(evidence_id, hlc_wall_ms DESC, hlc_logical DESC, device_id DESC, is_deleted);

-- A row is eligible only if it is (1) live, (2) represented by a live fusion,
-- (3) connected through that fusion to a live posted ledger entry, and (4) its
-- exact HLC position has been acknowledged by every active, live peer.
CREATE VIEW IF NOT EXISTS prunable_raw_evidence AS
SELECT r.evidence_id, r.content_sha256, r.hlc_wall_ms, r.hlc_logical, r.device_id
FROM raw_evidence AS r
WHERE r.is_deleted = 0
  AND EXISTS (
      SELECT 1
      FROM event_fusion_evidence AS fe
      JOIN event_fusion AS f ON f.fusion_id = fe.fusion_id
      JOIN probabilistic_ledger_estimates AS pe ON pe.fusion_id = f.fusion_id
      JOIN ledger_entries AS l ON l.entry_id = pe.entry_id
      WHERE fe.evidence_id = r.evidence_id
        AND fe.is_deleted = 0 AND f.is_deleted = 0
        AND pe.is_deleted = 0 AND l.is_deleted = 0
  )
  AND NOT EXISTS (
      SELECT 1
      FROM sync_peers AS sp
      LEFT JOIN sync_peer_watermarks AS sw
        ON sw.peer_id = sp.peer_id AND sw.is_deleted = 0
      WHERE sp.is_active = 1 AND sp.is_deleted = 0
        AND (sw.peer_id IS NULL
          OR sw.ack_hlc_wall_ms < r.hlc_wall_ms
          OR (sw.ack_hlc_wall_ms = r.hlc_wall_ms AND sw.ack_hlc_logical < r.hlc_logical)
          OR (sw.ack_hlc_wall_ms = r.hlc_wall_ms AND sw.ack_hlc_logical = r.hlc_logical
              AND sw.ack_device_id < r.device_id))
  );

-- Archival procedure (run in one IMMEDIATE transaction; bind all :parameters).
-- The caller must allocate (:prune_hlc_wall_ms, :prune_hlc_logical,
-- :prune_device_id) strictly greater than the candidate's current HLC tuple.
-- This never DELETEs raw evidence: it creates an audit manifest and replaces the
-- bulky envelope with a tombstone.  The tombstone must itself be synced normally.
--
-- INSERT INTO evidence_archive_manifest (
--   evidence_id, content_sha256, archive_uri, archive_reason, archived_at,
--   hlc_wall_ms, hlc_logical, device_id, updated_at, is_deleted
-- )
-- SELECT evidence_id, content_sha256, :archive_uri, 'fused_and_ledger_synced',
--        :archived_at, :prune_hlc_wall_ms, :prune_hlc_logical, :prune_device_id,
--        :prune_hlc_wall_ms, 0
-- FROM prunable_raw_evidence
-- WHERE evidence_id = :evidence_id;
--
-- UPDATE raw_evidence
-- SET payload_json = json_object('archived', 1, 'archive_uri', :archive_uri,
--                                'content_sha256', content_sha256),
--     hlc_wall_ms = :prune_hlc_wall_ms, hlc_logical = :prune_hlc_logical,
--     device_id = :prune_device_id, updated_at = :prune_hlc_wall_ms,
--     is_deleted = 1
-- WHERE evidence_id = :evidence_id
--   AND EXISTS (SELECT 1 FROM prunable_raw_evidence AS p WHERE p.evidence_id = :evidence_id)
--   AND (hlc_wall_ms < :prune_hlc_wall_ms
--     OR (hlc_wall_ms = :prune_hlc_wall_ms AND hlc_logical < :prune_hlc_logical)
--     OR (hlc_wall_ms = :prune_hlc_wall_ms AND hlc_logical = :prune_hlc_logical
--         AND device_id < :prune_device_id));
