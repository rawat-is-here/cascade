/**
 * Shared Type Definitions for Team Cascade
 * "The Invisible Worker" - 0.5% Anti-Template Probabilistic Offline Ledger Engine
 * Shared across Mobile App, Server, Core Engine, CRDT, and Evaluation Harness
 */

// ==========================================
// 1. EPISTEMIC CONFIDENCE LATTICE
// ==========================================
export type EpistemicConfidence = 
  | 'VERIFIED_KNOWN'      // Verified by trusted multi-modal evidence within freshness window
  | 'PROBABLE'            // Plausible bounds, historically consistent
  | 'DEGRADED_OUTDATED'   // Signal degraded, noisy, or aged beyond threshold
  | 'UNKNOWN_ABSTAIN';    // Critical invariant violation or SNR too low; refuse prediction

export interface AffineInterval {
  minEstimate: number;
  maxEstimate: number;
  uncertaintyInterval: number; // maxEstimate - minEstimate
}

// ==========================================
// 2. HYBRID LOGICAL CLOCK & CRDT
// ==========================================
export interface HLC {
  wallMs: number;       // Physical clock in UTC milliseconds (>= 946684800000, 2000-01-01)
  logical: number;      // Monotonic sequence counter for ties within the same millisecond
  deviceId: string;     // Unique client device identifier (e.g. "dev-family-phone-01")
}

export type StandardAccount =
  | 'Assets:Cash'
  | 'Assets:Bank:UPI'
  | 'Assets:Receivable'
  | 'Assets:Inventory'
  | 'Expenses:COGS'
  | 'Expenses:Wastage:Spoilage'
  | 'Expenses:Wastage:Theft'
  | 'Expenses:PromotionalGoodwill'
  | 'Expenses:CashRoundingLoss'
  | 'Equity:PersonalDraw'
  | 'Revenue:Sales'
  | 'Liabilities:Payable:Supplier';

export type Account = 
  | 'cash'
  | 'credit'
  | 'inventory'
  | 'cogs'
  | 'spoilage'
  | 'theft'
  | 'personal'
  | 'sales'
  | 'supplier';

export interface TxPosting {
  debit: Account | string;
  credit: Account | string;
  amount: number;
  alias?: string;
  item?: string;
  qty?: number;
  unit?: string;
  confidence?: number;
}

export interface VendorEvent {
  id: string;
  type: 'speech' | 'sms' | 'paper' | 'count';
  raw: string;
  entries: TxPosting[];
  timestamp: number;
  clock: number;
}

export interface LossReport {
  item: string;
  lostQty: number;
  unit: string;
  spoilage: number;
  theft: number;
  eating: number;
  range: [number, number];
}

export interface CRDTNode {
  nodeId: string;
  clock: number;
  parents: string[];
  hash: string;
  event: VendorEvent;
}

export interface ProfitBounds {
  drawerCash: number;
  revenue: number;
  cogs: number;
  debt: number;
  unpaidCredit: number;
  spoilageCost: number;
  personalDraw: number;
  profitRange: [number, number];
  note: string;
}

export interface BalancedDelta {
  txId: string;
  occurredAt: number;       // Inferred physical timestamp
  debitAccount: string;     // e.g. "Assets:Cash", "Expenses:COGS"
  creditAccount: string;    // e.g. "Revenue:Sales", "Assets:Inventory"
  amountMinor: number;      // Integer minor units (e.g. paise / cents), strictly > 0
  currencyCode: string;     // 'INR'
  bounds: AffineInterval;
  counterpartyEntityId?: string;
  evidenceId?: string;
  memo?: string;
  hlc: HLC;
  parentHashes: string[];   // Merkle causal parent hashes
  hash: string;             // SHA-256 hash of this operation
  isDeleted?: boolean;
}

export interface DAGNode {
  hash: string;
  delta: BalancedDelta;
  parents: string[];
  lamportClock: number;
  epistemicState: EpistemicConfidence;
}

// ==========================================
// 3. MULTI-MODAL & NEGOTIATION TYPES
// ==========================================
export type SpeakerRole = 'VENDOR' | 'CUSTOMER' | 'UNKNOWN';

export type NegotiationDialogueAct = 
  | 'PRICE_INQUIRY'       // "tamatar kitne ka"
  | 'VENDOR_QUOTE'        // "40 ka diya"
  | 'CUSTOMER_COUNTER'    // "nahi 30 ka lagao"
  | 'VENDOR_CONCESSION'   // "ok", "theek hai"
  | 'VENDOR_REJECTION'    // "nahi hoga", "35 se kam nahi"
  | 'QUANTITY_SPEC'       // "aadha kilo kar do"
  | 'VALUE_ORDER'         // "50 rupaye ka de do"
  | 'FREEBIE_REQUEST'     // "thoda mirchi daal do"
  | 'WALK_AWAY'           // "rehne do"
  | 'TRANSACTION_CLOSE';

export interface CustomerVoiceCluster {
  clusterId: string;             // e.g. "CUST_01"
  centroidVector: number[];      // 192-d normalized ECAPA-TDNN centroid
  lastSpokeAt: number;           // Timestamp for TTL eviction (120s)
  associatedAlias?: string;      // e.g. "ENT-SHARMA-01"
}

