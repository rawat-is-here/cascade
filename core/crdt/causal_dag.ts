import { createHash } from 'node:crypto';
import type { BalancedDelta, DAGNode, EpistemicConfidence, HLC } from '../../shared/types.ts';
import { InvariantValidator } from '../constraints.ts';

/**
 * Merkle-Lamport Causal DAG
 * Immune to hostile clocks (e.g. 1970 UNIX epoch resets from dead phone batteries).
 * 
 * Causality is preserved strictly through cryptographic parent hashes and monotonically
 * increasing Lamport logical clocks rather than untrusted wall-clock timestamps.
 */
export class CausalDAG {
  private nodes: Map<string, DAGNode> = new Map();
  private childMap: Map<string, Set<string>> = new Map();
  private heads: Set<string> = new Set();
  private localDeviceId: string;
  private currentLamportClock = 0;

  constructor(localDeviceId = 'dev-local-01') {
    this.localDeviceId = localDeviceId;
  }

  /**
   * Generates a deterministic SHA-256 hash for a balanced delta node.
   */
  public static computeHash(
    delta: Omit<BalancedDelta, 'hash'>, 
    parentHashes: string[], 
    lamportClock: number
  ): string {
    const sortedParents = [...parentHashes].sort().join(':');
    const canonicalPayload = JSON.stringify({
      txId: delta.txId,
      debit: delta.debitAccount,
      credit: delta.creditAccount,
      amountMinor: delta.amountMinor,
      currency: delta.currencyCode,
      hlc: {
        logical: delta.hlc.logical,
        deviceId: delta.hlc.deviceId
      }
    });

    return createHash('sha256')
      .update(`${sortedParents}|${canonicalPayload}|${lamportClock}|${delta.hlc.deviceId}`)
      .digest('hex');
  }

  /**
   * Appends a new balanced delta to the local DAG.
   * Cites all current DAG heads as parents, advancing the logical clock.
   */
  public createLocalNode(
    deltaInput: Omit<BalancedDelta, 'hash' | 'hlc' | 'parentHashes'>,
    epistemicState: EpistemicConfidence = 'VERIFIED_KNOWN'
  ): DAGNode {
    // Advance logical clock
    this.currentLamportClock += 1;

    // Determine parents from current heads
    const parentHashes = Array.from(this.heads);

    // Build HLC
    const safeWallMs = Math.max(Date.now(), InvariantValidator.MIN_VALID_TIMESTAMP_MS);
    const hlc: HLC = {
      wallMs: safeWallMs,
      logical: this.currentLamportClock,
      deviceId: this.localDeviceId
    };

    const hash = CausalDAG.computeHash({ ...deltaInput, hlc }, parentHashes, this.currentLamportClock);

    const delta: BalancedDelta = {
      ...deltaInput,
      hlc,
      parentHashes,
      hash
    };

    const node: DAGNode = {
      hash,
      delta,
      parents: parentHashes,
      lamportClock: this.currentLamportClock,
      epistemicState
    };

    this.insertNodeInternal(node);
    return node;
  }

  /**
   * Inserts an external or synced DAG node received from a peer device over Bluetooth mesh.
   * Resolves hostile clocks (e.g. 1970 epoch) by deriving safe Lamport ordering.
   */
  public insertSyncedNode(node: DAGNode): { accepted: boolean; error?: string } {
    if (this.nodes.has(node.hash)) {
      return { accepted: true }; // Idempotent duplicate
    }

    // Double-entry validation
    const balanceCheck = InvariantValidator.validateDoubleEntryInvariant(node.delta);
    if (!balanceCheck.valid) {
      return { accepted: false, error: balanceCheck.error };
    }

    // Verify cryptographic integrity
    const expectedHash = CausalDAG.computeHash(node.delta, node.parents, node.lamportClock);
    if (expectedHash !== node.hash) {
      return { accepted: false, error: `Cryptographic hash mismatch. Expected ${expectedHash}, got ${node.hash}` };
    }

    // Advance local Lamport clock beyond any observed remote clock
    this.currentLamportClock = Math.max(this.currentLamportClock, node.lamportClock) + 1;

    this.insertNodeInternal(node);
    return { accepted: true };
  }

