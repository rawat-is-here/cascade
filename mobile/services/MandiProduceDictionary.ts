/**
 * Offline Indic Mandi Produce Dictionary & Fuzzy Lexicon Matcher
 * 
 * Street vendors in Indian mandis use mixed dialects (Hindi, Hinglish, Marathi, Punjabi),
 * colloquial contractions, and handwritten abbreviations.
 * 
 * This module uses Levenshtein distance to map noisy OCR output (e.g. "al00", "tmatr", "knda")
 * to clean canonical produce with standardized wholesale packaging weights.
 */

export interface CanonicalProduce {
  canonicalName: string;
  hindiName: string;
  aliases: string[];
  defaultUnit: 'kg' | 'crate' | 'bori' | 'piece' | 'l';
  defaultWholesaleWeightKg: number; // e.g. 1 bori = 50kg, 1 crate = 25kg
  typicalPricePerKg: number;
}

export const MANDI_PRODUCE_CATALOG: CanonicalProduce[] = [
  {
    canonicalName: 'Aloo (Potato)',
    hindiName: 'आलू',
    aliases: ['aloo', 'aalu', 'alu', 'batata', 'bataata', 'aalo', 'potato', 'al00', 'a100', 'आलू', 'बटाटा'],
    defaultUnit: 'bori',
    defaultWholesaleWeightKg: 50,
    typicalPricePerKg: 14
  },
  {
    canonicalName: 'Tamatar (Tomato)',
    hindiName: 'टमाटर',
    aliases: ['tamatar', 'tamaatar', 'tmatar', 'tamatr', 'tomato', 'tmtr', 'टमाटर', 'टमाटार'],
    defaultUnit: 'crate',
    defaultWholesaleWeightKg: 25,
    typicalPricePerKg: 18
  },
  {
    canonicalName: 'Pyaz / Kanda (Onion)',
    hindiName: 'प्याज़ / कांदा',
    aliases: ['pyaz', 'pyaaz', 'kanda', 'kande', 'knda', 'onion', 'pyaaj', 'कांदा', 'प्याज़', 'कांदे'],
    defaultUnit: 'bori',
    defaultWholesaleWeightKg: 50,
    typicalPricePerKg: 22
  },
  {
    canonicalName: 'Hari Mirch (Green Chili)',
    hindiName: 'हरी मिर्च',
    aliases: ['mirch', 'mirchi', 'hari mirch', 'mrch', 'chili', 'chilli', 'मिर्च', 'हरी मिर्च', 'मिरची'],
    defaultUnit: 'kg',
    defaultWholesaleWeightKg: 1,
    typicalPricePerKg: 45
  },
  {
    canonicalName: 'Adrak (Ginger)',
    hindiName: 'अदरक',
    aliases: ['adrak', 'adrakh', 'aale', 'ale', 'ginger', 'adrk', 'अदरक', 'आले'],
    defaultUnit: 'kg',
    defaultWholesaleWeightKg: 1,
    typicalPricePerKg: 110
  },
  {
    canonicalName: 'Lehsun (Garlic)',
    hindiName: 'लहसुन',
    aliases: ['lehsun', 'lahsun', 'lasun', 'garlic', 'lhsun', 'लहसुन', 'लसूण'],
    defaultUnit: 'kg',
    defaultWholesaleWeightKg: 1,
    typicalPricePerKg: 140
  },
  {
    canonicalName: 'Dhaniya (Coriander)',
    hindiName: 'धनिया',
    aliases: ['dhaniya', 'dhania', 'kothimbir', 'coriander', 'dhnya', 'धनिया', 'कोथिंबीर'],
    defaultUnit: 'kg',
    defaultWholesaleWeightKg: 1,
    typicalPricePerKg: 35
  },
  {
    canonicalName: 'Nimbu (Lemon)',
    hindiName: 'नींबू',
    aliases: ['nimbu', 'neebu', 'limbu', 'lemon', 'nmbu', 'नींबू', 'लिंबू'],
    defaultUnit: 'piece',
    defaultWholesaleWeightKg: 0.05,
    typicalPricePerKg: 60
  },
  {
    canonicalName: 'Patta Gobhi (Cabbage)',
    hindiName: 'पत्ता गोभी',
    aliases: ['gobhi', 'gobi', 'patta gobhi', 'band gobhi', 'cabbage', 'गोभी', 'पत्तागोभी'],
    defaultUnit: 'bori',
    defaultWholesaleWeightKg: 40,
    typicalPricePerKg: 16
  },
  {
    canonicalName: 'Phool Gobhi (Cauliflower)',
    hindiName: 'फूल गोभी',
    aliases: ['phool gobhi', 'cauliflower', 'ful gobi', 'फूलगोभी', 'फूल गोभी'],
    defaultUnit: 'bori',
    defaultWholesaleWeightKg: 30,
    typicalPricePerKg: 24
  },
  {
    canonicalName: 'Gajar (Carrot)',
    hindiName: 'गाजर',
    aliases: ['gajar', 'gajr', 'carrot', 'गाजर'],
    defaultUnit: 'bori',
    defaultWholesaleWeightKg: 40,
    typicalPricePerKg: 20
  },
  {
    canonicalName: 'Matar (Green Peas)',
    hindiName: 'मटर',
    aliases: ['matar', 'mutter', 'peas', 'mtr', 'मटर'],
    defaultUnit: 'bori',
    defaultWholesaleWeightKg: 30,
    typicalPricePerKg: 40
  },
  {
    canonicalName: 'Bhindi (Ladyfinger/Okra)',
    hindiName: 'भिंडी',
    aliases: ['bhindi', 'bhendi', 'okra', 'ladyfinger', 'भिंडी', 'भेंडी'],
    defaultUnit: 'kg',
    defaultWholesaleWeightKg: 1,
    typicalPricePerKg: 32
  },
  {
    canonicalName: 'Palak (Spinach)',
    hindiName: 'पालक',
    aliases: ['palak', 'spinach', 'paalak', 'पालक'],
    defaultUnit: 'kg',
    defaultWholesaleWeightKg: 1,
    typicalPricePerKg: 20
  },
  {
    canonicalName: 'Paneer (Cottage Cheese)',
    hindiName: 'पनीर',
    aliases: ['paneer', 'panir', 'cheese', 'cottage cheese', 'पनीर'],
    defaultUnit: 'kg',
    defaultWholesaleWeightKg: 1,
    typicalPricePerKg: 340
  },
  {
    canonicalName: 'Poha (Flattened Rice)',
    hindiName: 'पोहा',
    aliases: ['poha', 'pohe', 'chivda', 'aval', 'पोहा', 'पोहे'],
    defaultUnit: 'bori',
    defaultWholesaleWeightKg: 25,
    typicalPricePerKg: 38
  },
  {
    canonicalName: 'Refined Tel (Cooking Oil)',
    hindiName: 'रिफाइंड तेल',
    aliases: ['tel', 'oil', 'refined tel', 'sarson tel', 'refined', 'तेल'],
    defaultUnit: 'l',
    defaultWholesaleWeightKg: 15,
    typicalPricePerKg: 115
  }
];

