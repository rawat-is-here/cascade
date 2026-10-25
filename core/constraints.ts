import { DataPayload, EpistemicConfidence } from '../shared/types';

export interface InvariantCheckResult {
  passed: boolean;
  violations: string[];
  inferredState: EpistemicConfidence;
}

/**
 * Validates domain and physical invariants before any decision is committed.
 * This is the 0.5% anti-hallucination layer.
 */
export class InvariantValidator {
  /**
   * Checks for impossible physical clock jumps (e.g. 1970 UNIX epoch reset from dead phone batteries)
   */
  static validateClockInvariant(payload: DataPayload, lastKnownLogicalClock: number): { valid: boolean; error?: string } {
    const rawTime = typeof payload.timestamp === 'string' ? Date.parse(payload.timestamp) : payload.timestamp;
    
    // Check for 1970 epoch reset (within 48 hours of 1970-01-01)
    if (rawTime < 172800000) {
      return { 
        valid: false, 
        error: `Physical clock reset detected: timestamp=${payload.timestamp}. Causal Lamport clock must override.` 
      };
    }

    if (payload.logicalLamportClock && payload.logicalLamportClock < lastKnownLogicalClock) {
      return {
        valid: false,
        error: `Causal sequence violation: Lamport clock ${payload.logicalLamportClock} < last known ${lastKnownLogicalClock}`
      };
    }

    return { valid: true };
  }

  /**
   * Evaluates epistemic confidence based on input signal quality
   */
  static evaluateEpistemicLattice(noiseLevelDb: number, signalAgeSeconds: number): EpistemicConfidence {
    if (noiseLevelDb > 80 || signalAgeSeconds > 3600) {
      return 'UNKNOWN_ABSTAIN';
    }
    if (noiseLevelDb > 55 || signalAgeSeconds > 900) {
      return 'DEGRADED_OUTDATED';
    }
    if (noiseLevelDb > 30 || signalAgeSeconds > 300) {
      return 'PROBABLE';
    }
    return 'VERIFIED_KNOWN';
  }
}