export interface ActiveCustomerNegotiation {
  sessionKey: string;            // e.g. "CUST_01:TOMATO"
  customerId: string;            // "CUST_01"
  itemName: string;              // "tomato"
  currentState: 
    | 'IDLE' 
    | 'INQUIRY' 
    | 'VENDOR_QUOTE' 
    | 'CUSTOMER_COUNTER' 
    | 'VENDOR_CONCEDED' 
    | 'QUANTITY_LOCKED' 
    | 'WALK_AWAY';
  currentQuotedRate?: number;
  finalAgreedRate?: number;
  quantity?: number;
  unit?: string;
  derivedTotalAmount?: number;
  isVendorConfirmed: boolean;
  lastActiveTimestamp: number;
}

export interface AmountCandidate {
  amount: number;
  acousticConfidence: number; // 0.0 to 1.0
}

export interface AudioHypothesisBundle {
  snippetId: string;
  timestamp: number;
  rawTranscript: string;
  noiseDb: number;
  speakerRole: SpeakerRole;
  customerId?: string;
  negotiation?: ActiveCustomerNegotiation;
  entities: {
    alias?: { raw: string; canonicalId: string; confidence: number };
    candidateAmounts: AmountCandidate[];
    orderItem?: { name: string; quantity: number; unit: string };
  };
  epistemicState: EpistemicConfidence;
}

export interface ParsedUPINotification {
  notificationId: string;
  sourceApp: 'PAYTM' | 'PHONEPE' | 'GPAY' | 'BANK_SMS';
  amount: number;
  refId: string; // Unique RRN for idempotency
  payerName?: string;
  receivedAt: number;
}

export interface ConfirmedDigitalTransaction {
  txId: string;
  sourceAudioId?: string;
  upiRefId: string;
  amount: number;
  entityId?: string;
  settledAt: number;
}

export interface DailyHypothesisStoreState {
  confirmedDigitalTransactions: ConfirmedDigitalTransaction[];
  uncommittedCashHypotheses: AudioHypothesisBundle[];
  totalConfirmedDigitalCash: number;
}

export interface EODReconciliationRequest {
  openingFloat: number;
  closingPhysicalCash: number;
  knownCashExpenses: number;
  confirmedUpiTotal: number;
}

export interface ResolvedTransaction {
  snippetId: string;
  chosenAmount: number;
  acousticConfidence: number;
  epistemicState: EpistemicConfidence;
  rationale: string;
}

export interface RecipeInferenceResult {
  menuItemId: string;
  ingredientPortions: {
    ingredient: string;
    meanGrams: number;
    interval: AffineInterval;
  }[];
  driftPercentage: number; // e.g. -14.2% portion shrinkage
}

export interface LossAttributionReport {
  ingredient: string;
  unrecordedLossKg: number;
  attribution: {
    spoilage: { kg: number; probability: number };
    theft: { kg: number; probability: number };
    personalConsumption: { kg: number; probability: number };
  };
}

export interface TrueAccrualProfitReport {
  cashInHand: number;
  reconciledCreditReceivables: AffineInterval;
  trueCogsBurned: AffineInterval;
  attributedWastageCost: AffineInterval;
  netAccrualProfit: {
    p10WorstCase: number;
    p50Expected: number;
    p90BestCase: number;
  };
  epistemicState: EpistemicConfidence;
}

export interface EODReconciliationResult {
  targetCashDelta: number;
  totalResolvedCash: number;
  drawerDiscrepancy: number; // ε_slack
  attributionTag: 'EXACT_MATCH' | 'ROUNDING_FRICTION' | 'UNRECORDED_LEAKAGE' | 'DROWNED_SALES_SURPLUS';
  resolvedTransactions: ResolvedTransaction[];
  committedDeltas: BalancedDelta[];
}

// ==========================================
// 4. CORE ENGINE & BENCHMARK INTERFACES
// ==========================================
export interface DataPayload {
  id: string;
  timestamp: number | string; // Real-world timestamps may be corrupted (e.g. 1970-01-01)
  logicalLamportClock?: number; // Causal clock invariant
  source: string;
  rawInput: string;
  metadata?: Record<string, unknown>;
  delta?: Partial<BalancedDelta>;
}

export interface EngineResult {
  decisionId: string;
  inputEcho: string;
  primaryDecision: string;
  confidenceScore: number; // 0.0 to 1.0
  epistemicState: EpistemicConfidence;
  bounds: AffineInterval;
  invariantViolationsDetected: string[];
  abstained: boolean;
  latencyMs: number;
  causalParents: string[];
  explanation: string;
  crdtRootHash?: string;
  ledgerBalanceCheck?: {
    isBalanced: boolean;
    totalDebit: number;
    totalCredit: number;
  };
}

export interface BaselineResult {
  decisionId: string;
  rawLLMOutput: string;
  claimedConfidence: number;
  crashedOrHallucinated: boolean;
  failureReason?: string;
  latencyMs: number;
}

export type SabotageType = 
  | 'NONE_CLEAN'
  | 'NOISE_85DB'
  | 'CLOCK_DRIFT_1970'
  | 'NETWORK_SEVERED'
  | 'CORRUPTED_INVENTORY'
  | 'ADVERSARIAL_OUTLIER';

export interface SabotageEvent {
  scenario: SabotageType;
  intensity: number; // 0 to 100 slider value
  injectedAt: number;
  description: string;
}

export interface LiveComparisonState {
  currentScenario: SabotageType;
  sabotageIntensity: number;
  latestPayload?: DataPayload;
  baseline: BaselineResult;
  engine: EngineResult;
  systemMetrics: {
    totalEvents: number;
    baselineFailures: number;
    engineRecoveries: number;
    averageEngineLatencyMs: number;
  };
}
