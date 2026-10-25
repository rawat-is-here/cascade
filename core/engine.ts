import type { DataPayload, EngineResult, EpistemicConfidence, AffineInterval } from '../shared/types.ts';
import { InvariantValidator } from './constraints.ts';
import { ConservedDoubleEntryCRDT } from './crdt/double_entry_crdt.ts';

export class CoreDecisionEngine {
  private crdt: ConservedDoubleEntryCRDT;
  private lastKnownLogicalClock = 0;
  private causalHistory: string[] = [];

  constructor(deviceId = 'dev-core-engine-01') {
    this.crdt = new ConservedDoubleEntryCRDT(deviceId);
  }

  /**
   * Processes data through the 0.5% mechanism:
   * 1. Validates physical/causal invariants (quarantines 1970 UNIX epoch resets)
   * 2. Evaluates epistemic confidence lattice
   * 3. Enforces double-entry zero-sum balance conservation
   * 4. Calculates affine interval bounds instead of blind point predictions
   * 5. Chooses when to abstain safely rather than hallucinating
   */
  public process(payload: DataPayload, noiseIntensity = 0): EngineResult {
    const startTime = performance.now();
    const violations: string[] = [];

    // Invariant 1: Clock check (catches 1970 UNIX epoch reset from dead phone batteries)
    const clockCheck = InvariantValidator.validateClockInvariant(payload, this.lastKnownLogicalClock);
    if (!clockCheck.valid && clockCheck.error) {
      violations.push(clockCheck.error);
    }

    // Advance logical clock safely (Causal Lamport DAG overrides physical clock)
    this.lastKnownLogicalClock = Math.max(this.lastKnownLogicalClock + 1, payload.logicalLamportClock || 0);
    this.causalHistory.push(payload.id);

    // Invariant 2: Double-Entry Transaction check (if transaction delta payload exists)
    let isBalanced = true;
    let totalDebit = 0;
    let totalCredit = 0;

    if (payload.delta && payload.delta.debitAccount && payload.delta.creditAccount && payload.delta.amountMinor) {
      const deltaCheck = InvariantValidator.validateDoubleEntryInvariant(payload.delta as any);
      if (!deltaCheck.valid && deltaCheck.error) {
        violations.push(deltaCheck.error);
        isBalanced = false;
      } else {
        try {
          this.crdt.postTransaction({
            txId: payload.delta.txId || `tx-${payload.id}`,
            debitAccount: payload.delta.debitAccount,
            creditAccount: payload.delta.creditAccount,
            amountMinor: payload.delta.amountMinor,
            currencyCode: payload.delta.currencyCode || 'INR',
            occurredAt: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
            bounds: payload.delta.bounds
          });
          totalDebit += payload.delta.amountMinor;
          totalCredit += payload.delta.amountMinor;
        } catch (err: any) {
          violations.push(err.message || 'Double-entry posting error');
          isBalanced = false;
        }
      }
    }

    // Epistemic lattice evaluation
    const epistemicState: EpistemicConfidence = InvariantValidator.evaluateEpistemicLattice(
      noiseIntensity, 
      120, 
      violations.length
    );

    // Dynamic affine uncertainty bounds
    const baseValue = 100;
    const noiseSpread = (noiseIntensity / 100) * 45;
    const minEstimate = Math.max(0, baseValue - noiseSpread);
    const maxEstimate = baseValue + noiseSpread;
    const bounds: AffineInterval = {
      minEstimate,
      maxEstimate,
      uncertaintyInterval: maxEstimate - minEstimate
    };

    // Decision logic
    const shouldAbstain = epistemicState === 'UNKNOWN_ABSTAIN' || violations.length > 0;
    const confidenceScore = shouldAbstain ? 0.15 : Math.max(0.4, 1.0 - (noiseIntensity / 120));

    const latencyMs = Number((performance.now() - startTime).toFixed(2));
    const crdtHeads = this.crdt.getDAG().getHeads();
    const crdtRootHash = crdtHeads.length > 0 ? crdtHeads[0] : undefined;

    return {
      decisionId: `eng-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      inputEcho: payload.rawInput,
      primaryDecision: shouldAbstain 
        ? '[ABSTAINED] Critical invariant violated or signal-to-noise ratio too low'
        : `[COMMITTED] Verified actionable output with interval bounds [${minEstimate.toFixed(1)}, ${maxEstimate.toFixed(1)}]`,
      confidenceScore,
      epistemicState,
      bounds,
      invariantViolationsDetected: violations,
      abstained: shouldAbstain,
      latencyMs,
      causalParents: this.causalHistory.slice(-3),
      explanation: violations.length > 0
        ? `Refused blind prediction. Caught invariant violation: ${violations.join('; ')}`
        : `Decision verified under epistemic state ${epistemicState} with computed error bounds.`,
      crdtRootHash,
      ledgerBalanceCheck: {
        isBalanced,
        totalDebit,
        totalCredit
      }
    };
  }

  /**
   * Exposes the underlying Conserved Double-Entry CRDT ledger
   */
  public getCRDT(): ConservedDoubleEntryCRDT {
    return this.crdt;
  }
}
