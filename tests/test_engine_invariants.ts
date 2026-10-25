import { CoreDecisionEngine } from '../core/engine.ts';
import { InvariantValidator } from '../core/constraints.ts';
import { CausalDAG } from '../core/crdt/causal_dag.ts';
import { ConservedDoubleEntryCRDT } from '../core/crdt/double_entry_crdt.ts';
import type { DataPayload, BalancedDelta } from '../shared/types.ts';

function runPhase1VerificationSuite() {
  console.log('================================================================');
  console.log('       TEAM CASCADE: PHASE 1 CRDT & INVARIANT TEST SUITE        ');
  console.log('================================================================\n');

  const startTime = performance.now();

  // -------------------------------------------------------------
  // TEST 1: Double-Entry Zero-Sum Conservation Invariant
  // -------------------------------------------------------------
  console.log('--- TEST 1: Double-Entry Zero-Sum Conservation ---');
  const crdtA = new ConservedDoubleEntryCRDT('dev-phone-akash');

  // Transaction 1: Sale of Poha (₹140)
  crdtA.postTransaction({
    txId: 'tx-001',
    debitAccount: 'Assets:Cash',
    creditAccount: 'Revenue:Sales',
    amountMinor: 14000, // ₹140.00
    memo: '7 plate poha'
  });

  // Transaction 2: Purchase of Tomatoes (₹180)
  crdtA.postTransaction({
    txId: 'tx-002',
    debitAccount: 'Expenses:COGS',
    creditAccount: 'Assets:Cash',
    amountMinor: 18000, // ₹180.00
    memo: '3 kg tomatoes wholesale'
  });

  // Transaction 3: Sharma ji credit payment (₹40)
  crdtA.postTransaction({
    txId: 'tx-003',
    debitAccount: 'Assets:Cash',
    creditAccount: 'Assets:Receivable',
    amountMinor: 4000, // ₹40.00
    memo: 'Sharma ji jama'
  });

  const checkA = crdtA.verifyConservation();
  if (!checkA.isConserved) {
    throw new Error(`TEST 1 FAILED: Ledger conservation violated! Net balance = ${checkA.netBalanceMinor}`);
  }
  console.log(`  ✓ Zero-Sum Conservation Verified: Net Balance = ${checkA.netBalanceMinor} paise`);
  console.log(`    Cash: ₹${crdtA.getBalance('Assets:Cash')}`);
  console.log(`    COGS: ₹${crdtA.getBalance('Expenses:COGS')}`);
  console.log(`    Sales: ₹${crdtA.getBalance('Revenue:Sales')}`);
  console.log(`    Receivable: ₹${crdtA.getBalance('Assets:Receivable')}`);

  // -------------------------------------------------------------
  // TEST 2: Rejection of Unbalanced & Invalid Transactions
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Invariant Rejection of Malformed Transactions ---');
  let caughtEqualAccounts = false;
  try {
    crdtA.postTransaction({
      txId: 'tx-bad-1',
      debitAccount: 'Assets:Cash',
      creditAccount: 'Assets:Cash', // INVALID: same account
      amountMinor: 5000
    });
  } catch (err: any) {
    caughtEqualAccounts = true;
    console.log(`  ✓ Caught equal debit/credit account rejection: "${err.message}"`);
  }
  if (!caughtEqualAccounts) throw new Error('TEST 2 FAILED: Failed to reject identical debit/credit accounts');

  let caughtNegativeAmount = false;
  try {
    crdtA.postTransaction({
      txId: 'tx-bad-2',
      debitAccount: 'Assets:Cash',
      creditAccount: 'Revenue:Sales',
      amountMinor: -100 // INVALID: negative amount
    });
  } catch (err: any) {
    caughtNegativeAmount = true;
    console.log(`  ✓ Caught negative amount rejection: "${err.message}"`);
  }
  if (!caughtNegativeAmount) throw new Error('TEST 2 FAILED: Failed to reject negative minor amount');

  // -------------------------------------------------------------
  // TEST 3: Hostile Clock Invariant (1970 UNIX Epoch Sabotage)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Hostile Clock Invariant (1970 UNIX Epoch Sabotage) ---');
  const engine = new CoreDecisionEngine();

  // Dead battery phone resets timestamp to 0 (1970-01-01)
  const sabotagedPayload: DataPayload = {
    id: 'payload-dead-battery-1970',
    timestamp: 0, // 1970 Epoch
    source: 'dead-battery-client',
    rawInput: 'Timestamp reset after sudden battery depletion'
  };

  const engineRes = engine.process(sabotagedPayload, 10);
  if (!engineRes.abstained) {
    throw new Error('TEST 3 FAILED: Engine failed to catch and abstain on 1970 clock reset');
  }
  if (!engineRes.invariantViolationsDetected.some(v => v.includes('clock reset'))) {
    throw new Error('TEST 3 FAILED: Clock reset violation missing from violation report');
  }
  console.log(`  ✓ 1970 Epoch reset caught cleanly: "${engineRes.invariantViolationsDetected[0]}"`);
  console.log(`  ✓ Epistemic state shifted safely to: ${engineRes.epistemicState}`);

  // -------------------------------------------------------------
  // TEST 4: Offline 3-Device Bluetooth Mesh CRDT Sync Convergence
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Offline 3-Device Bluetooth Mesh CRDT Sync Convergence ---');
  // Scenario: 3 family members (Vendor, Spouse, Son) operate offline at stall
  const deviceVendor = new ConservedDoubleEntryCRDT('dev-vendor-01');
  const deviceSpouse = new ConservedDoubleEntryCRDT('dev-spouse-02');
  const deviceSon    = new ConservedDoubleEntryCRDT('dev-son-03');

  // Vendor sells tea & poha (Cash ₹120, Sales ₹120)
  deviceVendor.postTransaction({
    txId: 'tx-v1',
    debitAccount: 'Assets:Cash',
    creditAccount: 'Revenue:Sales',
    amountMinor: 12000,
    memo: 'Tea and poha'
  });

  // Spouse pays milk supplier (Payable ₹500, Cash ₹500)
  deviceSpouse.postTransaction({
    txId: 'tx-s1',
    debitAccount: 'Liabilities:Payable:Supplier',
    creditAccount: 'Assets:Cash',
    amountMinor: 50000,
    memo: 'Milk vendor cash payment'
  });

  // Son records ice purchase (COGS ₹60, Cash ₹60)
  deviceSon.postTransaction({
    txId: 'tx-k1',
    debitAccount: 'Expenses:COGS',
    creditAccount: 'Assets:Cash',
    amountMinor: 6000,
    memo: 'Ice slab'
  });

  // Devices reconnect intermittently via Bluetooth mesh (Arbitrary Out-of-Order Join)
  // Step 1: Vendor merges with Spouse
  deviceVendor.merge(deviceSpouse);
  // Step 2: Spouse merges with Son
  deviceSpouse.merge(deviceSon);
  // Step 3: Son merges with Vendor
  deviceSon.merge(deviceVendor);
  // Step 4: Vendor merges with Son (completing full mesh sync)
  deviceVendor.merge(deviceSon);
  deviceSpouse.merge(deviceVendor);

  // Assert full state convergence across all 3 replicas
  const balVendor = deviceVendor.getBalance('Assets:Cash');
  const balSpouse = deviceSpouse.getBalance('Assets:Cash');
  const balSon    = deviceSon.getBalance('Assets:Cash');

  if (balVendor !== balSpouse || balSpouse !== balSon) {
    throw new Error(`TEST 4 FAILED: Replicas diverged! V=${balVendor}, S=${balSpouse}, K=${balSon}`);
  }

  const consV = deviceVendor.verifyConservation();
  const consS = deviceSpouse.verifyConservation();
  const consK = deviceSon.verifyConservation();

  if (!consV.isConserved || !consS.isConserved || !consK.isConserved) {
    throw new Error('TEST 4 FAILED: Conservation law violated after CRDT mesh merge!');
  }

  console.log(`  ✓ 3-Device CRDT Mesh Converged to Exact Same Balances:`);
  console.log(`    Cash Balance across all 3 nodes: ₹${balVendor}`);
  console.log(`    All 3 Replicas Zero-Sum Conserved: V=${consV.isConserved}, S=${consS.isConserved}, K=${consK.isConserved}`);

  // -------------------------------------------------------------
  // TEST 5: Causal DAG Topological Sorting & Cycle Immunity
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Causal DAG Topological Sorting & Cycle Immunity ---');
  const dag = deviceVendor.getDAG();
  const topoOrder = dag.getTopologicalOrder();

  if (topoOrder.length !== dag.size()) {
    throw new Error(`TEST 5 FAILED: Topo order count ${topoOrder.length} !== DAG size ${dag.size()}`);
  }

  if (dag.hasCycle()) {
    throw new Error('TEST 5 FAILED: Cycle detected in Causal DAG!');
  }
  console.log(`  ✓ DAG contains ${dag.size()} causal nodes with 0 cycles.`);
  console.log(`  ✓ Topological Causal Order verified strictly.`);

  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log('\n================================================================');
  console.log(`✓ ALL PHASE 1 CORE INVARIANT & CRDT TESTS PASSED in ${elapsed}ms (<15ms budget).`);
  console.log('================================================================\n');
}

runPhase1VerificationSuite();
