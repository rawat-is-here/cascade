/**
 * True Accrual Profit Engine
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Computes true street food profit using Affine Interval Arithmetic:
 *   True Accrual Profit = (Cash Revenue + Δ Receivables) - (COGS Burned + Attributed Wastage + Expenses)
 * 
 * Computes bounded P10 worst-case, P50 expected, and P90 best-case profit intervals
 * without hallucinations.
 */

import type { TrueAccrualProfitReport, EpistemicConfidence } from '../../shared/types.ts';
import { AffineForm } from './affine_intervals.ts';
import type { ConservedDoubleEntryCRDT } from '../crdt/double_entry_crdt.ts';

export interface AccrualInputs {
  cashInHand: number;
  uncollectedReceivablesMin: number;
  uncollectedReceivablesMax: number;
  cogsBurnedMin: number;
  cogsBurnedMax: number;
  attributedWastageCostMin: number;
  attributedWastageCostMax: number;
  fixedOperatingExpenses: number; // e.g. LPG gas cylinder, electricity, stall fee
}

export class TrueAccrualProfitEngine {
  /**
   * Computes probabilistic accrual profit intervals from physical ledger inputs.
   */
  public static calculateAccrualProfit(inputs: AccrualInputs): TrueAccrualProfitReport {
    // 1. Represent uncertain quantities as Affine Forms
    const cashRevForm = AffineForm.fromScalar(inputs.cashInHand);
    const receivablesForm = AffineForm.fromInterval(
      inputs.uncollectedReceivablesMin,
      inputs.uncollectedReceivablesMax
    );
    const cogsForm = AffineForm.fromInterval(
      inputs.cogsBurnedMin,
      inputs.cogsBurnedMax
    );
    const wastageForm = AffineForm.fromInterval(
      inputs.attributedWastageCostMin,
      inputs.attributedWastageCostMax
    );
    const expensesForm = AffineForm.fromScalar(inputs.fixedOperatingExpenses);

    // 2. Net Accrual Formula: (Cash + Receivables) - (COGS + Wastage + Expenses)
    const grossIncomeForm = cashRevForm.add(receivablesForm);
    const totalOutflowsForm = cogsForm.add(wastageForm).add(expensesForm);
    const netProfitForm = grossIncomeForm.subtract(totalOutflowsForm);

    const percentiles = netProfitForm.toPercentiles();

    // 3. Epistemic Confidence Tag
    let confidence: EpistemicConfidence;
    if (netProfitForm.radius < 50.0) {
      confidence = 'CONSERVED_CANONICAL';
    } else if (netProfitForm.radius < 300.0) {
      confidence = 'PROBABILISTIC_PRIOR';
    } else {
      confidence = 'HIGH_ENTROPY_ABSTAIN';
    }

    return {
      cashInHand: inputs.cashInHand,
      reconciledCreditReceivables: receivablesForm.toAffineInterval(),
      trueCogsBurned: cogsForm.toAffineInterval(),
      attributedWastageCost: wastageForm.toAffineInterval(),
      netAccrualProfit: {
        p10WorstCase: percentiles.p10,
        p50Expected: percentiles.p50,
        p90BestCase: percentiles.p90
      },
      epistemicState: confidence
    };
  }

  /**
   * Computes accrual profit directly from an active ConservedDoubleEntryCRDT ledger instance.
   */
  public static calculateFromLedger(
    ledger: ConservedDoubleEntryCRDT,
    fixedExpenses: number = 0
  ): TrueAccrualProfitReport {
    const summary = ledger.getLedgerSummary();
    const cashAccount = summary.find(a => a.account.startsWith('Assets:Cash'));
    const cashInHand = cashAccount ? cashAccount.balanceUnits : 0;

    const receivableAccount = summary.find(a => a.account.startsWith('Assets:Receivable'));
    const recMin = receivableAccount ? receivableAccount.bounds.minEstimate / 100 : 0;
    const recMax = receivableAccount ? receivableAccount.bounds.maxEstimate / 100 : 0;

    const cogsAccount = summary.find(a => a.account.startsWith('Expenses:COGS'));
    const cogsMin = cogsAccount ? cogsAccount.bounds.minEstimate / 100 : 0;
    const cogsMax = cogsAccount ? cogsAccount.bounds.maxEstimate / 100 : 0;

    const wastageAccount = summary.find(a => a.account.startsWith('Expenses:Theft') || a.account.startsWith('Expenses:CashRounding'));
    const wasteMin = wastageAccount ? wastageAccount.bounds.minEstimate / 100 : 0;
    const wasteMax = wastageAccount ? wastageAccount.bounds.maxEstimate / 100 : 0;

    return this.calculateAccrualProfit({
      cashInHand,
      uncollectedReceivablesMin: recMin,
      uncollectedReceivablesMax: recMax,
      cogsBurnedMin: cogsMin,
      cogsBurnedMax: cogsMax,
      attributedWastageCostMin: wasteMin,
      attributedWastageCostMax: wasteMax,
      fixedOperatingExpenses: fixedExpenses
    });
  }
}
