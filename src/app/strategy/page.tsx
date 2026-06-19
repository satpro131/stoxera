'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { useAppStore } from '@/store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  TrendingUp,
  Percent,
  Plus,
  Trash2,
  Sliders,
  DollarSign,
  TrendingDown,
  Info,
  Layers,
  Settings,
  RefreshCw,
  TrendingUp as ProfitIcon
} from 'lucide-react';

interface PositionLeg {
  id: string;
  strike: number;
  type: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  premium: number;
  lots: number;
}

// Pre-defined strategy templates
type StrategyTemplate = 'custom' | 'bull_call_spread' | 'bear_put_spread' | 'long_straddle' | 'short_straddle' | 'iron_condor' | 'covered_call';

export default function StrategyBuilder() {
  const { selectedSymbol, setSelectedSymbol } = useAppStore();
  const [legs, setLegs] = useState<PositionLeg[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyTemplate>('bull_call_spread');
  const [simulatedPrice, setSimulatedPrice] = useState<number>(0);

  // Fetch stocks list (to make sure selected stock is F&O)
  const { data: stocksRes } = useQuery({
    queryKey: ['stocks'],
    queryFn: async () => {
      const res = await fetch('/api/stocks');
      return res.json();
    }
  });

  const stocks = stocksRes?.success ? stocksRes.data : [];
  const foStocks = stocks.filter((s: any) => s.category === 'F&O');

  const [instrumentKey, setInstrumentKey] = useState<string | null>(null);
  const [resolvingKey, setResolvingKey] = useState(true);

  useEffect(() => {
    async function fetchKey() {
      try {
        const { getInstrumentKeyClient } = await import('@/utils/dbClient');
        const key = await getInstrumentKeyClient(selectedSymbol);
        setInstrumentKey(key);
      } catch (err) {
        console.error('Failed to resolve instrument key:', err);
      } finally {
        setResolvingKey(false);
      }
    }
    if (selectedSymbol) {
      fetchKey();
    }
  }, [selectedSymbol]);

  // Fetch option chain for selected symbol
  const { data: optionsRes, isLoading } = useQuery({
    queryKey: ['options-chain', selectedSymbol, instrumentKey],
    queryFn: async () => {
      const keyParam = instrumentKey ? `&instrument_key=${encodeURIComponent(instrumentKey)}` : '';
      const res = await fetch(`/api/options?symbol=${selectedSymbol}${keyParam}`);
      return res.json();
    },
    enabled: !!selectedSymbol && !resolvingKey
  });

  const optionData = optionsRes?.success ? optionsRes.data : null;
  const spotPrice = optionData?.underlyingPrice || 1000;
  const strikes = useMemo(() => optionData?.chain.map((c: any) => c.strike) || [], [optionData]);

  // Set lot size based on symbol
  const lotSize = useMemo(() => {
    if (selectedSymbol === 'NIFTY') return 25;
    if (selectedSymbol === 'BANKNIFTY') return 15;
    if (selectedSymbol === 'RELIANCE') return 250;
    if (selectedSymbol === 'TCS') return 175;
    return 500;
  }, [selectedSymbol]);

  // Initial simulated price
  useEffect(() => {
    if (spotPrice) {
      setSimulatedPrice(Math.round(spotPrice));
    }
  }, [spotPrice]);

  // Build template legs when option chain loads or strategy selection changes
  useEffect(() => {
    if (!optionData || optionData.chain.length === 0) return;
    const chain = optionData.chain;
    
    // Find closest ATM strike index
    let atmIndex = 0;
    let minDiff = Infinity;
    chain.forEach((item: any, idx: number) => {
      const diff = Math.abs(item.strike - spotPrice);
      if (diff < minDiff) {
        minDiff = diff;
        atmIndex = idx;
      }
    });

    const spacing = chain[1]?.strike - chain[0]?.strike || 50;
    const atmStrike = chain[atmIndex]?.strike;
    
    // Safety check on boundary indices
    const otmCallIndex = Math.min(atmIndex + 2, chain.length - 1);
    const otmPutIndex = Math.max(atmIndex - 2, 0);

    const otmCallStrike = chain[otmCallIndex]?.strike || (atmStrike + 2 * spacing);
    const otmPutStrike = chain[otmPutIndex]?.strike || (atmStrike - 2 * spacing);

    const farOtmCallStrike = chain[Math.min(atmIndex + 4, chain.length - 1)]?.strike || (atmStrike + 4 * spacing);
    const farOtmPutStrike = chain[Math.max(atmIndex - 4, 0)]?.strike || (atmStrike - 4 * spacing);

    let newLegs: PositionLeg[] = [];

    switch (selectedStrategy) {
      case 'bull_call_spread':
        newLegs = [
          {
            id: 'leg-1',
            strike: atmStrike,
            type: 'CE',
            action: 'BUY',
            premium: chain[atmIndex]?.call.ltp || 50,
            lots: 1
          },
          {
            id: 'leg-2',
            strike: otmCallStrike,
            type: 'CE',
            action: 'SELL',
            premium: chain[otmCallIndex]?.call.ltp || 20,
            lots: 1
          }
        ];
        break;

      case 'bear_put_spread':
        newLegs = [
          {
            id: 'leg-1',
            strike: atmStrike,
            type: 'PE',
            action: 'BUY',
            premium: chain[atmIndex]?.put.ltp || 50,
            lots: 1
          },
          {
            id: 'leg-2',
            strike: otmPutStrike,
            type: 'PE',
            action: 'SELL',
            premium: chain[otmPutIndex]?.put.ltp || 20,
            lots: 1
          }
        ];
        break;

      case 'long_straddle':
        newLegs = [
          {
            id: 'leg-1',
            strike: atmStrike,
            type: 'CE',
            action: 'BUY',
            premium: chain[atmIndex]?.call.ltp || 50,
            lots: 1
          },
          {
            id: 'leg-2',
            strike: atmStrike,
            type: 'PE',
            action: 'BUY',
            premium: chain[atmIndex]?.put.ltp || 48,
            lots: 1
          }
        ];
        break;

      case 'short_straddle':
        newLegs = [
          {
            id: 'leg-1',
            strike: atmStrike,
            type: 'CE',
            action: 'SELL',
            premium: chain[atmIndex]?.call.ltp || 50,
            lots: 1
          },
          {
            id: 'leg-2',
            strike: atmStrike,
            type: 'PE',
            action: 'SELL',
            premium: chain[atmIndex]?.put.ltp || 48,
            lots: 1
          }
        ];
        break;

      case 'iron_condor':
        newLegs = [
          {
            id: 'leg-1',
            strike: otmPutStrike,
            type: 'PE',
            action: 'SELL',
            premium: chain[otmPutIndex]?.put.ltp || 15,
            lots: 1
          },
          {
            id: 'leg-2',
            strike: farOtmPutStrike,
            type: 'PE',
            action: 'BUY',
            premium: chain[Math.max(atmIndex - 4, 0)]?.put.ltp || 5,
            lots: 1
          },
          {
            id: 'leg-3',
            strike: otmCallStrike,
            type: 'CE',
            action: 'SELL',
            premium: chain[otmCallIndex]?.call.ltp || 16,
            lots: 1
          },
          {
            id: 'leg-4',
            strike: farOtmCallStrike,
            type: 'CE',
            action: 'BUY',
            premium: chain[Math.min(atmIndex + 4, chain.length - 1)]?.call.ltp || 6,
            lots: 1
          }
        ];
        break;

      case 'covered_call':
        // Simulates Buy underlying (we model it here as a Deep ITM Call delta ~1.0, or stock purchase)
        newLegs = [
          {
            id: 'leg-1',
            strike: atmStrike - 2 * spacing, // Deep ITM
            type: 'CE',
            action: 'BUY',
            premium: chain[Math.max(atmIndex - 2, 0)]?.call.ltp || (2 * spacing),
            lots: 1
          },
          {
            id: 'leg-2',
            strike: otmCallStrike,
            type: 'CE',
            action: 'SELL',
            premium: chain[otmCallIndex]?.call.ltp || 18,
            lots: 1
          }
        ];
        break;
      
      case 'custom':
      default:
        // Do not reset custom legs if they already exist
        if (legs.length === 0) {
          newLegs = [
            {
              id: 'leg-1',
              strike: atmStrike,
              type: 'CE',
              action: 'BUY',
              premium: chain[atmIndex]?.call.ltp || 50,
              lots: 1
            }
          ];
        } else {
          newLegs = legs;
        }
    }

    setLegs(newLegs);
  }, [selectedStrategy, optionData, spotPrice]);

  // Edit action/type/lots/strike/premium for a leg
  const updateLeg = (id: string, updatedFields: Partial<PositionLeg>) => {
    setLegs(legs.map(leg => (leg.id === id ? { ...leg, ...updatedFields } : leg)));
  };

  const removeLeg = (id: string) => {
    setLegs(legs.filter(leg => leg.id !== id));
  };

  const addLeg = () => {
    const defaultStrike = strikes[Math.round(strikes.length / 2)] || spotPrice;
    setLegs([
      ...legs,
      {
        id: `leg-${Date.now()}`,
        strike: defaultStrike,
        type: 'CE',
        action: 'BUY',
        premium: 10,
        lots: 1
      }
    ]);
  };

  // Helper to calculate P&L of a single leg at a given stock price at expiry
  const calculateLegPayoff = (leg: PositionLeg, expiryPrice: number): number => {
    const size = leg.lots * lotSize;
    let payoff = 0;

    if (leg.type === 'CE') {
      if (leg.action === 'BUY') {
        payoff = Math.max(0, expiryPrice - leg.strike) - leg.premium;
      } else {
        payoff = leg.premium - Math.max(0, expiryPrice - leg.strike);
      }
    } else {
      // Put
      if (leg.action === 'BUY') {
        payoff = Math.max(0, leg.strike - expiryPrice) - leg.premium;
      } else {
        payoff = leg.premium - Math.max(0, leg.strike - expiryPrice);
      }
    }

    return payoff * size;
  };

  // Calculate overall strategy metrics (Max Profit, Max Loss, Breakevens)
  const strategyAnalysis = useMemo(() => {
    if (legs.length === 0) return { maxProfit: 0, maxLoss: 0, breakevens: [], currentPL: 0 };

    // Span range of prices to evaluate payoff profile
    // 500 steps from spotPrice * 0.7 to spotPrice * 1.3
    const lowBound = spotPrice * 0.75;
    const highBound = spotPrice * 1.25;
    const steps = 500;
    const stepSize = (highBound - lowBound) / steps;

    let maxProfit = -Infinity;
    let maxLoss = Infinity;
    const breakevens: number[] = [];

    let prevPrice = lowBound;
    let prevPL = 0;

    for (let i = 0; i <= steps; i++) {
      const priceAtExpiry = lowBound + i * stepSize;
      let totalPL = 0;

      legs.forEach(leg => {
        totalPL += calculateLegPayoff(leg, priceAtExpiry);
      });

      if (totalPL > maxProfit) maxProfit = totalPL;
      if (totalPL < maxLoss) maxLoss = totalPL;

      // Track breakevens (where P&L crosses zero)
      if (i > 0) {
        if ((prevPL < 0 && totalPL >= 0) || (prevPL > 0 && totalPL <= 0)) {
          // Linear interpolation for more precise breakeven price
          const fraction = -prevPL / (totalPL - prevPL);
          const crossoverPrice = prevPrice + fraction * (priceAtExpiry - prevPrice);
          breakevens.push(Number(crossoverPrice.toFixed(0)));
        }
      }

      prevPrice = priceAtExpiry;
      prevPL = totalPL;
    }

    // Calculate current simulated price P&L
    let currentPL = 0;
    legs.forEach(leg => {
      currentPL += calculateLegPayoff(leg, simulatedPrice);
    });

    return {
      maxProfit: Math.round(maxProfit),
      maxLoss: Math.round(maxLoss),
      breakevens: Array.from(new Set(breakevens)).sort((a, b) => a - b),
      currentPL: Math.round(currentPL)
    };
  }, [legs, spotPrice, lotSize, simulatedPrice]);

  // Generate chart payoff line data
  const chartPayoffData = useMemo(() => {
    if (legs.length === 0) return [];
    
    // Evaluate payoff at 40 key points
    const points: { price: number; PL: number }[] = [];
    const lowBound = spotPrice * 0.85;
    const highBound = spotPrice * 1.15;
    const step = (highBound - lowBound) / 40;

    for (let i = 0; i <= 40; i++) {
      const price = Math.round(lowBound + i * step);
      let totalPL = 0;
      legs.forEach(leg => {
        totalPL += calculateLegPayoff(leg, price);
      });
      points.push({ price, PL: Math.round(totalPL) });
    }

    return points;
  }, [legs, spotPrice, lotSize]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header />

      <main className="flex-1 px-4 py-6 md:px-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Top selector and header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Sliders className="h-5 w-5 text-cyan-400" />
              Options Strategy Builder
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Select an asset, design custom multi-leg configurations, and model your expiry payoffs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Symbol selector */}
            <div className="flex items-center gap-1.5 bg-zinc-900/40 border border-zinc-900 p-1.5 rounded-xl text-xs">
              <span className="text-zinc-500 px-1 font-semibold uppercase">Asset:</span>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded px-2.5 py-1 font-bold uppercase focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                {foStocks.map((s: any) => (
                  <option key={s.symbol} value={s.symbol}>{s.symbol}</option>
                ))}
              </select>
            </div>

            {/* Strategy template selector */}
            <div className="flex items-center gap-1.5 bg-zinc-900/40 border border-zinc-900 p-1.5 rounded-xl text-xs">
              <span className="text-zinc-500 px-1 font-semibold uppercase">Strategy:</span>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value as StrategyTemplate)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded px-2.5 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="custom">Custom legs</option>
                <option value="bull_call_spread">Bull Call Spread</option>
                <option value="bear_put_spread">Bear Put Spread</option>
                <option value="long_straddle">Long Straddle</option>
                <option value="short_straddle">Short Straddle</option>
                <option value="iron_condor">Iron Condor</option>
                <option value="covered_call">Covered Call</option>
              </select>
            </div>
          </div>
        </div>

        {/* Builder Interface Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Leg configuration editor */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  Position Legs Config
                </span>
                
                <button
                  onClick={addLeg}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-[10px] font-bold uppercase text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Leg
                </button>
              </div>

              {isLoading ? (
                <div className="py-8 flex justify-center items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-cyan-500 animate-spin" />
                  <span className="text-xs text-zinc-500">Retrieving option chain contracts...</span>
                </div>
              ) : legs.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No legs configured. Click "Add Leg" or select a Strategy Template.
                </div>
              ) : (
                <div className="space-y-3">
                  {legs.map((leg, index) => (
                    <div
                      key={leg.id}
                      className="flex flex-wrap md:flex-nowrap items-center justify-between border border-zinc-900 bg-zinc-950/20 p-3.5 rounded-xl gap-3 text-xs"
                    >
                      {/* Action selector (Buy/Sell) */}
                      <div className="flex flex-col gap-1 w-20">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">Action</span>
                        <select
                          value={leg.action}
                          onChange={(e) => updateLeg(leg.id, { action: e.target.value as 'BUY' | 'SELL' })}
                          className={`font-semibold bg-zinc-900 border border-zinc-800 px-1.5 py-1 rounded text-center focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer ${
                            leg.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          <option value="BUY">BUY</option>
                          <option value="SELL">SELL</option>
                        </select>
                      </div>

                      {/* Strike selector */}
                      <div className="flex flex-col gap-1 w-24">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">Strike</span>
                        <select
                          value={leg.strike}
                          onChange={(e) => updateLeg(leg.id, { strike: Number(e.target.value) })}
                          className="font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-1 rounded text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                        >
                          {strikes.map((s: number) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Type selector (CE/PE) */}
                      <div className="flex flex-col gap-1 w-16">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">Type</span>
                        <select
                          value={leg.type}
                          onChange={(e) => updateLeg(leg.id, { type: e.target.value as 'CE' | 'PE' })}
                          className={`font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-1 rounded text-center focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer ${
                            leg.type === 'CE' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          <option value="CE">CE</option>
                          <option value="PE">PE</option>
                        </select>
                      </div>

                      {/* Premium input */}
                      <div className="flex flex-col gap-1 w-20">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">Premium (₹)</span>
                        <input
                          type="number"
                          value={leg.premium}
                          onChange={(e) => updateLeg(leg.id, { premium: Number(e.target.value) })}
                          className="font-semibold bg-zinc-900 border border-zinc-850 px-2 py-1 rounded text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-full"
                          step="0.05"
                          min="0.05"
                        />
                      </div>

                      {/* Lots input */}
                      <div className="flex flex-col gap-1 w-16">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">Lots</span>
                        <input
                          type="number"
                          value={leg.lots}
                          onChange={(e) => updateLeg(leg.id, { lots: Math.max(1, Number(e.target.value)) })}
                          className="font-semibold bg-zinc-900 border border-zinc-850 px-2 py-1 rounded text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-full text-center"
                          min="1"
                        />
                      </div>

                      {/* Leg detail summary */}
                      <div className="flex flex-col justify-end text-zinc-500 text-[10px] w-24">
                        <span className="block font-medium text-zinc-400">Total Premium</span>
                        <span className="font-bold text-zinc-300">₹{(leg.premium * leg.lots * lotSize).toLocaleString('en-IN')}</span>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => removeLeg(leg.id)}
                        className="h-8 w-8 flex items-center justify-center border border-zinc-900/60 hover:border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-650 hover:text-rose-400 rounded-lg transition-all mt-4 self-center md:self-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payoff chart profile */}
            {legs.length > 0 && (
              <div className="border border-zinc-900 bg-zinc-950/30 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Payoff Curve at Expiry
                </h3>

                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartPayoffData} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                      <XAxis dataKey="price" stroke="#52525b" fontSize={9} />
                      <YAxis stroke="#52525b" fontSize={9} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                        labelClassName="text-white font-bold text-xs"
                        itemStyle={{ fontSize: '11px' }}
                      />
                      {/* Zero line */}
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                      {/* Current simulated price */}
                      <ReferenceLine x={simulatedPrice} stroke="#06b6d4" strokeWidth={1} strokeDasharray="3 3" label={{ value: `Simulated Spot: ₹${simulatedPrice}`, fill: '#06b6d4', position: 'top', fontSize: 9, fontWeight: 'bold' }} />
                      
                      <Line
                        type="monotone"
                        dataKey="PL"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Right: Profit/Loss Metrics and Simulation Sliders */}
          <div className="space-y-6">
            {/* Payoff parameters card */}
            <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Strategy Parameters</h3>

              <div className="space-y-3.5">
                {/* Max Profit */}
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                  <span className="text-xs text-zinc-400">Max Profit</span>
                  <span className={`text-sm font-extrabold ${strategyAnalysis.maxProfit > 1000000 ? 'text-emerald-400' : 'text-emerald-500'}`}>
                    {strategyAnalysis.maxProfit > 1000000 ? 'Unlimited' : `₹${strategyAnalysis.maxProfit.toLocaleString('en-IN')}`}
                  </span>
                </div>

                {/* Max Loss */}
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                  <span className="text-xs text-zinc-400">Max Loss</span>
                  <span className={`text-sm font-extrabold ${strategyAnalysis.maxLoss < -1000000 ? 'text-rose-400' : 'text-rose-500'}`}>
                    {strategyAnalysis.maxLoss < -1000000 ? 'Unlimited' : `₹${strategyAnalysis.maxLoss.toLocaleString('en-IN')}`}
                  </span>
                </div>

                {/* Risk/Reward */}
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                  <span className="text-xs text-zinc-400">Risk / Reward Ratio</span>
                  <span className="text-xs font-bold text-zinc-200">
                    {strategyAnalysis.maxLoss !== 0 && strategyAnalysis.maxProfit !== 0
                      ? `1 : ${Math.abs(Number((strategyAnalysis.maxProfit / strategyAnalysis.maxLoss).toFixed(2)))}`
                      : 'N/A'}
                  </span>
                </div>

                {/* Breakevens */}
                <div className="flex justify-between items-start">
                  <span className="text-xs text-zinc-400 mt-0.5">Breakevens</span>
                  <div className="text-right">
                    {strategyAnalysis.breakevens.length === 0 ? (
                      <span className="text-xs text-zinc-400 font-semibold">None detected</span>
                    ) : (
                      strategyAnalysis.breakevens.map((b, i) => (
                        <span key={i} className="block text-xs font-mono font-bold text-amber-500">
                          ₹{b.toLocaleString('en-IN')}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Expiry price simulator slider */}
            {legs.length > 0 && (
              <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Expiry Price Simulator</h3>
                
                <div className="space-y-4">
                  {/* Slider control */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-500">Simulate Spot</span>
                      <span className="text-zinc-300 font-mono">₹{simulatedPrice}</span>
                    </div>
                    
                    <input
                      type="range"
                      min={Math.round(spotPrice * 0.85)}
                      max={Math.round(spotPrice * 1.15)}
                      value={simulatedPrice}
                      onChange={(e) => setSimulatedPrice(Number(e.target.value))}
                      className="w-full bg-zinc-800 rounded-lg appearance-none h-1 cursor-pointer accent-cyan-500"
                    />

                    <div className="flex justify-between text-[10px] text-zinc-650">
                      <span>-15%</span>
                      <span>Spot: ₹{Math.round(spotPrice)}</span>
                      <span>+15%</span>
                    </div>
                  </div>

                  {/* Simulated outcome P&L */}
                  <div className={`p-4 rounded-xl text-center border ${
                    strategyAnalysis.currentPL >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-rose-500/10 border-rose-500/20'
                  }`}>
                    <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Estimated Expiry Net P&L</span>
                    <span className={`block text-xl font-black mt-1 ${
                      strategyAnalysis.currentPL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {strategyAnalysis.currentPL >= 0 ? '+' : ''}₹{strategyAnalysis.currentPL.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[9px] text-zinc-500 mt-1 uppercase">
                      Based on lot sizes: {lotSize} qty/lot
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Guide Info */}
            <div className="border border-zinc-900/60 bg-zinc-950/20 p-4 rounded-2xl flex items-start gap-3">
              <Info className="h-4.5 w-4.5 text-cyan-400/80 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-zinc-500">
                <span className="block font-bold text-zinc-400">Options Strategy Tip</span>
                <p className="leading-relaxed">
                  Debit spreads (like Bull Call) have a fixed cost and limited risk. Credit spreads (like Straddles or iron condor legs) seek to harvest time decay (Theta) but require strict margin management.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
