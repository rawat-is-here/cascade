/**
 * Indic Phonetic Soundex & Trie Alias Resolver
 * 100% Standalone On-Device. Sub-millisecond execution.
 * 
 * Maps Indian colloquial customer nicknames and phonetic variants (e.g. "Sharma ji", "Sarma", "Sarmaji")
 * to canonical customer ledger entities.
 */

export interface CanonicalCustomerEntity {
  entityId: string;           // e.g. "ENT-SHARMA-01"
  canonicalName: string;      // e.g. "Sharma Ji"
  historicalAgreedRate?: Record<string, number>; // e.g. { "tomato": 30.0 }
  totalPurchasesCount: number;
}

export class IndicPhoneticTrie {
  private static readonly HONORIFICS = ['ji', 'bhai', 'sahab', 'saheb', 'seth', 'babu', 'dada', 'chacha', 'uncle', 'aunty'];

  // Map of canonical entities by ID
  private entities: Map<string, CanonicalCustomerEntity> = new Map();
  // Map of normalized phonetic code -> entityId
  private phoneticIndex: Map<string, string> = new Map();

  constructor() {
    // Seed default common customer profiles for testing & production
    this.registerCustomer({
      entityId: 'ENT-SHARMA-01',
      canonicalName: 'Sharma Ji',
      historicalAgreedRate: { 'tomato': 30, 'onion': 25 },
      totalPurchasesCount: 42
    }, ['sharma', 'sharmaji', 'sarma', 'sarmaji', 'sharma sahab']);

    this.registerCustomer({
      entityId: 'ENT-PANDIT-02',
      canonicalName: 'Pandit Ji',
      historicalAgreedRate: { 'milk': 55, 'potato': 18 },
      totalPurchasesCount: 28
    }, ['pandit', 'panditji', 'pandat', 'pandatji']);

    this.registerCustomer({
      entityId: 'ENT-MASTER-03',
      canonicalName: 'Master Ji',
      historicalAgreedRate: { 'tea': 10, 'poha': 18 },
      totalPurchasesCount: 15
    }, ['master', 'masterji']);
  }

  /**
   * Registers a customer entity with known spoken aliases.
   */
  public registerCustomer(entity: CanonicalCustomerEntity, knownAliases: string[] = []): void {
    this.entities.set(entity.entityId, entity);

    // Index canonical name
    const code = IndicPhoneticTrie.soundex(entity.canonicalName);
    this.phoneticIndex.set(code, entity.entityId);

    // Index all aliases
    for (const alias of knownAliases) {
      const aliasCode = IndicPhoneticTrie.soundex(alias);
      this.phoneticIndex.set(aliasCode, entity.entityId);
    }
  }

  /**
   * Resolves a spoken name mention (e.g. "Sharma ji ka 40 jama kar") to a canonical customer entity.
   */
  public resolve(rawName: string): CanonicalCustomerEntity | undefined {
    // 1. Direct check on full cleaned string
    const cleanedFull = IndicPhoneticTrie.cleanHonorifics(rawName);
    const directCode = IndicPhoneticTrie.soundex(cleanedFull);
    const directId = this.phoneticIndex.get(directCode);
    if (directId) {
      return this.entities.get(directId);
    }

    // 2. Tokenize and search bigrams and unigrams
    const tokens = rawName
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);

    // Try bigrams first
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      const bigramCode = IndicPhoneticTrie.soundex(bigram);
      const entityId = this.phoneticIndex.get(bigramCode);
      if (entityId) {
        return this.entities.get(entityId);
      }
    }

    // Try unigrams
    for (const token of tokens) {
      // Ignore common non-name stop words in Hindi/Hinglish ledger phrases
      if (['ka', 'ki', 'ke', 'ko', 'jama', 'kar', 'do', 'likh', 'dena', 'bhaiya'].includes(token)) {
        continue;
      }
      const code = IndicPhoneticTrie.soundex(token);
      const entityId = this.phoneticIndex.get(code);
      if (entityId) {
        return this.entities.get(entityId);
      }
    }

    return undefined;
  }

  /**
   * Removes conversational honorifics from Indic names.
   */
  public static cleanHonorifics(name: string): string {
    let cleaned = name.toLowerCase().trim();
    for (const h of this.HONORIFICS) {
      cleaned = cleaned.replace(new RegExp(`\\b${h}\\b`, 'g'), '').trim();
    }
    return cleaned.replace(/\s+/g, ' ');
  }

  /**
   * Indic-Adapted Soundex Algorithm:
   * Maps phonetic consonant clusters across Hindi/Hinglish to canonical sound buckets.
   * Group 1 (Sibilants): S, Sh, Z, Zh -> '1'
   * Group 2 (Labials):   B, V, Bh, P, F -> '2'
   * Group 3 (Gutturals): K, Kh, G, Gh, Q -> '3'
   * Group 4 (Dentals):   D, Dh, T, Th -> '4'
   * Group 5 (Liquids):   L, R, Rh -> '5'
   * Group 6 (Nasals):    M, N -> '6'
   */
  public static soundex(input: string): string {
    const cleaned = this.cleanHonorifics(input).replace(/[^a-z]/g, '');
    if (!cleaned) return '0000';

    const firstChar = cleaned[0].toUpperCase();
    const mappings: Record<string, string> = {
      s: '1', c: '1', z: '1',
      b: '2', v: '2', p: '2', f: '2', w: '2',
      k: '3', g: '3', q: '3',
      d: '4', t: '4', j: '4',
      l: '5', r: '5',
      m: '6', n: '6'
    };

    let result = firstChar;
    let prevCode = mappings[cleaned[0]] || '0';

    for (let i = 1; i < cleaned.length; i++) {
      const char = cleaned[i];
      const code = mappings[char] || '0';

      if (code !== '0' && code !== prevCode) {
        result += code;
      }
      prevCode = code;

      if (result.length === 4) break;
    }

    return result.padEnd(4, '0');
  }

  public getEntity(entityId: string): CanonicalCustomerEntity | undefined {
    return this.entities.get(entityId);
  }
}
