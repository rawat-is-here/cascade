/**
 * End-of-Day (EOD) Elastic Slack Reconciliation (Algorithm 2)
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * MAP (Maximum A Posteriori) Branch-and-Bound Solver:
 * Uses the street vendor's physical cash drawer closing count as an elastic
 * boundary constraint to disambiguate the entire day's noisy audio hypotheses.
 */

import type { 
  AudioHypothesisBundle, 
  EODReconciliationRequest, 
  EODReconciliationResult,
  ResolvedTransaction,
  BalancedDelta
} from '../../shared/types.ts';
import type { ConservedDoubleEntryCRDT } from '../crdt/double_entry_crdt.ts';

interface CandidateChoice {
  amount: number;
  confidence: number;
  negLogLikelihood: number;
}

interface SnippetCandidates {
  snippet: AudioHypothesisBundle;
  choices: CandidateChoice[];
  minAmount: number;
  maxAmount: number;
}

export class EODCashSettler {
  private static readonly LAMBDA_SLACK = 0.08; // Elastic penalty per Rupee of discrepancy
  private static readonly ROUNDING_LIMIT = 15.0; // ₹15 coin rounding boundary

  /**
   * Reconciles physical cash against uncommitted acoustic hypotheses.
   */
  public static reconcile(
    uncommittedHypotheses: AudioHypothesisBundle[],
    request: EODReconciliationRequest,
    ledger?: ConservedDoubleEntryCRDT
  ): EODReconciliationResult {
    // 1. Calculate Target Cash Delta
    // ΔC_target = Closing - Opening + KnownExpenses
    const targetCashDelta = request.closingPhysicalCash - request.openingFloat + request.knownCashExpenses;

    if (uncommittedHypotheses.length === 0) {
      const discrepancy = targetCashDelta;
      const attributionTag = this.determineAttribution(discrepancy);
      
      const committedDeltas: BalancedDelta[] = [];
      if (ledger && discrepancy !== 0) {
        const delta = this.postSlackDelta(ledger, discrepancy, attributionTag);
        if (delta) committedDeltas.push(delta);
      }

      return {
        targetCashDelta,
        totalResolvedCash: 0,
        drawerDiscrepancy: discrepancy,
        attributionTag,
        resolvedTransactions: [],
        committedDeltas
      };
    }

    // 2. Prepare and normalize candidates for each snippet
    const snippetList: SnippetCandidates[] = uncommittedHypotheses.map(snippet => {
      const choices: CandidateChoice[] = [];

      // Extract candidate amounts from entities
      if (snippet.entities.candidateAmounts && snippet.entities.candidateAmounts.length > 0) {
        for (const c of snippet.entities.candidateAmounts) {
          if (c.amount > 0) {
            const conf = Math.max(0.01, Math.min(0.999, c.acousticConfidence));
            choices.push({
              amount: c.amount,
              confidence: conf,
              negLogLikelihood: -Math.log(conf)
            });
          }
        }
      }

      // Check derived negotiation amount
      if (snippet.negotiation && snippet.negotiation.derivedTotalAmount) {
        const amt = snippet.negotiation.derivedTotalAmount;
        if (!choices.some(c => Math.abs(c.amount - amt) < 0.01)) {
          choices.push({
            amount: amt,
            confidence: 0.98,
            negLogLikelihood: -Math.log(0.98)
          });
        }
      }

      // If the snippet was locked/confirmed by negotiation or canonical epistemic state,
      // its amount is fixed to the agreed total!
      if (snippet.negotiation?.isVendorConfirmed && snippet.negotiation.derivedTotalAmount) {
        choices.length = 0; // Clear raw speculative candidates
        choices.push({
          amount: snippet.negotiation.derivedTotalAmount,
          confidence: 1.0,
          negLogLikelihood: 0.0
        });
      }

      // Include background chatter / false trigger candidate (₹0) ONLY if
      // the utterance was NOT confirmed by vendor and has low acoustic confidence
      const isVendorConfirmed = snippet.negotiation?.isVendorConfirmed || false;
      const maxConf = choices.length > 0 ? Math.max(...choices.map(c => c.confidence)) : 0;

      if (!isVendorConfirmed && maxConf < 0.70) {
        const chatterPrior = 0.02; // Small prior for bystander chatter
        choices.push({
          amount: 0,
          confidence: chatterPrior,
          negLogLikelihood: -Math.log(chatterPrior)
        });
      }

      // If no valid candidates found, default to ₹0
      if (choices.length === 0) {
        choices.push({
          amount: 0,
          confidence: 0.50,
          negLogLikelihood: -Math.log(0.50)
        });
      }

      // Sort choices by confidence descending
      choices.sort((a, b) => b.confidence - a.confidence);

      let minAmount = choices[0].amount;
      let maxAmount = choices[0].amount;
      for (const ch of choices) {
        if (ch.amount < minAmount) minAmount = ch.amount;
        if (ch.amount > maxAmount) maxAmount = ch.amount;
      }

      return {
        snippet,
        choices,
        minAmount,
        maxAmount
      };
    });

    // 3. Precompute suffix bounds for Branch-and-Bound pruning
    const n = snippetList.length;
    const suffixMin = new Array(n + 1).fill(0);
    const suffixMax = new Array(n + 1).fill(0);

    for (let i = n - 1; i >= 0; i--) {
      suffixMin[i] = suffixMin[i + 1] + snippetList[i].minAmount;
      suffixMax[i] = suffixMax[i + 1] + snippetList[i].maxAmount;
    }

    // 4. Branch and Bound MAP Search
    let bestCost = 1e9;
    let bestAssignment: number[] = new Array(n).fill(0); // Index of chosen candidate per snippet
    const currentAssignment: number[] = new Array(n).fill(0);

    const maxSlackWindow = Math.max(100, Math.abs(targetCashDelta) * 0.25);
    let evalCount = 0;
    const maxEvals = 15000;

    function search(depth: number, currentSum: number, currentNLL: number) {
      if (evalCount++ > maxEvals) return;

      if (depth === n) {
        const slack = targetCashDelta - currentSum;
        const totalCost = currentNLL + (EODCashSettler.LAMBDA_SLACK * Math.abs(slack));
        if (totalCost < bestCost) {
          bestCost = totalCost;
          for (let i = 0; i < n; i++) bestAssignment[i] = currentAssignment[i];
        }
        return;
      }

      // Pruning bounds
      const minPossible = currentSum + suffixMin[depth];
      const maxPossible = currentSum + suffixMax[depth];

      if (minPossible > targetCashDelta + maxSlackWindow) return; // Cannot reach target, overshoots
      if (maxPossible < targetCashDelta - maxSlackWindow) return; // Cannot reach target, undershoots

      // Explore candidates
      const item = snippetList[depth];
      for (let c = 0; c < item.choices.length; c++) {
        const choice = item.choices[c];
        const nextSum = currentSum + choice.amount;
        const nextNLL = currentNLL + choice.negLogLikelihood;

        // Bounded optimistic heuristic check
        if (nextNLL >= bestCost) continue;

        currentAssignment[depth] = c;
        search(depth + 1, nextSum, nextNLL);
      }
    }

    search(0, 0, 0);

    // 5. Build Resolved Transactions
    const resolvedTransactions: ResolvedTransaction[] = [];
    let totalResolvedCash = 0;

    for (let i = 0; i < n; i++) {
      const item = snippetList[i];
      const chosen = item.choices[bestAssignment[i]];
      totalResolvedCash += chosen.amount;

      resolvedTransactions.push({
        snippetId: item.snippet.snippetId,
        chosenAmount: chosen.amount,
        acousticConfidence: chosen.confidence,
        epistemicState: chosen.amount > 0 
          ? (chosen.confidence >= 0.85 ? 'CONSERVED_CANONICAL' : 'PROBABILISTIC_PRIOR')
          : 'HIGH_ENTROPY_ABSTAIN',
        rationale: chosen.amount > 0 
          ? `Disambiguated to ₹${chosen.amount} via drawer constraint (prior conf ${(chosen.confidence * 100).toFixed(0)}%)`
          : 'Identified as background chatter / non-cash utterance'
      });
    }

    // 6. Compute Elastic Slack (ε_slack) & Attribution
    const discrepancy = targetCashDelta - totalResolvedCash;
    const attributionTag = this.determineAttribution(discrepancy);

    // 7. Commit Double-Entry Deltas to CRDT Ledger if attached
    const committedDeltas: BalancedDelta[] = [];

    if (ledger) {
      // Post all confirmed cash sales
      for (const res of resolvedTransactions) {
        if (res.chosenAmount > 0) {
          const delta = ledger.postTransaction({
            txId: `EOD_CASH_${res.snippetId}`,
            debitAccount: 'Assets:Cash:Drawer',
            creditAccount: 'Revenue:Sales',
            amountMinor: Math.round(res.chosenAmount * 100),
            memo: res.rationale,
            epistemicState: res.epistemicState
          });
          committedDeltas.push(delta);
        }
      }

      // Post slack delta to balance physical drawer
      if (discrepancy !== 0) {
        const slackDelta = this.postSlackDelta(ledger, discrepancy, attributionTag);
        if (slackDelta) committedDeltas.push(slackDelta);
      }
    }

    return {
      targetCashDelta,
      totalResolvedCash,
      drawerDiscrepancy: discrepancy,
      attributionTag,
      resolvedTransactions,
      committedDeltas
    };
  }

