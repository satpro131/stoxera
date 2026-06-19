import { OHLCV } from './mockData';
import { deriveTrendStatus } from './formulas';

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(closes: number[], period: number): number {
  if (closes.length < period) {
    if (closes.length === 0) return 0;
    // Fallback to average of available closes
    const sum = closes.reduce((a, b) => a + b, 0);
    return Number((sum / closes.length).toFixed(2));
  }
  const slice = closes.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / period).toFixed(2));
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(closes: number[], period: number): number[] {
  const emas: number[] = [];
  if (closes.length === 0) return emas;

  const k = 2 / (period + 1);
  // Initial SMA
  let prevEma = closes[0];
  const initialSmaLength = Math.min(closes.length, period);
  const sum = closes.slice(0, initialSmaLength).reduce((a, b) => a + b, 0);
  prevEma = sum / initialSmaLength;
  emas.push(prevEma);

  for (let i = 1; i < closes.length; i++) {
    const ema = closes[i] * k + prevEma * (1 - k);
    emas.push(ema);
    prevEma = ema;
  }

  return emas;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length <= period) return 50; // default to neutral if insufficient data

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let gains = 0;
  let losses = 0;

  // First values
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Number(rsi.toFixed(2));
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(closes: number[]): { macdLine: number; signalLine: number; histogram: number } {
  const defaultResult = { macdLine: 0, signalLine: 0, histogram: 0 };
  if (closes.length < 26) return defaultResult;

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLines: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLines.push(ema12[i] - ema26[i]);
  }

  const signalLines = calculateEMA(macdLines, 9);

  const lastMacd = macdLines[macdLines.length - 1];
  const lastSignal = signalLines[signalLines.length - 1];
  const lastHist = lastMacd - lastSignal;

  return {
    macdLine: Number(lastMacd.toFixed(2)),
    signalLine: Number(lastSignal.toFixed(2)),
    histogram: Number(lastHist.toFixed(2))
  };
}

/**
 * Calculate Support and Resistance levels based on recent price pivots
 */
export function calculateSupportResistance(candles: OHLCV[]): { support: number[]; resistance: number[] } {
  if (candles.length < 10) {
    const closes = candles.map(c => c.close);
    const avg = closes.reduce((a, b) => a + b, 0) / (closes.length || 1);
    return {
      support: [Number((avg * 0.97).toFixed(2)), Number((avg * 0.94).toFixed(2))],
      resistance: [Number((avg * 1.03).toFixed(2)), Number((avg * 1.06).toFixed(2))]
    };
  }

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const currentPrice = candles[candles.length - 1].close;

  // Find local peaks and troughs (pivots)
  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    // Pivot High (peak)
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      pivotHighs.push(highs[i]);
    }
    // Pivot Low (trough)
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      pivotLows.push(lows[i]);
    }
  }

  // Sort and filter pivots relative to current price
  // Support: Pivot lows below current price, sorted descending (closest first)
  const supports = pivotLows
    .filter(val => val < currentPrice)
    .sort((a, b) => b - a);
  
  // Resistance: Pivot highs above current price, sorted ascending (closest first)
  const resistances = pivotHighs
    .filter(val => val > currentPrice)
    .sort((a, b) => a - b);

  // Fallback to percentage buffer if no pivots found
  const s1 = supports[0] || (currentPrice * 0.97);
  const s2 = supports[1] || (s1 * 0.97);
  const r1 = resistances[0] || (currentPrice * 1.03);
  const r2 = resistances[1] || (r1 * 1.03);

  return {
    support: [Number(s1.toFixed(2)), Number(s2.toFixed(2))],
    resistance: [Number(r1.toFixed(2)), Number(r2.toFixed(2))]
  };
}

export interface MultiTimeframeIndicators {
  timeframe: string;
  rsi: number;
  macd: { macdLine: number; signalLine: number; histogram: number };
  sma20: number;
  sma50: number;
  sma200: number;
  support: number[];
  resistance: number[];
  trend: 'Bullish' | 'Bearish' | 'Neutral' | 'Strong Bullish' | 'Strong Bearish';
}

/**
 * Compute technical indicators for a given timeframe's candle history
 */
export function getIndicatorsForTimeframe(timeframe: string, candles: OHLCV[]): MultiTimeframeIndicators {
  const closes = candles.map(c => c.close);
  const lastClose = closes[closes.length - 1] || 0;

  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const { support, resistance } = calculateSupportResistance(candles);

  // Determine trend string using rule-based deriveTrendStatus formula
  const trend = deriveTrendStatus(rsi, macd.histogram, sma20, sma50, lastClose);

  return {
    timeframe,
    rsi,
    macd,
    sma20,
    sma50,
    sma200,
    support,
    resistance,
    trend
  };
}

import { RSI, MACD, SMA } from 'technicalindicators';

export interface ComputedIndicators {
  rsi: (number | null)[];
  macd: ({ macdLine: number; signalLine: number; histogram: number } | null)[];
  sma20: (number | null)[];
  sma50: (number | null)[];
  sma200: (number | null)[];
}

/**
 * Server-side technical indicator computation utilizing the 'technicalindicators' package
 * Pads initial values with null to keep output array lengths aligned to the input candles.
 */
export function computeIndicators(candles: { close: number }[]): ComputedIndicators {
  const closes = candles.map(c => c.close);
  const length = closes.length;

  if (length === 0) {
    return { rsi: [], macd: [], sma20: [], sma50: [], sma200: [] };
  }

  const rsiRaw = RSI.calculate({ period: 14, values: closes }) || [];
  const sma20Raw = SMA.calculate({ period: 20, values: closes }) || [];
  const sma50Raw = SMA.calculate({ period: 50, values: closes }) || [];
  const sma200Raw = SMA.calculate({ period: 200, values: closes }) || [];

  const macdRaw = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  }) || [];

  // Pad arrays with nulls at the start to align lengths to input candles
  const rsi = new Array(length).fill(null);
  for (let i = 0; i < rsiRaw.length; i++) {
    rsi[length - rsiRaw.length + i] = Number(rsiRaw[i].toFixed(2));
  }

  const sma20 = new Array(length).fill(null);
  for (let i = 0; i < sma20Raw.length; i++) {
    sma20[length - sma20Raw.length + i] = Number(sma20Raw[i].toFixed(2));
  }

  const sma50 = new Array(length).fill(null);
  for (let i = 0; i < sma50Raw.length; i++) {
    sma50[length - sma50Raw.length + i] = Number(sma50Raw[i].toFixed(2));
  }

  const sma200 = new Array(length).fill(null);
  for (let i = 0; i < sma200Raw.length; i++) {
    sma200[length - sma200Raw.length + i] = Number(sma200Raw[i].toFixed(2));
  }

  const macd = new Array(length).fill(null);
  for (let i = 0; i < macdRaw.length; i++) {
    const m = macdRaw[i];
    macd[length - macdRaw.length + i] = {
      macdLine: Number(m.MACD?.toFixed(2) || 0),
      signalLine: Number(m.signal?.toFixed(2) || 0),
      histogram: Number(m.histogram?.toFixed(2) || 0)
    };
  }

  return {
    rsi,
    macd,
    sma20,
    sma50,
    sma200
  };
}
