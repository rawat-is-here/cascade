import { CoreDecisionEngine } from '../core/engine';
import { NaiveCompetitorBaseline } from '../baseline/naive_solution';
import normalCases from './datasets/normal_cases.json';
import adversarialCases from './datasets/adversarial_cases.json';

export function runThreeRunBenchmark() {
  const engine = new CoreDecisionEngine();
  const baseline = new NaiveCompetitorBaseline();

  console.log('================================================================');
  console.log('       TEAM CASCADE: 3-RUN SABOTAGE BENCHMARK SUITE             ');
  console.log('================================================================\n');

  // RUN 1: Clean Happy Path
  console.log('--- RUN 01: Standard Baseline on Clean Inputs ---');
  for (const item of normalCases) {
    const bRes = baseline.process(item, 10);
    const eRes = engine.process(item, 10);
    console.log(`[Item ${item.id}] Baseline: Latency ${bRes.latencyMs}ms | Engine: Latency ${eRes.latencyMs}ms | State: ${eRes.epistemicState}`);
  }

  // RUN 2 & 3: Hostile Inputs
  console.log('\n--- RUN 02 (Baseline under Sabotage) vs RUN 03 (Engine Recovery) ---');
  let baselineFailures = 0;
  let engineRecoveries = 0;

  for (const item of adversarialCases) {
    const noise = (item.metadata as { noiseDb?: number })?.noiseDb || 75;
    const bRes = baseline.process(item, noise);
    const eRes = engine.process(item, noise);

    if (bRes.crashedOrHallucinated) baselineFailures++;
    if (!eRes.abstained || eRes.invariantViolationsDetected.length > 0) engineRecoveries++;

    console.log(`\n[Sabotage Case: ${item.id}]`);
    console.log(`  ❌ Baseline Result : ${bRes.rawLLMOutput} (Crashed/Hallucinated: ${bRes.crashedOrHallucinated})`);
    console.log(`  ✅ Our Engine       : ${eRes.primaryDecision}`);
    console.log(`  🔍 Invariants Caught: ${eRes.invariantViolationsDetected.join(', ') || 'None'}`);
    console.log(`  📊 Epistemic State  : ${eRes.epistemicState}`);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: Baseline Failures: ${baselineFailures}/${adversarialCases.length} | Engine Safe Recoveries: ${engineRecoveries}/${adversarialCases.length}`);
  console.log('================================================================\n');
}

if (require.main === module) {
  runThreeRunBenchmark();
}
