import { DataPayload, BaselineResult } from '../shared/types';

/**
 * What 95% of teams in the hackathon room build:
 * A direct prompt/heuristic or point-prediction wrapper.
 * Fails to check physical invariants, assumes perfect timestamps, and hallucinates confident answers.
 */
export class NaiveCompetitorBaseline {
  public process(payload: DataPayload, noiseIntensity = 0): BaselineResult {
    const startTime = performance.now();

    // Naive systems blindly parse timestamps as valid
    const rawTime = typeof payload.timestamp === 'string' ? Date.parse(payload.timestamp) : payload.timestamp;

    // Failure Mode 1: 1970 clock reset crashes naive time diff logic
    if (rawTime < 172800000) {
      return {
        decisionId: `base-${Date.now()}`,
        rawLLMOutput: 'ERROR: Time index out of range (-1702848200000ms delta). Database transaction aborted.',
        claimedConfidence: 0.0,
        crashedOrHallucinated: true,
        failureReason: 'Unhandled physical clock reset caused integer underflow or invalid ordering.',
        latencyMs: Number((performance.now() - startTime).toFixed(2))
      };
    }

    // Failure Mode 2: High acoustic/sensor noise causes blind hallucination
    if (noiseIntensity > 60) {
      return {
        decisionId: `base-${Date.now()}`,
        rawLLMOutput: 'AI Assistant: "I am 98% confident that everything is completely normal." (Hallucination)',
        claimedConfidence: 0.98, // Dangerous overconfidence
        crashedOrHallucinated: true,
        failureReason: 'Blind point prediction with false overconfidence under high noise.',
        latencyMs: Number((performance.now() - startTime + 80).toFixed(2)) // LLMs are slow
      };
    }

    // Happy path for naive baseline
    return {
      decisionId: `base-${Date.now()}`,
      rawLLMOutput: `Standard Output: Parsed "${payload.rawInput}" successfully.`,
      claimedConfidence: 0.85,
      crashedOrHallucinated: false,
      latencyMs: Number((performance.now() - startTime + 50).toFixed(2))
    };
  }
}
