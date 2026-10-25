/**
 * Deterministic Indic Numeric & Unit Lexer
 * 100% Standalone On-Device. Zero-dependency, sub-millisecond execution.
 * 
 * Maps Indian street colloquialisms, fractional units, and currency expressions
 * into physical metric weights (kg) and monetary amounts (paise/INR).
 */

export interface ExtractedIndicEntities {
  item?: string;
  itemNormalized?: string;
  price?: number;            // Price in INR units (e.g. 40.0)
  priceMinor?: number;       // Price in paise (e.g. 4000)
  quantity?: number;         // Quantity in base metric units (e.g. kg)
  unit?: string;             // e.g. "kg", "plate", "piece"
  rawText: string;
  isValueDriven: boolean;    // true if order specified cash first (e.g. "50 rupaye ka aalu")
  isFreebie: boolean;        // true if customer asked for free garnish ("dhaniya-mirchi")
}

// Canonical unit mapping for Indian street retail
const COLLOQUIAL_UNIT_WEIGHTS_KG: Record<string, number> = {
  // Metric fraction slang
  'aadha kilo': 0.5,
  'adha kilo': 0.5,
  'aadha': 0.5,
  'adha': 0.5,
  'ek kilo': 1.0,
  '1 kilo': 1.0,
  'do kilo': 2.0,
  '2 kilo': 2.0,
  'teen kilo': 3.0,
  '3 kilo': 3.0,
  'char kilo': 4.0,
  '4 kilo': 4.0,
  'paanch kilo': 5.0,
  '5 kilo': 5.0,
  'dedh kilo': 1.5,
  'dhai kilo': 2.5,
  
  // Traditional Indian Pao / Pav (1 Pao = 250 grams = 0.25 kg)
  'paav': 0.25,
  'pao': 0.25,
  'pav': 0.25,
  'ek paav': 0.25,
  'ek pao': 0.25,
  'ek pav': 0.25,
  'do paav': 0.5,
  'do pao': 0.5,
  'do pav': 0.5,
  'teen paav': 0.75,
  'teen pao': 0.75,
  'char paav': 1.0,

  // Counts / Pieces / Plates
  'ek plate': 1.0,
  'do plate': 2.0,
  'teen plate': 3.0,
  'ek chai': 1.0,
  'do chai': 2.0,
  'teen chai': 3.0,
  'ek samosa': 1.0,
  'do samosa': 2.0,
  'teen samosa': 3.0,

  // Gram variants
  'sau gram': 0.1,
  'so gram': 0.1,
  'dedh sau gram': 0.15,
  'do sau gram': 0.2,
  'dhai sau gram': 0.25,
  'tin sau gram': 0.3,
  'paanch sau gram': 0.5,
  'aadha paav': 0.125,

  // Street kitchen / stall units (in kg equivalent)
  'katori': 0.14,      // 1 standard street bowl ~ 140g
  'ek katori': 0.14,
  'mutthi': 0.035,     // 1 fistful ~ 35g
  'ek mutthi': 0.035,
  'gaddi': 0.25        // 1 bundle (spinach/coriander) ~ 250g
};

// Canonical vocabulary mapping
const COMMODITY_MAP: Record<string, { canonical: string; standardUnit: string; defaultRate: number }> = {
  'tamatar': { canonical: 'tomato', standardUnit: 'kg', defaultRate: 40 },
  'tomato':  { canonical: 'tomato', standardUnit: 'kg', defaultRate: 40 },
  'pyaaz':   { canonical: 'onion', standardUnit: 'kg', defaultRate: 30 },
  'pyaj':    { canonical: 'onion', standardUnit: 'kg', defaultRate: 30 },
  'kanda':   { canonical: 'onion', standardUnit: 'kg', defaultRate: 30 },
  'onion':   { canonical: 'onion', standardUnit: 'kg', defaultRate: 30 },
  'aalu':    { canonical: 'potato', standardUnit: 'kg', defaultRate: 20 },
  'aloo':    { canonical: 'potato', standardUnit: 'kg', defaultRate: 20 },
  'batata':  { canonical: 'potato', standardUnit: 'kg', defaultRate: 20 },
  'potato':  { canonical: 'potato', standardUnit: 'kg', defaultRate: 20 },
  'adrak':   { canonical: 'ginger', standardUnit: 'kg', defaultRate: 120 },
  'lehsun':  { canonical: 'garlic', standardUnit: 'kg', defaultRate: 160 },
  'dhaniya': { canonical: 'coriander', standardUnit: 'kg', defaultRate: 80 },
  'mirchi':  { canonical: 'chili', standardUnit: 'kg', defaultRate: 60 },
  'nimbu':   { canonical: 'lemon', standardUnit: 'piece', defaultRate: 5 },
  'poha':    { canonical: 'poha', standardUnit: 'plate', defaultRate: 20 },
  'chai':    { canonical: 'tea', standardUnit: 'cup', defaultRate: 10 },
  'samosa':  { canonical: 'samosa', standardUnit: 'piece', defaultRate: 15 },
  'seb':     { canonical: 'apple', standardUnit: 'kg', defaultRate: 120 },
  'kela':    { canonical: 'banana', standardUnit: 'dozen', defaultRate: 40 }
};

