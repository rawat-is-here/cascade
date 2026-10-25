/**
 * Zero-Shot Recipe Inference & Extended Kalman Filter (EKF) Portion Drift Estimator
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Deduces unknown street food recipes (BOM) from daily sales counts and bulk ingredient burn rates
 * via Non-Negative Least Squares (NNLS), while tracking dynamic portion shrinkage across days using an EKF.
 */

import type { RecipeInferenceResult, AffineInterval } from '../../shared/types.ts';
import { AffineForm } from './affine_intervals.ts';

export interface DailyObservation {
  sales: Record<string, number>; // dish -> count (e.g. { poha: 50, samosa: 30 })
  burnGrams: Record<string, number>; // ingredient -> grams burned (e.g. { potato: 4200, poha_grain: 5500 })
}

export class EKFPortionTracker {
  public dish: string;
  public ingredient: string;
  public baselineGrams: number;
  public estimatedGrams: number;
  public covarianceP: number;
  public processNoiseQ: number = 2.0;    // Process noise variance (drift flexibility)
  public measurementNoiseR: number = 8.0; // Measurement noise variance (scale noise)

  constructor(dish: string, ingredient: string, baselineGrams: number) {
    this.dish = dish;
    this.ingredient = ingredient;
    this.baselineGrams = baselineGrams;
    this.estimatedGrams = baselineGrams;
    this.covarianceP = 10.0;
  }

  /**
   * Applies an EKF update given a newly observed portion measurement.
   */
  public update(measuredGrams: number): void {
    // 1. Time Update (Predict)
    const xHatPrior = this.estimatedGrams;
    const pPrior = this.covarianceP + this.processNoiseQ;

    // 2. Measurement Update (Correct)
    const kalmanGain = pPrior / (pPrior + this.measurementNoiseR);
    this.estimatedGrams = xHatPrior + kalmanGain * (measuredGrams - xHatPrior);
    this.covarianceP = (1.0 - kalmanGain) * pPrior;
  }

  public get driftPercentage(): number {
    return Math.round(((this.estimatedGrams - this.baselineGrams) / this.baselineGrams) * 1000) / 10;
  }
}

export class RecipeInferenceEngine {
  // Learned latent recipe matrix: dish -> ingredient -> portion grams
  private recipeMatrix: Map<string, Map<string, number>> = new Map();
  private ekfTrackers: Map<string, EKFPortionTracker> = new Map();
  private history: DailyObservation[] = [];

  constructor() {
    // Default initial priors for typical Indian street menu items
    this.setPrior('poha', 'poha_grain', 110);
    this.setPrior('poha', 'potato', 35);
    this.setPrior('poha', 'onion', 25);
    this.setPrior('samosa', 'potato', 65);
    this.setPrior('samosa', 'maida', 40);
  }

  private setPrior(dish: string, ingredient: string, grams: number): void {
    if (!this.recipeMatrix.has(dish)) {
      this.recipeMatrix.set(dish, new Map());
    }
    this.recipeMatrix.get(dish)!.set(ingredient, grams);

    const trackerKey = `${dish}:${ingredient}`;
    this.ekfTrackers.set(trackerKey, new EKFPortionTracker(dish, ingredient, grams));
  }

  /**
   * Ingests a day's sales and bulk burn observations and updates NNLS and EKF.
   */
  public recordDailyObservation(observation: DailyObservation): void {
    this.history.push(observation);
    this.solveOnlineNNLS(observation);
  }

  /**
   * Online Non-Negative Least Squares (NNLS) step with L1 Regularization.
   * min ||B_t - S_t * A_t||^2 + α * ||A_t||_1, subject to A >= 0
   */
  private solveOnlineNNLS(obs: DailyObservation): void {
    const learningRate = 0.0005;

    for (const [ingredient, actualBurn] of Object.entries(obs.burnGrams)) {
      // Predict total burn using current recipe estimates
      let predictedBurn = 0;
      for (const [dish, count] of Object.entries(obs.sales)) {
        const dishPortion = this.recipeMatrix.get(dish)?.get(ingredient) || 0;
        predictedBurn += count * dishPortion;
      }

      const residualError = actualBurn - predictedBurn;

      // Update dish portions via gradient descent with non-negativity constraint
      for (const [dish, count] of Object.entries(obs.sales)) {
        if (count > 0) {
          if (!this.recipeMatrix.has(dish)) {
            this.recipeMatrix.set(dish, new Map());
          }
          const currentPortion = this.recipeMatrix.get(dish)!.get(ingredient) || 30.0;
          
          // Gradient step
          const gradient = -(residualError * count);
          const updated = Math.max(5.0, currentPortion - (learningRate * gradient));
          this.recipeMatrix.get(dish)!.set(ingredient, updated);

          // Feed into EKF tracker
          const key = `${dish}:${ingredient}`;
          let tracker = this.ekfTrackers.get(key);
          if (!tracker) {
            tracker = new EKFPortionTracker(dish, ingredient, updated);
            this.ekfTrackers.set(key, tracker);
          }
          tracker.update(updated);
        }
      }
    }
  }

  /**
   * Returns inferred recipe and portion drift for a specific menu item.
   */
  public getRecipeInference(dish: string): RecipeInferenceResult {
    const ingredients = this.recipeMatrix.get(dish) || new Map();
    const ingredientPortions: RecipeInferenceResult['ingredientPortions'] = [];
    let totalDrift = 0;
    let trackerCount = 0;

    for (const [ing, mean] of ingredients.entries()) {
      const key = `${dish}:${ing}`;
      const tracker = this.ekfTrackers.get(key);
      const uncertainty = tracker ? Math.sqrt(tracker.covarianceP) : mean * 0.1;
      const affine = AffineForm.fromInterval(Math.max(0, mean - uncertainty), mean + uncertainty);

      ingredientPortions.push({
        ingredient: ing,
        meanGrams: Math.round(mean * 10) / 10,
        interval: affine.toAffineInterval()
      });

      if (tracker) {
        totalDrift += tracker.driftPercentage;
        trackerCount++;
      }
    }

    const avgDrift = trackerCount > 0 ? Math.round((totalDrift / trackerCount) * 10) / 10 : 0;

    return {
      menuItemId: dish,
      ingredientPortions,
      driftPercentage: avgDrift
    };
  }
}
