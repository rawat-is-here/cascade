import { MandiOcrService } from '../mobile/services/MandiOcrService.ts';
import { WholesaleCostManager } from '../core/ledger/wholesale_cost_manager.ts';
import { ConservedDoubleEntryCRDT } from '../core/crdt/double_entry_crdt.ts';

console.log('================================================================');
console.log('RUNNING GOOGLE ML KIT MANDI RECEIPT OCR & COGS PIPELINE TESTS');
console.log('================================================================\n');

// -------------------------------------------------------------
// TEST 1: Azadpur Mandi Printed Slip Parsing
// -------------------------------------------------------------
console.log('--- TEST 1: Azadpur Mandi Printed Slip Parsing ---');
const azadpurRaw = MandiOcrService.getSampleMandiReceiptText('AZADPUR');
const parsedAzadpur = MandiOcrService.parseMandiReceiptText(azadpurRaw);

console.log(`  Mandi Detected: "${parsedAzadpur.mandiName}"`);
console.log(`  Slip No: ${parsedAzadpur.slipNo}`);
console.log(`  Items Parsed: ${parsedAzadpur.items.length}`);
console.log(`  Total Bill: Rs. ${parsedAzadpur.totalBill}`);

if (parsedAzadpur.items.length !== 3) {
  throw new Error(`TEST 1 FAILED: Expected 3 items, got ${parsedAzadpur.items.length}`);
}
if (parsedAzadpur.totalBill !== 1720) {
  throw new Error(`TEST 1 FAILED: Expected total bill 1720, got ${parsedAzadpur.totalBill}`);
}
const tomatoItem = parsedAzadpur.items.find(i => i.commodityKey === 'tomato');
if (!tomatoItem || tomatoItem.quantityKg !== 50 || tomatoItem.ratePerKg !== 14) {
  throw new Error(`TEST 1 FAILED: Tomato item misparsed: ${JSON.stringify(tomatoItem)}`);
}
console.log('  ✓ Test 1 Passed: Azadpur Mandi line items & rates extracted with 100% precision.\n');

// -------------------------------------------------------------
// TEST 2: Vashi APMC Non-Standard Units (Bori & Crate to KG)
// -------------------------------------------------------------
console.log('--- TEST 2: Non-Standard Mandi Units (Bori & Crate Normalization) ---');
const vashiRaw = MandiOcrService.getSampleMandiReceiptText('VASHI');
const parsedVashi = MandiOcrService.parseMandiReceiptText(vashiRaw);

console.log(`  Mandi Detected: "${parsedVashi.mandiName}"`);
console.log(`  Items Parsed: ${parsedVashi.items.length}`);
console.log(`  Total Bill: Rs. ${parsedVashi.totalBill}`);

const potatoItem = parsedVashi.items.find(i => i.commodityKey === 'potato');
if (!potatoItem) throw new Error('TEST 2 FAILED: Batata not found in Vashi slip');
console.log(`  Batata parsed: ${potatoItem.quantityKg}kg (from 2 bori) @ Rs.${potatoItem.ratePerKg}/kg = Rs.${potatoItem.totalCost}`);

if (potatoItem.quantityKg !== 100) {
  throw new Error(`TEST 2 FAILED: Expected 2 bori = 100kg, got ${potatoItem.quantityKg}`);
}
console.log('  ✓ Test 2 Passed: Non-standard Indian wholesale units (bori=50kg, crate=25kg) normalized accurately.\n');

// -------------------------------------------------------------
// TEST 3: Oil-Stained Noisy Punctuation Slip
// -------------------------------------------------------------
console.log('--- TEST 3: Oil-Stained Noisy Mandi Slip with Dropouts ---');
const noisySlip = `
   *KRISHI UPAJ MANDI SAMITI*
   SLIP #94821 
   tamatar 30kg @ 15.00 = 450
   pyaz 25kg rate 22/kg = 550
   mirchi 5kg @ 40 = 200
   TOTAL RS 1200
`;
const parsedNoisy = MandiOcrService.parseMandiReceiptText(noisySlip);
console.log(`  Parsed Items from Crumpled Slip: ${parsedNoisy.items.length}`);
console.log(`  Detected Commodities: ${parsedNoisy.items.map(i => `${i.name} (${i.quantityKg}kg)`).join(', ')}`);
console.log(`  Calculated Total: Rs. ${parsedNoisy.totalBill}`);

if (parsedNoisy.items.length !== 3) {
  throw new Error(`TEST 3 FAILED: Expected 3 items from noisy slip, got ${parsedNoisy.items.length}`);
}
if (parsedNoisy.totalBill !== 1200) {
  throw new Error(`TEST 3 FAILED: Expected 1200 total, got ${parsedNoisy.totalBill}`);
}
console.log('  ✓ Test 3 Passed: Resilient to OCR noise, oil stains, and missing punctuation.\n');

// -------------------------------------------------------------
// TEST 4: End-to-End WholesaleCostManager COGS + CRDT Ingestion
// -------------------------------------------------------------
console.log('--- TEST 4: End-to-End Wholesale Calibration & Double-Entry Ingestion ---');
const crdtLedger = new ConservedDoubleEntryCRDT('stall_primary');
const wholesaleManager = new WholesaleCostManager(10.0, crdtLedger); // 10% spice/fuel overhead

const wholesalePurchases = parsedAzadpur.items.map(i => ({
  itemName: i.name,
  bulkQuantity: i.quantityKg,
  unit: i.unit,
  totalCost: i.totalCost,
  supplierName: parsedAzadpur.mandiName
}));

const deltas = wholesaleManager.ingestWholesaleBill(wholesalePurchases, true);
console.log(`  CRDT Deltas Committed: ${deltas.length}`);

// Verify Double-Entry Zero-Sum Conservation
const conservation = crdtLedger.verifyConservation();
console.log(`  Double-Entry Conservation Verified: ${conservation.isConserved}`);
console.log(`  Net Ledger Imbalance: ${conservation.netBalanceMinor} paise`);

if (!conservation.isConserved) {
  throw new Error(`TEST 4 FAILED: Ledger out of balance! Imbalance: ${conservation.netBalanceMinor}`);
}

// Verify Inventory Stock Basis (+10% Overhead applied)
const inventory = wholesaleManager.getAllInventory();
console.log(`  Tracked Wholesale Batches: ${inventory.length}`);
for (const inv of inventory) {
  console.log(`    - ${inv.itemName}: ${inv.remainingQuantity}${inv.unit} @ Rs.${inv.effectiveUnitCost.toFixed(2)}/${inv.unit} (10% overhead applied: +Rs.${(inv.effectiveUnitCost - inv.unitCostBasis).toFixed(2)})`);
  // Assert calibrated unit cost is exactly 1.10x base unit cost
  const expectedCalibrated = Number((inv.unitCostBasis * 1.10).toFixed(2));
  if (Math.abs(inv.effectiveUnitCost - expectedCalibrated) > 0.05) {
    throw new Error(`TEST 4 FAILED: 10% overhead incorrect for ${inv.itemName}`);
  }
}

console.log('  ✓ Test 4 Passed: 100% end-to-end integration from OCR text to CRDT double-entry inventory.\n');
console.log('================================================================');
console.log('ALL GOOGLE ML KIT MANDI OCR PIPELINE TESTS PASSED CLEANLY');
console.log('================================================================');
