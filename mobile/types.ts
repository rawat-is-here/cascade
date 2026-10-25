// Re-export core shared types
export * from '../shared/types';

// Extended frontend engine and benchmark types
export type SabotageType = 
  | 'NONE_CLEAN'
  | 'NOISE_85DB'
  | 'CLOCK_DRIFT_1970'
  | 'NETWORK_PARTITION'
  | 'FABRICATED_SLIP';

export interface EngineResult {
  primaryDecision: string;
  epistemicState: 'KNOWN_BOUNDS' | 'PROBABLE' | 'OUTDATED' | 'CRITICAL_COLLAPSE' | string;
  bounds?: {
    minEstimate: number;
    maxEstimate: number;
    uncertaintyInterval: number;
  };
  invariantViolationsDetected: string[];
  latencyMs: number;
  abstained: boolean;
}

export interface BaselineResult {
  rawLLMOutput: string;
  crashedOrHallucinated: boolean;
  failureReason?: string;
  latencyMs: number;
}
