import { openDB, IDBPDatabase } from 'idb';

export interface PositionalTrade {
  id: string;
  symbol: string;
  instrument_key: string;
  source: 'AI' | 'MANUAL';
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  quantity: number;
  target_price: number | null;
  stop_loss: number | null;
  expected_timeline: string | null;
  ai_rationale: string | null;
  status: 'OPEN' | 'CLOSED';
  entry_date: string; // ISO
  exit_price: number | null;
  exit_date: string | null;
  exit_reason: 'TARGET_HIT' | 'STOP_LOSS_HIT' | 'MANUAL_CLOSE' | 'AI_SUGGESTED_EXIT' | null;
  created_at: string;
  updated_at: string;
}

export interface FnoTradeLeg {
  action: 'BUY' | 'SELL';
  strike: number;
  option_type: 'CE' | 'PE';
  entry_premium: number;
  lots: number;
  lot_size: number;
}

export interface FnoTrade {
  id: string;
  symbol: string;
  instrument_key: string;
  source: 'AI' | 'MANUAL';
  strategy_name: string;
  expiry_date: string;
  legs: FnoTradeLeg[];
  max_profit_estimate: number | string | null;
  max_loss_estimate: number | string | null;
  breakeven_points: string[] | number[] | null;
  ai_rationale: string | null;
  status: 'OPEN' | 'CLOSED';
  entry_date: string;
  exit_date: string | null;
  exit_reason: 'EXPIRY' | 'MANUAL_CLOSE' | 'AI_SUGGESTED_EXIT' | null;
  realized_pnl: number | null;
  created_at: string;
  updated_at: string;
}

export interface AiReviewLog {
  id: string;
  trade_id: string;
  trade_type: 'POSITIONAL' | 'FNO';
  review_date: string; // ISO
  ai_verdict: 'CONTINUE' | 'BOOK_PROFIT' | 'BOOK_LOSS' | 'ADJUST';
  ai_reasoning: string;
  pnl_at_review: number;
  snapshot_price: number;
  confidence?: number;
  key_changes_since_entry?: string[];
  suggested_action_detail?: string | null;
}

const DB_NAME = 'demo_trading_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

function getDb() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create positional_trades store
        if (!db.objectStoreNames.contains('positional_trades')) {
          const store = db.createObjectStore('positional_trades', { keyPath: 'id' });
          store.createIndex('symbol', 'symbol', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        // Create fno_trades store
        if (!db.objectStoreNames.contains('fno_trades')) {
          const store = db.createObjectStore('fno_trades', { keyPath: 'id' });
          store.createIndex('symbol', 'symbol', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('expiry_date', 'expiry_date', { unique: false });
        }
        // Create ai_review_log store
        if (!db.objectStoreNames.contains('ai_review_log')) {
          const store = db.createObjectStore('ai_review_log', { keyPath: 'id' });
          store.createIndex('trade_id', 'trade_id', { unique: false });
          store.createIndex('review_date', 'review_date', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// Generate simple client-side UUID
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Positional Trade operations
export async function addPositionalTrade(trade: Omit<PositionalTrade, 'id' | 'status' | 'entry_date' | 'exit_price' | 'exit_date' | 'exit_reason' | 'created_at' | 'updated_at'>): Promise<PositionalTrade> {
  const db = await getDb();
  if (!db) throw new Error('IndexedDB is not available on server-side');

  const now = new Date().toISOString();
  const fullTrade: PositionalTrade = {
    ...trade,
    id: generateUUID(),
    status: 'OPEN',
    entry_date: now,
    exit_price: null,
    exit_date: null,
    exit_reason: null,
    created_at: now,
    updated_at: now
  };

  await db.put('positional_trades', fullTrade);
  return fullTrade;
}

// F&O Trade operations
export async function addFnoTrade(trade: Omit<FnoTrade, 'id' | 'status' | 'entry_date' | 'exit_date' | 'exit_reason' | 'realized_pnl' | 'created_at' | 'updated_at'>): Promise<FnoTrade> {
  const db = await getDb();
  if (!db) throw new Error('IndexedDB is not available on server-side');

  const now = new Date().toISOString();
  const fullTrade: FnoTrade = {
    ...trade,
    id: generateUUID(),
    status: 'OPEN',
    entry_date: now,
    exit_date: null,
    exit_reason: null,
    realized_pnl: null,
    created_at: now,
    updated_at: now
  };

  await db.put('fno_trades', fullTrade);
  return fullTrade;
}

// Get Open Trades
export async function getOpenTrades(type: 'POSITIONAL' | 'FNO'): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const storeName = type === 'POSITIONAL' ? 'positional_trades' : 'fno_trades';
  const trades = await db.getAllFromIndex(storeName, 'status', 'OPEN');
  return trades.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// Get Closed Trades
export async function getClosedTrades(type: 'POSITIONAL' | 'FNO'): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const storeName = type === 'POSITIONAL' ? 'positional_trades' : 'fno_trades';
  const trades = await db.getAllFromIndex(storeName, 'status', 'CLOSED');
  return trades.sort((a, b) => new Date(b.exit_date || '').getTime() - new Date(a.exit_date || '').getTime());
}

// Close a Trade
export async function closeTrade(
  id: string,
  type: 'POSITIONAL' | 'FNO',
  exitPriceOrPnl: number,
  reason: 'TARGET_HIT' | 'STOP_LOSS_HIT' | 'MANUAL_CLOSE' | 'AI_SUGGESTED_EXIT' | 'EXPIRY'
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date().toISOString();
  if (type === 'POSITIONAL') {
    const trade = await db.get('positional_trades', id);
    if (trade) {
      trade.status = 'CLOSED';
      trade.exit_price = exitPriceOrPnl;
      trade.exit_date = now;
      trade.exit_reason = reason as any;
      trade.updated_at = now;
      await db.put('positional_trades', trade);
    }
  } else {
    const trade = await db.get('fno_trades', id);
    if (trade) {
      trade.status = 'CLOSED';
      trade.exit_date = now;
      trade.exit_reason = reason as any;
      trade.realized_pnl = exitPriceOrPnl;
      trade.updated_at = now;
      await db.put('fno_trades', trade);
    }
  }
}

// Update Trade (Patch)
export async function updateTrade(id: string, type: 'POSITIONAL' | 'FNO', patch: Partial<any>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const storeName = type === 'POSITIONAL' ? 'positional_trades' : 'fno_trades';
  const trade = await db.get(storeName, id);
  if (trade) {
    const updated = {
      ...trade,
      ...patch,
      updated_at: new Date().toISOString()
    };
    await db.put(storeName, updated);
  }
}

// Add Review Log
export async function addReviewLog(log: Omit<AiReviewLog, 'id' | 'review_date'>): Promise<AiReviewLog> {
  const db = await getDb();
  if (!db) throw new Error('IndexedDB is not available on server-side');

  const fullLog: AiReviewLog = {
    ...log,
    id: generateUUID(),
    review_date: new Date().toISOString()
  };

  await db.put('ai_review_log', fullLog);
  return fullLog;
}

// Get Review History
export async function getReviewHistory(tradeId: string): Promise<AiReviewLog[]> {
  const db = await getDb();
  if (!db) return [];

  const logs = await db.getAllFromIndex('ai_review_log', 'trade_id', tradeId);
  return logs.sort((a, b) => new Date(a.review_date).getTime() - new Date(b.review_date).getTime());
}
