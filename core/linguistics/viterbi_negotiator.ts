import type { SpeakerRole, NegotiationDialogueAct, ActiveCustomerNegotiation } from '../../shared/types.ts';
import { IndicNumericLexer, type ExtractedIndicEntities } from './indic_lexer.ts';
import { IndicPhoneticTrie, type CanonicalCustomerEntity } from './indic_phonetic.ts';

export interface NegotiationResult {
  sessionId: string;
  customerId: string;
  itemName?: string;
  itemNormalized?: string;
  quotedRate?: number;
  customerCounterRate?: number;
  finalAgreedRate?: number;
  quantity?: number;
  unit?: string;
  derivedTotalAmount?: number;
  derivedTotalMinor?: number; // In paise (paise = total * 100)
  isBindingCommitted: boolean;
  isFreebie: boolean;
  isWalkaway: boolean;
  currentState: string;
  explanation: string;
}

// 9 Canonical States in the Bargaining Markov Chain
export type HMMState = 
  | 'IDLE' 
  | 'INQUIRY' 
  | 'VENDOR_QUOTE' 
  | 'CUSTOMER_COUNTER' 
  | 'VENDOR_CONCESSION' 
  | 'VENDOR_REJECTION' 
  | 'QUANTITY_SPEC' 
  | 'VALUE_ORDER' 
  | 'FREEBIE_REQUEST' 
  | 'WALK_AWAY'
  | 'SETTLED';

export class ViterbiNegotiatorEngine {
  private activeSessions: Map<string, ActiveCustomerNegotiation> = new Map();
  private aliasTrie = new IndicPhoneticTrie();

  // Semantic Prototype Anchor Clusters
  private static readonly ANCHOR_CLUSTERS: Record<string, string[]> = {
    'INQUIRY': [
      'tamatar kitne ka', 'tamatar kya bhav', 'aalu ka rate bolo', 'kya hisaab diya',
      'kitne ka lagaya', 'bhav kya hai', 'kitna diya'
    ],
    'VENDOR_QUOTE': [
      '40 ka diya', 'chalis rupaye', 'rate 40 hai', 'tees rupaye kilo', 'bees ka ek kilo',
      '40 lagega', 'saaf maal hai 40'
    ],
    'CUSTOMER_COUNTER': [
      'nahi 30 ka lagao', '30 me nipta do', 'kam karo bhaiya', 'padosi 25 me de raha hai',
      'kuch to kam karo', '30 se ek rupya upar nahi doonga', '30 me de do', '25 lagao'
    ],
    'VENDOR_CONCESSION': [
      'ok', 'theek hai', 'chalo le jao', 'de diya', 'baandh do', 'daal diya',
      'le lo', 'chal theek hai', 'ha le ja', 'ok done'
    ],
    'VENDOR_REJECTION': [
      'nahi hoga', 'nahi jam raha', 'kharid hi 32 ki hai', '35 se kam nahi',
      'chhod do', 'itne me nahi baithta', 'nahi aayega'
    ],
    'QUANTITY_SPEC': [
      'aadha kilo kar do', 'ek kilo daalo', '2 paav de do', 'dedh kilo pack karo',
      'ek kilo kar do', 'paav de do', '2 kilo daal do', 'aadha kilo'
    ],
    'VALUE_ORDER': [
      '50 rupaye ka de do', '100 ka aalu do', 'bees rupaye ka tamatar', '50 ka aalu'
    ],
    'FREEBIE_REQUEST': [
      'thoda dhaniya mirchi daal do', 'mirchi upar se do', 'nimbu free me do', 'thoda kadi patta'
    ],
    'WALK_AWAY': [
      'rehne do bhaiya', 'aage dekhenge', 'nahi chahiye', 'bohot mehenga hai',
      'chalo aage chalte hain', 'chhod do rehne do'
    ]
  };

