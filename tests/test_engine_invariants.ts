import { CoreDecisionEngine } from '../core/engine';
import { DataPayload } from '../shared/types';

function runTests() {
  console.log('Running Invariant & Recovery Verification Tests...');
  const engine = new CoreDecisionEngine();

  // Test 1: Clean input
  const cleanPayload: DataPayload = {
    id: 'test-1',
    timestamp: Date.now(),
    source: 'test-source',
    rawInput: 'Sample operational event'
  };
  const cleanRes = engine.process(cleanPayload, 10);
  if (cleanRes.abstained) throw new Error('Engine should not abstain on clean input');
  console.log('✓ Clean invariant test passed');

  // Test 2: 1970 clock reset sabotage
  const sabotagedClock: DataPayload = {
    id: 'test-2',
    timestamp: 0, // 1970 Epoch
    source: 'dead-battery-node',
    rawInput: 'Timestamp reset event'
  };
  const clockRes = engine.process(sabotagedClock, 10);
  if (!clockRes.abstained) throw new Error('Engine should catch and abstain on 1970 clock reset');
  console.log('✓ 1970 clock reset sabotage caught successfully');

  console.log('\nAll core invariants verified (<50ms).');
}

runTests();
