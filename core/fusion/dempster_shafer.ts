/**
 * Dempster-Shafer Multi-Sensor Conflict Resolution
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Fuses epistemic evidence across heterogeneous street sensors:
 * 1. Spoken Audio Hypothesis (noisy 85dB acoustic lattice)
 * 2. Digital UPI Notification (chime / SMS)
 * 3. Paper Tally / Vendor manual tick marks
 * 
 * Computes degree of conflict K. If K >= 0.85, flags severe multi-modal contradiction
 * preventing corrupted journal commits.
 */

import type { EpistemicConfidence } from '../../shared/types.ts';

export interface SensorBeliefMass {
  sensorId: 'SPEECH_ASR' | 'UPI_SOUNDBOX' | 'PAPER_TALLY';
  hypothesizedAmount: number;
  beliefMass: number;      // m({Amount}) in [0, 1]
  uncertaintyMass: number; // m(Theta) in [0, 1], where belief + uncertainty = 1.0
}

export interface FusedSensorBelief {
  fusedAmount: number;
  combinedBelief: number;
  conflictDegreeK: number;
  hasSevereConflict: boolean;
  epistemicConfidence: EpistemicConfidence;
  explanation: string;
}

export class DempsterShaferFuser {
  private static readonly CRITICAL_CONFLICT_THRESHOLD = 0.85;

  /**
   * Combines two sensor belief masses using Dempster's Rule of Combination.
   */
  public static combineTwoSensors(
    m1: SensorBeliefMass,
    m2: SensorBeliefMass
  ): {
    combinedAmounts: Map<number, number>;
    uncertainty: number;
    conflictK: number;
  } {
    // Frame: {A1}, {Theta} and {A2}, {Theta}
    let conflictK = 0.0;
    const combined = new Map<number, number>();

    const val1 = m1.hypothesizedAmount;
    const b1 = m1.beliefMass;
    const u1 = m1.uncertaintyMass;

    const val2 = m2.hypothesizedAmount;
    const b2 = m2.beliefMass;
    const u2 = m2.uncertaintyMass;

    // 1. Intersection {A1} and {A2}
    if (val1 === val2) {
      combined.set(val1, b1 * b2);
    } else {
      conflictK += b1 * b2; // Disjoint sets
    }

    // 2. Intersection {A1} and Theta2 => {A1}
    combined.set(val1, (combined.get(val1) || 0) + (b1 * u2));

    // 3. Intersection Theta1 and {A2} => {A2}
    combined.set(val2, (combined.get(val2) || 0) + (u1 * b2));

    // 4. Intersection Theta1 and Theta2 => Theta
    const fusedTheta = u1 * u2;

    // Normalization by (1 - K)
    const normalization = 1.0 - conflictK;
    if (normalization > 1e-6) {
      for (const [amt, mass] of combined.entries()) {
        combined.set(amt, mass / normalization);
      }
      return {
        combinedAmounts: combined,
        uncertainty: fusedTheta / normalization,
        conflictK
      };
    } else {
      // Complete contradiction
      return {
        combinedAmounts: combined,
        uncertainty: 0.0,
        conflictK: 1.0
      };
    }
  }

  /**
   * Fuses an arbitrary array of sensor inputs sequentially.
   */
  public static fuseSensors(sensors: SensorBeliefMass[]): FusedSensorBelief {
    if (sensors.length === 0) {
      return {
        fusedAmount: 0,
        combinedBelief: 0,
        conflictDegreeK: 0,
        hasSevereConflict: false,
        epistemicConfidence: 'PROBABILISTIC_PRIOR' as EpistemicConfidence,
        explanation: 'No sensor evidence available.'
      };
    }

    if (sensors.length === 1) {
      return {
        fusedAmount: sensors[0].hypothesizedAmount,
        combinedBelief: sensors[0].beliefMass,
        conflictDegreeK: 0,
        hasSevereConflict: false,
        epistemicConfidence: sensors[0].beliefMass > 0.8 ? 'CONSERVED_CANONICAL' as EpistemicConfidence : 'PROBABILISTIC_PRIOR' as EpistemicConfidence,
        explanation: `Single sensor evidence from ${sensors[0].sensorId}.`
      };
    }

    let currentBelief = sensors[0];
    let maxConflictK = 0.0;

    for (let i = 1; i < sensors.length; i++) {
      const result = this.combineTwoSensors(currentBelief, sensors[i]);
      maxConflictK = Math.max(maxConflictK, result.conflictK);

      // Find highest mass candidate
      let bestAmt = currentBelief.hypothesizedAmount;
      let highestMass = 0;
      for (const [amt, mass] of result.combinedAmounts.entries()) {
        if (mass > highestMass) {
          highestMass = mass;
          bestAmt = amt;
        }
      }

      currentBelief = {
        sensorId: 'SPEECH_ASR',
        hypothesizedAmount: bestAmt,
        beliefMass: highestMass,
        uncertaintyMass: result.uncertainty
      };
    }

    const hasSevereConflict = maxConflictK >= this.CRITICAL_CONFLICT_THRESHOLD;
    let confidence: EpistemicConfidence;

    if (hasSevereConflict) {
      confidence = 'HIGH_ENTROPY_ABSTAIN' as EpistemicConfidence;
    } else if (currentBelief.beliefMass >= 0.85) {
      confidence = 'CONSERVED_CANONICAL' as EpistemicConfidence;
    } else {
      confidence = 'PROBABILISTIC_PRIOR' as EpistemicConfidence;
    }

    return {
      fusedAmount: currentBelief.hypothesizedAmount,
      combinedBelief: currentBelief.beliefMass,
      conflictDegreeK: maxConflictK,
      hasSevereConflict,
      epistemicConfidence: confidence,
      explanation: hasSevereConflict
        ? `Severe multi-sensor conflict (K = ${(maxConflictK * 100).toFixed(1)}%). Evidence quarantined.`
        : `Sensors converged to ₹${currentBelief.hypothesizedAmount} with ${(currentBelief.beliefMass * 100).toFixed(1)}% belief.`
    };
  }
}
