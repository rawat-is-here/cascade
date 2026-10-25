import type { SpeakerRole, CustomerVoiceCluster } from '../../shared/types.ts';

export interface DiarizationResult {
  role: SpeakerRole;
  clusterId: string;       // "VENDOR" or "CUST_01", "CUST_02", etc.
  confidence: number;      // 0.0 to 1.0 (cosine similarity)
  isNovelCustomer: boolean;
}

/**
 * On-Device Speaker Diarization & Dynamic Online Customer Clustering
 * Based on 192-dimensional ECAPA-TDNN unit embeddings.
 * 
 * 100% Standalone on mobile CPU. Execution latency: <1ms per vector evaluation.
 * Solves the Mandi Cocktail Party problem (multiple customers bargaining concurrently).
 */
export class OnDeviceSpeakerDiarizer {
  public static readonly EMBEDDING_DIM = 192;
  public static readonly VENDOR_MATCH_THRESHOLD = 0.72;
  public static readonly CUSTOMER_MATCH_THRESHOLD = 0.68;
  public static readonly CUSTOMER_TTL_MS = 120000; // 2 minutes inactivity timeout

  private vendorProfile?: number[];
  private customerClusters: Map<string, CustomerVoiceCluster> = new Map();
  private nextCustomerSeq = 1;

  constructor(initialVendorProfile?: number[]) {
    if (initialVendorProfile) {
      this.vendorProfile = OnDeviceSpeakerDiarizer.normalize(initialVendorProfile);
    }
  }

  /**
   * Enrolls vendor voice using 1 to 3 calibration sample embeddings (5-second setup).
   */
  public enrollVendor(sampleEmbeddings: number[][]): number[] {
    if (sampleEmbeddings.length === 0) {
      throw new Error('At least one embedding is required for vendor enrollment.');
    }

    const centroid = new Array(OnDeviceSpeakerDiarizer.EMBEDDING_DIM).fill(0);
    for (const emb of sampleEmbeddings) {
      for (let i = 0; i < OnDeviceSpeakerDiarizer.EMBEDDING_DIM; i++) {
        centroid[i] += emb[i];
      }
    }

    this.vendorProfile = OnDeviceSpeakerDiarizer.normalize(centroid);
    return this.vendorProfile;
  }

  /**
   * Evaluates an incoming speech burst embedding against the vendor profile
   * and dynamic customer clusters.
   */
  public diarize(embedding: number[], timestamp = Date.now()): DiarizationResult {
    const normalized = OnDeviceSpeakerDiarizer.normalize(embedding);

    // 1. Check against Vendor Profile
    if (this.vendorProfile) {
      const vendorSim = OnDeviceSpeakerDiarizer.cosineSimilarity(normalized, this.vendorProfile);
      if (vendorSim >= OnDeviceSpeakerDiarizer.VENDOR_MATCH_THRESHOLD) {
        // Adapt vendor profile slowly to account for voice fatigue during 12h shift
        this.adaptVendorFatigue(normalized);
        return {
          role: 'VENDOR',
          clusterId: 'VENDOR',
          confidence: Number(vendorSim.toFixed(3)),
          isNovelCustomer: false
        };
      }
    }

    // 2. Check against Active Customer Clusters (Evict expired clusters first)
    this.evictExpiredClusters(timestamp);

    let bestClusterId: string | undefined;
    let maxSim = -1;

    for (const [clusterId, cluster] of this.customerClusters) {
      const sim = OnDeviceSpeakerDiarizer.cosineSimilarity(normalized, cluster.centroidVector);
      if (sim > maxSim) {
        maxSim = sim;
        bestClusterId = clusterId;
      }
    }

    // Match existing customer
    if (bestClusterId && maxSim >= OnDeviceSpeakerDiarizer.CUSTOMER_MATCH_THRESHOLD) {
      const cluster = this.customerClusters.get(bestClusterId)!;
      // Exponential moving average centroid update
      cluster.centroidVector = OnDeviceSpeakerDiarizer.normalize(
        cluster.centroidVector.map((v, i) => 0.85 * v + 0.15 * normalized[i])
      );
      cluster.lastSpokeAt = timestamp;

      return {
        role: 'CUSTOMER',
        clusterId: bestClusterId,
        confidence: Number(maxSim.toFixed(3)),
        isNovelCustomer: false
      };
    }

    // 3. Novel Customer Spawn
    const newClusterId = `CUST_${String(this.nextCustomerSeq++).padStart(2, '0')}`;
    this.customerClusters.set(newClusterId, {
      clusterId: newClusterId,
      centroidVector: [...normalized],
      lastSpokeAt: timestamp
    });

    return {
      role: 'CUSTOMER',
      clusterId: newClusterId,
      confidence: 1.0,
      isNovelCustomer: true
    };
  }

