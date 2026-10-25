import { computeSha256 } from './crdt/hash_util';
import { VendorEvent, CRDTNode } from '../shared/types';

export class CrdtLedger {
  nodeId: string;
  clock = 0;
  nodes: Map<string, CRDTNode> = new Map();
  tips: Set<string> = new Set();

  constructor(nodeId = 'stall_dev_1') {
    this.nodeId = nodeId;
  }

  hash(parents: string[], event: VendorEvent, clock: number) {
    const data = JSON.stringify({ parents, id: event.id, clock, entries: event.entries });
    return computeSha256(data).slice(0, 16);
  }

  addEvent(event: VendorEvent): CRDTNode {
    this.clock++;
    const parents = Array.from(this.tips);
    const hash = this.hash(parents, event, this.clock);

    const node: CRDTNode = {
      nodeId: this.nodeId,
      clock: this.clock,
      parents,
      hash,
      event
    };

    this.nodes.set(hash, node);

    parents.forEach(p => this.tips.delete(p));
    this.tips.add(hash);

    return node;
  }

  merge(incoming: CRDTNode[]) {
    let count = 0;
    for (const node of incoming) {
      if (!this.nodes.has(node.hash)) {
        this.nodes.set(node.hash, node);
        this.clock = Math.max(this.clock, node.clock) + 1;
        count++;
      }
    }
    this.updateTips();
    return { count, clock: this.clock };
  }

  updateTips() {
    const parentSet = new Set<string>();
    this.nodes.forEach(n => n.parents.forEach(p => parentSet.add(p)));
    this.tips.clear();
    this.nodes.forEach((_, h) => {
      if (!parentSet.has(h)) this.tips.add(h);
    });
  }

  getBalances() {
    let cash = 0;
    let inventory = 0;
    let cogs = 0;
    let credit = 0;
    let sales = 0;
    let supplier = 0;
    let spoilage = 0;
    let theft = 0;
    let personal = 0;

    let debits = 0;
    let credits = 0;

    const sorted = Array.from(this.nodes.values()).sort((a, b) => {
      if (a.clock !== b.clock) return a.clock - b.clock;
      return a.hash.localeCompare(b.hash);
    });

    for (const n of sorted) {
      for (const e of n.event.entries) {
        const amt = e.amount;
        debits += amt;
        credits += amt;

        if (e.debit === 'cash') cash += amt;
        if (e.debit === 'inventory') inventory += amt;
        if (e.debit === 'credit') credit += amt;
        if (e.debit === 'cogs') cogs += amt;
        if (e.debit === 'spoilage') spoilage += amt;
        if (e.debit === 'theft') theft += amt;
        if (e.debit === 'personal') personal += amt;

        if (e.credit === 'cash') cash -= amt;
        if (e.credit === 'inventory') inventory -= amt;
        if (e.credit === 'credit') credit -= amt;
        if (e.credit === 'sales') sales += amt;
        if (e.credit === 'supplier') supplier += amt;
      }
    }

    const diff = Math.abs(debits - credits);

    return {
      cash,
      inventory,
      cogs,
      credit,
      sales,
      supplier,
      spoilage,
      theft,
      personal,
      balanced: diff < 0.001,
      diff
    };
  }

  getAll() {
    return Array.from(this.nodes.values());
  }
}