  private insertNodeInternal(node: DAGNode): void {
    this.nodes.set(node.hash, node);

    // Update child mapping and heads
    if (!this.childMap.has(node.hash)) {
      this.childMap.set(node.hash, new Set());
    }

    for (const parentHash of node.parents) {
      if (!this.childMap.has(parentHash)) {
        this.childMap.set(parentHash, new Set());
      }
      this.childMap.get(parentHash)!.add(node.hash);

      // Parent is no longer a head
      this.heads.delete(parentHash);
    }

    // New node is currently a head
    this.heads.add(node.hash);
  }

  /**
   * Retrieves a node by its hash.
   */
  public getNode(hash: string): DAGNode | undefined {
    return this.nodes.get(hash);
  }

  /**
   * Returns current DAG heads (leaf nodes with no children).
   */
  public getHeads(): string[] {
    return Array.from(this.heads);
  }

  /**
   * Returns the total number of nodes in the DAG.
   */
  public size(): number {
    return this.nodes.size;
  }

  /**
   * Returns the current Lamport logical clock.
   */
  public getLogicalClock(): number {
    return this.currentLamportClock;
  }

  /**
   * Returns topologically sorted list of all nodes in causal order.
   * If a hostile device clock reset to 1970 occurred, this topological sort
   * guarantees that causal ancestors ALWAYS execute before causal descendants.
   */
  public getTopologicalOrder(): DAGNode[] {
    const inDegree: Map<string, number> = new Map();
    for (const [hash, node] of this.nodes) {
      // In-degree is the count of parents that actually exist in this DAG
      let validParents = 0;
      for (const p of node.parents) {
        if (this.nodes.has(p)) {
          validParents++;
        }
      }
      inDegree.set(hash, validParents);
    }

    // Queue nodes with zero in-degree (root nodes)
    const queue: string[] = [];
    for (const [hash, deg] of inDegree) {
      if (deg === 0) {
        queue.push(hash);
      }
    }

    // Sort queue deterministically by Lamport clock, then hash tie-breaker
    queue.sort((a, b) => {
      const nodeA = this.nodes.get(a)!;
      const nodeB = this.nodes.get(b)!;
      if (nodeA.lamportClock !== nodeB.lamportClock) {
        return nodeA.lamportClock - nodeB.lamportClock;
      }
      return a.localeCompare(b);
    });

    const result: DAGNode[] = [];

    while (queue.length > 0) {
      const currentHash = queue.shift()!;
      const currentNode = this.nodes.get(currentHash)!;
      result.push(currentNode);

      const children = this.childMap.get(currentHash) || new Set();
      for (const childHash of children) {
        const currentDeg = (inDegree.get(childHash) || 1) - 1;
        inDegree.set(childHash, currentDeg);
        if (currentDeg === 0) {
          queue.push(childHash);
        }
      }

      // Keep queue sorted deterministically
      queue.sort((a, b) => {
        const nodeA = this.nodes.get(a)!;
        const nodeB = this.nodes.get(b)!;
        if (nodeA.lamportClock !== nodeB.lamportClock) {
          return nodeA.lamportClock - nodeB.lamportClock;
        }
        return a.localeCompare(b);
      });
    }

    return result;
  }

  /**
   * Detects whether any cycle exists in the graph.
   */
  public hasCycle(): boolean {
    const visited: Set<string> = new Set();
    const recursionStack: Set<string> = new Set();

    const dfs = (hash: string): boolean => {
      visited.add(hash);
      recursionStack.add(hash);

      const children = this.childMap.get(hash) || new Set();
      for (const child of children) {
        if (!visited.has(child)) {
          if (dfs(child)) return true;
        } else if (recursionStack.has(child)) {
          return true; // Cycle detected
        }
      }

      recursionStack.delete(hash);
      return false;
    };

    for (const hash of this.nodes.keys()) {
      if (!visited.has(hash)) {
        if (dfs(hash)) return true;
      }
    }

    return false;
  }
}
