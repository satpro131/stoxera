import { calculateBlackScholes } from './formulas';

export interface StockFundamentals {
  pe: number;
  pb: number;
  roe: number; // percentage
  roce: number; // percentage
  debtToEquity: number;
  epsGrowth: number; // percentage
  revenueGrowth: number; // percentage
  promoterHolding: number; // percentage
  dividendYield: number; // percentage
  marketCap: number; // in Cr (INR)
}

export interface StockTechnicals {
  rsi: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  sma20: number;
  sma50: number;
  sma200: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  trend: 'Bullish' | 'Bearish' | 'Neutral' | 'Strong Bullish' | 'Strong Bearish';
  support: number[];
  resistance: number[];
}

export interface StockInfo {
  symbol: string;
  name: string;
  category: 'F&O' | 'Cash';
  sector: string;
  price: number;
  change: number; // absolute change
  changePercent: number; // percentage change
  prevClose: number;
  volume: number;
  oi?: number; // Open Interest (futures)
  oiChangePercent?: number;
  buildupType?: 'Long Buildup' | 'Short Buildup' | 'Long Unwinding' | 'Short Covering' | 'Neutral';
  fundamentals: StockFundamentals;
  technicals: StockTechnicals;
}

export interface OptionChainItem {
  strike: number;
  call: {
    ltp: number;
    change: number;
    changePercent: number;
    volume: number;
    oi: number;
    oiChange: number;
    oiChangePercent: number;
    iv: number;
    delta: number;
    theta: number;
    vega: number;
    gamma: number;
  };
  put: {
    ltp: number;
    change: number;
    changePercent: number;
    volume: number;
    oi: number;
    oiChange: number;
    oiChangePercent: number;
    iv: number;
    delta: number;
    theta: number;
    vega: number;
    gamma: number;
  };
}

export interface NewsItem {
  id: string;
  timestamp: string;
  source: string;
  title: string;
  summary: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  score: number; // -1.0 to 1.0
  category: 'Company' | 'Sector' | 'Macro' | 'Global';
}

