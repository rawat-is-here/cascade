/**
 * Environmental Loss Attribution Engine
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Partitions unrecorded inventory stock losses into:
 * 1. Spoilage: Physical Arrhenius temperature & humidity decay kinetics
 * 2. Theft: Bystander crowd & stall vacancy opportunities
 * 3. Personal Consumption: Vendor & family midday meal curves
 */

import type { LossAttributionReport } from '../../shared/types.ts';

export interface EnvironmentalCovariates {
  ambientTempCelsius: number;   // e.g. 36°C (summer afternoon)
  relativeHumidityPercent: number; // e.g. 70%
  exposureHours: number;        // e.g. 8 hours
  hourOfDay: number;            // e.g. 14 (2 PM)
  connectedFamilyDevices: number; // e.g. 2 (brother / son at stall)
  stallVacancyMinutes: number;  // e.g. 25 minutes unattended
}

export class EnvironmentalLossAttributionEngine {
  /**
   * Arrhenius Perishability Kinetic Model:
   * k_decay(T, H) = k_0 * exp(0.065 * (T - 25)) * (1 + 0.005 * H)
   */
  public static calculateArrheniusDecayRate(
    ingredient: string,
    tempC: number,
    humidityPercent: number
  ): number {
    // Baseline decay rates at 25°C per hour (k_0)
    let k0 = 0.015; // default leafy/soft veg
    const ing = ingredient.toLowerCase();
    if (ing.includes('potato') || ing.includes('aalu')) k0 = 0.003;
    else if (ing.includes('onion') || ing.includes('pyaaz')) k0 = 0.005;
    else if (ing.includes('tomato') || ing.includes('tamatar')) k0 = 0.025;
    else if (ing.includes('milk') || ing.includes('paneer') || ing.includes('dahi')) k0 = 0.040;

    const tempFactor = Math.exp(0.065 * (tempC - 25.0));
    const humidityFactor = 1.0 + (0.005 * (humidityPercent - 50.0));

    return k0 * tempFactor * Math.max(0.5, humidityFactor);
  }

  /**
   * Partitions unexplained stock loss into Spoilage, Theft, and Personal Consumption.
   */
  public static attributeLoss(
    ingredient: string,
    initialStockKg: number,
    unrecordedLossKg: number,
    env: EnvironmentalCovariates
  ): LossAttributionReport {
    if (unrecordedLossKg <= 0) {
      return {
        ingredient,
        unrecordedLossKg: 0,
        attribution: {
          spoilage: { kg: 0, probability: 0 },
          theft: { kg: 0, probability: 0 },
          personalConsumption: { kg: 0, probability: 0 }
        }
      };
    }

    // 1. Arrhenius Decay Spoilage Prediction
    const decayRate = this.calculateArrheniusDecayRate(
      ingredient,
      env.ambientTempCelsius,
      env.relativeHumidityPercent
    );
    const predictedSpoilFraction = 1.0 - Math.exp(-decayRate * env.exposureHours);
    const predictedSpoilKg = Math.min(unrecordedLossKg, initialStockKg * predictedSpoilFraction);

    // 2. Personal Meal Consumption Curve (Gaussian peak around 1:30 PM = 13.5h)
    const lunchDistHours = Math.abs(env.hourOfDay - 13.5);
    const lunchTimeAffinity = Math.exp(-Math.pow(lunchDistHours, 2) / 4.0); // bell curve
    const familyWeight = Math.min(1.0, env.connectedFamilyDevices * 0.4);
    const personalMealScore = 0.2 + (lunchTimeAffinity * 0.6 * (0.5 + familyWeight));

    // 3. Theft / Pilferage Opportunity Score
    const vacancyScore = Math.min(1.0, env.stallVacancyMinutes / 60.0);
    const theftScore = 0.15 + (vacancyScore * 0.70);

    // 4. Dirichlet mixture normalization
    const spoilWeight = Math.max(0.1, predictedSpoilKg / unrecordedLossKg);
    const totalWeights = spoilWeight + personalMealScore + theftScore;

    const probSpoil = spoilWeight / totalWeights;
    const probPersonal = personalMealScore / totalWeights;
    const probTheft = theftScore / totalWeights;

    const spoilageKg = Math.round(unrecordedLossKg * probSpoil * 100) / 100;
    const personalKg = Math.round(unrecordedLossKg * probPersonal * 100) / 100;
    const theftKg = Math.round((unrecordedLossKg - spoilageKg - personalKg) * 100) / 100;

    return {
      ingredient,
      unrecordedLossKg,
      attribution: {
        spoilage: { kg: spoilageKg, probability: Math.round(probSpoil * 1000) / 1000 },
        theft: { kg: theftKg, probability: Math.round(probTheft * 1000) / 1000 },
        personalConsumption: { kg: personalKg, probability: Math.round(probPersonal * 1000) / 1000 }
      }
    };
  }
}
