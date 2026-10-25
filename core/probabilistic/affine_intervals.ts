/**
 * Affine Interval Arithmetic Library
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Represents uncertain values as affine forms:
 *   x̂ = x_0 + Σ (x_i * ε_i),  where ε_i ∈ [-1, +1]
 * 
 * Unlike naive interval arithmetic (which suffers from the wrapping effect and runaway width),
 * affine arithmetic preserves first-order correlations between shared financial/inventory noise variables.
 */

import type { AffineInterval } from '../../shared/types.ts';

export class AffineForm {
  public static nextSymbolId = 1;

  public center: number;
  public noiseTerms: Map<number, number>; // symbolId -> coefficient

  constructor(center: number, noiseTerms: Map<number, number> = new Map()) {
    this.center = center;
    this.noiseTerms = new Map(noiseTerms);
  }

  /**
   * Creates a new uncertain quantity with center and +/- radius.
   */
  public static fromInterval(min: number, max: number): AffineForm {
    const center = (min + max) / 2.0;
    const radius = Math.abs(max - min) / 2.0;
    const symbolId = AffineForm.nextSymbolId++;
    const terms = new Map<number, number>();
    if (radius > 0) {
      terms.set(symbolId, radius);
    }
    return new AffineForm(center, terms);
  }

  /**
   * Creates an exact scalar value (zero uncertainty).
   */
  public static fromScalar(value: number): AffineForm {
    return new AffineForm(value);
  }

  /**
   * Total uncertainty radius r = Σ |x_i|.
   */
  public get radius(): number {
    let sum = 0;
    for (const coeff of this.noiseTerms.values()) {
      sum += Math.abs(coeff);
    }
    return sum;
  }

  public get min(): number {
    return this.center - this.radius;
  }

  public get max(): number {
    return this.center + this.radius;
  }

  /**
   * Adds two affine quantities: (x̂ + ŷ)
   * Correlation cancellation: if they share symbols with opposite signs, uncertainty cancels out!
   */
  public add(other: AffineForm): AffineForm {
    const newCenter = this.center + other.center;
    const newTerms = new Map<number, number>(this.noiseTerms);

    for (const [sym, coeff] of other.noiseTerms.entries()) {
      const existing = newTerms.get(sym) || 0;
      const combined = existing + coeff;
      if (Math.abs(combined) < 1e-9) {
        newTerms.delete(sym);
      } else {
        newTerms.set(sym, combined);
      }
    }

    return new AffineForm(newCenter, newTerms);
  }

  /**
   * Subtracts two affine quantities: (x̂ - ŷ)
   */
  public subtract(other: AffineForm): AffineForm {
    const newCenter = this.center - other.center;
    const newTerms = new Map<number, number>(this.noiseTerms);

    for (const [sym, coeff] of other.noiseTerms.entries()) {
      const existing = newTerms.get(sym) || 0;
      const combined = existing - coeff;
      if (Math.abs(combined) < 1e-9) {
        newTerms.delete(sym);
      } else {
        newTerms.set(sym, combined);
      }
    }

    return new AffineForm(newCenter, newTerms);
  }

  /**
   * Multiplies by a constant scalar: α * x̂
   */
  public scale(scalar: number): AffineForm {
    const newCenter = this.center * scalar;
    const newTerms = new Map<number, number>();
    for (const [sym, coeff] of this.noiseTerms.entries()) {
      newTerms.set(sym, coeff * scalar);
    }
    return new AffineForm(newCenter, newTerms);
  }

  /**
   * Converts to canonical AffineInterval type for ledger/reporting.
   */
  public toAffineInterval(): AffineInterval {
    const r = this.radius;
    return {
      minEstimate: Math.round((this.center - r) * 100) / 100,
      maxEstimate: Math.round((this.center + r) * 100) / 100,
      uncertaintyInterval: Math.round(r * 100) / 100
    };
  }

  /**
   * Extracts P10, P50, P90 percentile confidence estimates.
   */
  public toPercentiles(): { p10: number; p50: number; p90: number } {
    const r = this.radius;
    return {
      p10: Math.round((this.center - (0.85 * r)) * 100) / 100,
      p50: Math.round(this.center * 100) / 100,
      p90: Math.round((this.center + (0.85 * r)) * 100) / 100
    };
  }
}