export interface OHLCV {
  time: string | number; // ISO String or Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Master Stock Data Definitions
export const STOCKS_LIST: Omit<StockInfo, 'price' | 'change' | 'changePercent' | 'prevClose' | 'volume' | 'oi' | 'oiChangePercent' | 'buildupType' | 'technicals'>[] = [
  // F&O Segment
  { symbol: 'NIFTY', name: 'Nifty 50 Index', category: 'F&O', sector: 'Indices', fundamentals: { pe: 22.4, pb: 4.1, roe: 15.2, roce: 18.1, debtToEquity: 0.8, epsGrowth: 12.5, revenueGrowth: 11.2, promoterHolding: 0, dividendYield: 1.2, marketCap: 18500000 } },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', category: 'F&O', sector: 'Indices', fundamentals: { pe: 16.2, pb: 2.8, roe: 14.5, roce: 13.8, debtToEquity: 3.5, epsGrowth: 14.2, revenueGrowth: 13.5, promoterHolding: 0, dividendYield: 0.8, marketCap: 7200000 } },
  { symbol: 'RELIANCE', name: 'Reliance Industries Limited', category: 'F&O', sector: 'Energy & Retail', fundamentals: { pe: 25.8, pb: 2.3, roe: 9.8, roce: 11.2, debtToEquity: 0.4, epsGrowth: 8.5, revenueGrowth: 9.6, promoterHolding: 50.4, dividendYield: 0.35, marketCap: 1720000 } },
  { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'F&O', sector: 'IT Services', fundamentals: { pe: 28.5, pb: 12.4, roe: 45.6, roce: 58.2, debtToEquity: 0.02, epsGrowth: 10.8, revenueGrowth: 8.4, promoterHolding: 72.4, dividendYield: 2.1, marketCap: 1350000 } },
  { symbol: 'INFOSYS', name: 'Infosys Limited', category: 'F&O', sector: 'IT Services', fundamentals: { pe: 24.2, pb: 8.1, roe: 31.8, roce: 40.5, debtToEquity: 0.05, epsGrowth: 9.1, revenueGrowth: 7.6, promoterHolding: 14.8, dividendYield: 2.3, marketCap: 680000 } },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', category: 'F&O', sector: 'Private Banking', fundamentals: { pe: 18.5, pb: 2.9, roe: 17.2, roce: 16.5, debtToEquity: 1.1, epsGrowth: 18.2, revenueGrowth: 16.4, promoterHolding: 0, dividendYield: 1.1, marketCap: 1150000 } },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', category: 'F&O', sector: 'Private Banking', fundamentals: { pe: 17.1, pb: 3.1, roe: 18.5, roce: 17.2, debtToEquity: 1.2, epsGrowth: 21.4, revenueGrowth: 18.1, promoterHolding: 0, dividendYield: 0.9, marketCap: 780000 } },
  { symbol: 'SBIN', name: 'State Bank of India', category: 'F&O', sector: 'Public Banking', fundamentals: { pe: 9.4, pb: 1.6, roe: 16.8, roce: 15.2, debtToEquity: 1.5, epsGrowth: 24.1, revenueGrowth: 14.8, promoterHolding: 57.5, dividendYield: 1.5, marketCap: 690000 } },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Limited', category: 'F&O', sector: 'Telecom', fundamentals: { pe: 42.1, pb: 6.2, roe: 14.8, roce: 16.2, debtToEquity: 1.4, epsGrowth: 32.5, revenueGrowth: 12.1, promoterHolding: 54.3, dividendYield: 0.4, marketCap: 650000 } },
  { symbol: 'ITC', name: 'ITC Limited', category: 'F&O', sector: 'FMCG & Hotels', fundamentals: { pe: 26.5, pb: 7.8, roe: 29.2, roce: 39.1, debtToEquity: 0.0, epsGrowth: 11.5, revenueGrowth: 8.9, promoterHolding: 0, dividendYield: 3.1, marketCap: 520000 } },
  { symbol: 'LT', name: 'Larsen & Toubro Limited', category: 'F&O', sector: 'Infrastructure', fundamentals: { pe: 32.8, pb: 4.8, roe: 15.2, roce: 18.4, debtToEquity: 0.9, epsGrowth: 16.8, revenueGrowth: 15.1, promoterHolding: 0, dividendYield: 0.8, marketCap: 480000 } },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Limited', category: 'F&O', sector: 'Automobile', fundamentals: { pe: 15.4, pb: 3.2, roe: 22.4, roce: 24.1, debtToEquity: 0.7, epsGrowth: 45.2, revenueGrowth: 22.5, promoterHolding: 46.4, dividendYield: 0.6, marketCap: 320000 } },
  { symbol: 'TATASTEEL', name: 'Tata Steel Limited', category: 'F&O', sector: 'Metals & Mining', fundamentals: { pe: 65.4, pb: 1.5, roe: 2.4, roce: 5.8, debtToEquity: 1.1, epsGrowth: -15.2, revenueGrowth: -4.5, promoterHolding: 33.9, dividendYield: 2.2, marketCap: 175000 } },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Limited', category: 'F&O', sector: 'Automobile', fundamentals: { pe: 29.8, pb: 4.2, roe: 14.8, roce: 19.5, debtToEquity: 0.05, epsGrowth: 28.1, revenueGrowth: 14.2, promoterHolding: 58.2, dividendYield: 1.1, marketCap: 340000 } },
  
