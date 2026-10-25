/**
 * Shared Type Definitions for Team Cascade
 * Shared between Expo Go Mobile App, Node.js Server, Core Engine, and Evaluation Harness
 */

export type EpistemicConfidence = 'VERIFIED_KNOWN' | 'PROBABLE' | 'DEGRADED_OUTDATED' | 'UNKNOWN_ABSTAIN';

export interface DataPayload {
  id: string;
  timestamp: number | string; // Real-world timestamps may be corrupted (e.g. 1970-01-01)
  logicalLamportClock?: number; // Causal clock invariant
  source: string;
  rawInput: string;
  metadata?: Record<string, unknown>;
}

export interface EngineResult {
  decisionId: string;
  inputEcho: string;
  primaryDecision: string;
  confidenceScore: number; // 0.0 to 1.0
  epistemicState: EpistemicConfidence;
  bounds: {
    minEstimate: number;
    maxEstimate: number;
    uncertaintyInterval: number;
  };
  invariantViolationsDetected: string[];
  abstained: boolean;
  latencyMs: number;
  causalParents: string[];
  explanation: string;
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