export class IndicNumericLexer {
  /**
   * Parses an utterance into structured entities, numbers, and weights.
   */
  public static parse(rawText: string): ExtractedIndicEntities {
    const text = rawText.toLowerCase().trim();

    let item: string | undefined;
    let itemNormalized: string | undefined;
    let price: number | undefined;
    let quantity: number | undefined;
    let unit: string | undefined;
    let isValueDriven = false;
    let isFreebie = false;

    // 1. Detect Freebies ("thoda dhaniya mirchi daal do")
    if (/(?:thoda|upar se|free mein)?\s*(?:dhaniya|mirchi|kadi patta|nimbu)\s*(?:bhi\s*)?(?:daal do|de do|rakh do)/i.test(text)) {
      if (!/(?:rupaye|rs|mein|ka|lagao|\d+)/i.test(text)) {
        isFreebie = true;
      }
    }

    // 2. Identify Item / Commodity
    for (const [alias, meta] of Object.entries(COMMODITY_MAP)) {
      const regex = new RegExp(`\\b${alias}\\b`, 'i');
      if (regex.test(text)) {
        item = alias;
        itemNormalized = meta.canonical;
        unit = meta.standardUnit;
        break;
      }
    }

    // 3. Detect Value-Driven Orders ("50 rupaye ka aalu", "100 ka tamatar")
    const valueMatch = text.match(/(?:(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:rupaye|rs|ka|ke)\s*(?:ka|ke)?)\s*(?:aalu|aloo|tamatar|pyaaz|kanda|seb|adrak)/i);
    if (valueMatch && !/(?:kilo|kg|gm|gram|paav|pao|plate|cup)/i.test(text)) {
      const valStr = valueMatch[1] || valueMatch[2];
      if (valStr) {
        price = parseFloat(valStr);
        isValueDriven = true;
      }
    }

    // 4. Extract Colloquial Weights ("aadha kilo", "ek paav", "2 paav", "2 kilo")
    if (!isValueDriven) {
      // Check numeric + unit patterns first ("2 paav", "2 kilo", "500 gram", "3 plate", "3 samosa")
      const qtyMatch = text.match(/(\d+(?:\.\d+)?)\s*(kilo|kg|gm|gram|pao|paav|pav|plate|cup|glass|piece|dozen|samosa|samose|chai|poha|pohe)/i);
      if (qtyMatch) {
        const num = parseFloat(qtyMatch[1]);
        const u = qtyMatch[2].toLowerCase();
        if (u === 'kilo' || u === 'kg') {
          quantity = num;
          unit = 'kg';
        } else if (u === 'gm' || u === 'gram') {
          quantity = num / 1000;
          unit = 'kg';
        } else if (u === 'pao' || u === 'paav' || u === 'pav') {
          quantity = num * 0.25;
          unit = 'kg';
        } else {
          quantity = num;
          unit = u;
        }
      }

      // Fallback: Check multi-word verbal unit dictionary ("aadha kilo", "do paav", "ek paav")
      if (quantity === undefined) {
        const sortedKeys = Object.keys(COLLOQUIAL_UNIT_WEIGHTS_KG).sort((a, b) => b.length - a.length);
        for (const unitKey of sortedKeys) {
          const wordRegex = new RegExp(`\\b${unitKey}\\b`, 'i');
          if (wordRegex.test(text)) {
            quantity = COLLOQUIAL_UNIT_WEIGHTS_KG[unitKey];
            unit = 'kg';
            break;
          }
        }
      }
    }

    // 5. Extract Explicit Price / Rate ("40 ka diya", "30 lagao", "180 mein", "rate 40", "5 karo")
    if (price === undefined) {
      const priceRegex = /(?:(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?))|(\d+(?:\.\d+)?)\s*(?:ka\s*diya|ka\s*hai|mein|me|lagao|kar\s*do|ka\s*rate|rupaye|rs|bhav|karo|me\s*do|me\s*de|de\s*raha)/i;
      const pMatch = text.match(priceRegex);
      if (pMatch) {
        price = parseFloat(pMatch[1] || pMatch[2]);
      } else {
        // Fallback: standalone number when preceded or followed by rate-indicative words
        const standaloneMatch = text.match(/\b(\d+)\b/);
        if (standaloneMatch) {
          price = parseFloat(standaloneMatch[1]);
        }
      }
    }

    const priceMinor = price !== undefined ? Math.round(price * 100) : undefined;

    return {
      item,
      itemNormalized,
      price,
      priceMinor,
      quantity,
      unit: unit || 'kg',
      rawText,
      isValueDriven,
      isFreebie
    };
  }

  /**
   * Helper to derive total cash given unit rate and quantity.
   */
  public static calculateTotal(ratePerUnit: number, quantity: number): number {
    return Number((ratePerUnit * quantity).toFixed(2));
  }

  /**
   * Helper to derive inferred quantity given value target and unit rate.
   */
  public static calculateQuantityFromValue(cashTarget: number, ratePerUnit: number): number {
    if (ratePerUnit <= 0) return 0;
    return Number((cashTarget / ratePerUnit).toFixed(3));
  }
}