  // Cash Segment
  { symbol: 'CDSL', name: 'Central Depository Services Limited', category: 'Cash', sector: 'Financial Services', fundamentals: { pe: 54.2, pb: 18.5, roe: 30.1, roce: 39.4, debtToEquity: 0.0, epsGrowth: 35.8, revenueGrowth: 28.4, promoterHolding: 20.0, dividendYield: 1.4, marketCap: 22000 } },
  { symbol: 'RVNL', name: 'Rail Vikas Nigam Limited', category: 'Cash', sector: 'Infrastructure', fundamentals: { pe: 41.5, pb: 7.2, roe: 19.4, roce: 18.5, debtToEquity: 1.2, epsGrowth: 16.5, revenueGrowth: 12.1, promoterHolding: 72.8, dividendYield: 0.6, marketCap: 78000 } },
  { symbol: 'ZOMATO', name: 'Zomato Limited', category: 'Cash', sector: 'E-Commerce', fundamentals: { pe: 120.4, pb: 8.9, roe: 6.8, roce: 8.1, debtToEquity: 0.01, epsGrowth: 210.0, revenueGrowth: 54.2, promoterHolding: 0, dividendYield: 0.0, marketCap: 155000 } },
  { symbol: 'SUZLON', name: 'Suzlon Energy Limited', category: 'Cash', sector: 'Renewable Energy', fundamentals: { pe: 85.2, pb: 12.4, roe: 25.4, roce: 22.8, debtToEquity: 0.1, epsGrowth: 145.0, revenueGrowth: 38.6, promoterHolding: 13.3, dividendYield: 0.0, marketCap: 65000 } },
  { symbol: 'JIOFIN', name: 'Jio Financial Services Limited', category: 'Cash', sector: 'Financial Services', fundamentals: { pe: 110.8, pb: 1.8, roe: 1.6, roce: 2.1, debtToEquity: 0.0, epsGrowth: 8.4, revenueGrowth: 11.2, promoterHolding: 47.1, dividendYield: 0.0, marketCap: 210000 } },
  { symbol: 'IREDA', name: 'Indian Renewable Energy Dev Agency', category: 'Cash', sector: 'Financial Services', fundamentals: { pe: 38.2, pb: 4.8, roe: 15.4, roce: 13.9, debtToEquity: 4.2, epsGrowth: 30.2, revenueGrowth: 25.1, promoterHolding: 75.0, dividendYield: 0.5, marketCap: 62000 } },
  { symbol: 'TRENT', name: 'Trent Limited', category: 'Cash', sector: 'Retail', fundamentals: { pe: 145.6, pb: 24.1, roe: 22.4, roce: 28.5, debtToEquity: 0.2, epsGrowth: 85.2, revenueGrowth: 48.4, promoterHolding: 37.0, dividendYield: 0.2, marketCap: 165000 } }
];

// Helper to get seed prices for symbols
export function getBasePrice(symbol: string): number {
  switch (symbol) {
    case 'NIFTY': return 23450;
    case 'BANKNIFTY': return 50120;
    case 'RELIANCE': return 2930;
    case 'TCS': return 3850;
    case 'INFOSYS': return 1490;
    case 'HDFCBANK': return 1610;
    case 'ICICIBANK': return 1120;
    case 'SBIN': return 840;
    case 'BHARTIARTL': return 1380;
    case 'ITC': return 430;
    case 'LT': return 3550;
    case 'TATAMOTORS': return 980;
    case 'TATASTEEL': return 165;
    case 'MARUTI': return 12200;
    case 'CDSL': return 2100;
    case 'RVNL': return 380;
    case 'ZOMATO': return 185;
    case 'SUZLON': return 52;
    case 'JIOFIN': return 335;
    case 'IREDA': return 220;
    case 'TRENT': return 4600;
    default: return 500;
  }
}

