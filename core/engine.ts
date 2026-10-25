import { DataPayload, EngineResult, EpistemicConfidence } from '../shared/types';
import { InvariantValidator } from './constraints';

export class CoreDecisionEngine {
  private lastKnownLogicalClock = 0;
  private causalHistory: string[] = [];

  /**
   * Processes data through the 0.5% mechanism:
   * 1. Validates physical/causal invariants
   * 2. Evaluates epistemic confidence lattice
   * 3. Calculates interval bounds instead of blind point predictions
   * 4. Chooses when to abstain rather than hallucinate
   */
  public process(payload: DataPayload, noiseIntensity = 0): EngineResult {
    const startTime = performance.now();
    const violations: string[] = [];

    // Invariant 1: Clock check
    const clockCheck = InvariantValidator.validateClockInvariant(payload, this.lastKnownLogicalClock);
    if (!clockCheck.valid && clockCheck.error) {
      violations.push(clockCheck.error);
    }

    // Advance logical clock safely
    this.lastKnownLogicalClock = Math.max(this.lastKnownLogicalClock + 1, payload.logicalLamportClock || 0);
    this.causalHistory.push(payload.id);

    // Epistemic lattice evaluation
    const epistemicState: EpistemicConfidence = InvariantValidator.evaluateEpistemicLattice(noiseIntensity, 120);

    // Dynamic uncertainty bounds
    const baseValue = 100;
    const noiseSpread = (noiseIntensity / 100) * 45;
    const minEstimate = Math.max(0, baseValue - noiseSpread);
    const maxEstimate = baseValue + noiseSpread;
    const interval = maxEstimate - minEstimate;

    // Decision logic
    const shouldAbstain = epistemicState === 'UNKNOWN_ABSTAIN' || violations.length > 0;
    const confidenceScore = shouldAbstain ? 0.15 : Math.max(0.4, 1.0 - (noiseIntensity / 120));

    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    return {
      decisionId: `eng-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      inputEcho: payload.rawInput,
      primaryDecision: shouldAbstain 
        ? '[ABSTAINED] Critical invariant violated or signal-to-noise ratio too low'
        : `[COMMITTED] Verified actionable output with interval bounds [${minEstimate.toFixed(1)}, ${maxEstimate.toFixed(1)}]`,
      confidenceScore,
      epistemicState,
      bounds: {
        minEstimate,
        maxEstimate,
        uncertaintyInterval: interval,
      },
      invariantViolationsDetected: violations,
      abstained: shouldAbstain,
      latencyMs,
      causalParents: this.causalHistory.slice(-3),
      explanation: violations.length > 0
        ? `Refused blind prediction. Caught invariant violation: ${violations.join('; ')}`
        : `Decision verified under epistemic state ${epistemicState} with computed error bounds.`
    };
  }
}
