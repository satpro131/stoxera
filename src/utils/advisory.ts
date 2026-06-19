import { promises as fs } from 'fs';
import path from 'path';
import { getStocks, getNews, getOptionChain, getOHLCV } from './mockData';
import { calculateMaxPain } from './formulas';
import { getLiveNews } from './news';
import { getUpstoxCandles, getUpstoxExpiries, getUpstoxOptionChain } from './upstox';
import { getIndicatorsForTimeframe } from './indicators';

export async function getLiveOptionChainData(symbol: string, instrumentKey?: string): Promise<any[]> {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;
  if (token) {
    try {
      const expiries = await getUpstoxExpiries(symbol, instrumentKey);
      if (expiries.length > 0) {
        const nearestExpiry = expiries[0];
        const upstoxChain = await getUpstoxOptionChain(symbol, nearestExpiry, instrumentKey);
        if (upstoxChain.length > 0) {
          const mappedChain = upstoxChain.map(item => {
            const strike = Number(item.strike_price);
            const defaultOptionData = {
              ltp: 0, change: 0, changePercent: 0, volume: 0, oi: 0, oiChange: 0, oiChangePercent: 0,
              iv: 0, delta: 0, theta: 0, vega: 0, gamma: 0
            };
            const mapSide = (optionObj: any) => {
              if (!optionObj) return defaultOptionData;
              const mData = optionObj.market_data || {};
              const greeks = optionObj.option_greeks || {};
              const ltp = Number(mData.ltp || 0);
              const closePrice = Number(mData.close_price || ltp);
              const change = ltp - closePrice;
              const changePercent = (change / (closePrice || 1)) * 100;
              const oi = Number(mData.oi || 0);
              const prevOi = Number(mData.prev_oi || oi);
              const oiChange = oi - prevOi;
              const oiChangePercent = (oiChange / (prevOi || 1)) * 100;
              return {
                ltp: Number(ltp.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: Number(mData.volume || 0),
                oi,
                oiChange,
                oiChangePercent: Number(oiChangePercent.toFixed(2)),
                iv: Number((greeks.iv || 0).toFixed(2)),
                delta: Number((greeks.delta || 0).toFixed(3)),
                theta: Number((greeks.theta || 0).toFixed(3)),
                vega: Number((greeks.vega || 0).toFixed(3)),
                gamma: Number((greeks.gamma || 0).toFixed(5))
              };
            };
            return {
              strike,
              call: mapSide(item.call_options),
              put: mapSide(item.put_options)
            };
          });
          return mappedChain.sort((a, b) => a.strike - b.strike);
        }
      }
    } catch (err) {
      console.warn(`[getLiveOptionChainData] Failed to fetch live option chain for ${symbol}:`, err);
    }
  }
  return getOptionChain(symbol);
}

export interface AdvisoryContext {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  category: string;
  technicals: {
    rsi: number;
    trend: string;
    sma20: number;
    sma50: number;
    sma200: number;
    support: number[];
    resistance: number[];
    macd: { macdLine: number; signalLine: number; histogram: number };
  };
  fundamentals: {
    pe: number;
    pb: number;
    roe: number;
    roce: number;
    debtToEquity: number;
    epsGrowth: number;
    revenueGrowth: number;
    promoterHolding: number;
    dividendYield: number;
    marketCap: number;
    as_of_date?: string;
  };
  newsSentiment: {
    score: number;
    label: string;
    totalCount: number;
    articles: any[];
  };
  options: {
    pcr: number;
    maxPain: number;
    totalCallOI: number;
    totalPutOI: number;
    buildupType: string;
  } | null;
}

/**
 * Gathers consistent, fresh stock data context for AI Advisory & Trade Setup.
 */
export async function assembleAdvisoryContext(symbol: string, instrumentKey?: string): Promise<AdvisoryContext> {
  const normalizedSymbol = symbol.toUpperCase();
  const stocks = getStocks();
  const stock = stocks.find(s => s.symbol === normalizedSymbol);

  if (!stock) {
    throw new Error(`Stock not found: ${normalizedSymbol}`);
  }

  // 1. Latest Technical Indicators (current data only from daily timeframe)
  let candles = [];
  const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;
  try {
    if (token) {
      candles = await getUpstoxCandles(normalizedSymbol, '1d', instrumentKey);
    }
  } catch (err) {
    console.warn('[Advisory Context] Failed to fetch live candles, falling back to mock:', err);
  }
  if (!candles || candles.length === 0) {
    candles = getOHLCV(normalizedSymbol, '1d', 250);
  }
  const dailyIndicators = getIndicatorsForTimeframe('1d', candles);

  // 2. Latest Fundamentals from DB table (with memory fallback)
  let fundamentals = { ...stock.fundamentals, as_of_date: new Date().toISOString().split('T')[0] };
  try {
    const dbPath = path.join(process.cwd(), 'src', 'utils', 'fundamentalsDb.json');
    const content = await fs.readFile(dbPath, 'utf-8');
    const dbData = JSON.parse(content);
    if (dbData[normalizedSymbol]) {
      fundamentals = { ...dbData[normalizedSymbol] };
    }
  } catch (err) {
    console.warn('[Advisory Context] Failed to read fundamentals DB, using fallback:', err);
  }

  // 3. Recent News Sentiment Summary from DB table (with live/memory fallback)
  let newsArticles = [];
  try {
    const dbPath = path.join(process.cwd(), 'src', 'utils', 'newsDb.json');
    const content = await fs.readFile(dbPath, 'utf-8');
    const dbData = JSON.parse(content);
    const specificNews = dbData[normalizedSymbol] || [];
    const globalNews = dbData['GLOBAL'] || [];
    const merged = [...specificNews];
    for (const item of globalNews) {
      if (!merged.some(m => m.url === item.url)) {
        merged.push(item);
      }
    }
    newsArticles = merged;
  } catch (err) {
    console.warn('[Advisory Context] Failed to read news DB, using fallback:', err);
  }

  if (newsArticles.length === 0) {
    try {
      newsArticles = await getLiveNews(normalizedSymbol, stock.name, stock.sector);
    } catch {
      // ignore
    }
  }
  if (newsArticles.length === 0) {
    newsArticles = getNews(normalizedSymbol);
  }

  let positive = 0, negative = 0, neutral = 0;
  newsArticles.forEach((item: any) => {
    const sent = item.sentiment?.toLowerCase() || 'neutral';
    if (sent.includes('positive') || sent.includes('bullish')) positive++;
    else if (sent.includes('negative') || sent.includes('bearish')) negative++;
    else neutral++;
  });
  const totalNews = positive + negative + neutral;
  let newsScore = 0;
  let newsLabel = 'Neutral';
  if (totalNews > 0) {
    newsScore = Number(((positive - negative) / totalNews).toFixed(2));
    if (newsScore >= 0.2) newsLabel = 'Bullish';
    else if (newsScore <= -0.2) newsLabel = 'Bearish';
  }

  // 4. Current Option Chain stats: PCR, Max Pain
  let optionStats: AdvisoryContext['options'] = null;
  if (stock.category === 'F&O') {
    let optionChain: any[] = [];
    try {
      optionChain = await getLiveOptionChainData(normalizedSymbol, instrumentKey);
    } catch {
      // ignore
    }
    if (optionChain && optionChain.length > 0) {
      let totalCallOI = 0;
      let totalPutOI = 0;
      const strikes: number[] = [];
      const callOI: Record<number, number> = {};
      const putOI: Record<number, number> = {};

      optionChain.forEach((item: any) => {
        totalCallOI += item.call?.oi || 0;
        totalPutOI += item.put?.oi || 0;
        if (item.strike) {
          strikes.push(item.strike);
          callOI[item.strike] = item.call?.oi || 0;
          putOI[item.strike] = item.put?.oi || 0;
        }
      });

      const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 0;
      const { maxPainPrice } = calculateMaxPain(strikes, callOI, putOI);

      optionStats = {
        pcr,
        maxPain: maxPainPrice,
        totalCallOI,
        totalPutOI,
        buildupType: stock.buildupType || 'Neutral'
      };
    }
  }

  let currentPrice = stock.price;
  let currentChange = stock.change;
  let currentChangePercent = stock.changePercent;

  if (candles && candles.length > 0) {
    const latestCandle = candles[candles.length - 1];
    currentPrice = latestCandle.close;
    if (candles.length > 1) {
      const prevClose = candles[candles.length - 2].close;
      currentChange = Number((currentPrice - prevClose).toFixed(2));
      currentChangePercent = Number(((currentChange / prevClose) * 100).toFixed(2));
    }
  }

  return {
    symbol: normalizedSymbol,
    name: stock.name,
    sector: stock.sector,
    price: currentPrice,
    change: currentChange,
    changePercent: currentChangePercent,
    category: stock.category,
    technicals: {
      rsi: dailyIndicators.rsi,
      trend: dailyIndicators.trend,
      sma20: dailyIndicators.sma20,
      sma50: dailyIndicators.sma50,
      sma200: dailyIndicators.sma200,
      support: dailyIndicators.support,
      resistance: dailyIndicators.resistance,
      macd: dailyIndicators.macd
    },
    fundamentals,
    newsSentiment: {
      score: newsScore,
      label: newsLabel,
      totalCount: totalNews,
      articles: newsArticles
    },
    options: optionStats
  };
}
