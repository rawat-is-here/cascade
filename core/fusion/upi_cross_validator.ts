/**
 * Dual Acoustic-Digital UPI Cross-Validation Engine
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Solves dense street market sound collisions:
 * 1. Confirmed Stall Sale: Mic hears chime AND phone receives matching OS notification (+-30s).
 * 2. Personal Non-Stall Transfer: Phone gets notification (e.g. ₹2,000 from family) with NO chime -> Routes to Owner Capital, NOT Revenue.
 * 3. Neighbor Soundbox Spillover: Mic hears neighbor stall's soundbox chime, but NO notification on phone -> Quarantined as noise (0 ledger entry).
 * 4. Silent QR Payment: Chime + Notification without speech -> Booked as direct digital stall sale.
 */

import type { ParsedUPINotification, ConfirmedDigitalTransaction, BalancedDelta } from '../../shared/types.ts';
import type { ConservedDoubleEntryCRDT } from '../crdt/double_entry_crdt.ts';

export interface SoundboxAcousticChime {
  chimeId: string;
  sourceApp: 'PAYTM' | 'PHONEPE' | 'GPAY' | 'BHIM' | 'UNKNOWN';
  amount: number;
  timestamp: number;
  confidence: number;
}

export type UPICrossValidationStatus = 
  | 'CONFIRMED_STALL_SALE'
  | 'PERSONAL_NON_STALL_TRANSFER'
  | 'NEIGHBOR_SOUNDBOX_SPILLOVER'
  | 'SILENT_DIRECT_QR_PAYMENT';

export interface UPICrossValidationResult {
  status: UPICrossValidationStatus;
  amount: number;
  upiRefId?: string;
  sourceChimeId?: string;
  accountingAction: string;
  delta?: BalancedDelta;
  rationale: string;
}

export class UPICrossValidator {
  private static readonly MATCH_WINDOW_MS = 30_000; // 30-second correlation window

  private pendingChimes: SoundboxAcousticChime[] = [];
  private pendingNotifications: ParsedUPINotification[] = [];
  private processedRRNs: Set<string> = new Set(); // Bank RRN idempotency
  private ledger?: ConservedDoubleEntryCRDT;

  constructor(ledger?: ConservedDoubleEntryCRDT) {
    this.ledger = ledger;
  }

  public attachLedger(ledger: ConservedDoubleEntryCRDT): void {
    this.ledger = ledger;
  }

  /**
   * Ingests an acoustic chime detected by the continuous microphone stream.
   */
  public ingestAcousticChime(chime: SoundboxAcousticChime): UPICrossValidationResult | null {
    // Check if a matching notification already arrived within the last 30s
    const now = chime.timestamp;
    const matchIdx = this.pendingNotifications.findIndex(n => 
      Math.abs(n.receivedAt - now) <= UPICrossValidator.MATCH_WINDOW_MS &&
      Math.abs(n.amount - chime.amount) < 0.01 &&
      !this.processedRRNs.has(n.refId)
    );

    if (matchIdx !== -1) {
      const notif = this.pendingNotifications[matchIdx];
      this.pendingNotifications.splice(matchIdx, 1);
      return this.confirmStallSale(chime, notif);
    }

    // Buffer chime waiting for notification
    this.pendingChimes.push(chime);
    return null;
  }

  /**
   * Ingests an Android OS notification from the status bar.
   */
  public ingestNotification(notif: ParsedUPINotification): UPICrossValidationResult {
    // Idempotency check on unique bank RRN
    if (this.processedRRNs.has(notif.refId)) {
      return {
        status: 'CONFIRMED_STALL_SALE',
        amount: notif.amount,
        upiRefId: notif.refId,
        accountingAction: 'IGNORED_DUPLICATE',
        rationale: `Duplicate bank RRN ${notif.refId} already processed.`
      };
    }

    // Check if an acoustic chime was heard within the last 30s
    const now = notif.receivedAt;
    const matchIdx = this.pendingChimes.findIndex(c => 
      Math.abs(c.timestamp - now) <= UPICrossValidator.MATCH_WINDOW_MS &&
      Math.abs(c.amount - notif.amount) < 0.01
    );

    if (matchIdx !== -1) {
      const chime = this.pendingChimes[matchIdx];
      this.pendingChimes.splice(matchIdx, 1);
      return this.confirmStallSale(chime, notif);
    }

    // If no acoustic chime was heard, buffer notification briefly
    this.pendingNotifications.push(notif);

    // If notification has existed past the match window with zero acoustic chime,
    // it is classified as a Personal Non-Stall Transfer!
    return {
      status: 'PERSONAL_NON_STALL_TRANSFER',
      amount: notif.amount,
      upiRefId: notif.refId,
      accountingAction: 'PENDING_ACOUSTIC_WINDOW',
      rationale: `Notification received without immediate acoustic chime. Watching correlation window.`
    };
  }

