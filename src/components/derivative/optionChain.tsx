'use client';

import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Percent, TrendingUp, HelpCircle, Activity } from 'lucide-react';

interface OptionChainProps {
  symbol: string;
  optionsData: {
    underlyingPrice: number;
    totalCallOI: number;
    totalPutOI: number;
    pcr: number;
    maxPainPrice: number;
    chain: any[];
  };
}

export default function OptionChain({ symbol, optionsData }: OptionChainProps) {
  const [showGreeks, setShowGreeks] = useState(false);
  const { underlyingPrice, totalCallOI, totalPutOI, pcr, maxPainPrice, chain } = optionsData;

  // Prepare chart data
  const chartData = chain.map(item => ({
    strike: item.strike,
    'Call OI': item.call.oi,
    'Put OI': item.put.oi,
  }));

  const getPcrSentiment = (val: number) => {
    if (val > 1.3) return { text: 'Strongly Bullish (Heavy Put Writing)', color: 'text-emerald-500 bg-emerald-500/10' };
    if (val > 0.9) return { text: 'Bullish (Put support building)', color: 'text-emerald-400 bg-emerald-400/5' };
    if (val < 0.6) return { text: 'Strongly Bearish (Heavy Call Writing)', color: 'text-rose-500 bg-rose-500/10' };
    if (val < 0.8) return { text: 'Bearish (Call resistance building)', color: 'text-rose-400 bg-rose-400/5' };
    return { text: 'Neutral / Range-bound', color: 'text-zinc-400 bg-zinc-800' };
  };

  const sentiment = getPcrSentiment(pcr);

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Spot Price */}
        <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Spot Price</span>
          <span className="text-xl font-bold text-white mt-1">₹{underlyingPrice.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-zinc-400 mt-1 uppercase">Underlying Index/Stock</span>
        </div>

        {/* PCR */}
        <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Put-Call Ratio (PCR)</span>
          <span className="text-xl font-bold text-cyan-400 mt-1">{pcr}</span>
          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1.5 w-fit ${sentiment.color}`}>
            {sentiment.text}
          </span>
        </div>

        {/* Max Pain */}
        <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Max Pain Strike</span>
          <span className="text-xl font-bold text-amber-500 mt-1">₹{maxPainPrice.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-zinc-400 mt-1">Strike price with lowest buyer pain</span>
        </div>

        {/* Total OI */}
        <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total OI Concentration</span>
          <div className="mt-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-400">Calls: {(totalCallOI / 100000).toFixed(1)}L</span>
              <span className="text-rose-400">Puts: {(totalPutOI / 100000).toFixed(1)}L</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 mt-1 overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${(totalCallOI / (totalCallOI + totalPutOI || 1)) * 100}%` }} />
              <div className="bg-rose-500 h-full" style={{ width: `${(totalPutOI / (totalCallOI + totalPutOI || 1)) * 100}%` }} />
            </div>
          </div>
          <span className="text-[10px] text-zinc-500 mt-2 uppercase">Volume dynamics</span>
        </div>
      </div>

      {/* OI Heatmap / Concentration Chart */}
      <div className="border border-zinc-900 bg-zinc-950/30 rounded-xl p-5">
        <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-cyan-400" />
          Open Interest (OI) Concentration Profile
        </h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="strike" stroke="#52525b" fontSize={9} />
              <YAxis stroke="#52525b" fontSize={9} tickFormatter={(val) => `${(val / 100000).toFixed(0)}L`} />
              <Tooltip
                contentStyle={{ background: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                labelClassName="text-white font-bold text-xs"
                itemStyle={{ fontSize: '11px' }}
              />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="Call OI" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="Put OI" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.8} />
              {/* Highlight Spot Price */}
              <ReferenceLine
                x={Math.round(underlyingPrice / (chain[1]?.strike - chain[0]?.strike || 50)) * (chain[1]?.strike - chain[0]?.strike || 50)}
                stroke="#06b6d4"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                label={{ value: 'Spot Price', fill: '#06b6d4', position: 'top', fontSize: 9, fontWeight: 'bold' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Option Chain Grid */}
      <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl overflow-hidden shadow-xl">
        {/* Chain controls */}
        <div className="border-b border-zinc-900 bg-zinc-950/80 px-4 py-3 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-300">OPTION CHAIN - exps 14 days</span>
          <button
            onClick={() => setShowGreeks(!showGreeks)}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all border ${
              showGreeks
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {showGreeks ? 'Hide Greeks' : 'Show Option Greeks'}
          </button>
        </div>

        {/* Chain table */}
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-950/80 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                {/* Calls */}
                <th className="py-2 px-1 text-zinc-500 border-r border-zinc-900/50">OI (Chg%)</th>
                <th className="py-2 px-1 text-zinc-500">Volume</th>
                <th className="py-2 px-1 text-zinc-500">IV</th>
                {showGreeks && <th className="py-2 px-1 text-zinc-400">Delta</th>}
                {showGreeks && <th className="py-2 px-1 text-zinc-400">Theta</th>}
                <th className="py-2 px-2 text-emerald-400 font-bold border-r border-zinc-900">Call Price (LTP)</th>
                
                {/* Strike */}
                <th className="py-2 px-4 bg-zinc-900 text-zinc-200 font-extrabold border-r border-zinc-900">Strike</th>
                
                {/* Puts */}
                <th className="py-2 px-2 text-rose-400 font-bold border-r border-zinc-900/50">Put Price (LTP)</th>
                {showGreeks && <th className="py-2 px-1 text-zinc-400">Delta</th>}
                {showGreeks && <th className="py-2 px-1 text-zinc-400">Theta</th>}
                <th className="py-2 px-1 text-zinc-500">IV</th>
                <th className="py-2 px-1 text-zinc-500">Volume</th>
                <th className="py-2 px-1 text-zinc-500">OI (Chg%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/20 text-[11px] font-mono">
              {chain.map((item, idx) => {
                const isCallITM = item.strike < underlyingPrice;
                const isPutITM = item.strike > underlyingPrice;

                return (
                  <tr key={idx} className="hover:bg-zinc-900/20 transition-colors">
                    {/* Call Columns */}
                    <td className={`py-1.5 px-1 border-r border-zinc-900/50 text-right ${isCallITM ? 'bg-cyan-500/[0.02]' : ''}`}>
                      <span className="text-zinc-300 font-semibold">{(item.call.oi / 1000).toFixed(0)}k</span>
                      <span className={`block text-[9px] ${item.call.oiChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.call.oiChange >= 0 ? '+' : ''}{item.call.oiChangePercent}%
                      </span>
                    </td>
                    <td className={`py-1.5 px-1 text-right text-zinc-500 ${isCallITM ? 'bg-cyan-500/[0.02]' : ''}`}>
                      {(item.call.volume / 1000).toFixed(0)}k
                    </td>
                    <td className={`py-1.5 px-1 text-zinc-400 ${isCallITM ? 'bg-cyan-500/[0.02]' : ''}`}>
                      {item.call.iv}%
                    </td>
                    
                    {showGreeks && <td className={`py-1.5 px-1 text-zinc-400 ${isCallITM ? 'bg-cyan-500/[0.02]' : ''}`}>{item.call.delta}</td>}
                    {showGreeks && <td className={`py-1.5 px-1 text-rose-500/80 ${isCallITM ? 'bg-cyan-500/[0.02]' : ''}`}>{item.call.theta}</td>}
                    
                    <td className={`py-1.5 px-2 border-r border-zinc-900 font-bold text-right text-emerald-400 ${
                      isCallITM ? 'bg-cyan-500/[0.06] text-emerald-300' : ''
                    }`}>
                      ₹{item.call.ltp}
                      <span className={`block text-[8px] font-normal ${item.call.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.call.change >= 0 ? '+' : ''}{item.call.changePercent}%
                      </span>
                    </td>

                    {/* Strike */}
                    <td className="py-1.5 px-4 bg-zinc-900/60 font-bold text-center border-r border-zinc-900 text-zinc-200">
                      {item.strike}
                    </td>

                    {/* Put Columns */}
                    <td className={`py-1.5 px-2 border-r border-zinc-900/50 font-bold text-left text-rose-400 ${
                      isPutITM ? 'bg-cyan-500/[0.06] text-rose-300' : ''
                    }`}>
                      ₹{item.put.ltp}
                      <span className={`block text-[8px] font-normal ${item.put.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.put.change >= 0 ? '+' : ''}{item.put.changePercent}%
                      </span>
                    </td>

                    {showGreeks && <td className={`py-1.5 px-1 text-zinc-400 ${isPutITM ? 'bg-cyan-500/[0.06]' : ''}`}>{item.put.delta}</td>}
                    {showGreeks && <td className={`py-1.5 px-1 text-rose-500/80 ${isPutITM ? 'bg-cyan-500/[0.06]' : ''}`}>{item.put.theta}</td>}

                    <td className={`py-1.5 px-1 text-zinc-400 ${isPutITM ? 'bg-cyan-500/[0.06]' : ''}`}>
                      {item.put.iv}%
                    </td>
                    <td className={`py-1.5 px-1 text-right text-zinc-500 ${isPutITM ? 'bg-cyan-500/[0.06]' : ''}`}>
                      {(item.put.volume / 1000).toFixed(0)}k
                    </td>
                    <td className={`py-1.5 px-1 text-left ${isPutITM ? 'bg-cyan-500/[0.06]' : ''}`}>
                      <span className="text-zinc-300 font-semibold">{(item.put.oi / 1000).toFixed(0)}k</span>
                      <span className={`block text-[9px] ${item.put.oiChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.put.oiChange >= 0 ? '+' : ''}{item.put.oiChangePercent}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
