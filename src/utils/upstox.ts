// Map Stoxera symbols to Upstox Instrument Keys for requests
export const UPSTOX_INSTRUMENT_MAP: Record<string, string> = {
  NIFTY: 'NSE_INDEX|Nifty 50',
  BANKNIFTY: 'NSE_INDEX|Nifty Bank',
  FINNIFTY: 'NSE_INDEX|Nifty Fin Service',
  RELIANCE: 'NSE_EQ|INE002A01018',
  TCS: 'NSE_EQ|INE467B01029',
  INFOSYS: 'NSE_EQ|INE009A01021',
  HDFCBANK: 'NSE_EQ|INE040A01034',
  ICICIBANK: 'NSE_EQ|INE090A01021',
  SBIN: 'NSE_EQ|INE062A01020',
  BHARTIARTL: 'NSE_EQ|INE397D01024',
  ITC: 'NSE_EQ|INE154A01025',
  LT: 'NSE_EQ|INE018A01030',
  TATAMOTORS: 'NSE_EQ|INE155A01022',
  TATASTEEL: 'NSE_EQ|INE081A01020',
  MARUTI: 'NSE_EQ|INE585B01010',
  CDSL: 'NSE_EQ|INE736W01011',
  RVNL: 'NSE_EQ|INE515Z01012',
  ZOMATO: 'NSE_EQ|INE758T01015',
  SUZLON: 'NSE_EQ|INE040H01021',
  JIOFIN: 'NSE_EQ|INE018S01016',
  IREDA: 'NSE_EQ|INE0F0W01011',
  TRENT: 'NSE_EQ|INE848E01016'
};

// Map Upstox response JSON keys to Stoxera symbols
export const UPSTOX_RESPONSE_MAP: Record<string, string> = {
  'NSE_INDEX:Nifty 50': 'NIFTY',
  'NSE_INDEX:Nifty Bank': 'BANKNIFTY',
  'NSE_INDEX:Nifty Fin Service': 'FINNIFTY',
  'NSE_EQ:RELIANCE': 'RELIANCE',
  'NSE_EQ:TCS': 'TCS',
  'NSE_EQ:INFY': 'INFOSYS',
  'NSE_EQ:HDFCBANK': 'HDFCBANK',
  'NSE_EQ:ICICIBANK': 'ICICIBANK',
  'NSE_EQ:SBIN': 'SBIN',
  'NSE_EQ:BHARTIARTL': 'BHARTIARTL',
  'NSE_EQ:ITC': 'ITC',
  'NSE_EQ:LT': 'LT',
  'NSE_EQ:TATAMOTORS': 'TATAMOTORS',
  'NSE_EQ:TATASTEEL': 'TATASTEEL',
  'NSE_EQ:MARUTI': 'MARUTI',
  'NSE_EQ:CDSL': 'CDSL',
  'NSE_EQ:RVNL': 'RVNL',
  'NSE_EQ:ZOMATO': 'ZOMATO',
  'NSE_EQ:SUZLON': 'SUZLON',
  'NSE_EQ:JIOFIN': 'JIOFIN',
  'NSE_EQ:IREDA': 'IREDA',
  'NSE_EQ:TRENT': 'TRENT'
};

const BASE_URL = 'https://api.upstox.com/v2';

