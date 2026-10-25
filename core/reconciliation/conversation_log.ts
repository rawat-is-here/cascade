/**
 * Daily Hypothesis Store & Conversation Log
 * 100% Standalone On-Device.
 * 
 * Manages daily spoken audio hypotheses, incoming UPI Soundbox chimes,
 * and executes cross-modal Hungarian matching to immediately settle digital sales
 * while buffering ambiguous cash hypotheses for End-of-Day (EOD) physical cash reconciliation.
 */

import type { 
  AudioHypothesisBundle, 
  ParsedUPINotification, 
  ConfirmedDigitalTransaction,
  DailyHypothesisStoreState,
  BalancedDelta
} from '../../shared/types.ts';
import { HungarianBipartiteMatcher } from '../fusion/bipartite_matcher.ts';
import type { ConservedDoubleEntryCRDT } from '../crdt/double_entry_crdt.ts';

export class DailyHypothesisStore {
  private uncommittedAudioHypotheses: Map<string, AudioHypothesisBundle> = new Map();
  private confirmedTransactions: Map<string, ConfirmedDigitalTransaction> = new Map();
  private totalConfirmedDigitalMinor: number = 0; // In paise
  private ledger?: ConservedDoubleEntryCRDT;

  constructor(ledger?: ConservedDoubleEntryCRDT) {
    this.ledger = ledger;
  }

  /**
   * Attaches or updates the double-entry CRDT ledger instance.
   */
  public attachLedger(ledger: ConservedDoubleEntryCRDT): void {
    this.ledger = ledger;
  }

  /**
   * Buffers an incoming spoken audio transaction hypothesis.
   * If not yet verified by UPI or physical cash, it sits in the uncommitted pool.
   */
  public ingestAudioHypothesis(audio: AudioHypothesisBundle): void {
    this.uncommittedAudioHypotheses.set(audio.snippetId, audio);
  }

  /**
   * Ingests an incoming UPI Soundbox notification or Bank SMS.
   * Attempts immediate Hungarian bipartite matching against all uncommitted audio events.
   * If matched:
   *   - Immediately converts to ConfirmedDigitalTransaction
   *   - Commits DR Assets:Bank:UPI / CR Revenue:Sales to CRDT ledger
   *   - Removes matched audio hypothesis from uncommitted cash pool
   * If unmatched:
   *   - Commits independent digital receipt directly to CRDT ledger
   */
  public ingestUPINotification(upi: ParsedUPINotification): {
    matched: boolean;
    transaction: ConfirmedDigitalTransaction;
    delta?: BalancedDelta;
  } {
    // Collect active uncommitted audio hypotheses
    const audioPool = Array.from(this.uncommittedAudioHypotheses.values());

    // Execute bipartite matching
    const matchResult = HungarianBipartiteMatcher.match(audioPool, [upi]);

    let confirmedTx: ConfirmedDigitalTransaction;
    let isMatched = false;

    if (matchResult.matchedPairs.length > 0) {
      const pair = matchResult.matchedPairs[0];
      confirmedTx = pair.confirmedTx;
      isMatched = true;

      // Remove matched audio snippet from uncommitted cash pool
      this.uncommittedAudioHypotheses.delete(pair.audioSnippet.snippetId);
    } else {
      // Unmatched independent UPI payment
      confirmedTx = {
        txId: `DIGI_UPI_${upi.refId}`,
        upiRefId: upi.refId,
        amount: upi.amount,
        settledAt: upi.receivedAt
      };
    }

    // Record digital transaction
    this.confirmedTransactions.set(confirmedTx.txId, confirmedTx);
    const amountMinor = Math.round(confirmedTx.amount * 100);
    this.totalConfirmedDigitalMinor += amountMinor;

    // Post to CRDT Ledger if attached
    let delta: BalancedDelta | undefined;
    if (this.ledger) {
      const creditAcct = confirmedTx.entityId 
        ? `Assets:Receivable:${confirmedTx.entityId}`
        : 'Revenue:Sales';

      delta = this.ledger.postTransaction({
        txId: confirmedTx.txId,
        debitAccount: 'Assets:Bank:UPI',
        creditAccount: creditAcct,
        amountMinor,
        occurredAt: confirmedTx.settledAt,
        counterpartyEntityId: confirmedTx.entityId,
        evidenceId: confirmedTx.sourceAudioId || upi.notificationId,
        memo: isMatched ? `UPI Soundbox fused with audio snippet ${confirmedTx.sourceAudioId}` : `Unmatched UPI receipt ref ${upi.refId}`,
        epistemicState: 'CONSERVED_CANONICAL'
      });
    }

    return {
      matched: isMatched,
      transaction: confirmedTx,
      delta
    };
  }

  /**
   * Returns all audio hypotheses that have not been claimed by UPI.
   * These form the candidate input pool for Phase 4 EOD physical cash reconciliation.
   */
  public getUncommittedCashHypotheses(): AudioHypothesisBundle[] {
    return Array.from(this.uncommittedAudioHypotheses.values());
  }

  /**
   * Returns all settled digital transactions.
   */
  public getConfirmedTransactions(): ConfirmedDigitalTransaction[] {
    return Array.from(this.confirmedTransactions.values());
  }

  /**
   * Total confirmed digital money in Rupees.
   */
  public getTotalConfirmedDigital(): number {
    return this.totalConfirmedDigitalMinor / 100;
  }

  /**
   * Total confirmed digital money in minor units (paise).
   */
  public getTotalConfirmedDigitalMinor(): number {
    return this.totalConfirmedDigitalMinor;
  }

  /**
   * Exports complete snapshot of the hypothesis store.
   */
  public getState(): DailyHypothesisStoreState {
    return {
      confirmedDigitalTransactions: this.getConfirmedTransactions(),
      uncommittedCashHypotheses: this.getUncommittedCashHypotheses(),
      totalConfirmedDigitalCash: this.getTotalConfirmedDigital()
    };
  }

  /**
   * Clears the daily hypothesis store after EOD settlement.
   */
  public resetDailyStore(): void {
    this.uncommittedAudioHypotheses.clear();
    this.confirmedTransactions.clear();
    this.totalConfirmedDigitalMinor = 0;
  }
}