  // State Transition Probability Matrix: P(State_t | State_t-1)
  // Strictly enforces conversation laws. Unacceptable transitions have probability 0.0.
  private static readonly TRANSITION_MATRIX: Record<HMMState, Partial<Record<HMMState, number>>> = {
    'IDLE': {
      'INQUIRY': 0.5,
      'VENDOR_QUOTE': 0.3,
      'VALUE_ORDER': 0.15,
      'IDLE': 0.05
    },
    'INQUIRY': {
      'VENDOR_QUOTE': 0.85,
      'WALK_AWAY': 0.1,
      'IDLE': 0.05
    },
    'VENDOR_QUOTE': {
      'CUSTOMER_COUNTER': 0.6,
      'QUANTITY_SPEC': 0.25,
      'WALK_AWAY': 0.1,
      'VENDOR_QUOTE': 0.05
    },
    'CUSTOMER_COUNTER': {
      'VENDOR_CONCESSION': 0.5,
      'VENDOR_REJECTION': 0.35,
      'WALK_AWAY': 0.15,
      'CUSTOMER_COUNTER': 0.0,
      'SETTLED': 0.0 // FORBIDDEN: Customer cannot self-commit without vendor concession!
    },
    'VENDOR_CONCESSION': {
      'QUANTITY_SPEC': 0.7,
      'SETTLED': 0.25,
      'WALK_AWAY': 0.05
    },
    'VENDOR_REJECTION': {
      'CUSTOMER_COUNTER': 0.45,
      'VENDOR_QUOTE': 0.3,
      'WALK_AWAY': 0.25
    },
    'QUANTITY_SPEC': {
      'SETTLED': 0.9,
      'IDLE': 0.1
    },
    'VALUE_ORDER': {
      'SETTLED': 0.85,
      'IDLE': 0.15
    },
    'FREEBIE_REQUEST': {
      'SETTLED': 0.9,
      'IDLE': 0.1
    },
    'WALK_AWAY': {
      'IDLE': 1.0
    },
    'SETTLED': {
      'IDLE': 0.8,
      'INQUIRY': 0.2
    }
  };

  /**
   * Processes a turn in the dialogue stream and returns the updated negotiation state.
   */
  public processTurn(params: {
    speakerRole: SpeakerRole;
    utteranceText: string;
    customerId?: string;
    timestamp?: number;
  }): NegotiationResult {
    const timestamp = params.timestamp || Date.now();
    const customerId = params.customerId || 'CUST_DEFAULT';
    const text = params.utteranceText.trim();

    // 1. Lexical extraction of numbers, commodities, and units
    const entities = IndicNumericLexer.parse(text);

    // 2. Resolve alias if mention present ("Sharma ji")
    const aliasEntity = this.aliasTrie.resolve(text);

    // 3. Retrieve or create customer active session
    let session = this.activeSessions.get(customerId);
    if (!session) {
      session = {
        sessionKey: `${customerId}:${entities.itemNormalized || 'GENERAL'}`,
        customerId,
        itemName: entities.itemNormalized || 'general',
        currentState: 'IDLE',
        isVendorConfirmed: false,
        lastActiveTimestamp: timestamp
      };
      this.activeSessions.set(customerId, session);
    }

    // 4. Compute Emission Likelihoods via Character 3-Gram Cosine Vector Match
    const emissionScores = this.computeEmissionLikelihoods(text, entities);

    // 5. Viterbi Path Transition Step: Determine most probable current state
    const prevState = (session.currentState as HMMState) || 'IDLE';
    const nextState = this.determineNextState(prevState, emissionScores, params.speakerRole, entities);

    // 6. Update Negotiation State & Execute Criticality Rules
    session.currentState = nextState;
    session.lastActiveTimestamp = timestamp;
    if (entities.itemNormalized) session.itemName = entities.itemNormalized;

    return this.applyCriticalityRules(session, nextState, entities, params.speakerRole, text, aliasEntity);
  }

  /**
   * Evaluates emission similarity between utterance and anchor clusters.
   */
  private computeEmissionLikelihoods(text: string, entities: ExtractedIndicEntities): Record<string, number> {
    const scores: Record<string, number> = {};
    const lower = text.toLowerCase();

    for (const [intent, anchors] of Object.entries(ViterbiNegotiatorEngine.ANCHOR_CLUSTERS)) {
      let maxSim = 0.01;
      for (const anchor of anchors) {
        const sim = ViterbiNegotiatorEngine.stringSimilarity(lower, anchor);
        if (sim > maxSim) {
          maxSim = sim;
        }
      }
      scores[intent] = maxSim;
    }

    // Boost scores based on extracted lexical entities
    if (entities.isFreebie) scores['FREEBIE_REQUEST'] = 0.95;
    if (entities.isValueDriven) scores['VALUE_ORDER'] = 0.95;
    if (entities.quantity !== undefined && !entities.isValueDriven) scores['QUANTITY_SPEC'] = Math.max(scores['QUANTITY_SPEC'] || 0, 0.9);

    return scores;
  }

