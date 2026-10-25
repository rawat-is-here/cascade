import { CoreDecisionEngine } from '../../../core/engine';
import { NaiveCompetitorBaseline } from '../../../baseline/naive_solution';
import { DataPayload, EngineResult, BaselineResult } from '../../../shared/types';

/**
 * Core Bridge orchestrating both the 0.5% Core Engine and the Competitor Baseline.
 * If Thackrey runs a Python microservice, this can easily fetch from localhost:8000.
 */
export class CoreBridge {
  private engine = new CoreDecisionEngine();
  private baseline = new NaiveCompetitorBaseline();

  public evaluateComparison(payload: DataPayload, noiseIntensity: number): {
    engine: EngineResult;
    baseline: BaselineResult;
  } {
    const engineResult = this.engine.process(payload, noiseIntensity);
    const baselineResult = this.baseline.process(payload, noiseIntensity);

    return {
      engine: engineResult,
      baseline: baselineResult
    };
  }
}
