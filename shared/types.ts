export type Account = 
  | 'cash'
  | 'credit'
  | 'inventory'
  | 'cogs'
  | 'spoilage'
  | 'theft'
  | 'personal'
  | 'sales'
  | 'supplier';

export interface TxPosting {
  debit: Account;
  credit: Account;
  amount: number;
  alias?: string;
  item?: string;
  qty?: number;
  unit?: string;
  confidence?: number;
}

export interface VendorEvent {
  id: string;
  type: 'speech' | 'sms' | 'paper' | 'count';
  raw: string;
  entries: TxPosting[];
  timestamp: number;
  clock: number;
}

export interface LossReport {
  item: string;
  lostQty: number;
  unit: string;
  spoilage: number;
  theft: number;
  eating: number;
  range: [number, number];
}

export interface CRDTNode {
  nodeId: string;
  clock: number;
  parents: string[];
  hash: string;
  event: VendorEvent;
}

export interface ProfitBounds {
  drawerCash: number;
  revenue: number;
  cogs: number;
  debt: number;
  unpaidCredit: number;
  spoilageCost: number;
  personalDraw: number;
  profitRange: [number, number];
  note: string;
}