/**
 * Standard Levenshtein Distance for fuzzy string similarity.
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Matches a noisy OCR word against the Indic Mandi Produce Catalog.
 * Returns the canonical produce or null if below threshold.
 */
export function fuzzyMatchMandiProduce(rawWord: string): { produce: CanonicalProduce; confidence: number } | null {
  const cleaned = rawWord.toLowerCase().replace(/[^a-zA-Z\u0900-\u097F]/g, '').trim();
  if (cleaned.length < 2) return null;

  let bestMatch: CanonicalProduce | null = null;
  let bestScore = 0;

  for (const item of MANDI_PRODUCE_CATALOG) {
    for (const alias of item.aliases) {
      const aliasClean = alias.toLowerCase();
      // Exact substring or prefix match
      if (cleaned === aliasClean) {
        return { produce: item, confidence: 1.0 };
      }
      if (cleaned.startsWith(aliasClean) || aliasClean.startsWith(cleaned)) {
        const score = Math.min(cleaned.length, aliasClean.length) / Math.max(cleaned.length, aliasClean.length);
        if (score > bestScore && score >= 0.75) {
          bestScore = score;
          bestMatch = item;
        }
      }

      // Levenshtein distance check for spelling / OCR confusion
      const dist = levenshteinDistance(cleaned, aliasClean);
      const maxLen = Math.max(cleaned.length, aliasClean.length);
      const similarity = 1 - (dist / maxLen);

      if (similarity > bestScore && similarity >= 0.65) {
        bestScore = similarity;
        bestMatch = item;
      }
    }
  }

  return bestMatch && bestScore >= 0.65 ? { produce: bestMatch, confidence: bestScore } : null;
}

/**
 * Standardizes units and weights: converts packaging units to kg.
 * E.g., '2 bori' -> 100 kg, '1 crate' -> 25 kg, '1 dharhi' -> 5 kg.
 */
export function normalizeWholesaleUnit(
  rawUnit: string,
  rawQuantity: number,
  commodity?: CanonicalProduce | null
): { quantityKg: number; unit: string } {
  const u = (rawUnit || '').toLowerCase().trim();

  if (['bori', 'katta', 'sack', 'बोरी', 'कट्टा'].includes(u)) {
    const unitWeight = commodity?.defaultWholesaleWeightKg || 50;
    return { quantityKg: rawQuantity * unitWeight, unit: 'kg' };
  }

  if (['crate', 'crates', 'petti', 'क्रेट', 'पेटी'].includes(u)) {
    const unitWeight = commodity?.defaultWholesaleWeightKg || 25;
    return { quantityKg: rawQuantity * unitWeight, unit: 'kg' };
  }

  if (['dharhi', 'dhadi', 'धड़ी'].includes(u)) {
    return { quantityKg: rawQuantity * 5, unit: 'kg' }; // 1 Dharhi = 5 kg in North India
  }

  if (['paav', 'pav', 'पाव'].includes(u)) {
    return { quantityKg: rawQuantity * 0.25, unit: 'kg' }; // 1 Paav = 250 g
  }

  if (['g', 'gm', 'gram', 'ग्राम'].includes(u)) {
    return { quantityKg: rawQuantity / 1000, unit: 'kg' };
  }

  if (['l', 'liter', 'litre', 'ltr', 'लीटर'].includes(u)) {
    return { quantityKg: rawQuantity, unit: 'l' };
  }

  if (['piece', 'pieces', 'pc', 'nug', 'नग'].includes(u)) {
    return { quantityKg: rawQuantity, unit: 'piece' };
  }

  return { quantityKg: rawQuantity, unit: 'kg' };
}
