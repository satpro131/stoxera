'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import OptionChain from '@/components/derivative/optionChain';
import CandleChart from '@/components/stock/candleChart';
import StrategyPlanner from '@/components/stock/strategyPlanner';
import PatternChart from '@/components/stock/patternChart';
import { useAppStore } from '@/store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { addPositionalTrade, addFnoTrade } from '@/utils/demoDb';
import {
  TrendingUp,
  TrendingDown,
  Star,
  ChevronLeft,
  Calendar,
  Layers,
  FileText,
  Clock,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Bookmark,
  X
} from 'lucide-react';

export default function StockDetail() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const symbol = (params.symbol as string)?.toUpperCase();

  const { watchlist, toggleWatchlist, timeframe, setTimeframe, selectedModel, setSelectedModel } = useAppStore();
  const isWatchlisted = watchlist.includes(symbol);

  // Read URL search params to set active tab if present
  const defaultTab = searchParams.get('tab') || 'chart';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [showAiDetails, setShowAiDetails] = useState<boolean>(false);
  const [selectedPattern, setSelectedPattern] = useState<string>('flag');
  const [expandRationale, setExpandRationale] = useState<boolean>(false);
  const [showAllRisks, setShowAllRisks] = useState<boolean>(false);
  const [lastSynthesizedAt, setLastSynthesizedAt] = useState<Date | null>(null);

  // Demo Trade placement modals state
  const [showPosModal, setShowPosModal] = useState(false);
  const [posModalData, setPosModalData] = useState<any>(null);
  const [posEntryPrice, setPosEntryPrice] = useState<number>(0);
  const [posQuantity, setPosQuantity] = useState<number>(100);

  const [showFnoModal, setShowFnoModal] = useState(false);
  const [fnoModalData, setFnoModalData] = useState<any>(null);
  const [fnoLegLots, setFnoLegLots] = useState<Record<number, number>>({});
  const [fnoLegPremiums, setFnoLegPremiums] = useState<Record<number, number>>({});
  const [refreshingFno, setRefreshingFno] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleAddPositionalDemoTrade = (suggested: any) => {
    const rawEntry = String(suggested.entry_point || stock?.price || 0).replace(/[₹,]/g, '');
    const entryVal = parseFloat(rawEntry) || stock?.price || 0;
    const targetVal = suggested.target_price ? parseFloat(String(suggested.target_price).replace(/[₹,]/g, '')) : null;
    const stopLossVal = suggested.stop_loss ? parseFloat(String(suggested.stop_loss).replace(/[₹,]/g, '')) : null;

    setPosModalData({
      symbol,
      instrument_key: stock?.instrument_key || '',
      direction: (suggested.direction || 'LONG').toUpperCase(),
      target_price: targetVal,
      stop_loss: stopLossVal,
      expected_timeline: suggested.expected_timeline || null,
      ai_rationale: suggested.rationale || null
    });
    setPosEntryPrice(Number(entryVal.toFixed(2)));
    setPosQuantity(100);
    setShowPosModal(true);
  };

  const handleConfirmPosDemoTrade = async () => {
    try {
      await addPositionalTrade({
        symbol: posModalData.symbol,
        instrument_key: posModalData.instrument_key || '',
        source: 'AI',
        direction: posModalData.direction,
        entry_price: posEntryPrice,
        quantity: posQuantity,
        target_price: posModalData.target_price,
        stop_loss: posModalData.stop_loss,
        expected_timeline: posModalData.expected_timeline,
        ai_rationale: posModalData.ai_rationale
      });
      showToast('Positional trade successfully added to Demo Trading!');
      setShowPosModal(false);
    } catch (err: any) {
      showToast('Failed to place trade: ' + err.message, 'error');
    }
  };

  const handleAddFnoDemoTrade = async (suggested: any) => {
    const initialLots: Record<number, number> = {};
    const initialPremiums: Record<number, number> = {};
    (suggested.legs || []).forEach((leg: any, idx: number) => {
      initialLots[idx] = leg.lots || 1;
      initialPremiums[idx] = leg.premium_reference;
    });

    setFnoModalData({
      symbol,
      instrument_key: stock?.instrument_key || '',
      strategy_name: suggested.strategy_name || 'Custom Strategy',
      expiry_date: suggested.expiry_used || '',
      legs: suggested.legs || [],
      max_profit_estimate: suggested.max_profit_estimate || null,
      max_loss_estimate: suggested.max_loss_estimate || null,
      breakeven_points: suggested.breakeven_points || null,
      ai_rationale: suggested.rationale || null
    });
    setFnoLegLots(initialLots);
    setFnoLegPremiums(initialPremiums);
    setShowFnoModal(true);

    setRefreshingFno(true);
    try {
      const res = await fetch(`/api/options?symbol=${symbol}`);
      const data = await res.json();
      if (data?.success && data?.data?.chain) {
        const liveChain = data.data.chain;
        const updatedPremiums: Record<number, number> = {};
        (suggested.legs || []).forEach((leg: any, idx: number) => {
          const matched = liveChain.find((c: any) => c.strike === leg.strike);
          if (matched) {
            const ltp = leg.option_type === 'CE' ? matched.call?.ltp : matched.put?.ltp;
            if (ltp !== undefined && ltp > 0) {
              updatedPremiums[idx] = ltp;
            } else {
              updatedPremiums[idx] = leg.premium_reference;
            }
          } else {
            updatedPremiums[idx] = leg.premium_reference;
          }
        });
        setFnoLegPremiums(updatedPremiums);
      }
    } catch (e) {
      console.warn('Failed to refresh option chain premiums:', e);
    } finally {
      setRefreshingFno(false);
    }
  };

  const handleConfirmFnoDemoTrade = async () => {
    try {
      let lotSize = 500;
      if (symbol === 'NIFTY') lotSize = 25;
      else if (symbol === 'BANKNIFTY') lotSize = 15;
      else if (symbol === 'RELIANCE') lotSize = 250;
      else if (symbol === 'TCS') lotSize = 175;

      const finalLegs = fnoModalData.legs.map((leg: any, idx: number) => ({
        action: leg.action,
        strike: leg.strike,
        option_type: leg.option_type,
        entry_premium: fnoLegPremiums[idx] || leg.premium_reference,
        lots: fnoLegLots[idx] || 1,
        lot_size: lotSize
      }));

      await addFnoTrade({
        symbol: fnoModalData.symbol,
        instrument_key: fnoModalData.instrument_key || '',
        source: 'AI',
        strategy_name: fnoModalData.strategy_name,
        expiry_date: fnoModalData.expiry_date,
        legs: finalLegs,
        max_profit_estimate: fnoModalData.max_profit_estimate,
        max_loss_estimate: fnoModalData.max_loss_estimate,
        breakeven_points: fnoModalData.breakeven_points,
        ai_rationale: fnoModalData.ai_rationale
      });

      showToast('F&O strategy successfully added to Demo Trading!');
      setShowFnoModal(false);
    } catch (err: any) {
      showToast('Failed to place trade: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Query 1: Fetch stock quote and chart history
  const { data: quoteRes, isLoading: quoteLoading, refetch: refetchQuote } = useQuery({
    queryKey: ['quote', symbol, timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/quote?symbol=${symbol}&timeframe=${timeframe}`);
      return res.json();
    },
    enabled: !!symbol
  });

  // Query 2: Fetch options data (only for F&O)
  const isFO = quoteRes?.success ? quoteRes.data.stock.category === 'F&O' : false;
  const { data: optionsRes, isLoading: optionsLoading } = useQuery({
    queryKey: ['options', symbol],
    queryFn: async () => {
      const res = await fetch(`/api/options?symbol=${symbol}`);
      return res.json();
    },
    enabled: !!symbol && isFO
  });

  // Query 3: Fetch news and sentiment
  const { data: newsRes, isLoading: newsLoading } = useQuery({
    queryKey: ['news', symbol],
    queryFn: async () => {
      const res = await fetch(`/api/news?symbol=${symbol}`);
      return res.json();
    },
    enabled: !!symbol
  });

  // Query 4: Fetch AI Advisory
  const { data: recommendRes, isLoading: recommendLoading, refetch: refetchRecommend, isRefetching: isRecommending } = useQuery({
    queryKey: ['recommend', symbol, selectedModel],
    queryFn: async () => {
      const res = await fetch(`/api/recommend?symbol=${symbol}&model=${selectedModel}`);
      return res.json();
    },
    enabled: !!symbol
  });

  useEffect(() => {
    if (recommendRes?.success) {
      setLastSynthesizedAt(new Date());
    }
  }, [recommendRes]);

  const stock = quoteRes?.success ? quoteRes.data.stock : null;
  const chartData = quoteRes?.success ? quoteRes.data.chart : null;
  const optionsData = optionsRes?.success ? optionsRes.data : null;
  const newsData = newsRes?.success ? newsRes.data : null;
  const aiReport = recommendRes?.success ? recommendRes.data : null;

  // Dynamic Pattern Detection & Line Calculation
  const detectedPatterns = useMemo(() => {
    if (!chartData || chartData.length < 30) return [];

    const count = chartData.length;
    const price = stock?.price || chartData[count - 1].close;
    const timeframeLabel = timeframe === '1d' ? 'Daily' : timeframe === '1h' ? '1-Hour' : timeframe === '15m' ? '15-Min' : 'Weekly';
    const list: any[] = [];

    // Analyze local highs and lows of the last 30 candles
    const subset = chartData.slice(count - 30);
    
    // Find local minima (valleys)
    const valleys: { idx: number; val: number; time: string }[] = [];
    for (let i = 2; i < subset.length - 2; i++) {
      if (subset[i].low < subset[i-1].low && 
          subset[i].low < subset[i-2].low && 
          subset[i].low < subset[i+1].low && 
          subset[i].low < subset[i+2].low) {
        valleys.push({ idx: i, val: subset[i].low, time: String(subset[i].time) });
      }
    }

    // Find local maxima (peaks)
    const peaks: { idx: number; val: number; time: string }[] = [];
    for (let i = 2; i < subset.length - 2; i++) {
      if (subset[i].high > subset[i-1].high && 
          subset[i].high > subset[i-2].high && 
          subset[i].high > subset[i+1].high && 
          subset[i].high > subset[i+2].high) {
        peaks.push({ idx: i, val: subset[i].high, time: String(subset[i].time) });
      }
    }

    // 1. Detect Double Bottom
    for (let i = 0; i < valleys.length; i++) {
      for (let j = i + 1; j < valleys.length; j++) {
        const v1 = valleys[i];
        const v2 = valleys[j];
        if (v2.idx - v1.idx >= 4 && Math.abs(v1.val - v2.val) / Math.min(v1.val, v2.val) < 0.025) {
          const intermediatePeaks = peaks.filter(p => p.idx > v1.idx && p.idx < v2.idx);
          if (intermediatePeaks.length > 0) {
            const peak = Math.max(...intermediatePeaks.map(p => p.val));
            const valleyAverage = (v1.val + v2.val) / 2;
            
            const dbUpperLines: { time: string; value: number }[] = [];
            const dbLowerLines: { time: string; value: number }[] = [];
            for (let k = count - 30 + v1.idx; k < count; k++) {
              if (k <= count - 2) {
                dbUpperLines.push({ time: String(chartData[k].time), value: Number(peak.toFixed(2)) });
                dbLowerLines.push({ time: String(chartData[k].time), value: Number(valleyAverage.toFixed(2)) });
              }
            }

            list.push({
              id: 'double_bottom',
              name: 'Double Bottom Reversal',
              timeframe: timeframeLabel,
              confidence: '82%',
              status: price > peak ? 'Neckline Broken (Bullish Reversal)' : 'Forming (Below Neckline)',
              statusColor: price > peak ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-amber-400 border-amber-500/20 bg-amber-500/10',
              target: Math.round(peak + (peak - valleyAverage)),
              stopLoss: Math.round(Math.min(v1.val, v2.val)),
              desc: `Detected two consecutive valley lows at ₹${v1.val.toFixed(0)} and ₹${v2.val.toFixed(0)} on the chart. A break above the neckline resistance at ₹${peak.toFixed(0)} signals reversal.`,
              upper: dbUpperLines,
              lower: dbLowerLines
            });
            break;
          }
        }
      }
      if (list.some(p => p.id === 'double_bottom')) break;
    }

    // 2. Detect Double Top
    for (let i = 0; i < peaks.length; i++) {
      for (let j = i + 1; j < peaks.length; j++) {
        const p1 = peaks[i];
        const p2 = peaks[j];
        if (p2.idx - p1.idx >= 4 && Math.abs(p1.val - p2.val) / Math.min(p1.val, p2.val) < 0.025) {
          const intermediateValleys = valleys.filter(v => v.idx > p1.idx && v.idx < p2.idx);
          if (intermediateValleys.length > 0) {
            const valley = Math.min(...intermediateValleys.map(v => v.val));
            const peakAverage = (p1.val + p2.val) / 2;

            const dtUpperLines: { time: string; value: number }[] = [];
            const dtLowerLines: { time: string; value: number }[] = [];
            for (let k = count - 30 + p1.idx; k < count; k++) {
              if (k <= count - 2) {
                dtUpperLines.push({ time: String(chartData[k].time), value: Number(peakAverage.toFixed(2)) });
                dtLowerLines.push({ time: String(chartData[k].time), value: Number(valley.toFixed(2)) });
              }
            }

            list.push({
              id: 'double_top',
              name: 'Double Top Reversal',
              timeframe: timeframeLabel,
              confidence: '85%',
              status: price < valley ? 'Neckline Broken (Bearish Reversal)' : 'Forming (Above Neckline)',
              statusColor: price < valley ? 'text-rose-400 border-rose-500/20 bg-rose-500/10' : 'text-amber-400 border-amber-500/20 bg-amber-500/10',
              target: Math.round(valley - (peakAverage - valley)),
              stopLoss: Math.round(Math.max(p1.val, p2.val)),
              desc: `Detected two consecutive peak highs at ₹${p1.val.toFixed(0)} and ₹${p2.val.toFixed(0)} on the chart. A breakdown below the neckline support at ₹${valley.toFixed(0)} signals reversal.`,
              upper: dtUpperLines,
              lower: dtLowerLines
            });
            break;
          }
        }
      }
      if (list.some(p => p.id === 'double_top')) break;
    }

    // 3. Detect Ascending Triangle
    if (peaks.length >= 2 && valleys.length >= 2) {
      const highestHigh = Math.max(...peaks.map(p => p.val));
      const lowestLow = Math.min(...valleys.map(v => v.val));
      
      let risingLows = true;
      for (let k = 1; k < valleys.length; k++) {
        if (valleys[k].val < valleys[k-1].val - (lowestLow * 0.005)) {
          risingLows = false;
        }
      }

      let flatResistance = true;
      const avgPeak = peaks.reduce((acc, p) => acc + p.val, 0) / peaks.length;
      for (const p of peaks) {
        if (Math.abs(p.val - avgPeak) / avgPeak > 0.02) {
          flatResistance = false;
        }
      }

      if (risingLows && flatResistance) {
        const triStartIndex = count - 30 + valleys[0].idx;
        const triStep = (highestHigh - lowestLow) / (count - triStartIndex);
        const triUpperLines: { time: string; value: number }[] = [];
        const triLowerLines: { time: string; value: number }[] = [];

        for (let k = triStartIndex; k < count; k++) {
          const t = chartData[k].time;
          if (k <= count - 2) {
            triUpperLines.push({ time: String(t), value: Number(highestHigh.toFixed(2)) });
            const valLower = lowestLow + (k - triStartIndex) * triStep;
            triLowerLines.push({ time: String(t), value: Number(valLower.toFixed(2)) });
          }
        }

        list.push({
          id: 'triangle',
          name: 'Ascending Triangle',
          timeframe: timeframeLabel,
          confidence: '78%',
          status: 'Forming (Breakout pending)',
          statusColor: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
          target: Math.round(highestHigh * 1.055),
          stopLoss: Math.round(lowestLow),
          desc: `Overhead flat resistance at ₹${highestHigh.toFixed(0)} meeting a rising support line starting at ₹${lowestLow.toFixed(0)}.`,
          upper: triUpperLines,
          lower: triLowerLines
        });
      }
    }

    // 4. Detect Bullish Flag
    let poleDetected = false;
    let poleStart = 0;
    let poleEnd = 0;
    for (let i = 0; i < subset.length - 10; i++) {
      const change = (subset[i+8].close - subset[i].close) / subset[i].close;
      if (change > 0.035) {
        poleDetected = true;
        poleStart = count - 30 + i;
        poleEnd = count - 30 + i + 8;
        break;
      }
    }

    if (poleDetected) {
      const flagUpperLines: { time: string; value: number }[] = [];
      const flagLowerLines: { time: string; value: number }[] = [];
      const startHigh = chartData[poleEnd].high;
      const flagSlope = -(startHigh * 0.0006);

      for (let k = poleEnd; k < count; k++) {
        const t = chartData[k].time;
        if (k <= count - 2) {
          const valUpper = startHigh + (k - poleEnd) * flagSlope;
          const valLower = valUpper - (startHigh * 0.012);
          flagUpperLines.push({ time: String(t), value: Number(valUpper.toFixed(2)) });
          flagLowerLines.push({ time: String(t), value: Number(valLower.toFixed(2)) });
        }
      }

      list.push({
        id: 'flag',
        name: 'Bullish Flag Pattern',
        timeframe: timeframeLabel,
        confidence: '86%',
        status: 'Active Breakout',
        statusColor: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
        target: Math.round(price * 1.05),
        stopLoss: Math.round(chartData[poleEnd].low),
        desc: `Rapid pole ascent of +3.5% from ₹${chartData[poleStart].close.toFixed(0)} to ₹${chartData[poleEnd].close.toFixed(0)}, followed by downward channel consolidation.`,
        upper: flagUpperLines,
        lower: flagLowerLines
      });
    }

    // 5. Fallback Dynamic Channel
    if (list.length === 0) {
      const maxHigh = Math.max(...subset.map((c: any) => c.high));
      const minLow = Math.min(...subset.map((c: any) => c.low));
      const startHigh = subset[0].high;
      const slope = (subset[subset.length - 1].high - startHigh) / subset.length;

      const channelUpper: { time: string; value: number }[] = [];
      const channelLower: { time: string; value: number }[] = [];

      for (let k = count - 30; k < count; k++) {
        const t = chartData[k].time;
        if (k <= count - 2) {
          const valUpper = startHigh + (k - (count - 30)) * slope;
          const valLower = valUpper - (startHigh * 0.02);
          channelUpper.push({ time: String(t), value: Number(valUpper.toFixed(2)) });
          channelLower.push({ time: String(t), value: Number(valLower.toFixed(2)) });
        }
      }

      list.push({
        id: 'channel',
        name: slope < 0 ? 'Descending Channel' : 'Ascending Channel',
        timeframe: timeframeLabel,
        confidence: '70%',
        status: 'Trading Within Range',
        statusColor: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10',
        target: Math.round(price * (slope < 0 ? 1.03 : 1.05)),
        stopLoss: Math.round(minLow),
        desc: `Stock is currently trading within a defined ${slope < 0 ? 'downward' : 'upward'} sloping price channel bounded by support at ₹${minLow.toFixed(0)} and resistance at ₹${maxHigh.toFixed(0)}.`,
        upper: channelUpper,
        lower: channelLower
      });
    }

    return list;
  }, [chartData, stock?.price, timeframe]);

  const currentPatternObj = useMemo(() => {
    return detectedPatterns.find(p => p.id === selectedPattern) || null;
  }, [detectedPatterns, selectedPattern]);

  const patternInfo = useMemo(() => {
    if (currentPatternObj) {
      return {
        name: currentPatternObj.name,
        timeframe: currentPatternObj.timeframe,
        confidence: currentPatternObj.confidence,
        status: currentPatternObj.status,
        statusColor: currentPatternObj.statusColor,
        target: currentPatternObj.target,
        stopLoss: currentPatternObj.stopLoss,
        desc: currentPatternObj.desc
      };
    }
    return {
      name: 'N/A',
      timeframe: 'N/A',
      confidence: '0%',
      status: 'N/A',
      statusColor: 'text-zinc-500 border-zinc-850 bg-zinc-900',
      target: 0,
      stopLoss: 0,
      desc: 'No pattern detected'
    };
  }, [currentPatternObj]);

  const patternLines = useMemo(() => {
    if (currentPatternObj) {
      return {
        upper: currentPatternObj.upper,
        lower: currentPatternObj.lower
      };
    }
    return { upper: [], lower: [] };
  }, [currentPatternObj]);

  // Auto-select first detected pattern
  useEffect(() => {
    if (detectedPatterns && detectedPatterns.length > 0) {
      if (!detectedPatterns.some((p: any) => p.id === selectedPattern)) {
        setSelectedPattern(detectedPatterns[0].id);
      }
    }
  }, [detectedPatterns, selectedPattern]);

  if (quoteLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-950">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 text-cyan-500 animate-spin" />
          <span className="text-sm text-zinc-400">Loading stock insights...</span>
        </div>
      </div>
    );
  }

  if (!quoteRes?.success || !stock) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-950">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-md mx-auto px-4 text-center">
          <AlertTriangle className="h-12 w-12 text-rose-500" />
          <h2 className="text-xl font-bold text-white">Stock Not Found</h2>
          <p className="text-sm text-zinc-400">
            We couldn't retrieve price feeds for "{symbol}". It might not be in our tracked universe.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header />

      {/* Main Container */}
      <main className="flex-1 px-4 py-6 md:px-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header Back & Info row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="h-8 w-8 flex items-center justify-center border border-zinc-900 bg-zinc-950 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight uppercase">{stock.symbol}</h1>
                <span className="text-[10px] bg-zinc-900 border border-zinc-850 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">
                  {stock.category}
                </span>
                <span className="text-[10px] text-zinc-500 font-semibold">{stock.sector}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{stock.name}</p>
            </div>
          </div>

          {/* Price & Action row */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">₹{stock.price.toLocaleString('en-IN')}</span>
                <span className={`text-xs font-bold ${stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {stock.change >= 0 ? '+' : ''}{stock.changePercent}%
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">Volume: {(stock.volume / 100000).toFixed(1)}L</span>
            </div>

            <button
              onClick={() => toggleWatchlist(stock.symbol)}
              className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-xs font-bold uppercase transition-all ${
                isWatchlisted
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Star className={`h-4.5 w-4.5 ${isWatchlisted ? 'fill-amber-500' : ''}`} />
              Watchlist
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-zinc-900/60 pb-px overflow-x-auto no-scrollbar gap-2">
          {[
            { id: 'chart', label: 'Chart & Technicals' },
            ...(stock.category === 'F&O' ? [{ id: 'options', label: 'Option Chain (F&O)' }] : []),
            { id: 'fundamentals', label: 'Fundamentals' },
            { id: 'news', label: 'News & Sentiment' },
            { id: 'ai-advisory', label: 'AI Advisory & Trade Setup' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                // Sync tab to search param for URL shareability
                const params = new URLSearchParams(window.location.search);
                params.set('tab', tab.id);
                window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
              }}
              className={`px-4 py-2 border-b-2 text-xs font-bold uppercase whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div className="py-2">
          {activeTab === 'chart' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Candlestick Chart */}
              <div className="lg:col-span-3 border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-500 glow-cyan animate-pulse" />
                    TradingView Live Chart
                  </span>
                  
                  {/* Timeframe selector */}
                  <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                    {['15m', '1h', '1d', '1w'].map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                          timeframe === tf
                            ? 'bg-zinc-800 text-cyan-400 font-bold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-96">
                  <CandleChart data={chartData} />
                </div>
              </div>

              {/* Technical indicators sidebar */}
              <div className="space-y-6">
                {/* Trend Card */}
                <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-3">Technical Trend</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-300">Trend Status</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase ${
                      stock.technicals.trend.includes('Bullish')
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                        : stock.technicals.trend.includes('Bearish')
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {stock.technicals.trend}
                    </span>
                  </div>
                  
                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Relative Strength (RSI)</span>
                      <span className={`font-bold ${stock.technicals.rsi > 65 ? 'text-amber-500' : stock.technicals.rsi < 35 ? 'text-cyan-400' : 'text-zinc-200'}`}>
                        {stock.technicals.rsi}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1">
                      <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${stock.technicals.rsi}%` }} />
                    </div>
                    
                    <div className="flex justify-between text-zinc-400 mt-2">
                      <span>MACD Histogram</span>
                      <span className={`font-bold ${stock.technicals.macd.histogram >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stock.technicals.macd.histogram >= 0 ? '+' : ''}{stock.technicals.macd.histogram}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Moving Averages */}
                <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-1">Moving Averages (SMA)</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">20-Day SMA</span>
                      <span className="font-semibold text-zinc-200">₹{stock.technicals.sma20.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">50-Day SMA</span>
                      <span className="font-semibold text-zinc-200">₹{stock.technicals.sma50.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">200-Day SMA</span>
                      <span className="font-semibold text-zinc-200">₹{stock.technicals.sma200.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Supports & Resistances */}
                <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase text-rose-500 tracking-wider mb-2">Resistance Levels</h3>
                    <div className="flex gap-2">
                      {stock.technicals.resistance.map((r: number, idx: number) => (
                        <span key={idx} className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[10px] px-2 py-1 rounded">
                          R{idx+1}: ₹{r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase text-emerald-500 tracking-wider mb-2">Support Levels</h3>
                    <div className="flex gap-2">
                      {stock.technicals.support.map((s: number, idx: number) => (
                        <span key={idx} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] px-2 py-1 rounded">
                          S{idx+1}: ₹{s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'options' && isFO && optionsData && (
            <OptionChain symbol={symbol} optionsData={optionsData} />
          )}

          {activeTab === 'fundamentals' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Ratios Table */}
              <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-zinc-200 mb-4 uppercase tracking-wider">Valuations & Return Ratios</h3>
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between border-b border-zinc-900/60 pb-2">
                    <span className="text-zinc-500">Market Capitalization</span>
                    <span className="font-bold text-zinc-300">₹{stock.fundamentals.marketCap.toLocaleString('en-IN')} Cr</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/60 pb-2">
                    <span className="text-zinc-500">P/E Ratio</span>
                    <span className="font-bold text-zinc-200">{stock.fundamentals.pe}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/60 pb-2">
                    <span className="text-zinc-500">P/B Ratio</span>
                    <span className="font-bold text-zinc-200">{stock.fundamentals.pb}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/60 pb-2">
                    <span className="text-zinc-500">Return on Equity (ROE)</span>
                    <span className="font-bold text-emerald-400">{stock.fundamentals.roe}%</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/60 pb-2">
                    <span className="text-zinc-500">Return on Capital Employed (ROCE)</span>
                    <span className="font-bold text-emerald-400">{stock.fundamentals.roce}%</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-zinc-500">Debt to Equity</span>
                    <span className={`font-bold ${stock.fundamentals.debtToEquity > 1.5 ? 'text-rose-400' : 'text-zinc-250'}`}>
                      {stock.fundamentals.debtToEquity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shareholding & Growth */}
              <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-4 uppercase tracking-wider">Growth Trajectory</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">EPS Growth (YoY)</span>
                      <span className={`font-bold ${stock.fundamentals.epsGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stock.fundamentals.epsGrowth >= 0 ? '+' : ''}{stock.fundamentals.epsGrowth}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Revenue Growth (YoY)</span>
                      <span className={`font-bold ${stock.fundamentals.revenueGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stock.fundamentals.revenueGrowth >= 0 ? '+' : ''}{stock.fundamentals.revenueGrowth}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-900/60 pt-4">
                  <h3 className="text-sm font-bold text-zinc-200 mb-4 uppercase tracking-wider">Ownership details</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Promoter Shareholding</span>
                      <span className="font-bold text-zinc-200">{stock.fundamentals.promoterHolding}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Dividend Yield</span>
                      <span className="font-bold text-cyan-400">{stock.fundamentals.dividendYield}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'news' && newsData && (
            <div className="space-y-6">
              {/* Aggregated sentiment card */}
              <div className="border border-zinc-900 bg-zinc-950/30 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-200">Aggregated News Sentiment</h3>
                  <p className="text-xs text-zinc-500 mt-1">Weighted sentiment score across recent publications.</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white">{newsData.sentiment.score}</span>
                  <span className={`block text-[10px] font-bold px-2 py-0.5 rounded mt-1.5 w-fit ml-auto uppercase ${
                    newsData.sentiment.label === 'Bullish'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : newsData.sentiment.label === 'Bearish'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {newsData.sentiment.label}
                  </span>
                </div>
              </div>

              {/* News list */}
              <div className="space-y-4">
                {newsData.articles.map((item: any) => (
                  <div key={item.id} className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5 space-y-2 transition-all hover:bg-zinc-900/10">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-400">{item.source}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        item.sentiment === 'Bullish'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : item.sentiment === 'Bearish'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {item.sentiment}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-zinc-200 leading-tight">
                      {item.title}
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ai-advisory' && (
            <div className="space-y-6">
              {/* AI Config Header Bar */}
              <div className="border border-zinc-900 bg-gradient-to-r from-zinc-950 via-zinc-900/25 to-zinc-950 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <Cpu className="h-4 w-4 text-cyan-400" />
                    Advisory Synthesis Engine
                  </h3>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <p className="text-[10px] text-zinc-500">
                      Source: {recommendRes?.source || 'Rule Engine'}
                    </p>
                    {lastSynthesizedAt && (
                      <p className="text-[9px] text-cyan-500/70">
                        Last synthesized: {lastSynthesizedAt.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Model Selector dropdown */}
                  <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-850 p-1 rounded-xl text-[10px] font-bold">
                    <span className="text-zinc-500 px-1.5 uppercase text-[8px]">Gemini Model:</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-350 rounded px-2 py-0.5 text-[9px] font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer uppercase"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
                    </select>
                  </div>

                  <button
                    onClick={() => refetchRecommend()}
                    disabled={recommendLoading || isRecommending}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-[10px] rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/10 active:scale-98 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRecommending || recommendLoading ? 'animate-spin' : ''}`} />
                    Re-Synthesize
                  </button>
                </div>
              </div>

              {/* Advisory Details & Skeletons */}
              {recommendLoading ? (
                <div className="space-y-6">
                  {/* Hero Card Skeleton */}
                  <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                    <div className="space-y-2">
                      <div className="h-3 w-24 bg-zinc-800 rounded" />
                      <div className="h-8 w-36 bg-zinc-800 rounded" />
                      <div className="h-5 w-28 bg-zinc-800 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-32 bg-zinc-800 rounded" />
                      <div className="h-4 w-full bg-zinc-800 rounded" />
                      <div className="h-4 w-5/6 bg-zinc-800 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-20 bg-zinc-800 rounded" />
                      <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                      <div className="h-4 w-1/2 bg-zinc-800 rounded" />
                    </div>
                  </div>

                  {/* 3 Columns Skeleton */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 space-y-3 animate-pulse">
                        <div className="h-4 w-36 bg-zinc-850 rounded border-b border-zinc-900 pb-2" />
                        <div className="h-3 w-full bg-zinc-900 rounded" />
                        <div className="h-3 w-full bg-zinc-900 rounded" />
                        <div className="h-3 w-4/5 bg-zinc-900 rounded" />
                        <div className="h-3 w-5/6 bg-zinc-900 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : aiReport ? (() => {
                const pillars = aiReport.pillars || {
                  technical: {
                    trend_bias: aiReport.recommendation === 'Buy' ? 'Bullish' : aiReport.recommendation === 'Avoid' ? 'Bearish' : 'Neutral',
                    summary: aiReport.reasoningSummary?.technicals || 'N/A',
                    key_signals: [],
                    data_quality_issues: [],
                    confidence: aiReport.confidenceScore || 50
                  },
                  fundamental: {
                    valuation_verdict: aiReport.recommendation === 'Buy' ? 'Undervalued' : aiReport.recommendation === 'Avoid' ? 'Overvalued' : 'Fairly Valued',
                    summary: aiReport.reasoningSummary?.fundamentals || 'N/A',
                    strengths: [],
                    concerns: [],
                    confidence: aiReport.confidenceScore || 50
                  },
                  news: {
                    sentiment: aiReport.recommendation === 'Buy' ? 'Positive' : aiReport.recommendation === 'Avoid' ? 'Negative' : 'Mixed',
                    summary: aiReport.reasoningSummary?.newsSentiment || 'N/A',
                    positive_factors: [],
                    negative_factors: [],
                    confidence: aiReport.confidenceScore || 50
                  }
                };

                return (
                  <div className="space-y-6">
                    {/* Hero Card */}
                    <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                      
                      {/* Left column: recommendation */}
                      <div className="flex flex-col space-y-2">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Overall Recommendation</span>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-black tracking-wider ${
                            aiReport.recommendation.includes('Buy')
                              ? 'text-emerald-400'
                              : aiReport.recommendation.includes('Sell')
                              ? 'text-rose-400'
                              : 'text-zinc-300'
                          }`}>
                            {aiReport.recommendation}
                          </span>
                          <span className="text-xs font-semibold text-zinc-400">
                            ({aiReport.confidenceScore || aiReport.confidence}% Conf.)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] bg-zinc-900 text-cyan-400 px-2.5 py-1 rounded-lg font-bold uppercase border border-zinc-850">
                            Horizon: {aiReport.holdingPeriod || aiReport.horizon}
                          </span>
                        </div>
                        {aiReport.dominant_factor && (
                          <span className="text-[9px] text-zinc-500 block mt-1">
                            Dominant Driver: <strong className="text-zinc-400">{aiReport.dominant_factor}</strong>
                          </span>
                        )}
                      </div>

                      {/* Middle column: final synthesis rationale */}
                      <div className="flex flex-col space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                          <Bookmark className="h-3.5 w-3.5 fill-emerald-500/20" />
                          Final Synthesis Rationale
                        </span>
                        <div className="text-xs text-zinc-300 leading-relaxed">
                          {expandRationale ? (
                            <p>{aiReport.rationale || aiReport.reasoningSummary.finalSynthesis}</p>
                          ) : (
                            <p className="line-clamp-2">
                              {aiReport.rationale || aiReport.reasoningSummary.finalSynthesis}
                            </p>
                          )}
                          <button
                            onClick={() => setExpandRationale(!expandRationale)}
                            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 mt-1 focus:outline-none"
                          >
                            {expandRationale ? 'Show Less' : 'Show More'}
                          </button>
                        </div>
                      </div>

                      {/* Right column: risk flags */}
                      <div className="flex flex-col space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Risk Flags ({(aiReport.riskFlags || []).length})
                        </span>
                        <div className="text-xs text-zinc-350 leading-relaxed w-full">
                          {showAllRisks ? (
                            <ul className="list-disc list-inside space-y-1 mt-1 text-[11px] text-zinc-400">
                              {(aiReport.riskFlags || []).map((risk: string, i: number) => (
                                <li key={i}>{risk}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="line-clamp-1 text-zinc-450">
                              {(aiReport.riskFlags || [])[0] || 'No immediate risks identified.'}
                            </p>
                          )}
                          <button
                            onClick={() => setShowAllRisks(!showAllRisks)}
                            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 mt-1 focus:outline-none block"
                          >
                            {showAllRisks ? 'Hide Details' : 'Show Details'}
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Three-column detail grid below the hero card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Column 1: News & Sentiment */}
                      <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center justify-between">
                            <span>News & Sentiment</span>
                            {pillars.news.sentiment && (
                              <span className="text-[9px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400 uppercase font-bold">
                                {pillars.news.sentiment}
                              </span>
                            )}
                          </h4>
                          {pillars.news.failed ? (
                            <div className="text-xs text-rose-400 py-4 text-center bg-rose-500/5 rounded-xl border border-rose-500/10 mt-3">
                              Unable to load news pillar — retry
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-300 leading-relaxed mt-3">
                              {pillars.news.summary}
                            </p>
                          )}
                        </div>
                        {pillars.news.confidence > 0 && (
                          <div className="text-[9px] text-zinc-500 pt-2 border-t border-zinc-900/40 text-left">
                            Pillar Confidence: {pillars.news.confidence}%
                          </div>
                        )}
                      </div>

                      {/* Column 2: Fundamental Valuation */}
                      <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center justify-between">
                            <span>Fundamental Valuation</span>
                            {pillars.fundamental.valuation_verdict && (
                              <span className="text-[9px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400 uppercase font-bold">
                                {pillars.fundamental.valuation_verdict}
                              </span>
                            )}
                          </h4>
                          {pillars.fundamental.failed ? (
                            <div className="text-xs text-rose-400 py-4 text-center bg-rose-500/5 rounded-xl border border-rose-500/10 mt-3">
                              Unable to load fundamental pillar — retry
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-300 leading-relaxed mt-3">
                              {pillars.fundamental.summary}
                            </p>
                          )}
                        </div>
                        {pillars.fundamental.confidence > 0 && (
                          <div className="text-[9px] text-zinc-500 pt-2 border-t border-zinc-900/40 text-left">
                            Pillar Confidence: {pillars.fundamental.confidence}%
                          </div>
                        )}
                      </div>

                      {/* Column 3: Technical Signals */}
                      <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-wider border-b border-zinc-900 pb-2 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span>Technical Signals</span>
                              {pillars.technical.trend_bias && (
                                <span className="text-[9px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400 uppercase font-bold">
                                  {pillars.technical.trend_bias}
                                </span>
                              )}
                            </div>
                            {/* SURFACING DATA INCONSISTENCY ALERT */}
                            {pillars.technical.data_quality_issues && pillars.technical.data_quality_issues.length > 0 && (
                              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Data inconsistency detected
                              </div>
                            )}
                          </h4>
                          {pillars.technical.failed ? (
                            <div className="text-xs text-rose-400 py-4 text-center bg-rose-500/5 rounded-xl border border-rose-500/10 mt-3">
                              Unable to load technical pillar — retry
                            </div>
                          ) : (
                            <div className="space-y-2 mt-3">
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {pillars.technical.summary}
                              </p>
                              {pillars.technical.data_quality_issues && pillars.technical.data_quality_issues.length > 0 && (
                                <div className="bg-zinc-900/60 rounded-xl p-2.5 border border-zinc-850 space-y-1">
                                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Flagged Inconsistencies</span>
                                  <ul className="list-disc list-inside text-[10px] text-amber-400/90 space-y-0.5">
                                    {pillars.technical.data_quality_issues.map((issue: string, idx: number) => (
                                      <li key={idx}>{issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {pillars.technical.confidence > 0 && (
                          <div className="text-[9px] text-zinc-500 pt-2 border-t border-zinc-900/40 text-left">
                            Pillar Confidence: {pillars.technical.confidence}%
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Suggested Trade Setup Card */}
                    <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5 md:p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-900/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                            <Cpu className="h-4 w-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Suggested Trade Setup</h3>
                            <p className="text-[10px] text-zinc-500">AI-generated trade structures based on latest synthesis</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isFO ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {isFO ? 'F&O Eligible (Options + Cash)' : 'Cash Segment Only'}
                        </span>
                      </div>

                      {isFO ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Options Strategy Card */}
                          <div className="border border-zinc-900/80 bg-zinc-950/20 rounded-xl p-4.5 space-y-3.5 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2 border-b border-zinc-900/60 pb-2.5">
                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Option Derivatives Strategy</span>
                                {!aiReport.tradeSetup?.options_strategy?.no_trade_possible && (
                                  <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded font-bold text-emerald-400 uppercase border border-zinc-850">
                                    Win Prob: {aiReport.tradeSetup?.options_strategy?.estimated_win_probability || 0}%
                                  </span>
                                )}
                              </div>

                              {aiReport.tradeSetup?.options_strategy?.no_trade_possible ? (
                                <div className="py-6 px-4 bg-zinc-900/20 rounded-xl border border-zinc-900/60 text-center space-y-2 mt-3">
                                  <AlertTriangle className="h-5 w-5 text-zinc-500 mx-auto" />
                                  <span className="text-xs font-bold text-zinc-400 block uppercase">No Options Trade Suggested</span>
                                  <p className="text-[11px] text-zinc-550 leading-relaxed">
                                    {aiReport.tradeSetup?.options_strategy?.reasoning || 'No suitable setups match current volatility/liquidity parameters.'}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-3 mt-3">
                                  <div>
                                    <h4 className="text-sm font-black text-white">
                                      {aiReport.tradeSetup?.options_strategy?.strategy_name}
                                    </h4>
                                    <span className="text-[10px] text-zinc-500 font-semibold bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                      {aiReport.tradeSetup?.options_strategy?.setup_type}
                                    </span>
                                  </div>

                                  <div className="space-y-1.5 bg-zinc-950/60 rounded-xl p-3 border border-zinc-900/60">
                                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-wider block">Option Legs Configuration</span>
                                    <div className="space-y-1">
                                      {(aiReport.tradeSetup?.options_strategy?.legs || []).map((leg: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-xs font-mono">
                                          <span className={`font-bold ${leg.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {leg.action}
                                          </span>
                                          <span className="text-zinc-300 font-bold">{leg.strike} {leg.option_type}</span>
                                          <span className="text-zinc-500">Ref: ₹{leg.premium_reference}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                                    <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/60">
                                      <span className="text-zinc-500 block">Max Profit Estimate</span>
                                      <span className="font-extrabold text-emerald-400 font-mono">
                                        {aiReport.tradeSetup?.options_strategy?.max_profit_estimate}
                                      </span>
                                    </div>
                                    <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/60">
                                      <span className="text-zinc-500 block">Max Loss Estimate</span>
                                      <span className="font-extrabold text-rose-400 font-mono">
                                        {aiReport.tradeSetup?.options_strategy?.max_loss_estimate}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-[11px] space-y-1">
                                    <span className="text-zinc-550 block font-medium">Breakevens at Expiry:</span>
                                    <div className="font-mono text-amber-500 font-bold">
                                      {(aiReport.tradeSetup?.options_strategy?.breakeven_points || []).join(', ') || 'N/A'}
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-zinc-400 bg-zinc-900/10 p-2.5 rounded-lg border border-zinc-900/40 leading-relaxed">
                                    <span className="text-[9px] text-cyan-400 font-black uppercase tracking-wider block mb-0.5">Strategy Rationale</span>
                                    {aiReport.tradeSetup?.options_strategy?.rationale}
                                  </div>
                                  <button
                                    onClick={() => handleAddFnoDemoTrade(aiReport.tradeSetup.options_strategy)}
                                    className="w-full mt-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-[10px] rounded-lg uppercase transition-all select-none active:scale-98"
                                  >
                                    Add Options to Demo Trade
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Positional Trade Card */}
                          <div className="border border-zinc-900/80 bg-zinc-950/20 rounded-xl p-4.5 space-y-3.5 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2 border-b border-zinc-900/60 pb-2.5">
                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Positional Cash Trade</span>
                                {!aiReport.tradeSetup?.positional_trade?.no_trade_possible && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                    aiReport.tradeSetup?.positional_trade?.direction === 'Long'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}>
                                    {aiReport.tradeSetup?.positional_trade?.direction}
                                  </span>
                                )}
                              </div>

                              {aiReport.tradeSetup?.positional_trade?.no_trade_possible ? (
                                <div className="py-6 px-4 bg-zinc-900/20 rounded-xl border border-zinc-900/60 text-center space-y-2 mt-3">
                                  <AlertTriangle className="h-5 w-5 text-zinc-500 mx-auto" />
                                  <span className="text-xs font-bold text-zinc-400 block uppercase">No Cash Trade Suggested</span>
                                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                                    {aiReport.tradeSetup?.positional_trade?.reasoning || 'Market conditions are not favorable for a positional cash trade.'}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-3 mt-3">
                                  <div className="grid grid-cols-2 gap-2.5 text-[11px] font-mono">
                                    <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/60">
                                      <span className="text-zinc-500 block font-sans">Entry Price</span>
                                      <span className="font-extrabold text-zinc-200">
                                        {aiReport.tradeSetup?.positional_trade?.entry_point}
                                      </span>
                                    </div>
                                    <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/60">
                                      <span className="text-zinc-500 block font-sans">Target Price</span>
                                      <span className="font-extrabold text-emerald-400">
                                        {aiReport.tradeSetup?.positional_trade?.target_price}
                                      </span>
                                    </div>
                                    <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/60">
                                      <span className="text-zinc-500 block font-sans">Stop Loss</span>
                                      <span className="font-extrabold text-rose-400">
                                        {aiReport.tradeSetup?.positional_trade?.stop_loss}
                                      </span>
                                    </div>
                                    <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/60">
                                      <span className="text-zinc-500 block font-sans">Risk to Reward</span>
                                      <span className="font-extrabold text-amber-500">
                                        {aiReport.tradeSetup?.positional_trade?.risk_reward_ratio}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-[11px] space-y-1">
                                    <span className="text-zinc-550 block font-medium">Expected Timeline:</span>
                                    <div className="text-zinc-300 font-bold">
                                      {aiReport.tradeSetup?.positional_trade?.expected_timeline || 'N/A'}
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-zinc-400 bg-zinc-900/10 p-2.5 rounded-lg border border-zinc-900/40 leading-relaxed">
                                    <span className="text-[9px] text-cyan-400 font-black uppercase tracking-wider block mb-0.5">Trade Rationale</span>
                                    {aiReport.tradeSetup?.positional_trade?.rationale}
                                  </div>
                                  <button
                                    onClick={() => handleAddPositionalDemoTrade(aiReport.tradeSetup.positional_trade)}
                                    className="w-full mt-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-[10px] rounded-lg uppercase transition-all select-none active:scale-98"
                                  >
                                    Add Position to Demo Trade
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Non-F&O Eligible (Single Cash Positional Card) */
                        <div className="border border-zinc-900/80 bg-zinc-950/20 rounded-xl p-5 space-y-4">
                          <div className="flex items-center justify-between gap-2 border-b border-zinc-900/60 pb-2.5">
                            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Positional Cash Trade Setup</span>
                            {!aiReport.tradeSetup?.no_trade_possible && (
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                aiReport.tradeSetup?.direction === 'Long'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {aiReport.tradeSetup?.direction}
                              </span>
                            )}
                          </div>

                          {aiReport.tradeSetup?.no_trade_possible ? (
                            <div className="py-8 px-4 bg-zinc-900/20 rounded-xl border border-zinc-900/60 text-center space-y-2">
                              <AlertTriangle className="h-5 w-5 text-zinc-500 mx-auto" />
                              <span className="text-xs font-bold text-zinc-400 block uppercase">No Trade Suggested</span>
                              <p className="text-[11px] text-zinc-500 leading-relaxed">
                                {aiReport.tradeSetup?.reasoning || 'Current setups do not offer high-probability risk-to-reward opportunities.'}
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                  <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-900/60">
                                    <span className="text-zinc-550 block font-sans text-[10px]">Entry Price</span>
                                    <span className="font-extrabold text-zinc-200 text-sm">
                                      {aiReport.tradeSetup?.entry_point}
                                    </span>
                                  </div>
                                  <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-900/60">
                                    <span className="text-zinc-550 block font-sans text-[10px]">Target Price</span>
                                    <span className="font-extrabold text-emerald-400 text-sm">
                                      {aiReport.tradeSetup?.target_price}
                                    </span>
                                    <span className="text-[9px] text-emerald-505 block font-sans mt-0.5 font-bold">
                                      ({aiReport.tradeSetup?.expected_profit_percent})
                                    </span>
                                  </div>
                                  <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-900/60">
                                    <span className="text-zinc-550 block font-sans text-[10px]">Stop Loss</span>
                                    <span className="font-extrabold text-rose-400 text-sm">
                                      {aiReport.tradeSetup?.stop_loss}
                                    </span>
                                    <span className="text-[9px] text-rose-505 block font-sans mt-0.5 font-bold">
                                      ({aiReport.tradeSetup?.stop_loss_percent})
                                    </span>
                                  </div>
                                  <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-900/60">
                                    <span className="text-zinc-550 block font-sans text-[10px]">Risk to Reward</span>
                                    <span className="font-extrabold text-amber-500 text-sm">
                                      {aiReport.tradeSetup?.risk_reward_ratio}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-xs space-y-1">
                                  <span className="text-zinc-550 block font-medium">Expected Timeline:</span>
                                  <div className="text-zinc-300 font-bold">
                                    {aiReport.tradeSetup?.expected_timeline || 'N/A'}
                                  </div>
                                </div>
                              </div>

                              <div className="bg-zinc-900/15 p-4 rounded-xl border border-zinc-900/60 flex flex-col justify-between">
                                <div className="text-xs text-zinc-400 leading-relaxed">
                                  <span className="text-[10px] text-cyan-400 font-black uppercase tracking-wider block mb-1">Trade Rationale</span>
                                  {aiReport.tradeSetup?.rationale}
                                </div>
                                <button
                                  onClick={() => handleAddPositionalDemoTrade(aiReport.tradeSetup)}
                                  className="w-full mt-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-[10px] rounded-lg uppercase transition-all select-none active:scale-98"
                                >
                                  Add to Demo Trade
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Static Disclaimer */}
                      <p className="text-[9px] text-zinc-500 italic text-center leading-normal pt-2 border-t border-zinc-900/40">
                        *AI-generated trade setup for informational purposes only. Options and equity trading involve high risk. Verify strikes, liquidity, and pricing before executing any trade.*
                      </p>
                    </div>

                  </div>
                );
              })() : (
                <div className="border border-rose-500/10 bg-rose-500/5/20 rounded-2xl p-6 text-center space-y-3">
                  <AlertTriangle className="h-6 w-6 text-rose-400 mx-auto" />
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Synthesis Engine Unavailable</h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    {recommendRes?.error || 'Unable to load AI advisory report. Check network connection or configuration.'}
                  </p>
                  <button
                    onClick={() => refetchRecommend()}
                    className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-xs font-bold uppercase transition-colors"
                  >
                    Retry Request
                  </button>
                </div>
              )}

              {/* Technical indicators and Chart Patterns Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Column 1: Technical Indicator Summary */}
                <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 space-y-4">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Trend & Momentum</span>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Technical Trend</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      stock.technicals.trend.includes('Bullish')
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : stock.technicals.trend.includes('Bearish')
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-850'
                    }`}>
                      {stock.technicals.trend}
                    </span>
                  </div>

                  <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-455">RSI (14)</span>
                      <span className={`font-mono font-bold ${
                        stock.technicals.rsi > 70 ? 'text-amber-500' : stock.technicals.rsi < 30 ? 'text-cyan-400' : 'text-zinc-300'
                      }`}>
                        {stock.technicals.rsi}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1">
                      <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${stock.technicals.rsi}%` }} />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs border-t border-zinc-900/60 pt-3">
                    <span className="text-zinc-455">MACD Histogram</span>
                    <span className={`font-mono font-bold ${stock.technicals.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stock.technicals.macd.histogram >= 0 ? '+' : ''}{stock.technicals.macd.histogram}
                    </span>
                  </div>

                  <div className="space-y-2.5 border-t border-zinc-900/60 pt-3 text-xs">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block -mb-1">Moving Averages</span>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-455 font-medium">SMA 20 (Short)</span>
                      <span className={`font-mono font-bold ${stock.price >= stock.technicals.sma20 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ₹{stock.technicals.sma20.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-455 font-medium">SMA 50 (Mid)</span>
                      <span className={`font-mono font-bold ${stock.price >= stock.technicals.sma50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ₹{stock.technicals.sma50.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-zinc-900/60 pt-3 text-xs">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block -mb-1">Pivot S&R Levels</span>
                    <div className="flex justify-between items-center">
                      <span className="text-rose-455 text-[10px] font-bold">R1 Resistance</span>
                      <span className="font-mono font-bold text-zinc-350">₹{stock.technicals.resistance[0].toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center bg-cyan-950/20 border border-cyan-500/20 rounded p-1.5 text-[10px]">
                      <span className="text-cyan-400 font-extrabold uppercase">Spot Price</span>
                      <span className="font-mono font-black text-cyan-400">₹{stock.price.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-455 text-[10px] font-bold">S1 Support</span>
                      <span className="font-mono font-bold text-zinc-350">₹{stock.technicals.support[0].toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Columns 2-3: AI Pattern Analyzer */}
                <div className="lg:col-span-2 border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  
                  {/* Header & Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900/60 pb-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">AI Chart Pattern Analysis</span>
                      <h4 className="text-xs font-bold text-zinc-200 mt-1 uppercase">Detected Formations</h4>
                    </div>

                    {/* Pattern selection buttons */}
                    <div className="flex bg-zinc-905 border border-zinc-850 rounded-lg p-0.5 self-start text-[10px] font-bold">
                      {detectedPatterns.map(pat => {
                        const nameLabel = pat.id === 'flag' ? 'Flag' : pat.id === 'triangle' ? 'Triangle' : 'Double Bottom';
                        return (
                          <button
                            key={pat.id}
                            onClick={() => setSelectedPattern(pat.id as any)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                              selectedPattern === pat.id
                                ? 'bg-zinc-800 text-cyan-400 font-bold border border-zinc-750'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {nameLabel} ({pat.timeframe})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pattern Info and Chart Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch flex-1">
                    
                    {/* Pattern Details Panel */}
                    <div className="md:col-span-5 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-white">{patternInfo.name}</span>
                          <span className={`px-1.5 py-0.5 border rounded text-[9px] font-bold uppercase whitespace-nowrap ${patternInfo.statusColor}`}>
                            {patternInfo.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                          {patternInfo.desc}
                        </p>
                      </div>

                      <div className="bg-zinc-900/40 border border-zinc-900/60 rounded-xl p-3 space-y-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-medium">Pattern Timeframe:</span>
                          <span className="font-bold text-zinc-350">{patternInfo.timeframe}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-medium">Detection Confidence:</span>
                          <span className="font-bold text-cyan-400">{patternInfo.confidence}</span>
                        </div>
                        <div className="border-t border-zinc-900/40 my-1 pt-1 flex justify-between">
                          <span className="text-zinc-500 font-medium">Breakout Target:</span>
                          <span className="font-bold text-emerald-400">₹{patternInfo.target.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-medium">Pattern Stop Loss:</span>
                          <span className="font-bold text-rose-400">₹{patternInfo.stopLoss.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mini Pattern Chart Container */}
                    <div className="md:col-span-7 border border-zinc-900 bg-zinc-950/40 rounded-xl p-2 relative h-full min-h-[220px] flex flex-col justify-center">
                      <PatternChart data={chartData} patternLines={patternLines} />
                    </div>

                  </div>
                </div>

              </div>

              {/* Options Strategy Planner */}
              {isFO && (
                <StrategyPlanner
                  symbol={symbol}
                  spotPrice={stock.price}
                  optionsData={optionsData}
                  aiRecommendation={aiReport?.recommendation}
                  aiOptionsStrategy={aiReport?.tradeSetup?.options_strategy}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal Dialogues for placing trade */}
      {showPosModal && posModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Cpu className="h-4.5 w-4.5 text-cyan-400" />
              Confirm Demo Trade Placement
            </h3>
            <p className="text-[10px] text-zinc-500 mb-4 uppercase">AI Suggested Positional Setup</p>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-855">
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Symbol</span>
                  <span className="font-bold text-zinc-200">{posModalData.symbol}</span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-855">
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Direction</span>
                  <span className={`font-bold uppercase ${posModalData.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {posModalData.direction}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Entry Price (₹)</label>
                <input
                  type="number"
                  value={posEntryPrice}
                  onChange={(e) => setPosEntryPrice(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-lg p-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Quantity</label>
                <input
                  type="number"
                  value={posQuantity}
                  onChange={(e) => setPosQuantity(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-lg p-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono bg-zinc-900/30 p-3 rounded-lg border border-zinc-900">
                <div>
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Target Price</span>
                  <span className="font-bold text-emerald-400">₹{posModalData.target_price || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Stop Loss</span>
                  <span className="font-bold text-rose-400">₹{posModalData.stop_loss || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPosModal(false)}
                className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold text-xs uppercase rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPosDemoTrade}
                className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs uppercase rounded-xl transition-all shadow-md shadow-cyan-500/10"
              >
                Confirm Trade
              </button>
            </div>
          </div>
        </div>
      )}

      {showFnoModal && fnoModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative my-8">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="h-4.5 w-4.5 text-cyan-400" />
              Confirm Option Strategy Demo Trade
            </h3>
            <p className="text-[10px] text-zinc-500 mb-4 uppercase">AI Suggested F&O Strategy Playbook</p>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-855">
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Symbol</span>
                  <span className="font-bold text-zinc-200">{fnoModalData.symbol}</span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-855">
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Strategy</span>
                  <span className="font-bold text-zinc-200">{fnoModalData.strategy_name}</span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-855">
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Expiry</span>
                  <span className="font-bold text-zinc-200">{fnoModalData.expiry_date}</span>
                </div>
              </div>

              {/* Legs configuration details */}
              <div className="border border-zinc-900 rounded-xl overflow-hidden">
                <div className="bg-zinc-900/50 px-3 py-1.5 border-b border-zinc-900 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Option Legs (Edit Lots)
                </div>
                <div className="divide-y divide-zinc-900 max-h-56 overflow-y-auto">
                  {fnoModalData.legs.map((leg: any, idx: number) => (
                    <div key={idx} className="p-3 bg-zinc-950/20 flex items-center justify-between gap-4 font-mono">
                      <div>
                        <span className={`font-bold mr-2 ${leg.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {leg.action}
                        </span>
                        <span className="text-zinc-200 font-bold">{leg.strike} {leg.option_type}</span>
                        <span className="text-zinc-500 ml-2 block text-[9px] font-sans uppercase">
                          Ref Premium: ₹{leg.premium_reference}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] text-zinc-500 font-sans uppercase">Fill Premium (LTP)</span>
                          <span className="font-bold text-zinc-300">
                            ₹{refreshingFno ? '...' : (fnoLegPremiums[idx] || leg.premium_reference)}
                          </span>
                        </div>
                        <div className="w-16">
                          <span className="text-[8px] text-zinc-500 font-sans uppercase block mb-0.5">Lots</span>
                          <input
                            type="number"
                            min="1"
                            value={fnoLegLots[idx] || 1}
                            onChange={(e) => setFnoLegLots({ ...fnoLegLots, [idx]: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-center font-bold text-zinc-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {refreshingFno && (
                <div className="text-[10px] text-cyan-400 flex items-center gap-1 font-semibold uppercase animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Refreshing option chain premiums to live fill prices...
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 font-mono bg-zinc-900/30 p-3 rounded-lg border border-zinc-900">
                <div>
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Max Profit Estimate</span>
                  <span className="font-bold text-emerald-400">{fnoModalData.max_profit_estimate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Max Loss Estimate</span>
                  <span className="font-bold text-rose-400">{fnoModalData.max_loss_estimate || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowFnoModal(false)}
                className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold text-xs uppercase rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFnoDemoTrade}
                disabled={refreshingFno}
                className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs uppercase rounded-xl transition-all shadow-md shadow-cyan-500/10 disabled:opacity-50"
              >
                Confirm Strategy
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            <span className="text-xs font-bold tracking-wide">{toast.message}</span>
            <button onClick={() => setToast(null)} className="hover:opacity-85 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