  /**
   * Selects next optimal state maximizing P(Obs | S) * P(S | S_prev).
   */
  private determineNextState(
    prevState: HMMState, 
    emissions: Record<string, number>, 
    speakerRole: SpeakerRole,
    entities: ExtractedIndicEntities
  ): HMMState {
    const transitions = ViterbiNegotiatorEngine.TRANSITION_MATRIX[prevState] || ViterbiNegotiatorEngine.TRANSITION_MATRIX['IDLE'];

    let bestState: HMMState = 'IDLE';
    let maxProbability = -1;

    for (const [candidateState, transProb] of Object.entries(transitions)) {
      if (transProb === undefined || transProb <= 0) continue;

      let emissionProb = emissions[candidateState] || 0.05;

      // Speaker Role Invariant Constraints:
      // A customer cannot emit VENDOR_CONCESSION or VENDOR_QUOTE.
      if (speakerRole === 'CUSTOMER' && (candidateState === 'VENDOR_CONCESSION' || candidateState === 'VENDOR_QUOTE' || candidateState === 'VENDOR_REJECTION')) {
        emissionProb = 0.0;
      }
      // A vendor cannot emit CUSTOMER_COUNTER or FREEBIE_REQUEST.
      if (speakerRole === 'VENDOR' && (candidateState === 'CUSTOMER_COUNTER' || candidateState === 'FREEBIE_REQUEST')) {
        emissionProb = 0.0;
      }

      const totalProb = transProb * emissionProb;
      if (totalProb > maxProbability) {
        maxProbability = totalProb;
        bestState = candidateState as HMMState;
      }
    }

    // Direct override for explicit keywords if ambiguous
    if (entities.isFreebie) return 'FREEBIE_REQUEST';
    if (entities.isValueDriven) return 'VALUE_ORDER';

    return bestState;
  }

  /**
   * Applies the 8 Criticality business and ledger rules.
   */
  private applyCriticalityRules(
    session: ActiveCustomerNegotiation,
    state: HMMState,
    entities: ExtractedIndicEntities,
    speakerRole: SpeakerRole,
    rawText: string,
    aliasEntity?: CanonicalCustomerEntity
  ): NegotiationResult {
    let isBindingCommitted = false;
    let isFreebie = false;
    let isWalkaway = false;
    let explanation = `State: ${state}`;

    // -------------------------------------------------------------
    // CRITICALITY 1: Aborted Walkaway
    // -------------------------------------------------------------
    if (state === 'WALK_AWAY') {
      isWalkaway = true;
      this.activeSessions.delete(session.customerId);
      return {
        sessionId: session.sessionKey,
        customerId: session.customerId,
        itemName: session.itemName,
        derivedTotalAmount: 0,
        derivedTotalMinor: 0,
        isBindingCommitted: false,
        isFreebie: false,
        isWalkaway: true,
        currentState: 'WALK_AWAY',
        explanation: 'Customer walked away. Transaction aborted with 0 ledger entry.'
      };
    }

    // -------------------------------------------------------------
    // CRITICALITY 5: The "Dhaniya-Mirchi" Freebie (Goodwill Leak)
    // -------------------------------------------------------------
    if (state === 'FREEBIE_REQUEST' || entities.isFreebie) {
      isFreebie = true;
      return {
        sessionId: session.sessionKey,
        customerId: session.customerId,
        itemName: entities.itemNormalized || 'coriander',
        derivedTotalAmount: 0,
        derivedTotalMinor: 0,
        isBindingCommitted: true,
        isFreebie: true,
        isWalkaway: false,
        currentState: 'FREEBIE_REQUEST',
        explanation: 'Promotional goodwill freebie. Decrements stock, Cash remains untouched.'
      };
    }

    // -------------------------------------------------------------
    // CRITICALITY 2: Value-Driven Orders ("50 rupaye ka aalu")
    // -------------------------------------------------------------
    if (state === 'VALUE_ORDER' || entities.isValueDriven) {
      const cashTarget = entities.price || 50;
      const rate = session.finalAgreedRate || session.currentQuotedRate || 20; // default rate
      const inferredQty = IndicNumericLexer.calculateQuantityFromValue(cashTarget, rate);

      session.derivedTotalAmount = cashTarget;
      session.quantity = inferredQty;
      session.isVendorConfirmed = true;

      return {
        sessionId: session.sessionKey,
        customerId: session.customerId,
        itemName: session.itemName,
        finalAgreedRate: rate,
        quantity: inferredQty,
        unit: 'kg',
        derivedTotalAmount: cashTarget,
        derivedTotalMinor: Math.round(cashTarget * 100),
        isBindingCommitted: true,
        isFreebie: false,
        isWalkaway: false,
        currentState: 'SETTLED',
        explanation: `Value-driven order of ₹${cashTarget}. Inferred weight: ${inferredQty}kg at ₹${rate}/kg.`
      };
    }

    // Rate Tracking
    if (state === 'VENDOR_QUOTE' && entities.price) {
      session.currentQuotedRate = entities.price;
      session.finalAgreedRate = entities.price;
      explanation = `Vendor quoted initial rate: ₹${entities.price}/${session.unit || 'kg'}`;
    }

    if (state === 'CUSTOMER_COUNTER' && entities.price) {
      // Counter-offer is proposed by customer but NOT committed!
      explanation = `Customer proposed counter-offer: ₹${entities.price}. Pending vendor confirmation.`;
      // We store the counter rate provisionally
      (session as any).provisionalCounterRate = entities.price;
    }

    // -------------------------------------------------------------
    // VENDOR CONCESSION ("Ok", "Theek hai")
    // -------------------------------------------------------------
    if (state === 'VENDOR_CONCESSION' && speakerRole === 'VENDOR') {
      session.isVendorConfirmed = true;
      if ((session as any).provisionalCounterRate) {
        session.finalAgreedRate = (session as any).provisionalCounterRate;
      }
      explanation = `Vendor conceded! Agreed unit rate locked at ₹${session.finalAgreedRate}/${session.unit || 'kg'}`;
    }

    // -------------------------------------------------------------
    // QUANTITY SPECIFICATION ("aadha kilo kar do") -> Final Calculation
    // -------------------------------------------------------------
    if (state === 'QUANTITY_SPEC' || entities.quantity !== undefined) {
      const qty = entities.quantity || session.quantity || 1.0;
      session.quantity = qty;
      session.unit = entities.unit || session.unit || 'kg';

      // -------------------------------------------------------------
    // CRITICALITY 8: Historical Alias Prior Boost
    // -------------------------------------------------------------
      if (aliasEntity && aliasEntity.historicalAgreedRate && session.itemName) {
        const pastRate = aliasEntity.historicalAgreedRate[session.itemName];
        if (pastRate && !session.finalAgreedRate) {
          session.finalAgreedRate = pastRate;
        }
      }

      const agreedRate = session.finalAgreedRate || session.currentQuotedRate || 40;
      const totalAmount = IndicNumericLexer.calculateTotal(agreedRate, qty);
      session.derivedTotalAmount = totalAmount;

      isBindingCommitted = session.isVendorConfirmed || (session.currentQuotedRate !== undefined);

      return {
        sessionId: session.sessionKey,
        customerId: session.customerId,
        itemName: session.itemName,
        quotedRate: session.currentQuotedRate,
        finalAgreedRate: agreedRate,
        quantity: qty,
        unit: session.unit,
        derivedTotalAmount: totalAmount,
        derivedTotalMinor: Math.round(totalAmount * 100),
        isBindingCommitted,
        isFreebie: false,
        isWalkaway: false,
        currentState: 'SETTLED',
        explanation: `Agreed Rate ₹${agreedRate} × Qty ${qty}${session.unit} = Exactly ₹${totalAmount.toFixed(2)}.`
      };
    }

    // -------------------------------------------------------------
    // CRITICALITY 4: Weight Creep Adjustment ("1.18 kg ho gaya, 50 ka kar doon?")
    // -------------------------------------------------------------
    if (/(\d+)\s*(?:ka\s*kar\s*doon|kar\s*du|chalega)/i.test(rawText) && speakerRole === 'VENDOR') {
      const match = rawText.match(/(\d+)\s*(?:ka\s*kar\s*doon|kar\s*du)/i);
      if (match) {
        const revisedTotal = parseFloat(match[1]);
        session.derivedTotalAmount = revisedTotal;
        explanation = `Post-weighing adjustment to ₹${revisedTotal}. Awaiting customer confirmation.`;
      }
    }

    return {
      sessionId: session.sessionKey,
      customerId: session.customerId,
      itemName: session.itemName,
      quotedRate: session.currentQuotedRate,
      finalAgreedRate: session.finalAgreedRate,
      quantity: session.quantity,
      unit: session.unit,
      derivedTotalAmount: session.derivedTotalAmount,
      derivedTotalMinor: session.derivedTotalAmount ? Math.round(session.derivedTotalAmount * 100) : undefined,
      isBindingCommitted: false,
      isFreebie: false,
      isWalkaway: false,
      currentState: state,
      explanation
    };
  }

