/**
 * Morning Wholesale Cost Basis Manager
 * 100% Standalone On-Device.
 * 
 * Manages the ONLY financial ground truth prior of the day: morning wholesale mandi supply purchases.
 * Holds strictly ZERO pre-configured retail prices (retail prices are 100% dynamic from speech).
 * 
 * Supports an incidental street overhead factor (e.g. 10% for unmeasured cooking oil, spices, salt, and fuel).
 */

import type { BalancedDelta } from '../../shared/types.ts';
import type { ConservedDoubleEntryCRDT } from '../crdt/double_entry_crdt.ts';

export interface WholesaleItemPurchase {
  itemName: string;          // e.g. "potato", "tomato", "onion"
  bulkQuantity: number;      // e.g. 50 (in kg or pieces)
  unit: string;              // "kg", "plate", "piece", "liter"
  totalCost: number;         // e.g. ₹700
  supplierName?: string;     // e.g. "Azadpur Mandi - Ramesh Trader"
}

export interface WholesaleCostBasis {
  itemName: string;
  totalQuantity: number;
  remainingQuantity: number;
  unit: string;
  unitCostBasis: number;     // e.g. 700 / 50 = ₹14.00/kg
  effectiveUnitCost: number; // Unit cost + spice/oil/fuel overhead
}

export class WholesaleCostManager {
  private inventoryCostMap: Map<string, WholesaleCostBasis> = new Map();
  private overheadFactorPercent: number; // e.g. 10% for oil, masala, gas cylinder
  private ledger?: ConservedDoubleEntryCRDT;

  constructor(overheadFactorPercent = 10.0, ledger?: ConservedDoubleEntryCRDT) {
    this.overheadFactorPercent = overheadFactorPercent;
    this.ledger = ledger;
  }

  public attachLedger(ledger: ConservedDoubleEntryCRDT): void {
    this.ledger = ledger;
  }

  /**
   * Records morning wholesale purchases from manual input or scanned receipt OCR.
   * Commits double-entry inventory opening to CRDT ledger:
   *   DR Assets:Inventory:[Item]  [TotalCost]
   *   CR Assets:Cash (or Liabilities:Supplier) [TotalCost]
   */
  public ingestWholesaleBill(
    purchases: WholesaleItemPurchase[],
    paidViaCash: boolean = true
  ): BalancedDelta[] {
    const deltas: BalancedDelta[] = [];

    for (const p of purchases) {
      const rawUnitCost = p.bulkQuantity > 0 ? p.totalCost / p.bulkQuantity : 0;
      const effectiveUnitCost = rawUnitCost * (1.0 + (this.overheadFactorPercent / 100.0));

      const existing = this.inventoryCostMap.get(p.itemName.toLowerCase());
      if (existing) {
        const totalQty = existing.totalQuantity + p.bulkQuantity;
        const totalWeightedCost = (existing.totalQuantity * existing.unitCostBasis) + p.totalCost;
        const newUnitCost = totalWeightedCost / totalQty;
        this.inventoryCostMap.set(p.itemName.toLowerCase(), {
          itemName: p.itemName.toLowerCase(),
          totalQuantity: totalQty,
          remainingQuantity: existing.remainingQuantity + p.bulkQuantity,
          unit: p.unit,
          unitCostBasis: Math.round(newUnitCost * 100) / 100,
          effectiveUnitCost: Math.round(newUnitCost * (1.0 + this.overheadFactorPercent / 100.0) * 100) / 100
        });
      } else {
        this.inventoryCostMap.set(p.itemName.toLowerCase(), {
          itemName: p.itemName.toLowerCase(),
          totalQuantity: p.bulkQuantity,
          remainingQuantity: p.bulkQuantity,
          unit: p.unit,
          unitCostBasis: Math.round(rawUnitCost * 100) / 100,
          effectiveUnitCost: Math.round(effectiveUnitCost * 100) / 100
        });
      }

      // Commit to double-entry CRDT ledger if attached
      if (this.ledger) {
        const amountMinor = Math.round(p.totalCost * 100);
        const creditAccount = paidViaCash ? 'Assets:Cash:Drawer' : 'Liabilities:AccountsPayable:WholesaleSupplier';
        const delta = this.ledger.postTransaction({
          txId: `WHOLESALE_BUY_${p.itemName.toUpperCase()}_${Date.now()}`,
          debitAccount: `Assets:Inventory:${p.itemName}`,
          creditAccount,
          amountMinor,
          memo: `Wholesale purchase: ${p.bulkQuantity} ${p.unit} of ${p.itemName} @ ₹${rawUnitCost.toFixed(2)}/${p.unit}`,
          epistemicState: 'CONSERVED_CANONICAL'
        });
        deltas.push(delta);
      }
    }

    return deltas;
  }

  /**
   * Retrieves the wholesale cost basis for an ingredient.
   * Returns undefined if item is unknown.
   */
  public getCostBasis(itemName: string): WholesaleCostBasis | undefined {
    return this.inventoryCostMap.get(itemName.toLowerCase());
  }

  /**
   * Burns inventory quantity when an order is settled.
   * Returns the calculated Cost of Goods Sold (COGS) in Rupees.
   */
  public recordInventoryBurn(itemName: string, quantityBurned: number): {
    unitCost: number;
    totalCogs: number;
    remainingStock: number;
  } {
    const basis = this.inventoryCostMap.get(itemName.toLowerCase());
    if (!basis) {
      return { unitCost: 0, totalCogs: 0, remainingStock: 0 };
    }

    basis.remainingQuantity = Math.max(0, basis.remainingQuantity - quantityBurned);
    const totalCogs = Math.round(quantityBurned * basis.effectiveUnitCost * 100) / 100;

    return {
      unitCost: basis.effectiveUnitCost,
      totalCogs,
      remainingStock: basis.remainingQuantity
    };
  }

  /**
   * Returns complete snapshot of wholesale inventory stock and unit costs.
   */
  public getAllInventory(): WholesaleCostBasis[] {
    return Array.from(this.inventoryCostMap.values());
  }
}
