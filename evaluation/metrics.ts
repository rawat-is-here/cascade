export interface MetricReport {
  totalProcessed: number;
  baselineCrashRate: number; // percentage
  engineRecoveryRate: number; // percentage
  latencyAdvantageRatio: number;
}

export function computeMetrics(
  baselineResults: { crashedOrHallucinated: boolean; latencyMs: number }[],
  engineResults: { abstained: boolean; latencyMs: number }[]
): MetricReport {
  const total = baselineResults.length;
  const baselineCrashes = baselineResults.filter(r => r.crashedOrHallucinated).length;
  const engineRecoveries = engineResults.filter(r => !r.abstained).length;

  const avgBaseLatency = baselineResults.reduce((a, b) => a + b.latencyMs, 0) / (total || 1);
  const avgEngineLatency = engineResults.reduce((a, b) => a + b.latencyMs, 0) / (total || 1);

  return {
    totalProcessed: total,
    baselineCrashRate: Number(((baselineCrashes / (total || 1)) * 100).toFixed(1)),
    engineRecoveryRate: Number(((engineRecoveries / (total || 1)) * 100).toFixed(1)),
    latencyAdvantageRatio: Number((avgBaseLatency / (avgEngineLatency || 1)).toFixed(1))
  };
}