  /**
   * Classifies drawer slack into business attribution categories.
   */
  private static determineAttribution(slack: number): EODReconciliationResult['attributionTag'] {
    if (Math.abs(slack) === 0) {
      return 'EXACT_MATCH';
    }
    if (Math.abs(slack) <= this.ROUNDING_LIMIT) {
      return 'ROUNDING_FRICTION';
    }
    if (slack < -this.ROUNDING_LIMIT) {
      return 'UNRECORDED_LEAKAGE';
    }
    return 'DROWNED_SALES_SURPLUS';
  }

  /**
   * Posts double-entry balancing delta for drawer slack.
   */
  private static postSlackDelta(
    ledger: ConservedDoubleEntryCRDT,
    slack: number,
    tag: EODReconciliationResult['attributionTag']
  ): BalancedDelta | null {
    const slackMinor = Math.round(Math.abs(slack) * 100);
    if (slackMinor === 0) return null;

    if (slack > 0) {
      // Surplus: physical drawer has more cash than accounted
      return ledger.postTransaction({
        txId: `EOD_SLACK_SURPLUS_${Date.now()}`,
        debitAccount: 'Assets:Cash:Drawer',
        creditAccount: tag === 'ROUNDING_FRICTION' ? 'Revenue:RoundingGain' : 'Revenue:UnrecordedSales',
        amountMinor: slackMinor,
        memo: `EOD Slack Surplus: ${tag} (+₹${slack})`,
        epistemicState: 'PROBABILISTIC_PRIOR'
      });
    } else {
      // Shortage: physical drawer has less cash than accounted
      return ledger.postTransaction({
        txId: `EOD_SLACK_SHORTAGE_${Date.now()}`,
        debitAccount: tag === 'ROUNDING_FRICTION' ? 'Expenses:CashRoundingLoss' : 'Expenses:TheftOrLeakage',
        creditAccount: 'Assets:Cash:Drawer',
        amountMinor: slackMinor,
        memo: `EOD Slack Shortage: ${tag} (-₹${Math.abs(slack)})`,
        epistemicState: 'PROBABILISTIC_PRIOR'
      });
    }
  }
}
