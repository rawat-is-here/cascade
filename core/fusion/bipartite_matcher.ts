/**
 * Kuhn-Munkres (Hungarian) Bipartite Matcher for Cross-Modal Audio-UPI Fusion
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Pairs spoken price declarations with delayed UPI Soundbox notifications / Bank SMS
 * over a sliding temporal horizon (|t_audio - t_upi| <= 180s) to eliminate double-counting.
 */

import type { AudioHypothesisBundle, ParsedUPINotification, ConfirmedDigitalTransaction } from '../../shared/types.ts';

export interface FusionMatchResult {
  matchedPairs: Array<{
    audioSnippet: AudioHypothesisBundle;
    upiNotification: ParsedUPINotification;
    matchedAmount: number;
    matchCost: number;
    confirmedTx: ConfirmedDigitalTransaction;
  }>;
  unmatchedAudio: AudioHypothesisBundle[];
  unmatchedUPI: ParsedUPINotification[];
}

export class HungarianBipartiteMatcher {
  private static readonly MAX_TIME_DIFF_MS = 180_000; // 180 seconds window
  private static readonly MATCH_THRESHOLD = 0.35;    // Cutoff for valid cross-modal assignment
  private static readonly W_AMOUNT = 0.50;
  private static readonly W_TIME = 0.30;
  private static readonly W_ALIAS = 0.20;

  /**
   * Calculates the fusion affinity cost between an audio hypothesis and a UPI notification.
   * Returns a value in [0.0, 1.0], or 1e9 if temporally impossible (>180s).
   */
  public static calculateAffinityCost(
    audio: AudioHypothesisBundle,
    upi: ParsedUPINotification
  ): { cost: number; bestCandidateAmount: number } {
    const timeDeltaMs = Math.abs(audio.timestamp - upi.receivedAt);
    if (timeDeltaMs > this.MAX_TIME_DIFF_MS) {
      return { cost: 1e9, bestCandidateAmount: 0 };
    }

    // 1. Amount affinity
    const targetAmount = upi.amount;
    let minAmountDiff = 1e9;
    let bestCandidate = targetAmount;

    // Check candidate amounts extracted from audio
    const candidates = audio.entities.candidateAmounts;
    if (candidates && candidates.length > 0) {
      for (const cand of candidates) {
        const diff = Math.abs(cand.amount - targetAmount);
        if (diff < minAmountDiff) {
          minAmountDiff = diff;
          bestCandidate = cand.amount;
        }
      }
    } else if (audio.negotiation && audio.negotiation.derivedTotalAmount !== undefined) {
      minAmountDiff = Math.abs(audio.negotiation.derivedTotalAmount - targetAmount);
      bestCandidate = audio.negotiation.derivedTotalAmount;
    } else {
      minAmountDiff = 100.0;
    }

    const maxAmt = Math.max(bestCandidate, targetAmount, 1.0);
    const normalizedAmountCost = Math.min(1.0, minAmountDiff / maxAmt);

    // 2. Temporal proximity cost
    const normalizedTimeCost = timeDeltaMs / this.MAX_TIME_DIFF_MS;

    // 3. Alias / Payer Name similarity
    let aliasCost = 0.5; // neutral prior
    const audioAlias = audio.entities.alias?.canonicalId || audio.customerId;
    const upiPayer = upi.payerName;

    if (audioAlias && upiPayer) {
      const a = audioAlias.toLowerCase();
      const p = upiPayer.toLowerCase();
      if (a.includes(p) || p.includes(a)) {
        aliasCost = 0.0;
      } else {
        aliasCost = 1.0;
      }
    }

    const totalCost = 
      (this.W_AMOUNT * normalizedAmountCost) +
      (this.W_TIME * normalizedTimeCost) +
      (this.W_ALIAS * aliasCost);

    return { cost: totalCost, bestCandidateAmount: bestCandidate };
  }

