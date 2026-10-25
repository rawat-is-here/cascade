/**
 * Database-boundary types for server/src/db/init_db.sql. SQL JSON values remain
 * strings in raw rows and are decoded only through the validators in this file.
 */
export const MIN_VALID_HLC_MS = 946_684_800_000;
export const MAX_PPM = 1_000_000;

declare const brand: unique symbol;
type Brand<T, Name extends string> = T & { readonly [brand]: Name };

export type EntityId = Brand<string, 'EntityId'>;
export type EvidenceId = Brand<string, 'EvidenceId'>;
export type FusionId = Brand<string, 'FusionId'>;
export type LedgerEntryId = Brand<string, 'LedgerEntryId'>;
export type InventoryId = Brand<string, 'InventoryId'>;
export type EstimateId = Brand<string, 'EstimateId'>;
export type DeviceId = Brand<string, 'DeviceId'>;
export type HlcWallMs = Brand<number, 'HlcWallMs'>;
export type HlcLogical = Brand<number, 'HlcLogical'>;
export type Ppm = Brand<number, 'Ppm'>;
export type CurrencyCode = Brand<string, 'CurrencyCode'>;

export type EntityType = 'customer' | 'supplier' | 'vendor' | 'person' | 'business' | 'unknown';
export type EvidenceType = 'text' | 'voice' | 'image' | 'receipt' | 'location' | 'sensor' | 'import' | 'other';
export type EventKind = 'sale' | 'purchase' | 'stock_count' | 'loss' | 'production' | 'payment' | 'other';
export type ResolutionMethod = 'manual' | 'rule' | 'model' | 'hybrid';
export type InferenceMethod = 'manual' | 'heuristic' | 'model' | 'fusion';
export type EvidenceRole = 'supporting' | 'contradicting' | 'context';
export type LexiconTermKind = 'unit' | 'entity_alias' | 'material_alias' | 'action' | 'other';
export type AliasResolutionKind = 'entity' | 'material';
export type ArchiveReason = 'fused_and_ledger_synced' | 'retention_expired' | 'manual';

export interface HlcTuple {
  readonly hlc_wall_ms: HlcWallMs;
  readonly hlc_logical: HlcLogical;
  readonly device_id: DeviceId;
}

export interface CrdtMetadata extends HlcTuple {
  readonly updated_at: HlcWallMs;
  readonly is_deleted: 0 | 1;
}

export interface NumericRange {
  readonly min: number;
  readonly expected: number;
  readonly max: number;
}

export type JsonObject = Readonly<Record<string, unknown>>;
export type JsonArray = readonly unknown[];

export interface EntityRow extends CrdtMetadata {
  readonly entity_id: EntityId;
  readonly canonical_name: string;
  readonly entity_type: EntityType;
  readonly aliases_json: string;
  readonly notes: string | null;
}

export interface RawEvidenceRow extends CrdtMetadata {
  readonly evidence_id: EvidenceId;
  readonly evidence_type: EvidenceType;
  readonly payload_json: string;
  readonly content_sha256: string | null;
  readonly observed_at: number | null;
  readonly source_entity_id: EntityId | null;
  readonly confidence_ppm: Ppm;
}

export interface EventFusionRow extends CrdtMetadata {
  readonly fusion_id: FusionId;
  readonly event_kind: EventKind;
  readonly occurred_at: number;
  readonly reconciled_payload_json: string;
  readonly contradiction_summary_json: string;
  readonly fusion_confidence_score: Ppm;
  readonly resolution_method: ResolutionMethod;
}

export interface LedgerEntryRow extends CrdtMetadata {
  readonly entry_id: LedgerEntryId;
  readonly occurred_at: number;
  readonly debit_account: string;
  readonly credit_account: string;
  readonly amount_minor: number;
  readonly currency_code: CurrencyCode;
  readonly counterparty_entity_id: EntityId | null;
  readonly evidence_id: EvidenceId | null;
  readonly memo: string | null;
}

export interface InventoryStateRow extends CrdtMetadata {
  readonly inventory_id: InventoryId;
  readonly sku: string;
  readonly location_code: string;
  readonly quantity_microunits: number;
  readonly unit_cost_minor: number | null;
  readonly currency_code: CurrencyCode;
  readonly owner_entity_id: EntityId | null;
  readonly evidence_id: EvidenceId | null;
}

export interface ProbabilisticLedgerEstimateRow extends CrdtMetadata {
  readonly estimate_id: EstimateId;
  readonly entry_id: LedgerEntryId | null;
  readonly fusion_id: FusionId | null;
  readonly occurred_at: number;
  readonly debit_account: string;
  readonly credit_account: string;
  readonly expected_amount_minor: number;
  readonly min_amount_minor: number;
  readonly max_amount_minor: number;
  readonly confidence_score: Ppm;
  readonly distribution_json: string;
  readonly currency_code: CurrencyCode;
  readonly counterparty_entity_id: EntityId | null;
  readonly inference_method: InferenceMethod;
}

export interface ProbabilisticInventoryEstimateRow extends CrdtMetadata {
  readonly estimate_id: EstimateId;
  readonly inventory_id: InventoryId | null;
  readonly fusion_id: FusionId | null;
  readonly sku: string;
  readonly location_code: string;
  readonly expected_quantity_microunits: number;
  readonly min_quantity_microunits: number;
  readonly max_quantity_microunits: number;
  readonly confidence_score: Ppm;
  readonly distribution_json: string;
  readonly observed_at: number;
  readonly inference_method: InferenceMethod;
}

