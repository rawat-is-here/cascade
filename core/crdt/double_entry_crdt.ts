import type { BalancedDelta, AffineInterval, EpistemicConfidence, StandardAccount } from '../../shared/types.ts';
import { InvariantValidator } from '../constraints.ts';
import { CausalDAG } from './causal_dag.ts';

export interface AccountSummary {
  account: string;
  balanceMinor: number;
  balanceUnits: number; // In base currency units (e.g. INR rupees = minor / 100)
  bounds: AffineInterval;
  debitCount: number;
  creditCount: number;
}

/**
 * Conserved Double-Entry Delta-CRDT
 * Enforces zero-sum double-entry accounting conservation across offline Bluetooth mesh peers.
 * 
 * Invariant: Σ Balances(Accounts) ≡ 0.
 * Merging peer states via lattice join (SA ⊔ SB) is commutative, associative, and idempotent.
 */
export class ConservedDoubleEntryCRDT {
  private dag: CausalDAG;
  private deviceId: string;
  private appliedDeltaHashes: Set<string> = new Set();
  private accountBalancesMinor: Map<string, number> = new Map();
  private accountBounds: Map<string, { min: number; max: number }> = new Map();

  constructor(deviceId = 'dev-family-01') {
    this.deviceId = deviceId;
    this.dag = new CausalDAG(deviceId);
  }

  /**
   * Posts an atomic, balanced double-entry transaction.
   * Debit increases debitAccount, Credit decreases creditAccount (or vice versa),
   * guaranteeing that net change across the entire ledger is strictly 0.
   */
  public postTransaction(params: {
    txId: string;
    debitAccount: StandardAccount | string;
    creditAccount: StandardAccount | string;
    amountMinor: number;
    currencyCode?: string;
    occurredAt?: number;
    bounds?: AffineInterval;
    counterpartyEntityId?: string;
    evidenceId?: string;
    memo?: string;
    epistemicState?: EpistemicConfidence;
  }): BalancedDelta {
    const currencyCode = params.currencyCode || 'INR';
    const bounds: AffineInterval = params.bounds || {
      minEstimate: params.amountMinor,
      maxEstimate: params.amountMinor,
      uncertaintyInterval: 0
    };

    const deltaDraft: Omit<BalancedDelta, 'hash' | 'hlc' | 'parentHashes'> = {
      txId: params.txId,
      occurredAt: params.occurredAt || Date.now(),
      debitAccount: params.debitAccount.trim(),
      creditAccount: params.creditAccount.trim(),
      amountMinor: params.amountMinor,
      currencyCode,
      bounds,
      counterpartyEntityId: params.counterpartyEntityId,
      evidenceId: params.evidenceId,
      memo: params.memo,
      isDeleted: false
    };

    // Verify domain invariants
    const check = InvariantValidator.validateDoubleEntryInvariant({
      ...deltaDraft,
      hash: '',
      parentHashes: [],
      hlc: { wallMs: Date.now(), logical: 0, deviceId: this.deviceId }
    });

    if (!check.valid) {
      throw new Error(`Double-entry transaction rejected: ${check.error}`);
    }

    // Append to Causal DAG
    const node = this.dag.createLocalNode(deltaDraft, params.epistemicState || 'VERIFIED_KNOWN');
    this.applyNodeToBalances(node.delta);

    return node.delta;
  }

