import type { DataPayload, EpistemicConfidence, BalancedDelta, HLC } from '../shared/types.ts';

export interface InvariantCheckResult {
  valid: boolean;
  violations: string[];
  inferredState: EpistemicConfidence;
  error?: string;
}

/**
 * Validates domain, physical, and double-entry invariants before any decision is committed.
 * This is the 0.5% anti-hallucination layer.
 */
export class InvariantValidator {
  /**
   * Minimum valid physical timestamp: 2000-01-01T00:00:00Z in Unix ms.
   * Any timestamp below this represents a dead-battery clock reset (e.g. 1970 UNIX epoch).
   */
  public static readonly MIN_VALID_TIMESTAMP_MS = 946684800000;

  /**
   * 1970 Epoch threshold (within 48 hours of 1970-01-01).
   */
  public static readonly EPOCH_1970_THRESHOLD_MS = 172800000;

  /**
   * Checks for impossible physical clock jumps (e.g. 1970 UNIX epoch reset from dead phone batteries)
   * or causal Lamport sequence violations.
   */
  public static validateClockInvariant(
    payload: DataPayload, 
    lastKnownLogicalClock: number
  ): { valid: boolean; error?: string; isCorruptedWallClock?: boolean } {
    const rawTime = typeof payload.timestamp === 'string' 
      ? Date.parse(payload.timestamp) 
      : payload.timestamp;

    // Check for 1970 epoch reset (within 48 hours of 1970-01-01)
    if (isNaN(rawTime) || rawTime < this.EPOCH_1970_THRESHOLD_MS) {
      return { 
        valid: false, 
        error: `Physical clock reset detected: timestamp=${payload.timestamp}. Causal Lamport clock must override.`,
        isCorruptedWallClock: true
      };
    }

    // Check for invalid timestamps earlier than year 2000
    if (rawTime < this.MIN_VALID_TIMESTAMP_MS) {
      return {
        valid: false,
        error: `Hostile physical timestamp detected: timestamp=${payload.timestamp} (< 2000-01-01).`,
        isCorruptedWallClock: true
      };
    }

    // Check for causal Lamport sequence violation
    if (payload.logicalLamportClock !== undefined && payload.logicalLamportClock < lastKnownLogicalClock) {
      return {
        valid: false,
        error: `Causal sequence violation: Lamport clock ${payload.logicalLamportClock} < last known ${lastKnownLogicalClock}`,
        isCorruptedWallClock: false
      };
    }

    return { valid: true, isCorruptedWallClock: false };
  }

  /**
   * Validates HLC (Hybrid Logical Clock) integrity
   */
  public static validateHLC(hlc: HLC, minExpectedWallMs = this.MIN_VALID_TIMESTAMP_MS): { valid: boolean; error?: string } {
    if (!hlc.deviceId || hlc.deviceId.trim().length === 0) {
      return { valid: false, error: 'HLC deviceId must be a non-empty string.' };
    }
    if (hlc.logical < 0) {
      return { valid: false, error: `HLC logical counter cannot be negative: ${hlc.logical}.` };
    }
    if (hlc.wallMs < minExpectedWallMs) {
      return { valid: false, error: `HLC physical wall clock corrupted (${hlc.wallMs} < ${minExpectedWallMs}).` };
    }
    return { valid: true };
  }

  /**
   * Validates that a double-entry delta strictly satisfies conservation laws:
   * 1. amountMinor must be a strictly positive integer.
   * 2. debitAccount !== creditAccount.
   * 3. Accounts must be non-empty.
   */
  public static validateDoubleEntryInvariant(delta: BalancedDelta): { valid: boolean; error?: string } {
    if (!delta.txId || delta.txId.trim().length === 0) {
      return { valid: false, error: 'Transaction ID cannot be empty.' };
    }

    if (!delta.debitAccount || delta.debitAccount.trim().length === 0) {
      return { valid: false, error: 'Debit account cannot be empty.' };
    }

    if (!delta.creditAccount || delta.creditAccount.trim().length === 0) {
      return { valid: false, error: 'Credit account cannot be empty.' };
    }

    if (delta.debitAccount.trim().toLowerCase() === delta.creditAccount.trim().toLowerCase()) {
      return { 
        valid: false, 
        error: `Double-entry violation: Debit account '${delta.debitAccount}' cannot equal Credit account.` 
      };
    }

    if (typeof delta.amountMinor !== 'number' || !Number.isInteger(delta.amountMinor) || delta.amountMinor <= 0) {
      return { 
        valid: false, 
        error: `Double-entry violation: amountMinor must be a strictly positive integer, got ${delta.amountMinor}.` 
      };
    }

    return { valid: true };
  }

  /**
   * Verifies that the global ledger balances sum to zero (Conservation Law: Σ Debits ≡ Σ Credits).
   */
  public static validateLedgerZeroSum(balances: Map<string, number>): { valid: boolean; netBalance: number; error?: string } {
    let netBalance = 0;
    for (const [, balance] of balances) {
      netBalance += balance;
    }

    // Net balance must be zero (with small epsilon allowance for floating point rounding if minor units aren't used)
    if (Math.abs(netBalance) > 1e-6) {
      return {
        valid: false,
        netBalance,
        error: `Ledger Conservation Violation: Net balance is ${netBalance} (expected strictly 0).`
      };
    }

    return { valid: true, netBalance: 0 };
  }

  /**
   * Evaluates epistemic confidence based on input signal quality, noise level, and invariant violations
   */
  public static evaluateEpistemicLattice(
    noiseLevelDb: number, 
    signalAgeSeconds: number,
    violationsCount = 0
  ): EpistemicConfidence {
    if (violationsCount > 0 || noiseLevelDb > 80 || signalAgeSeconds > 3600) {
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