export interface StockLossAttributionRow extends CrdtMetadata {
  readonly loss_id: string;
  readonly inventory_id: InventoryId | null;
  readonly fusion_id: FusionId | null;
  readonly sku: string;
  readonly detected_at: number;
  readonly expected_loss_microunits: number;
  readonly min_loss_microunits: number;
  readonly max_loss_microunits: number;
  readonly spoilage_prob: Ppm;
  readonly theft_prob: Ppm;
  readonly personal_use_prob: Ppm;
  readonly other_loss_prob: Ppm;
  readonly environmental_covariates: string;
  readonly distribution_json: string;
  readonly confidence_score: Ppm;
}

export interface PortionInferenceRow extends CrdtMetadata {
  readonly inference_id: string;
  readonly fusion_id: FusionId | null;
  readonly source_evidence_id: EvidenceId | null;
  readonly material_sku: string;
  readonly inferred_output_sku: string | null;
  readonly window_started_at: number;
  readonly window_ended_at: number;
  readonly input_burn_microunits: number;
  readonly inferred_portions_expected: number;
  readonly inferred_portions_min: number;
  readonly inferred_portions_max: number;
  readonly portion_size_expected_microunits: number;
  readonly portion_size_min_microunits: number;
  readonly portion_size_max_microunits: number;
  readonly context_json: string;
  readonly confidence_score: Ppm;
  readonly model_version: string;
}

export interface LexiconTermRow extends CrdtMetadata {
  readonly term_id: string;
  readonly surface_form: string;
  readonly normalized_form: string;
  readonly language_tag: string;
  readonly term_kind: LexiconTermKind;
  readonly canonical_unit: string | null;
  readonly baseline_expected_microunits: number | null;
  readonly baseline_min_microunits: number | null;
  readonly baseline_max_microunits: number | null;
  readonly unit_variance_range: string;
  readonly context_confidence: Ppm;
  readonly context_json: string;
  readonly canonical_entity_id: EntityId | null;
  readonly canonical_sku: string | null;
  readonly source_evidence_id: EvidenceId | null;
}

export interface AliasResolutionCandidateRow extends CrdtMetadata {
  readonly resolution_id: string;
  readonly evidence_id: EvidenceId;
  readonly term_id: string | null;
  readonly mention_text: string;
  readonly mention_start_offset: number | null;
  readonly mention_end_offset: number | null;
  readonly resolution_kind: AliasResolutionKind;
  readonly candidate_entity_id: EntityId | null;
  readonly candidate_sku: string | null;
  readonly context_confidence: Ppm;
  readonly unit_variance_range: string;
  readonly rationale_json: string;
}

export type ResolvedEntityRow = EntityRow;
export type ResolvedLedgerRow = LedgerEntryRow;
export type ResolvedInventoryRow = InventoryStateRow;

export interface EntityInput {
  readonly entity_id: EntityId;
  readonly canonical_name: string;
  readonly entity_type: EntityType;
  readonly aliases: JsonArray;
  readonly notes?: string | null;
  readonly hlc: HlcTuple;
  readonly is_deleted?: 0 | 1;
}

export interface LedgerEntryInput {
  readonly entry_id: LedgerEntryId;
  readonly occurred_at: number;
  readonly debit_account: string;
  readonly credit_account: string;
  readonly amount_minor: number;
  readonly currency_code?: CurrencyCode;
  readonly counterparty_entity_id?: EntityId | null;
  readonly evidence_id?: EvidenceId | null;
  readonly memo?: string | null;
  readonly hlc: HlcTuple;
  readonly is_deleted?: 0 | 1;
}

export interface RawEvidenceInput {
  readonly evidence_id: string;
  readonly evidence_type: EvidenceType;
  readonly payload_json: string;
  readonly content_sha256?: string | null;
  readonly observed_at?: number | null;
  readonly source_entity_id?: EntityId | null;
  readonly confidence_ppm?: Ppm;
  readonly hlc: HlcTuple;
  readonly is_deleted?: 0 | 1;
}

export function assertHlcTuple(value: { hlc_wall_ms: number; hlc_logical: number; device_id: string }): HlcTuple {
  if (!Number.isInteger(value.hlc_wall_ms) || value.hlc_wall_ms < MIN_VALID_HLC_MS) throw new Error('Invalid HLC wall time');
  if (!Number.isInteger(value.hlc_logical) || value.hlc_logical < 0) throw new Error('Invalid HLC logical counter');
  if (!value.device_id.trim()) throw new Error('HLC device ID must be non-empty');
  return value as HlcTuple;
}

export function asPpm(value: number): Ppm {
  if (!Number.isInteger(value) || value < 0 || value > MAX_PPM) throw new Error(`Expected ppm in 0..${MAX_PPM}`);
  return value as Ppm;
}

export function assertRange(range: NumericRange): NumericRange {
  if (![range.min, range.expected, range.max].every(Number.isInteger) || range.min > range.expected || range.expected > range.max) {
    throw new Error('Expected an integer range where min <= expected <= max');
  }
  return range;
}

export function parseJsonObject(json: string): JsonObject {
  const parsed: unknown = JSON.parse(json);
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected JSON object');
  return parsed as JsonObject;
}

export function parseJsonArray(json: string): JsonArray {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
  return parsed;
}

export function compareHlc(left: HlcTuple, right: HlcTuple): number {
  if (left.hlc_wall_ms !== right.hlc_wall_ms) return left.hlc_wall_ms - right.hlc_wall_ms;
  if (left.hlc_logical !== right.hlc_logical) return left.hlc_logical - right.hlc_logical;
  return left.device_id < right.device_id ? -1 : left.device_id > right.device_id ? 1 : 0;
}