  /**
   * Solves Kuhn-Munkres (Hungarian algorithm) for minimum weight bipartite matching.
   * Input: cost matrix C where costMatrix[i][j] is the cost of assigning row i to col j.
   * Output: Array of length N where result[i] is the matched col index for row i, or -1.
   */
  public static solveHungarian(costMatrix: number[][]): number[] {
    const n = costMatrix.length;
    if (n === 0) return [];
    const m = costMatrix[0].length;
    if (m === 0) return new Array(n).fill(-1);

    // Make square matrix of size dim x dim
    const dim = Math.max(n, m);
    const cost: number[][] = Array.from({ length: dim }, (_, r) => 
      Array.from({ length: dim }, (_, c) => {
        if (r < n && c < m) return costMatrix[r][c];
        return 1e6; // dummy node penalty
      })
    );

    // 1-based indexing for standard O(V^3) Kuhn-Munkres
    const u = new Array(dim + 1).fill(0);
    const v = new Array(dim + 1).fill(0);
    const p = new Array(dim + 1).fill(0);
    const way = new Array(dim + 1).fill(0);

    for (let i = 1; i <= dim; ++i) {
      p[0] = i;
      let j0 = 0;
      const minv = new Array(dim + 1).fill(1e9);
      const used = new Array(dim + 1).fill(false);

      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = 1e9;
        let j1 = 0;

        for (let j = 1; j <= dim; ++j) {
          if (!used[j]) {
            const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
            if (cur < minv[j]) {
              minv[j] = cur;
              way[j] = j0;
            }
            if (minv[j] < delta) {
              delta = minv[j];
              j1 = j;
            }
          }
        }

        for (let j = 0; j <= dim; ++j) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }

        j0 = j1;
      } while (p[j0] !== 0);

      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0 !== 0);
    }

    const assignment = new Array(n).fill(-1);
    for (let j = 1; j <= dim; ++j) {
      if (p[j] <= n && j <= m) {
        assignment[p[j] - 1] = j - 1;
      }
    }

    return assignment;
  }

  /**
   * Executes cross-modal fusion on a pool of audio hypotheses and incoming UPI events.
   */
  public static match(
    audioList: AudioHypothesisBundle[],
    upiList: ParsedUPINotification[]
  ): FusionMatchResult {
    if (audioList.length === 0) {
      return { matchedPairs: [], unmatchedAudio: [], unmatchedUPI: [...upiList] };
    }
    if (upiList.length === 0) {
      return { matchedPairs: [], unmatchedAudio: [...audioList], unmatchedUPI: [] };
    }

    // Build cost matrix
    const numAudio = audioList.length;
    const numUpi = upiList.length;
    const costMatrix: number[][] = [];
    const bestAmounts: number[][] = [];

    for (let i = 0; i < numAudio; i++) {
      costMatrix[i] = [];
      bestAmounts[i] = [];
      for (let j = 0; j < numUpi; j++) {
        const { cost, bestCandidateAmount } = this.calculateAffinityCost(audioList[i], upiList[j]);
        costMatrix[i][j] = cost;
        bestAmounts[i][j] = bestCandidateAmount;
      }
    }

    // Solve Kuhn-Munkres
    const assignment = this.solveHungarian(costMatrix);

    const matchedPairs: FusionMatchResult['matchedPairs'] = [];
    const matchedAudioIndices = new Set<number>();
    const matchedUpiIndices = new Set<number>();

    for (let i = 0; i < numAudio; i++) {
      const j = assignment[i];
      if (j !== -1 && j < numUpi) {
        const cost = costMatrix[i][j];
        if (cost <= this.MATCH_THRESHOLD) {
          matchedAudioIndices.add(i);
          matchedUpiIndices.add(j);

          const audio = audioList[i];
          const upi = upiList[j];
          const matchedAmount = upi.amount;

          const confirmedTx: ConfirmedDigitalTransaction = {
            txId: `DIGI_TX_${upi.refId}`,
            sourceAudioId: audio.snippetId,
            upiRefId: upi.refId,
            amount: matchedAmount,
            entityId: audio.entities.alias?.canonicalId || audio.customerId,
            settledAt: upi.receivedAt
          };

          matchedPairs.push({
            audioSnippet: audio,
            upiNotification: upi,
            matchedAmount,
            matchCost: cost,
            confirmedTx
          });
        }
      }
    }

    const unmatchedAudio = audioList.filter((_, idx) => !matchedAudioIndices.has(idx));
    const unmatchedUPI = upiList.filter((_, idx) => !matchedUpiIndices.has(idx));

    return {
      matchedPairs,
      unmatchedAudio,
      unmatchedUPI
    };
  }
}
