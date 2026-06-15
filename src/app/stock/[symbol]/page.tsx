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
  Bookmark
} from 'lucide-react';

export default function StockDetail() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const symbol = (params.symbol as string)?.toUpperCase();

  const { watchlist, toggleWatchlist, timeframe, setTimeframe } = useAppStore();
  const isWatchlisted = watchlist.includes(symbol);

  // Read URL search params to set active tab if present
  const defaultTab = searchParams.get('tab') || 'chart';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [showAiDetails, setShowAiDetails] = useState<boolean>(false);
  const [selectedPattern, setSelectedPattern] = useState<'flag' | 'triangle' | 'double_bottom'>('flag');

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
    queryKey: ['recommend', symbol],
    queryFn: async () => {
      const res = await fetch(`/api/recommend?symbol=${symbol}`);
      return res.json();
    },
    enabled: !!symbol
  });

  const stock = quoteRes?.success ? quoteRes.data.stock : null;
  const chartData = quoteRes?.success ? quoteRes.data.chart : null;
  const optionsData = optionsRes?.success ? optionsRes.data : null;
  const newsData = newsRes?.success ? newsRes.data : null;
  const aiReport = recommendRes?.success ? recommendRes.data : null;

  // Dynamic Pattern line calculation (placed unconditionally)
  const patternLines = useMemo(() => {
    if (!chartData || chartData.length < 20) return null;
    
    const count = chartData.length;
    const startIndex = Math.max(0, count - 18);
    const endIndex = count - 1;
    
    const upper: { time: string; value: number }[] = [];
    const lower: { time: string; value: number }[] = [];
    
    if (selectedPattern === 'flag') {
      const startPrice = chartData[startIndex].high;
      const slope = -(startPrice * 0.0015);
      
      for (let i = startIndex; i <= endIndex; i++) {
        const t = chartData[i].time;
        if (i <= endIndex - 2) {
          const valUpper = startPrice + (i - startIndex) * slope;
          const valLower = valUpper - (startPrice * 0.012);
          upper.push({ time: t, value: Number(valUpper.toFixed(2)) });
          lower.push({ time: t, value: Number(valLower.toFixed(2)) });
        }
      }
    } else if (selectedPattern === 'triangle') {
      const startPrice = chartData[startIndex].low;
      const resistanceVal = chartData[startIndex].high * 1.006;
      const step = (resistanceVal * 0.995 - startPrice) / 15;
      
      for (let i = startIndex; i <= endIndex; i++) {
        const t = chartData[i].time;
        if (i <= endIndex - 3) {
          upper.push({ time: t, value: Number(resistanceVal.toFixed(2)) });
          const valLower = startPrice + (i - startIndex) * step;
          lower.push({ time: t, value: Number(valLower.toFixed(2)) });
        }
      }
    } else if (selectedPattern === 'double_bottom') {
      const necklineVal = chartData[startIndex].high * 1.002;
      for (let i = startIndex; i <= endIndex - 2; i++) {
        const t = chartData[i].time;
        upper.push({ time: t, value: Number(necklineVal.toFixed(2)) });
      }
    }
    
    return { upper, lower };
  }, [selectedPattern, chartData]);

  const patternInfo = useMemo(() => {
    const price = stock?.price || 100;
    if (selectedPattern === 'flag') {
      return {
        name: 'Bullish Flag Pattern',
        timeframe: '1-Hour',
        confidence: '86%',
        status: 'Active Breakout',
        statusColor: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
        target: Math.round(price * 1.06),
        stopLoss: Math.round(price * 0.97),
        desc: 'A brief consolidation period sloping downwards followed by a strong breakout candle, confirming standard continuation of upward trend.'
      };
    } else if (selectedPattern === 'triangle') {
      return {
        name: 'Ascending Triangle',
        timeframe: '15-Min',
        confidence: '78%',
        status: 'Forming (Breakout pending)',
        statusColor: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
        target: Math.round(price * 1.045),
        stopLoss: Math.round(price * 0.98),
        desc: 'A flat resistance line meeting an ascending support trendline. Breakout is expected if price breaches the horizontal overhead resistance.'
      };
    } else {
      return {
        name: 'Double Bottom Reversal',
        timeframe: 'Daily',
        confidence: '82%',
        status: 'Neckline Broken (Bullish Reversal)',
        statusColor: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
        target: Math.round(price * 1.075),
        stopLoss: Math.round(price * 0.96),
        desc: 'Two consecutive valleys formed at similar price levels, capped by a middle peak neckline. The breach of the neckline confirms a trend reversal.'
      };
    }
  }, [selectedPattern, stock?.price]);

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
              {/* Advisory Details */}
              {recommendLoading ? (
                <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 text-cyan-500 animate-spin" />
                  <span className="text-xs text-zinc-400">Synthesizing multi-LLM advisory analysis...</span>
                </div>
              ) : aiReport ? (
                <div className="space-y-4">
                  {/* Glassmorphic horizontal AI strip */}
                  <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    
                    {/* Col 1: Recommendation Badge & Horizon */}
                    <div className="md:col-span-3 flex flex-col items-center md:items-start text-center md:text-left justify-center border-b md:border-b-0 md:border-r border-zinc-900/60 pb-3 md:pb-0 md:pr-4">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">AI Advisory Suggestion</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-2xl font-black tracking-wider ${
                          aiReport.recommendation === 'Buy'
                            ? 'text-emerald-400'
                            : aiReport.recommendation === 'Sell'
                            ? 'text-rose-400'
                            : 'text-zinc-300'
                        }`}>
                          {aiReport.recommendation.toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-zinc-400">
                          ({aiReport.confidenceScore}% Conf.)
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] bg-zinc-900 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase">
                          Horizon: {aiReport.holdingPeriod}
                        </span>
                      </div>
                    </div>

                    {/* Col 2: Final Synthesis Rationale */}
                    <div className="md:col-span-5 flex flex-col justify-center border-b md:border-b-0 md:border-r border-zinc-900/60 pb-3 md:pb-0 md:px-4">
                      <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1 mb-1">
                        <Bookmark className="h-3 w-3 fill-emerald-500/20" />
                        Final Synthesis Rationale
                      </span>
                      <p className="text-xs text-zinc-300 leading-relaxed font-medium line-clamp-2">
                        {aiReport.reasoningSummary.finalSynthesis}
                      </p>
                    </div>

                    {/* Col 3: Identified Risks Pill-list */}
                    <div className="md:col-span-2 flex flex-col justify-center border-b md:border-b-0 md:border-r border-zinc-900/60 pb-3 md:pb-0 md:px-4">
                      <span className="text-[9px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Risk Flags ({aiReport.riskFlags.length})
                      </span>
                      <div className="text-[10px] text-zinc-400 leading-snug font-medium line-clamp-2">
                        {aiReport.riskFlags.join(', ')}
                      </div>
                    </div>

                    {/* Col 4: Action buttons */}
                    <div className="md:col-span-2 flex flex-row md:flex-col gap-2 justify-center pl-2">
                      <button
                        onClick={() => setShowAiDetails(!showAiDetails)}
                        className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all text-center flex items-center justify-center gap-1 ${
                          showAiDetails
                            ? 'bg-zinc-800 border-zinc-700 text-white'
                            : 'bg-zinc-900/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                      >
                        {showAiDetails ? 'Hide Details' : 'Show Details'}
                      </button>
                      <button
                        onClick={() => refetchRecommend()}
                        disabled={recommendLoading || isRecommending}
                        className="flex-1 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-[10px] rounded-lg flex items-center justify-center gap-1.5 transition-all shadow shadow-cyan-500/10 active:scale-98"
                      >
                        <RefreshCw className={`h-3 w-3 ${isRecommending ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>

                  </div>

                  {/* Expandable detailed factor breakdown */}
                  {showAiDetails && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="border-r border-zinc-900/60 pr-4 last:border-0">
                        <h4 className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider mb-1">
                          News & Sentiment
                        </h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {aiReport.reasoningSummary.newsSentiment}
                        </p>
                      </div>
                      <div className="border-r border-zinc-900/60 px-2 md:px-4 last:border-0">
                        <h4 className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider mb-1">
                          Fundamental Valuation
                        </h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {aiReport.reasoningSummary.fundamentals}
                        </p>
                      </div>
                      <div className="px-2 md:pl-4">
                        <h4 className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider mb-1">
                          Technical Signals
                        </h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {aiReport.reasoningSummary.technicals}
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              ) : null}

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
                      {[
                        { id: 'flag', label: 'Flag (1H)' },
                        { id: 'triangle', label: 'Triangle (15M)' },
                        { id: 'double_bottom', label: 'Double Bottom (Daily)' }
                      ].map(pat => (
                        <button
                          key={pat.id}
                          onClick={() => setSelectedPattern(pat.id as any)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                            selectedPattern === pat.id
                              ? 'bg-zinc-800 text-cyan-400 font-bold border border-zinc-750'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {pat.label}
                        </button>
                      ))}
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
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
