'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { useAppStore } from '@/store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Search,
  ChevronRight,
  Zap,
  Sparkles,
  Award,
  Star,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const { setSelectedSymbol, watchlist, toggleWatchlist } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'F&O' | 'CASH' | 'LONG_BUILDUP' | 'SHORT_BUILDUP'>('ALL');

  // Fetch all stocks
  const { data: stocksRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['stocks'],
    queryFn: async () => {
      const res = await fetch('/api/stocks');
      return res.json();
    },
    refetchInterval: 15000, // Refresh every 15s
  });

  const stocks = stocksRes?.success ? stocksRes.data : [];

  // Filter stocks based on selected tabs and search queries
  const filteredStocks = stocks.filter((stock: any) => {
    const matchesSearch =
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.sector.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeCategory === 'F&O') return stock.category === 'F&O';
    if (activeCategory === 'CASH') return stock.category === 'Cash';
    if (activeCategory === 'LONG_BUILDUP') return stock.buildupType === 'Long Buildup';
    if (activeCategory === 'SHORT_BUILDUP') return stock.buildupType === 'Short Buildup';

    return true;
  });

  // Calculate sector sentiment
  const sectors = Array.from(new Set(stocks.map((s: any) => s.sector))) as string[];
  const sectorData = sectors.map(sector => {
    const sectorStocks = stocks.filter((s: any) => s.sector === sector);
    const avgChange = sectorStocks.reduce((acc: number, curr: any) => acc + curr.changePercent, 0) / sectorStocks.length;
    return {
      name: sector,
      avgChange: Number(avgChange.toFixed(2)),
      count: sectorStocks.length
    };
  }).sort((a, b) => b.avgChange - a.avgChange);

  // Generate simulated recommendations for key F&O / High-volume cash stocks
  const topRecommendations = stocks
    .filter((s: any) => ['RELIANCE', 'TCS', 'HDFCBANK', 'ZOMATO', 'SUZLON'].includes(s.symbol))
    .map((s: any) => {
      // Create quick recommendation states
      let recommendation: 'BUY' | 'SELL' | 'HOLD' | 'AVOID' = 'HOLD';
      let score = 70;
      let target = '2-4 Weeks';
      let rationale = '';

      if (s.symbol === 'RELIANCE') {
        recommendation = 'BUY';
        score = 85;
        target = '1-2 Months';
        rationale = 'Technicals breaking out of 6-month consolidation. OI build-up indicates strong long addition.';
      } else if (s.symbol === 'TCS') {
        recommendation = 'BUY';
        score = 80;
        target = '2-4 Weeks';
        rationale = 'Strong cloud deal pipeline expansion coupled with reversal at the 200-SMA support.';
      } else if (s.symbol === 'HDFCBANK') {
        recommendation = 'HOLD';
        score = 65;
        target = '3-6 Weeks';
        rationale = 'Balanced credit-to-deposit adjustments. Trading near key moving averages.';
      } else if (s.symbol === 'ZOMATO') {
        recommendation = 'BUY';
        score = 92;
        target = '3-6 Months';
        rationale = 'Quick commerce gross order values doubling. Structural growth momentum remains high.';
      } else if (s.symbol === 'SUZLON') {
        recommendation = 'BUY';
        score = 78;
        target = '3-6 Months';
        rationale = 'Wind contract orderbook pipeline secures cash flow visibility. Extreme breakout momentum.';
      }

      return {
        ...s,
        recommendation,
        score,
        target,
        rationale
      };
    });

  const handleStockSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    router.push(`/stock/${symbol}`);
  };

  const getBuildupBadgeClass = (buildup?: string) => {
    switch (buildup) {
      case 'Long Buildup':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Short Buildup':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Long Unwinding':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Short Covering':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-zinc-800/50 text-zinc-400 border-transparent';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header />

      {/* Main Container */}
      <main className="flex-1 px-4 py-6 md:px-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Banner Section */}
        <section className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 md:p-8">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-72 w-72 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                <Sparkles className="h-3.5 w-3.5" />
                Next-Gen Option Chain & Advisory
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                Advisory Platform for Cash & F&O Positions
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Unlock multi-LLM synthesised analysis. Real-time open interest (OI) dynamics, Put-Call ratios, Max Pain tracking, and automated options strategy suggestions built to optimize your position setups.
              </p>
            </div>
            
            <button
              onClick={() => handleStockSelect('RELIANCE')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-5 py-3 text-sm font-semibold text-black font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-98 transition-all w-fit self-start md:self-auto"
            >
              <Zap className="h-4 w-4 fill-black" />
              Analyze Reliance Options
            </button>
          </div>
        </section>

        {/* Top Recommendations Carousel/Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 text-zinc-200">
              <Award className="h-5 w-5 text-cyan-400" />
              Top AI Trading Picks
            </h2>
            <button 
              onClick={() => refetch()} 
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              disabled={isLoading || isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl border border-zinc-900 bg-zinc-950/40 animate-pulse" />
              ))
            ) : (
              topRecommendations.map((rec: any) => (
                <div
                  key={rec.symbol}
                  onClick={() => handleStockSelect(rec.symbol)}
                  className="glass-panel glass-panel-hover rounded-xl p-5 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[200px]"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-extrabold text-white text-base tracking-tight">{rec.symbol}</span>
                        <span className="block text-[10px] text-zinc-500 truncate max-w-[150px]">{rec.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                          rec.recommendation === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : rec.recommendation === 'SELL'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {rec.recommendation}
                        </span>
                        <span className="text-zinc-500 text-xs font-semibold">
                          {rec.score}% Conf.
                        </span>
                      </div>
                    </div>

                    {/* Price and change */}
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-xl font-bold text-zinc-100">₹{rec.price.toLocaleString('en-IN')}</span>
                      <span className={`text-xs font-semibold ${rec.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {rec.change >= 0 ? '+' : ''}{rec.changePercent}%
                      </span>
                    </div>

                    {/* Rationale */}
                    <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                      {rec.rationale}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-zinc-900/60 pt-3 mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Target: <span className="text-zinc-300 font-semibold">{rec.target}</span></span>
                    <span className="flex items-center text-cyan-400 font-semibold group/link">
                      Analyze
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Sector Heatmap & Watchlist Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sector Map */}
          <section className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-zinc-200">Sector Performance Sentiment</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg border border-zinc-900 bg-zinc-950/40 animate-pulse" />
                ))
              ) : (
                sectorData.map(sector => (
                  <div
                    key={sector.name}
                    className="border border-zinc-900 bg-zinc-950/30 rounded-lg p-3 flex flex-col justify-between h-20 transition-all hover:bg-zinc-900/20"
                  >
                    <span className="text-xs font-semibold text-zinc-400 truncate">{sector.name}</span>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-zinc-600 font-medium">{sector.count} Stocks</span>
                      <span className={`text-xs font-bold ${sector.avgChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {sector.avgChange >= 0 ? '+' : ''}{sector.avgChange}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Watchlist Quick Overview */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-zinc-200 flex items-center gap-1.5">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              Watchlist
            </h2>
            <div className="border border-zinc-900 bg-zinc-950/20 rounded-xl p-4 space-y-3 max-h-[260px] overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-zinc-900/30 animate-pulse" />
                ))
              ) : stocks.filter((s: any) => watchlist.includes(s.symbol)).length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  No stocks in watchlist. Add stocks from the screener.
                </div>
              ) : (
                stocks
                  .filter((s: any) => watchlist.includes(s.symbol))
                  .map((stock: any) => (
                    <div
                      key={stock.symbol}
                      className="flex items-center justify-between border-b border-zinc-900/40 pb-2 last:border-0 last:pb-0 cursor-pointer group"
                    >
                      <div onClick={() => handleStockSelect(stock.symbol)} className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-zinc-200 group-hover:text-cyan-400 transition-colors uppercase">
                            {stock.symbol}
                          </span>
                          <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1 rounded uppercase font-medium">
                            {stock.category}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 truncate block max-w-[120px]">{stock.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-bold text-xs text-zinc-300">₹{stock.price}</span>
                          <span className={`block text-[10px] font-medium ${stock.changePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent}%
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(stock.symbol);
                          }}
                          className="text-amber-500 hover:text-zinc-600 transition-colors"
                        >
                          <Star className="h-3.5 w-3.5 fill-amber-500" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </section>
        </div>

        {/* Screener & Scanner Table */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-200">Market Screener & Scanner</h2>
              <p className="text-xs text-zinc-500">Search and sort derivative buildups and prices across equities.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search symbol, sector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs rounded-lg pl-9 pr-4 py-2 w-full focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                {(['ALL', 'F&O', 'CASH', 'LONG_BUILDUP', 'SHORT_BUILDUP'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                      activeCategory === cat
                        ? 'bg-zinc-800 text-cyan-400 font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Screener Table */}
          <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/80 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    <th className="py-3 px-4 w-10"></th>
                    <th className="py-3 px-4">Symbol</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-right">Change %</th>
                    <th className="py-3 px-4 text-right">F&O OI</th>
                    <th className="py-3 px-4 text-right">OI Chg %</th>
                    <th className="py-3 px-4 text-center">Buildup Profile</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/40 text-xs">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse h-12">
                        <td colSpan={9} className="py-3 px-4 bg-zinc-950/20" />
                      </tr>
                    ))
                  ) : filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-500 text-xs">
                        No stocks matched the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((stock: any) => {
                      const isWatchlisted = watchlist.includes(stock.symbol);
                      return (
                        <tr
                          key={stock.symbol}
                          onClick={() => handleStockSelect(stock.symbol)}
                          className="hover:bg-zinc-900/30 cursor-pointer transition-all border-b border-zinc-900/20 group"
                        >
                          {/* Watchlist toggle */}
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => toggleWatchlist(stock.symbol)}
                              className={`transition-colors ${isWatchlisted ? 'text-amber-500 hover:text-amber-600' : 'text-zinc-700 hover:text-zinc-400'}`}
                            >
                              <Star className={`h-4.5 w-4.5 ${isWatchlisted ? 'fill-amber-500' : ''}`} />
                            </button>
                          </td>

                          {/* Symbol & Name */}
                          <td className="py-3 px-4 font-semibold text-zinc-200">
                            <div className="flex items-center gap-1.5">
                              <span className="group-hover:text-cyan-400 transition-colors uppercase">{stock.symbol}</span>
                              <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 rounded-sm uppercase font-bold">
                                {stock.category}
                              </span>
                            </div>
                            <span className="block text-[10px] text-zinc-500 font-normal truncate max-w-[150px]">
                              {stock.name}
                            </span>
                          </td>

                          {/* Sector */}
                          <td className="py-3 px-4 text-zinc-400 font-medium">{stock.sector}</td>

                          {/* Price */}
                          <td className="py-3 px-4 text-right font-bold text-zinc-100">
                            ₹{stock.price.toLocaleString('en-IN')}
                          </td>

                          {/* Change Percent */}
                          <td className={`py-3 px-4 text-right font-bold ${stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {stock.change >= 0 ? '+' : ''}{stock.changePercent}%
                          </td>

                          {/* Open Interest */}
                          <td className="py-3 px-4 text-right font-medium text-zinc-400">
                            {stock.oi ? stock.oi.toLocaleString('en-IN') : '-'}
                          </td>

                          {/* OI Change % */}
                          <td className={`py-3 px-4 text-right font-semibold ${
                            !stock.oiChangePercent
                              ? 'text-zinc-500'
                              : stock.oiChangePercent >= 0
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          }`}>
                            {stock.oiChangePercent ? `${stock.oiChangePercent >= 0 ? '+' : ''}${stock.oiChangePercent}%` : '-'}
                          </td>

                          {/* Buildup Badge */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase border ${getBuildupBadgeClass(stock.buildupType)}`}>
                              {stock.buildupType || 'Neutral'}
                            </span>
                          </td>

                          {/* Action Arrow */}
                          <td className="py-3 px-4 text-right text-zinc-600 group-hover:text-cyan-400 transition-colors">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex items-center gap-2 justify-end text-[10px] text-zinc-500 border border-zinc-900 bg-zinc-950/20 p-3 rounded-xl">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500/80" />
            <span>Disclaimer: Advisory outcomes are generated by simulated logic / LLMs and do not represent SEBI-registered investment suggestions. Verify options positioning independently.</span>
          </div>
        </section>
      </main>
    </div>
  );
}