  /**
   * Applies an individual balanced delta to account balances.
   * Double-Entry Rule:
   *   Debit Account increases by +amountMinor.
   *   Credit Account decreases by -amountMinor.
   * Sum of delta = (+amountMinor) + (-amountMinor) = 0.
   */
  private applyNodeToBalances(delta: BalancedDelta): void {
    if (this.appliedDeltaHashes.has(delta.hash)) {
      return; // Idempotent deduplication
    }

    const currentDebit = this.accountBalancesMinor.get(delta.debitAccount) || 0;
    this.accountBalancesMinor.set(delta.debitAccount, currentDebit + delta.amountMinor);

    const currentCredit = this.accountBalancesMinor.get(delta.creditAccount) || 0;
    this.accountBalancesMinor.set(delta.creditAccount, currentCredit - delta.amountMinor);

    // Update interval bounds
    const debitB = this.accountBounds.get(delta.debitAccount) || { min: 0, max: 0 };
    this.accountBounds.set(delta.debitAccount, {
      min: debitB.min + delta.bounds.minEstimate,
      max: debitB.max + delta.bounds.maxEstimate
    });

    const creditB = this.accountBounds.get(delta.creditAccount) || { min: 0, max: 0 };
    this.accountBounds.set(delta.creditAccount, {
      min: creditB.min - delta.bounds.maxEstimate,
      max: creditB.max - delta.bounds.minEstimate
    });

    this.appliedDeltaHashes.add(delta.hash);
  }

  /**
   * Merges state from a peer CRDT replica (e.g. over offline Bluetooth).
   * Lattice Join: S_merged = S_local ⊔ S_peer.
   * Guaranteed commutative, associative, and zero-sum conserved.
   */
  public merge(peerCRDT: ConservedDoubleEntryCRDT): { added: number; skipped: number } {
    let added = 0;
    let skipped = 0;

    const peerNodes = peerCRDT.dag.getTopologicalOrder();

    for (const remoteNode of peerNodes) {
      if (this.appliedDeltaHashes.has(remoteNode.hash)) {
        skipped++;
        continue;
      }

      const syncResult = this.dag.insertSyncedNode(remoteNode);
      if (syncResult.accepted) {
        this.applyNodeToBalances(remoteNode.delta);
        added++;
      } else {
        skipped++;
      }
    }

    return { added, skipped };
  }

  /**
   * Exports all or newer deltas for peer sync.
   */
  public exportDeltas(): BalancedDelta[] {
    return this.dag.getTopologicalOrder().map(node => node.delta);
  }

  /**
   * Returns current balance for an account in minor units (e.g. paise).
   */
  public getBalanceMinor(account: string): number {
    return this.accountBalancesMinor.get(account) || 0;
  }

  /**
   * Returns balance in standard currency units (e.g. INR = paise / 100).
   */
  public getBalance(account: string): number {
    return Number(((this.accountBalancesMinor.get(account) || 0) / 100).toFixed(2));
  }

  /**
   * Returns interval bounds for an account.
   */
  public getAccountBounds(account: string): AffineInterval {
    const raw = this.accountBounds.get(account) || { min: 0, max: 0 };
    const minUnits = Number((raw.min / 100).toFixed(2));
    const maxUnits = Number((raw.max / 100).toFixed(2));
    return {
      minEstimate: minUnits,
      maxEstimate: maxUnits,
      uncertaintyInterval: Number((maxUnits - minUnits).toFixed(2))
    };
  }

  /**
   * Returns summary for all active accounts.
   */
  public getAllAccounts(): AccountSummary[] {
    const accounts: AccountSummary[] = [];
    for (const [acc, balMinor] of this.accountBalancesMinor) {
      const bounds = this.getAccountBounds(acc);
      accounts.push({
        account: acc,
        balanceMinor: balMinor,
        balanceUnits: Number((balMinor / 100).toFixed(2)),
        bounds,
        debitCount: 0,
        creditCount: 0
      });
    }
    return accounts;
  }

  /**
   * Verifies that the global conservation law holds:
   * Σ Account Balances ≡ 0.
   */
  public verifyConservation(): { isConserved: boolean; netBalanceMinor: number; error?: string } {
    const res = InvariantValidator.validateLedgerZeroSum(this.accountBalancesMinor);
    return {
      isConserved: res.valid,
      netBalanceMinor: res.netBalance,
      error: res.error
    };
  }

  /**
   * Returns the underlying Causal DAG.
   */
  public getDAG(): CausalDAG {
    return this.dag;
  }

  /**
   * Returns the device identifier.
   */
  public getDeviceId(): string {
    return this.deviceId;
  }
}
