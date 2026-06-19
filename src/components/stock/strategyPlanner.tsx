'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Sliders, Plus, Trash2, Info, Layers, Layers3, Sparkles, ShieldAlert } from 'lucide-react';

interface PositionLeg {
  id: string;
  strike: number;
  type: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  premium: number;
  lots: number;
}

type StrategyTemplate = 'custom' | 'bull_call_spread' | 'bear_put_spread' | 'long_straddle' | 'short_straddle' | 'iron_condor' | 'covered_call';

interface StrategyPlannerProps {
  symbol: string;
  spotPrice: number;
  optionsData: {
    underlyingPrice: number;
    chain: any[];
  } | null;
  aiRecommendation?: string;
  aiOptionsStrategy?: {
    no_trade_possible: boolean;
    reasoning?: string;
    strategy_name?: string;
    setup_type?: string;
    expiry_used?: string;
    legs: Array<{
      action: 'BUY' | 'SELL';
      strike: number;
      option_type: 'CE' | 'PE';
      premium_reference: number;
    }>;
    max_profit_estimate?: string;
    max_loss_estimate?: string;
    breakeven_points?: string[];
    estimated_win_probability?: number;
    risk_factors?: string[];
    rationale?: string;
  } | null;
}

export default function StrategyPlanner({ symbol, spotPrice, optionsData, aiRecommendation, aiOptionsStrategy }: StrategyPlannerProps) {
  const [legs, setLegs] = useState<PositionLeg[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyTemplate>('bull_call_spread');
  const [simulatedPrice, setSimulatedPrice] = useState<number>(Math.round(spotPrice));

  const chain = optionsData?.chain || [];
  const strikes = useMemo(() => chain.map((c: any) => c.strike) || [], [chain]);

  const recommendationDetails = useMemo(() => {
    const rec = (aiRecommendation || 'Buy').toLowerCase();
    
    // Find ATM strike in options chain
    let atmStrike = Math.round(spotPrice);
    if (chain.length > 0) {
      let minDiff = Infinity;
      chain.forEach((item: any) => {
        const diff = Math.abs(item.strike - spotPrice);
        if (diff < minDiff) {
          minDiff = diff;
          atmStrike = item.strike;
        }
      });
    }

    if (rec === 'sell') {
      return {
        strategy: 'bear_put_spread' as StrategyTemplate,
        name: 'Bear Put Spread',
        type: 'Bearish Position Setup',
        pop: '65%',
        rationale: `AI indicates a bearish trend. Buying an ATM Put and selling an OTM Put is a high-probability way to trade downward momentum with strictly capped risk.`,
        risks: [
          'Full premium paid is lost if the stock expires above the lower strike (ATM) at expiry.',
          'Time decay (Theta) reduces option values if the price remains stagnant.',
          'Sudden upward trend reversal will trigger the maximum defined loss.'
        ]
      };
    } else if (rec === 'hold' || rec === 'avoid') {
      return {
        strategy: 'iron_condor' as StrategyTemplate,
        name: 'Iron Condor',
        type: 'Rangebound Income Setup',
        pop: '74%',
        rationale: `AI indicates low momentum and rangebound pricing. Selling out-of-the-money Call & Put spreads yields maximum profit through time decay as long as the price remains stable.`,
        risks: [
          'Violent breakout beyond outer strikes in either direction will trigger maximum defined loss.',
          'Implied Volatility (IV) spike increases option values, temporarily showing paper losses.',
          'Requires disciplined risk exit if either outer strike is threatened.'
        ]
      };
    } else {
      // Default to Buy (Bullish)
      return {
        strategy: 'bull_call_spread' as StrategyTemplate,
        name: 'Bull Call Spread',
        type: 'Bullish Position Setup',
        pop: '68%',
        rationale: `AI indicates a strong bullish trend. Buying an ATM Call and selling an OTM Call lowers premium entry costs and provides a defined-risk setup with maximum upside leverage.`,
        risks: [
          'Maximum loss is limited to the net premium paid but occurs if the stock stays below the lower strike (ATM) at expiry.',
          'Time decay works against the long call leg if the stock remains stagnant.',
          'Maximum profit is capped if the stock rises significantly beyond the upper strike.'
        ]
      };
    }
  }, [aiRecommendation, spotPrice, chain]);

  const recDetails = useMemo(() => {
    if (aiOptionsStrategy && !aiOptionsStrategy.no_trade_possible) {
      return {
        strategy: 'custom' as StrategyTemplate,
        name: aiOptionsStrategy.strategy_name || 'AI Recommended Strategy',
        type: aiOptionsStrategy.setup_type || 'AI Suggested Setup',
        pop: aiOptionsStrategy.estimated_win_probability ? `${aiOptionsStrategy.estimated_win_probability}%` : 'N/A',
        rationale: aiOptionsStrategy.rationale || aiOptionsStrategy.reasoning || '',
        risks: aiOptionsStrategy.risk_factors && aiOptionsStrategy.risk_factors.length > 0
          ? aiOptionsStrategy.risk_factors
          : ['Options trading involves significant risk.']
      };
    }
    return recommendationDetails;
  }, [aiOptionsStrategy, recommendationDetails]);

  // Set lot size based on symbol
  const lotSize = useMemo(() => {
    if (symbol === 'NIFTY') return 25;
    if (symbol === 'BANKNIFTY') return 15;
    if (symbol === 'RELIANCE') return 250;
    if (symbol === 'TCS') return 175;
    return 500;
  }, [symbol]);

  // Reset simulated price when spot price changes
  useEffect(() => {
    if (spotPrice) {
      setSimulatedPrice(Math.round(spotPrice));
    }
  }, [spotPrice]);

  // Handle auto-population of AI recommended options legs
  useEffect(() => {
    if (aiOptionsStrategy && !aiOptionsStrategy.no_trade_possible && aiOptionsStrategy.legs && aiOptionsStrategy.legs.length > 0) {
      const parsedLegs = aiOptionsStrategy.legs.map((leg, index) => ({
        id: `ai-leg-${index}-${Date.now()}`,
        strike: leg.strike,
        type: leg.option_type,
        action: leg.action,
        premium: leg.premium_reference,
        lots: 1
      }));
      setLegs(parsedLegs);
      setSelectedStrategy('custom');
    }
  }, [aiOptionsStrategy]);

  // Auto-build strategy legs when option chain details change
  useEffect(() => {
    if (chain.length === 0) return;
    
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
        newLegs = [
          {
            id: 'leg-1',
            strike: atmStrike - 2 * spacing,
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
  }, [selectedStrategy, chain, spotPrice]);

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

  // Helper payoff calculations
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
      if (leg.action === 'BUY') {
        payoff = Math.max(0, leg.strike - expiryPrice) - leg.premium;
      } else {
        payoff = leg.premium - Math.max(0, leg.strike - expiryPrice);
      }
    }

    return payoff * size;
  };

  // Calculate payoff parameters
  const strategyAnalysis = useMemo(() => {
    if (legs.length === 0) return { maxProfit: 0, maxLoss: 0, breakevens: [], currentPL: 0 };

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

      if (i > 0) {
        if ((prevPL < 0 && totalPL >= 0) || (prevPL > 0 && totalPL <= 0)) {
          const fraction = -prevPL / (totalPL - prevPL);
          const crossoverPrice = prevPrice + fraction * (priceAtExpiry - prevPrice);
          breakevens.push(Number(crossoverPrice.toFixed(0)));
        }
      }

      prevPrice = priceAtExpiry;
      prevPL = totalPL;
    }

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

  // Generate chart data
  const chartPayoffData = useMemo(() => {
    if (legs.length === 0) return [];
    
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

  if (chain.length === 0) return null;

  return (
    <div className="border border-zinc-900 bg-zinc-950/30 rounded-2xl p-6 mt-6 space-y-6">
      
      {/* AI Recommended Trade Setup Card */}
      <div className="border border-cyan-500/10 bg-cyan-950/5/20 rounded-2xl p-4 md:p-5 relative overflow-hidden flex flex-col md:flex-row gap-6 justify-between items-stretch">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-24 w-24 rounded-full bg-cyan-500/5 blur-xl pointer-events-none" />
        
        {/* Left Side: Strategy Details & Apply Button */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-500/10 text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">AI Strategy Playbook Suggestion</span>
          </div>

          <div>
            <h4 className="text-base font-extrabold text-white">
              {recDetails.name} <span className="text-[10px] text-zinc-500 font-semibold bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded ml-2 uppercase tracking-wide">{recDetails.type}</span>
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed mt-1 font-medium">
              {recDetails.rationale}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-zinc-500">Estimated Win Prob: </span>
              <span className="font-bold text-emerald-400">{recDetails.pop}</span>
            </div>
            <div className="h-3 w-px bg-zinc-900" />
            <button
              onClick={() => {
                if (aiOptionsStrategy && !aiOptionsStrategy.no_trade_possible && aiOptionsStrategy.legs && aiOptionsStrategy.legs.length > 0) {
                  const parsedLegs = aiOptionsStrategy.legs.map((leg, index) => ({
                    id: `ai-leg-${index}-${Date.now()}`,
                    strike: leg.strike,
                    type: leg.option_type,
                    action: leg.action,
                    premium: leg.premium_reference,
                    lots: 1
                  }));
                  setLegs(parsedLegs);
                  setSelectedStrategy('custom');
                } else {
                  setSelectedStrategy(recDetails.strategy);
                }
              }}
              className="text-[10px] uppercase font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 group"
            >
              Configure this Strategy
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </div>

        {/* Right Side: Risk Factors & Disclaimers */}
        <div className="md:w-72 bg-zinc-950/40 border border-zinc-900/60 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Strategy Risk Factors
            </span>
            <ul className="space-y-1 text-[10px] text-zinc-500">
              {recDetails.risks.map((risk, index) => (
                <li key={index} className="flex items-start gap-1 leading-normal">
                  <span className="h-1 w-1 rounded-full bg-rose-500/70 mt-1 flex-shrink-0" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
          <span className="text-[8px] text-zinc-600 block italic leading-tight pt-1 border-t border-zinc-900/50">
            Options trading involves significant risk. Ensure sizing matches your risk tolerance.
          </span>
        </div>
      </div>

      {/* Header and templates */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900/60 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
            <Sliders className="h-4.5 w-4.5 text-cyan-400" />
            Interactive Option Strategy Planner
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Model options strategies for {symbol} using real-time contract prices.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 p-1 rounded-xl text-xs">
          <span className="text-[10px] font-bold text-zinc-500 px-1.5 uppercase">Strategy:</span>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value as StrategyTemplate)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer uppercase"
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

      {/* Grid: Configurator and pay-off */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Legs Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-bold uppercase pb-1">
            <span>Position Legs</span>
            <button
              onClick={addLeg}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-[9px] font-bold uppercase transition-colors"
            >
              + Add Leg
            </button>
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {legs.map(leg => (
              <div
                key={leg.id}
                className="flex flex-wrap md:flex-nowrap items-center justify-between border border-zinc-900 bg-zinc-950/20 p-2.5 rounded-lg gap-2 text-xs"
              >
                {/* Action */}
                <select
                  value={leg.action}
                  onChange={(e) => updateLeg(leg.id, { action: e.target.value as 'BUY' | 'SELL' })}
                  className={`font-semibold bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px] focus:outline-none cursor-pointer ${
                    leg.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>

                {/* Strike */}
                <select
                  value={leg.strike}
                  onChange={(e) => updateLeg(leg.id, { strike: Number(e.target.value) })}
                  className="font-mono bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-200 focus:outline-none cursor-pointer"
                >
                  {strikes.map((s: number) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Type */}
                <select
                  value={leg.type}
                  onChange={(e) => updateLeg(leg.id, { type: e.target.value as 'CE' | 'PE' })}
                  className={`font-bold bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px] focus:outline-none cursor-pointer ${
                    leg.type === 'CE' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  <option value="CE">CE</option>
                  <option value="PE">PE</option>
                </select>

                {/* Premium */}
                <div className="flex items-center gap-1 w-16">
                  <span className="text-zinc-600 text-[9px] uppercase font-bold">Premium</span>
                  <input
                    type="number"
                    value={leg.premium}
                    onChange={(e) => updateLeg(leg.id, { premium: Number(e.target.value) })}
                    className="font-semibold bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded text-zinc-200 text-[10px] focus:outline-none w-full"
                    step="0.05"
                  />
                </div>

                {/* Lots */}
                <div className="flex items-center gap-1 w-14">
                  <span className="text-zinc-600 text-[9px] uppercase font-bold">Lots</span>
                  <input
                    type="number"
                    value={leg.lots}
                    onChange={(e) => updateLeg(leg.id, { lots: Math.max(1, Number(e.target.value)) })}
                    className="font-semibold bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-zinc-200 text-[10px] focus:outline-none w-full text-center"
                  />
                </div>

                {/* Premium cost */}
                <span className="font-bold text-[10px] text-zinc-400 font-mono w-20 text-right truncate">
                  ₹{(leg.premium * leg.lots * lotSize).toLocaleString('en-IN')}
                </span>

                {/* Delete */}
                <button
                  onClick={() => removeLeg(leg.id)}
                  className="text-zinc-600 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Payoff curve */}
          {legs.length > 0 && (
            <div className="h-52 border border-zinc-900/60 bg-zinc-950/20 rounded-xl p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPayoffData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="price" stroke="#52525b" fontSize={8} />
                  <YAxis stroke="#52525b" fontSize={8} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#09090b', borderColor: '#27272a', borderRadius: '6px' }}
                    labelClassName="text-white font-bold text-[10px]"
                    itemStyle={{ fontSize: '10px' }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                  <ReferenceLine x={simulatedPrice} stroke="#06b6d4" strokeWidth={1} strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="PL" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payoff Stats & Slider */}
        <div className="space-y-4">
          <div className="border border-zinc-900 bg-zinc-950/20 rounded-xl p-4 space-y-3">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Strategy Summary</span>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-zinc-900/60 pb-1.5">
                <span className="text-zinc-500">Max Profit</span>
                <span className="font-extrabold text-emerald-400">
                  {strategyAnalysis.maxProfit > 1000000 ? 'Unlimited' : `₹${strategyAnalysis.maxProfit.toLocaleString('en-IN')}`}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-900/60 pb-1.5">
                <span className="text-zinc-500">Max Loss</span>
                <span className="font-extrabold text-rose-400">
                  {strategyAnalysis.maxLoss < -1000000 ? 'Unlimited' : `₹${strategyAnalysis.maxLoss.toLocaleString('en-IN')}`}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-900/60 pb-1.5">
                <span className="text-zinc-500">Breakevens</span>
                <div className="text-right font-mono font-bold text-amber-500">
                  {strategyAnalysis.breakevens.length === 0
                    ? 'None'
                    : strategyAnalysis.breakevens.map(b => `₹${b}`).join(', ')}
                </div>
              </div>
            </div>
          </div>

          {/* Slider */}
          {legs.length > 0 && (
            <div className="border border-zinc-900 bg-zinc-950/20 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-500">Expiry Spot Price</span>
                <span className="text-zinc-300 font-mono">₹{simulatedPrice}</span>
              </div>

              <input
                type="range"
                min={Math.round(spotPrice * 0.88)}
                max={Math.round(spotPrice * 1.12)}
                value={simulatedPrice}
                onChange={(e) => setSimulatedPrice(Number(e.target.value))}
                className="w-full bg-zinc-800 rounded-lg appearance-none h-1 cursor-pointer accent-cyan-500"
              />

              <div className={`p-3 rounded-lg text-center border text-xs font-bold ${
                strategyAnalysis.currentPL >= 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                Expiry P&L: {strategyAnalysis.currentPL >= 0 ? '+' : ''}₹{strategyAnalysis.currentPL.toLocaleString('en-IN')}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