  /**
   * Evaluates pending events after the 30s window expires:
   * - Unmatched notifications become Personal Non-Stall Transfers (Owner Capital).
   * - Unmatched chimes become Neighboring Stall Spillover (Discarded).
   */
  public flushExpiredEvents(currentTimestamp: number): UPICrossValidationResult[] {
    const results: UPICrossValidationResult[] = [];

    // 1. Process unmatched notifications -> Personal transfers
    const remainingNotifs: ParsedUPINotification[] = [];
    for (const notif of this.pendingNotifications) {
      if (currentTimestamp - notif.receivedAt > UPICrossValidator.MATCH_WINDOW_MS) {
        if (!this.processedRRNs.has(notif.refId)) {
          this.processedRRNs.add(notif.refId);
          const res = this.recordPersonalTransfer(notif);
          results.push(res);
        }
      } else {
        remainingNotifs.push(notif);
      }
    }
    this.pendingNotifications = remainingNotifs;

    // 2. Process unmatched chimes -> Neighbor soundbox noise (Discarded)
    const remainingChimes: SoundboxAcousticChime[] = [];
    for (const chime of this.pendingChimes) {
      if (currentTimestamp - chime.timestamp > UPICrossValidator.MATCH_WINDOW_MS) {
        // Neighbor's soundbox went off!
        results.push({
          status: 'NEIGHBOR_SOUNDBOX_SPILLOVER',
          amount: chime.amount,
          sourceChimeId: chime.chimeId,
          accountingAction: 'QUARANTINE_ZERO_LEDGER',
          rationale: `Acoustic chime of ₹${chime.amount} heard by mic, but NO matching bank notification on vendor phone. Quarantined as neighbor stall noise.`
        });
      } else {
        remainingChimes.push(chime);
      }
    }
    this.pendingChimes = remainingChimes;

    return results;
  }

  private confirmStallSale(
    chime: SoundboxAcousticChime,
    notif: ParsedUPINotification
  ): UPICrossValidationResult {
    this.processedRRNs.add(notif.refId);

    let delta: BalancedDelta | undefined;
    if (this.ledger) {
      delta = this.ledger.postTransaction({
        txId: `UPI_SALE_${notif.refId}`,
        debitAccount: 'Assets:Bank:UPI',
        creditAccount: 'Revenue:Sales',
        amountMinor: Math.round(notif.amount * 100),
        occurredAt: notif.receivedAt,
        evidenceId: `${chime.chimeId}_${notif.notificationId}`,
        memo: `Dual acoustic chime + notification confirmed stall sale (RRN: ${notif.refId})`,
        epistemicState: 'CONSERVED_CANONICAL'
      });
    }

    return {
      status: 'CONFIRMED_STALL_SALE',
      amount: notif.amount,
      upiRefId: notif.refId,
      sourceChimeId: chime.chimeId,
      accountingAction: 'POST_DR_BANK_CR_REVENUE',
      delta,
      rationale: `Acoustic soundbox chime (₹${chime.amount}) mutually verified with Android notification (₹${notif.amount}, RRN: ${notif.refId}).`
    };
  }

  private recordPersonalTransfer(notif: ParsedUPINotification): UPICrossValidationResult {
    let delta: BalancedDelta | undefined;
    if (this.ledger) {
      // Routes to Owner Equity rather than Sales Revenue to prevent false sales inflation
      delta = this.ledger.postTransaction({
        txId: `PERSONAL_TRANSFER_${notif.refId}`,
        debitAccount: 'Assets:Bank:UPI',
        creditAccount: 'Equity:OwnerPersonalCapital',
        amountMinor: Math.round(notif.amount * 100),
        occurredAt: notif.receivedAt,
        evidenceId: notif.notificationId,
        memo: `Personal transfer received (No soundbox chime heard). Isolated from sales revenue.`,
        epistemicState: 'CONSERVED_CANONICAL'
      });
    }

    return {
      status: 'PERSONAL_NON_STALL_TRANSFER',
      amount: notif.amount,
      upiRefId: notif.refId,
      accountingAction: 'POST_DR_BANK_CR_EQUITY',
      delta,
      rationale: `Notification for ₹${notif.amount} arrived with zero stall acoustic chime. Booked to Owner Personal Capital.`
    };
  }
}