// Generate full stock details
export function getStocks(): StockInfo[] {
  const seed = 0.55; // pseudo random seed
  return STOCKS_LIST.map((stock, idx) => {
    const basePrice = getBasePrice(stock.symbol);
    // Deterministic mock calculations using index
    const priceVariance = Math.sin(idx * 432.12) * 0.05; // -5% to +5%
    const currentPrice = basePrice * (1 + priceVariance);
    const prevClose = currentPrice * (1 - (Math.sin(idx * 777.7) * 0.02));
    const change = currentPrice - prevClose;
    const changePercent = (change / prevClose) * 100;
    const volume = Math.floor(Math.abs(Math.sin(idx * 111.1)) * 10000000) + 100000;

    let technicals: StockTechnicals = {
      rsi: Math.round(45 + Math.sin(idx * 8.8) * 25), // 20 to 70
      macd: {
        macdLine: Number((Math.sin(idx * 3.3) * 1.5).toFixed(2)),
        signalLine: Number((Math.sin(idx * 3.3) * 1.2).toFixed(2)),
        histogram: 0
      },
      sma20: currentPrice * (1 - Math.sin(idx * 9.9) * 0.015),
      sma50: currentPrice * (1 - Math.sin(idx * 10.1) * 0.035),
      sma200: currentPrice * (1 - Math.sin(idx * 11.2) * 0.08),
      bollingerBands: {
        upper: currentPrice * 1.05,
        middle: currentPrice,
        lower: currentPrice * 0.95
      },
      trend: 'Neutral',
      support: [
        Math.round(currentPrice * 0.96 * 10) / 10,
        Math.round(currentPrice * 0.92 * 10) / 10
      ],
      resistance: [
        Math.round(currentPrice * 1.04 * 10) / 10,
        Math.round(currentPrice * 1.08 * 10) / 10
      ]
    };
    technicals.macd.histogram = Number((technicals.macd.macdLine - technicals.macd.signalLine).toFixed(2));

    // Determine trend string
    if (technicals.rsi > 65) technicals.trend = 'Strong Bullish';
    else if (technicals.rsi > 55) technicals.trend = 'Bullish';
    else if (technicals.rsi < 35) technicals.trend = 'Strong Bearish';
    else if (technicals.rsi < 45) technicals.trend = 'Bearish';

    // F&O metrics
    const hasFO = stock.category === 'F&O';
    const oi = hasFO ? Math.floor(Math.abs(Math.cos(idx * 54.3)) * 50000000) + 2000000 : undefined;
    const oiChangePercent = hasFO ? Number((Math.sin(idx * 123.4) * 8).toFixed(2)) : undefined;

    let buildupType: StockInfo['buildupType'];
    if (hasFO && oiChangePercent && changePercent) {
      if (changePercent > 0.5 && oiChangePercent > 2) buildupType = 'Long Buildup';
      else if (changePercent < -0.5 && oiChangePercent > 2) buildupType = 'Short Buildup';
      else if (changePercent < -0.5 && oiChangePercent < -2) buildupType = 'Long Unwinding';
      else if (changePercent > 0.5 && oiChangePercent < -2) buildupType = 'Short Covering';
      else buildupType = 'Neutral';
    }

    return {
      ...stock,
      price: Number(currentPrice.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      prevClose: Number(prevClose.toFixed(2)),
      volume,
      oi,
      oiChangePercent,
      buildupType,
      technicals
    };
  });
}

// Generate dynamic historical OHLCV data
export function getOHLCV(symbol: string, timeframe: string, limit: number = 100): OHLCV[] {
  const currentPrice = getStocks().find(s => s.symbol === symbol)?.price || getBasePrice(symbol);
  const data: OHLCV[] = [];
  let price = currentPrice * (1 - (limit * 0.002)); // start slightly lower

  const now = new Date();
  let timeStepMinutes = 1;
  switch (timeframe) {
    case '1m': timeStepMinutes = 1; break;
    case '5m': timeStepMinutes = 5; break;
    case '15m': timeStepMinutes = 15; break;
    case '1h': timeStepMinutes = 60; break;
    case '1d': timeStepMinutes = 24 * 60; break;
    case '1w': timeStepMinutes = 7 * 24 * 60; break;
    default: timeStepMinutes = 24 * 60;
  }

  for (let i = limit; i >= 0; i--) {
    const date = new Date(now.getTime() - i * timeStepMinutes * 60 * 1000);
    const volatility = symbol.includes('NIFTY') ? 0.001 : 0.003;
    const randomChange = price * (Math.random() - 0.49) * volatility; // slight upward drift
    const open = price;
    const close = price + randomChange;
    const high = Math.max(open, close) + (Math.random() * price * volatility * 0.5);
    const low = Math.min(open, close) - (Math.random() * price * volatility * 0.5);
    const volume = Math.floor(Math.random() * 500000) + 10000;

    data.push({
      time: timeframe.includes('d') || timeframe.includes('w')
        ? date.toISOString().split('T')[0] // 'YYYY-MM-DD'
        : Math.floor(date.getTime() / 1000), // UNIX timestamp (seconds)
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    });
    price = close;
  }

  return data;
}

// Option Chain Strike Spacing Configuration
function getStrikeSpacing(symbol: string): number {
  if (symbol === 'NIFTY') return 100;
  if (symbol === 'BANKNIFTY') return 100;
  if (symbol === 'RELIANCE') return 50;
  if (symbol === 'TCS') return 50;
  if (symbol === 'INFOSYS') return 20;
  if (symbol === 'HDFCBANK') return 10;
  if (symbol === 'ICICIBANK') return 10;
  if (symbol === 'SBIN') return 10;
  if (symbol === 'ITC') return 5;
  return 20;
}

// Generate Option Chain
export function getOptionChain(symbol: string): OptionChainItem[] {
  const stock = getStocks().find(s => s.symbol === symbol);
  if (!stock || stock.category !== 'F&O') return [];

  const S = stock.price;
  const spacing = getStrikeSpacing(symbol);
  const atmStrike = Math.round(S / spacing) * spacing;
  
  // Generate 10 strikes above and 10 strikes below ATM
  const strikes: number[] = [];
  for (let i = -10; i <= 10; i++) {
    strikes.push(atmStrike + i * spacing);
  }

  const t = 14 / 365; // 2 weeks to expiry
  const r = 0.07; // 7% risk-free rate

  return strikes.map((K, index) => {
    // Generate implied volatility around 15% to 40% based on strike distance from ATM
    const distRatio = Math.abs(K - S) / S;
    const iv = 0.18 + distRatio * 0.4; // Smile effect

    const calls = calculateBlackScholes(S, K, t, r, iv, true);
    const puts = calculateBlackScholes(S, K, t, r, iv, false);

    // Generate Open Interest and Volumes
    // Call OI peaks slightly out of the money, Put OI peaks slightly out of the money
    const callOIFactor = Math.exp(-Math.pow(K - S * 1.02, 2) / (2 * Math.pow(S * 0.05, 2)));
    const putOIFactor = Math.exp(-Math.pow(K - S * 0.98, 2) / (2 * Math.pow(S * 0.05, 2)));

    const callOI = Math.floor(callOIFactor * 25000) * 100 + 1000;
    const putOI = Math.floor(putOIFactor * 22000) * 100 + 1000;

    const callOIChange = Math.floor((Math.sin(index * 2) * 0.3) * callOI);
    const putOIChange = Math.floor((Math.cos(index * 2.5) * 0.35) * putOI);

    const callVolume = Math.floor(callOI * (0.8 + Math.random()));
    const putVolume = Math.floor(putOI * (0.8 + Math.random()));

    return {
      strike: K,
      call: {
        ltp: Number(calls.price.toFixed(2)),
        change: Number((calls.price * (Math.random() - 0.4) * 0.1).toFixed(2)),
        changePercent: Number(((Math.random() - 0.4) * 12).toFixed(2)),
        volume: callVolume,
        oi: callOI,
        oiChange: callOIChange,
        oiChangePercent: Number(((callOIChange / (callOI - callOIChange || 1)) * 100).toFixed(2)),
        iv: Number((iv * 100).toFixed(2)),
        delta: Number(calls.delta.toFixed(3)),
        theta: Number(calls.theta.toFixed(3)),
        vega: Number(calls.vega.toFixed(3)),
        gamma: Number(calls.gamma.toFixed(5))
      },
      put: {
        ltp: Number(puts.price.toFixed(2)),
        change: Number((puts.price * (Math.random() - 0.6) * 0.1).toFixed(2)),
        changePercent: Number(((Math.random() - 0.6) * 12).toFixed(2)),
        volume: putVolume,
        oi: putOI,
        oiChange: putOIChange,
        oiChangePercent: Number(((putOIChange / (putOI - putOIChange || 1)) * 100).toFixed(2)),
        iv: Number((iv * 100).toFixed(2)),
        delta: Number(puts.delta.toFixed(3)),
        theta: Number(puts.theta.toFixed(3)),
        vega: Number(puts.vega.toFixed(3)),
        gamma: Number(puts.gamma.toFixed(5))
      }
    };
  });
}

// Generate News Items
export function getNews(symbol?: string): NewsItem[] {
  const genericNews: NewsItem[] = [
    {
      id: 'news-1',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30m ago
      source: 'Moneycontrol',
      title: 'Global markets rebound: Dow climbs 200 pts as Fed signals interest rate cuts',
      summary: 'Wall Street trade ended higher on Monday as soft inflation data reinforced hopes of a near-term Federal Reserve interest rate cut, prompting a global equities rally.',
      sentiment: 'Bullish',
      score: 0.75,
      category: 'Global'
    },
    {
      id: 'news-2',
      timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2h ago
      source: 'Economic Times',
      title: 'Brent Crude slips to $81/barrel amid rising US production levels',
      summary: 'Crude oil prices softened, lowering fuel import costs for major consumers like India, boosting prospects for local logistics, auto, and aviation sectors.',
      sentiment: 'Bullish',
      score: 0.60,
      category: 'Macro'
    },
    {
      id: 'news-3',
      timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5h ago
      source: 'Reuters',
      title: 'Indian IT sector sees double-digit margins bounce-back on cloud deals recovery',
      summary: 'Analysts upgrade guidance for largecap IT companies citing stronger outsourcing pipelines in Europe and resurgence of US discretionary BFSI tech spend.',
      sentiment: 'Bullish',
      score: 0.80,
      category: 'Sector'
    }
  ];

  const stockSpecificNews: Record<string, Omit<NewsItem, 'id' | 'timestamp'>[]> = {
    RELIANCE: [
      {
        source: 'CNBC-TV18',
        title: 'Reliance Retail steps up expansion, signs global cosmetic JV',
        summary: 'Reliance Retail expands premium lifestyle footprint with new global brand acquisitions, setting targets to double regional margins over next fiscal cycle.',
        sentiment: 'Bullish',
        score: 0.85,
        category: 'Company'
      },
      {
        source: 'Livemint',
        title: 'Reliance Industries shuts down secondary refining unit for regular maintenance',
        summary: 'The refining unit shutdown is anticipated to last 10 days, though overall export volumes are buffered by high inventory reserves.',
        sentiment: 'Neutral',
        score: -0.05,
        category: 'Company'
      }
    ],
    TCS: [
      {
        source: 'Bloomberg Quint',
        title: 'TCS wins massive $800M digital transformation contract with UK retail giant',
        summary: 'Tata Consultancy Services secured a multi-year IT integration and platform migration contract, driving positive sector analyst sentiment.',
        sentiment: 'Bullish',
        score: 0.90,
        category: 'Company'
      }
    ],
    HDFCBANK: [
      {
        source: 'Financial Express',
        title: 'HDFC Bank records 18% credit growth YoY in Q1 preliminary figures',
        summary: 'Deposit accretion picked up pace, narrowing the credit-to-deposit gap post-merger. Capital adequacy ratios remain highly robust.',
        sentiment: 'Bullish',
        score: 0.70,
        category: 'Company'
      },
      {
        source: 'Business Standard',
        title: 'RBI imposes minor penalty on HDFC Bank over compliance disclosures',
        summary: 'A nominal administrative penalty of INR 1.5 Crores was levied, which management clarified has no material operational or financial impact.',
        sentiment: 'Bearish',
        score: -0.25,
        category: 'Company'
      }
    ],
    ZOMATO: [
      {
        source: 'Economic Times',
        title: 'Zomato Blinkit gross order values (GOV) double as quick-commerce adoption spikes',
        summary: 'Zomato shares hit record highs as profitability metrics improve in the quick commerce vertical, prompting broker upgrades.',
        sentiment: 'Bullish',
        score: 0.95,
        category: 'Company'
      }
    ],
    SUZLON: [
      {
        source: 'Moneycontrol',
        title: 'Suzlon secures massive 300 MW wind energy project in Gujarat',
        summary: 'The order involves installing 95 wind turbine generators, with commissioning set for late next year, strengthening their order book.',
        sentiment: 'Bullish',
        score: 0.88,
        category: 'Company'
      }
    ]
  };

  if (!symbol) {
    return genericNews;
  }

  const specific = stockSpecificNews[symbol] || [];
  const items: NewsItem[] = specific.map((item, idx) => ({
    ...item,
    id: `news-${symbol}-${idx}`,
    timestamp: new Date(Date.now() - (idx + 1) * 3600 * 1000).toISOString()
  }));

  // Append some global news to context
  return [...items, ...genericNews];
}

// Structure for AI recommendation responses
export interface AIRecommendation {
  symbol: string;
  recommendation: 'Buy' | 'Sell' | 'Hold' | 'Avoid';
  confidenceScore: number; // 0 to 100
  holdingPeriod: string;
  reasoningSummary: {
    newsSentiment: string;
    fundamentals: string;
    technicals: string;
    finalSynthesis: string;
  };
  riskFlags: string[];
}

export function getAIRecommendation(symbol: string): AIRecommendation {
  const stock = getStocks().find(s => s.symbol === symbol);
  if (!stock) {
    return {
      symbol,
      recommendation: 'Hold',
      confidenceScore: 50,
      holdingPeriod: '1-2 Weeks',
      reasoningSummary: {
        newsSentiment: 'Neutral news flow.',
        fundamentals: 'Valuations are in-line with historic levels.',
        technicals: 'Consolidating in a tight range.',
        finalSynthesis: 'Stock is currently in equilibrium. Wait for a breakout.'
      },
      riskFlags: ['High volatility']
    };
  }

  const price = stock.price;
  const rsi = stock.technicals.rsi;
  const pe = stock.fundamentals.pe;
  const isFO = stock.category === 'F&O';

  let rec: AIRecommendation['recommendation'] = 'Hold';
  let score = 65;
  let period = '3-6 Weeks';
  const risks: string[] = [];
  const reasoning = {
    newsSentiment: '',
    fundamentals: '',
    technicals: '',
    finalSynthesis: ''
  };

  // Rule-based logic to simulate sophisticated multi-LLM synthesis
  if (rsi > 65) {
    reasoning.technicals = `Extremely strong price momentum. RSI is currently at ${rsi}, indicating the stock is entering overbought territory but showing powerful trend continuation above support at ${stock.technicals.support[0]}.`;
    if (pe > 40) {
      rec = 'Hold';
      score = 60;
      period = '1-2 Weeks';
      reasoning.fundamentals = `Valuations are premium-stretched with a P/E of ${pe} compared to sector average. While growth is positive, earnings yield offers limited margin of safety.`;
      reasoning.finalSynthesis = `Momentum is bullish, but fundamental valuations warrant caution. Recommend holding current positions with a trailing stop-loss, rather than initiating fresh longs.`;
      risks.push('Stretched Valuations', 'RSI Overbought Pullback risk');
    } else {
      rec = 'Buy';
      score = 82;
      period = '2-3 Months';
      reasoning.fundamentals = `Attractive fundamentals with ROE of ${stock.fundamentals.roe}% and P/E of ${pe}. High earnings growth (${stock.fundamentals.epsGrowth}%) supports current momentum.`;
      reasoning.finalSynthesis = `Excellent combination of cheap valuation and strong technical breakout. Strong momentum is backed by robust underlying balance sheet. Maintain a Buy bias.`;
    }
  } else if (rsi < 35) {
    reasoning.technicals = `Price action is highly depressed. RSI of ${rsi} is in oversold territory. The stock is hovering near primary support of ${stock.technicals.support[1]}, suggesting selling pressure may exhaust soon.`;
    if (stock.fundamentals.epsGrowth > 15 && stock.fundamentals.debtToEquity < 0.5) {
      rec = 'Buy';
      score = 75;
      period = '3-6 Months (Positional)';
      reasoning.fundamentals = `Fundamentals remain extremely clean. Debt-to-equity is low (${stock.fundamentals.debtToEquity}) and ROE is solid at ${stock.fundamentals.roe}%. Earnings are growing at ${stock.fundamentals.epsGrowth}%.`;
      reasoning.finalSynthesis = `Value buy opportunity. Technical selling is overextended while corporate fundamentals remain fully intact. Accumulate for positional recovery.`;
      risks.push('Short-term downside extension before recovery');
    } else {
      rec = 'Avoid';
      score = 88;
      period = 'N/A';
      reasoning.fundamentals = `Weak fundamental support. EPS growth is sluggish at ${stock.fundamentals.epsGrowth}% with high debt-to-equity ratios (${stock.fundamentals.debtToEquity}). Return ratios are deteriorating.`;
      reasoning.finalSynthesis = `Falling knife. Technical trend is deeply bearish, and weak fundamentals offer no buffer or support. Avoid this counter until structural improvements emerge.`;
      risks.push('Corporate Governance / Leverage Risks', 'Further margin contraction');
    }
  } else {
    // Neutral RSI range
    reasoning.technicals = `Consolidating in a range between support at ${stock.technicals.support[0]} and resistance at ${stock.technicals.resistance[0]}. RSI is at ${rsi}, showing no clear trend direction.`;
    reasoning.fundamentals = `Stable performance with P/E of ${pe} and ROE of ${stock.fundamentals.roe}%. Performance metrics are average for the sector.`;
    
    if (stock.changePercent > 1.5) {
      rec = 'Buy';
      score = 70;
      period = '2-4 Weeks';
      reasoning.finalSynthesis = `Minor intraday breakout supported by volume. A short-term swing long trade is viable targeting resistance of ${stock.technicals.resistance[0]}.`;
    } else {
      rec = 'Hold';
      score = 65;
      period = '2-4 Weeks';
      reasoning.finalSynthesis = `No immediate trigger. Recommend holding existing holdings and waiting for a decisive close outside the consolidation channel before taking new trades.`;
    }
  }

  // Factor in news
  const news = getNews(symbol);
  const bullishNewsCount = news.filter(n => n.sentiment === 'Bullish').length;
  const bearishNewsCount = news.filter(n => n.sentiment === 'Bearish').length;

  if (bullishNewsCount > bearishNewsCount) {
    reasoning.newsSentiment = `Sentiment is highly positive. Recent headlines highlight strong order bookings or favorable global conditions with a net positive sentiment score of +0.65.`;
    if (rec === 'Hold' && score < 70) {
      rec = 'Buy';
      score += 5;
    }
  } else if (bearishNewsCount > bullishNewsCount) {
    reasoning.newsSentiment = `Sentiment is cautious or negative due to regulatory audits or margin pressure indicators. Net sentiment score is -0.40.`;
    if (rec === 'Buy') {
      rec = 'Hold';
      score -= 10;
    }
    risks.push('Negative news flow overhang');
  } else {
    reasoning.newsSentiment = `Neutral news flows. General industry announcements dominate headlines.`;
  }

  // F&O metrics adjustments
  if (isFO && stock.buildupType) {
    if (stock.buildupType === 'Long Buildup') {
      reasoning.technicals += ` Option analytics show Long Buildup with OI increasing by ${stock.oiChangePercent}% alongside price gains, signifying strong bullish commitments.`;
      if (rec === 'Hold') rec = 'Buy';
      score = Math.min(score + 10, 95);
    } else if (stock.buildupType === 'Short Buildup') {
      reasoning.technicals += ` Derivative data indicates heavy Short Buildup. OI expanded by ${stock.oiChangePercent}% as prices slumped, indicating aggressive short positions being rolled over.`;
      if (rec === 'Buy' || rec === 'Hold') rec = 'Avoid';
      score = Math.min(score + 15, 95);
      risks.push('High Open Interest concentration on Call writing');
    } else if (stock.buildupType === 'Short Covering') {
      reasoning.technicals += ` Price is rising on declining Open Interest (-${stock.oiChangePercent}%), pointing towards Short Covering. This can trigger a sharp, temporary squeeze.`;
      risks.push('Volatility spike due to short squeeze');
    }
  }

  return {
    symbol,
    recommendation: rec,
    confidenceScore: score,
    holdingPeriod: period,
    reasoningSummary: reasoning,
    riskFlags: risks.length > 0 ? risks : ['Standard market volatility']
  };
}
