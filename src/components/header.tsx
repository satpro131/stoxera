'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingUp, Compass, Award, Star, Search } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedSymbol, setSelectedSymbol, watchlist } = useAppStore();

  // Fetch stocks to display index rates in the header ticker
  const { data: stocksRes } = useQuery({
    queryKey: ['stocks'],
    queryFn: async () => {
      const res = await fetch('/api/stocks');
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  const stocks = stocksRes?.success ? stocksRes.data : [];
  const indices = stocks.filter((s: any) => s.sector === 'Indices');
  const watchlistedStocks = stocks.filter((s: any) => watchlist.includes(s.symbol));

  const handleStockClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    router.push(`/stock/${symbol}`);
  };

  return (
    <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
      {/* Index Quotes Bar */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-900 px-4 text-xs">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
          <span className="flex items-center gap-1.5 font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Market
          </span>
          {indices.map((idx: any) => (
            <div
              key={idx.symbol}
              onClick={() => handleStockClick(idx.symbol)}
              className="flex items-center gap-2 cursor-pointer hover:bg-zinc-900 px-2 py-0.5 rounded transition-all"
            >
              <span className="font-medium text-zinc-300">{idx.name.replace(' Index', '')}</span>
              <span className="font-semibold">₹{idx.price.toLocaleString('en-IN')}</span>
              <span className={`font-medium ${idx.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {idx.change >= 0 ? '+' : ''}{idx.changePercent}%
              </span>
            </div>
          ))}
        </div>

        {/* Global Markets/Status */}
        <div className="hidden md:flex items-center gap-4 text-zinc-500">
          <span>USD-INR: ₹83.42 <span className="text-emerald-500 font-medium">+0.04%</span></span>
          <span className="h-3 w-px bg-zinc-900" />
          <span>Brent Crude: $81.24 <span className="text-rose-500 font-medium">-0.82%</span></span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 font-black text-black shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-all">
              NA
            </div>
            <div>
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                NEURAL ALPHA
              </span>
              <span className="block text-[8px] tracking-[0.25em] text-cyan-400 font-bold -mt-1 uppercase">
                AI Advisory F&O
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname === '/'
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50'
              }`}
            >
              <Compass className="h-4 w-4" />
              Dashboard
            </Link>
          </nav>
        </div>

        {/* Watchlist Quick Navigation & Search */}
        <div className="flex items-center gap-4">
          {/* Watchlist Mini Picker */}
          <div className="hidden lg:flex items-center gap-2 bg-zinc-900/40 border border-zinc-900 rounded-lg p-1">
            <span className="text-zinc-500 text-xs px-2 flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Watchlist:
            </span>
            <div className="flex items-center gap-1">
              {watchlistedStocks.slice(0, 4).map((w: any) => (
                <button
                  key={w.symbol}
                  onClick={() => handleStockClick(w.symbol)}
                  className={`px-2 py-1 rounded text-xs font-semibold uppercase transition-all ${
                    selectedSymbol === w.symbol
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {w.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Quick stock selector dropdown */}
          <div className="relative">
            <select
              value={selectedSymbol}
              onChange={(e) => handleStockClick(e.target.value)}
              className="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer transition-all uppercase"
            >
              <optgroup label="Index Derivatives" className="bg-zinc-950">
                {stocks.filter((s: any) => s.sector === 'Indices').map((s: any) => (
                  <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>
                ))}
              </optgroup>
              <optgroup label="F&O Segment" className="bg-zinc-950">
                {stocks.filter((s: any) => s.category === 'F&O' && s.sector !== 'Indices').map((s: any) => (
                  <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>
                ))}
              </optgroup>
              <optgroup label="Cash Segment" className="bg-zinc-950">
                {stocks.filter((s: any) => s.category === 'Cash').map((s: any) => (
                  <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