function getHeaders() {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Upstox token (UPSTOX_ANALYTICS_TOKEN or UPSTOX_ACCESS_TOKEN) is not configured');
  }
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`
  };
}

/**
 * Fetch full market quotes for a batch of instruments
 */
export async function getUpstoxQuotes(symbols: string[]): Promise<Record<string, any>> {
  const instrumentKeys = symbols
    .map(sym => UPSTOX_INSTRUMENT_MAP[sym])
    .filter(Boolean);

  if (instrumentKeys.length === 0) return {};

  const url = `${BASE_URL}/market-quote/quotes?symbol=${encodeURIComponent(instrumentKeys.join(','))}`;
  const response = await fetch(url, { headers: getHeaders() });
  
  if (!response.ok) {
    throw new Error(`Upstox HTTP error: ${response.statusText}`);
  }

  const resData = await response.json();
  if (resData?.status !== 'success') {
    throw new Error(resData?.errors?.[0]?.message || 'Failed to fetch Upstox quotes');
  }

  return resData.data || {};
}

/**
 * Fetch expiry dates for option contracts of an underlying instrument
 */
export async function getUpstoxExpiries(symbol: string): Promise<string[]> {
  const key = UPSTOX_INSTRUMENT_MAP[symbol];
  if (!key) throw new Error(`Invalid symbol: ${symbol}`);

  const url = `${BASE_URL}/option/contract?instrument_key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { headers: getHeaders() });

  if (!response.ok) {
    throw new Error(`Upstox HTTP error: ${response.statusText}`);
  }

  const resData = await response.json();
  if (resData?.status !== 'success') {
    throw new Error(resData?.errors?.[0]?.message || 'Failed to fetch Option contracts');
  }

  const contracts = resData.data || [];
  // Extract unique expiry dates
  const expiries = Array.from(new Set(contracts.map((c: any) => c.expiry))) as string[];
  
  // Sort dates chronological
  return expiries.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

/**
 * Fetch Option Chain for an instrument and expiry date
 */
export async function getUpstoxOptionChain(symbol: string, expiryDate: string): Promise<any[]> {
  const key = UPSTOX_INSTRUMENT_MAP[symbol];
  if (!key) throw new Error(`Invalid symbol: ${symbol}`);

  const url = `${BASE_URL}/option/chain?instrument_key=${encodeURIComponent(key)}&expiry_date=${expiryDate}`;
  const response = await fetch(url, { headers: getHeaders() });

  if (!response.ok) {
    throw new Error(`Upstox HTTP error: ${response.statusText}`);
  }

  const resData = await response.json();
  if (resData?.status !== 'success') {
    throw new Error(resData?.errors?.[0]?.message || 'Failed to fetch Option chain');
  }

  return resData.data || [];
}

/**
 * Fetch Candle charts (OHLCV) for a timeframe
 */
export async function getUpstoxCandles(symbol: string, timeframe: string): Promise<any[]> {
  const key = UPSTOX_INSTRUMENT_MAP[symbol];
  if (!key) throw new Error(`Invalid symbol: ${symbol}`);

  // Map timeframe to Upstox candle interval & dynamic date range
  let interval = 'day';
  let daysBack = 120;

  switch (timeframe) {
    case '1m':
    case '5m':
    case '15m':
      interval = '1minute';
      daysBack = 3; // Fetch last 3 days for 1m intervals
      break;
    case '1h':
      interval = '30minute';
      daysBack = 15; // Fetch last 15 days for 30m intervals
      break;
    case '1d':
      interval = 'day';
      daysBack = 120;
      break;
    case '1w':
      interval = 'week';
      daysBack = 730; // 2 years
      break;
    default:
      interval = 'day';
  }

  const toDate = new Date().toISOString().split('T')[0];
  const fromDateObj = new Date();
  fromDateObj.setDate(fromDateObj.getDate() - daysBack);
  const fromDate = fromDateObj.toISOString().split('T')[0];

  const url = `${BASE_URL}/historical-candle/${encodeURIComponent(key)}/${interval}/${toDate}/${fromDate}`;
  const response = await fetch(url, { headers: getHeaders() });

  if (!response.ok) {
    throw new Error(`Upstox HTTP error: ${response.statusText}`);
  }

  const resData = await response.json();
  if (resData?.status !== 'success') {
    throw new Error(resData?.errors?.[0]?.message || 'Failed to fetch Upstox candles');
  }

  const rawCandles = resData.data?.candles || [];
  
  // Format candles to chronological order
  const formatted = rawCandles.map((c: any[]) => {
    const timeStr = c[0];
    const time = timeframe.includes('d') || timeframe.includes('w')
      ? timeStr.split('T')[0]
      : Math.floor(new Date(timeStr).getTime() / 1000);

    return {
      time,
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5])
    };
  });

  return formatted.reverse();
}
