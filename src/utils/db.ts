const SECTOR_MAPPING: Record<string, string> = {
  NIFTY: 'Indices',
  BANKNIFTY: 'Indices',
  FINNIFTY: 'Indices',
  RELIANCE: 'Energy',
  TCS: 'IT Services',
  INFOSYS: 'IT Services',
  INFY: 'IT Services',
  HDFCBANK: 'Financial Services',
  ICICIBANK: 'Financial Services',
  SBIN: 'Financial Services',
  BHARTIARTL: 'Telecommunications',
  ITC: 'Fast Moving Consumer Goods (FMCG)',
  LT: 'Construction / Engineering',
  TATAMOTORS: 'Automobile',
  TATASTEEL: 'Metals & Mining',
  MARUTI: 'Automobile',
  CDSL: 'Financial Services',
  RVNL: 'Construction / Infrastructure',
  ZOMATO: 'Consumer Services / Internet',
  SUZLON: 'Renewable Energy',
  JIOFIN: 'Financial Services',
  IREDA: 'Financial Services',
  TRENT: 'Consumer Services / Retail'
};

const SYMBOL_ALIASES: Record<string, string> = {
  INFOSYS: 'INFY',
  NIFTY: 'Nifty 50',
  BANKNIFTY: 'Nifty Bank',
  FINNIFTY: 'Nifty Fin Service'
};

/**
 * Server-side sector mapping lookup (in-memory)
 */
export function getSectorForSymbol(symbol: string): string | null {
  const s = symbol.toUpperCase();
  if (SECTOR_MAPPING[s]) return SECTOR_MAPPING[s];
  const alias = SYMBOL_ALIASES[s];
  if (alias && SECTOR_MAPPING[alias]) return SECTOR_MAPPING[alias];
  return null;
}

/**
 * Add or update sector mapping in memory
 */
export function setSectorMapping(symbol: string, sector: string): void {
  SECTOR_MAPPING[symbol.toUpperCase()] = sector;
}

/**
 * Stub getInstrumentKey to keep upstox.ts compilation clean.
 * The primary resolution is now performed on the client using IndexedDB.
 */
export function getInstrumentKey(symbol: string, exchange = 'NSE'): string | null {
  return null;
}