  /**
   * Character 3-Gram Cosine Vector Similarity
   * Evaluates semantic distance between two strings without heavy external models.
   */
  public static stringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    const nGrams1 = this.getNGrams(s1, 3);
    const nGrams2 = this.getNGrams(s2, 3);

    let intersection = 0;
    for (const [gram, count1] of nGrams1) {
      if (nGrams2.has(gram)) {
        intersection += Math.min(count1, nGrams2.get(gram)!);
      }
    }

    const total1 = Array.from(nGrams1.values()).reduce((a, b) => a + b, 0);
    const total2 = Array.from(nGrams2.values()).reduce((a, b) => a + b, 0);

    const denom = Math.sqrt(total1 * total2);
    return denom === 0 ? 0 : Number((intersection / denom).toFixed(3));
  }

  private static getNGrams(str: string, n = 3): Map<string, number> {
    const map = new Map<string, number>();
    const padded = `  ${str.toLowerCase()}  `;
    for (let i = 0; i <= padded.length - n; i++) {
      const gram = padded.substring(i, i + n);
      map.set(gram, (map.get(gram) || 0) + 1);
    }
    return map;
  }

  public getActiveSession(customerId: string): ActiveCustomerNegotiation | undefined {
    return this.activeSessions.get(customerId);
  }
}