  /**
   * 3-Tier Context Arbitration:
   * When the vendor utters a short concession ("Theek hai le jao", "35 se kam nahi"),
   * this routes the vendor's response to the intended active customer session.
   */
  public routeVendorResponse(
    vendorUtterance: string,
    activeSessions: { customerId: string; itemName: string; lastSpokeAt: number; alias?: string }[],
    now = Date.now()
  ): string | undefined {
    if (activeSessions.length === 0) return undefined;
    if (activeSessions.length === 1) return activeSessions[0].customerId;

    const lower = vendorUtterance.toLowerCase();

    // TIER 1: Explicit Vocative / Name Match ("Haan Sharma ji")
    for (const session of activeSessions) {
      if (session.alias && lower.includes(session.alias.toLowerCase())) {
        return session.customerId;
      }
    }

    // TIER 2: Item Context Match (Vendor mentions item: "tamatar 35 mein doonga")
    for (const session of activeSessions) {
      if (session.itemName && lower.includes(session.itemName.toLowerCase())) {
        return session.customerId;
      }
    }

    // TIER 3: Recency Turn-Taking (Customer who spoke within last 3.5 seconds)
    const recencyThresholdMs = 3500;
    const sorted = [...activeSessions].sort((a, b) => b.lastSpokeAt - a.lastSpokeAt);
    if (now - sorted[0].lastSpokeAt <= recencyThresholdMs) {
      return sorted[0].customerId;
    }

    // Default fallback: most recent speaker
    return sorted[0].customerId;
  }

  /**
   * Associates an extracted alias name with an active customer voice cluster.
   */
  public bindAliasToCluster(clusterId: string, alias: string): void {
    const cluster = this.customerClusters.get(clusterId);
    if (cluster) {
      cluster.associatedAlias = alias;
    }
  }

  /**
   * Adapts vendor profile against vocal fatigue using momentum.
   */
  private adaptVendorFatigue(liveSample: number[]): void {
    if (!this.vendorProfile) return;
    this.vendorProfile = OnDeviceSpeakerDiarizer.normalize(
      this.vendorProfile.map((v, i) => 0.98 * v + 0.02 * liveSample[i])
    );
  }

  /**
   * Evicts customer clusters that have been inactive for more than TTL.
   */
  private evictExpiredClusters(now: number): void {
    for (const [id, cluster] of this.customerClusters) {
      if (now - cluster.lastSpokeAt > OnDeviceSpeakerDiarizer.CUSTOMER_TTL_MS) {
        this.customerClusters.delete(id);
      }
    }
  }

  /**
   * Vector Math: L2-Normalize
   */
  public static normalize(vec: number[]): number[] {
    let sumSq = 0;
    for (let i = 0; i < vec.length; i++) {
      sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq) || 1e-8;
    return vec.map(v => v / norm);
  }

  /**
   * Vector Math: Cosine Similarity
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  /**
   * Synthetic Embedding Generator for testing:
   * Generates deterministic 192-d unit embeddings with controlled angular distances.
   */
  public static createSyntheticEmbedding(seed: number, perturbFactor = 0): number[] {
    const vec = new Array(this.EMBEDDING_DIM);
    let s = (Math.abs(seed) * 1103515245 + 12345) & 0x7fffffff;
    for (let i = 0; i < this.EMBEDDING_DIM; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const randVal = ((s / 0x7fffffff) - 0.5) * 2.0;
      const perturb = perturbFactor * Math.cos(i * 1.7);
      vec[i] = randVal + perturb;
    }
    return this.normalize(vec);
  }

  public getActiveCustomerCount(): number {
    return this.customerClusters.size;
  }
}
