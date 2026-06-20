'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { 
  getOpenTrades, 
  getClosedTrades, 
  closeTrade, 
  addPositionalTrade, 
  addFnoTrade, 
  addReviewLog, 
  getReviewHistory,
  PositionalTrade, 
  FnoTrade,
  AiReviewLog
} from '@/utils/demoDb';
import { getStocks } from '@/utils/mockData';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Cpu, 
  Plus, 
  X, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  Layers3, 
  Clock, 
  Calendar,
  CheckCircle,
  HelpCircle,
  FileText
} from 'lucide-react';

export default function DemoTradingDashboard() {
  const [activeMainTab, setActiveMainTab] = useState<'POSITIONAL' | 'FNO'>('POSITIONAL');
  const [activeSubTab, setActiveSubTab] = useState<'OPEN' | 'CLOSED'>('OPEN');

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
  
  // Lists
  const [positionalTrades, setPositionalTrades] = useState<PositionalTrade[]>([]);
  const [fnoTrades, setFnoTrades] = useState<FnoTrade[]>([]);
  
  // Live Prices & Greeks (Loaded on polling)
  const [liveQuotes, setLiveQuotes] = useState<Record<string, number>>({});
  const [liveOptionChains, setLiveOptionChains] = useState<Record<string, any[]>>({});
  
  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualType, setManualType] = useState<'POSITIONAL' | 'FNO'>('POSITIONAL');
  
  // Form states - Positional
  const [formSymbol, setFormSymbol] = useState('');
  const [formDirection, setFormDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [formEntryPrice, setFormEntryPrice] = useState<number>(0);
  const [formQuantity, setFormQuantity] = useState<number>(100);
  const [formTarget, setFormTarget] = useState<number>(0);
  const [formStopLoss, setFormStopLoss] = useState<number>(0);

  // Form states - F&O
  const [formExpiries, setFormExpiries] = useState<string[]>([]);
  const [formSelectedExpiry, setFormSelectedExpiry] = useState('');
  const [formFnoLegs, setFormFnoLegs] = useState<any[]>([
    { action: 'BUY', strike: 0, option_type: 'CE', entry_premium: 0, lots: 1 }
  ]);
  const [formStrategyLabel, setFormStrategyLabel] = useState('Custom Strategy');
  const [formOptionChain, setFormOptionChain] = useState<any[]>([]);

  // Close Trade modal states
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeTradeItem, setCloseTradeItem] = useState<{ id: string; type: 'POSITIONAL' | 'FNO'; symbol: string; liveLtp: number } | null>(null);
  const [closeExitPrice, setCloseExitPrice] = useState<number>(0);
  const [closeReason, setCloseReason] = useState<'TARGET_HIT' | 'STOP_LOSS_HIT' | 'MANUAL_CLOSE' | 'AI_SUGGESTED_EXIT' | 'EXPIRY'>('MANUAL_CLOSE');

  // AI Review states
  const [reviewLoading, setReviewLoading] = useState<Record<string, boolean>>({});
  const [reviewsCached, setReviewsCached] = useState<Record<string, AiReviewLog>>({});
  const [reviewHistory, setReviewHistory] = useState<Record<string, AiReviewLog[]>>({});
  const [expandedRationales, setExpandedRationales] = useState<Record<string, boolean>>({});
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});

  const stocksList = useMemo(() => getStocks(), []);

  // Fetch from IndexedDB
  const refreshTrades = async () => {
    try {
      const posOpen = await getOpenTrades('POSITIONAL');
      const posClosed = await getClosedTrades('POSITIONAL');
      const fnoOpen = await getOpenTrades('FNO');
      const fnoClosed = await getClosedTrades('FNO');

      setPositionalTrades(activeSubTab === 'OPEN' ? posOpen : posClosed);
      setFnoTrades(activeSubTab === 'OPEN' ? fOpenCombined(fnoOpen) : fClosedCombined(fnoClosed));

      // Prefetch history & reviews for open trades
      const allOpen = [...posOpen, ...fnoOpen];
      for (const t of allOpen) {
        const history = await getReviewHistory(t.id);
        setReviewHistory(prev => ({ ...prev, [t.id]: history }));
        
        // Find if reviewed today
        const todayStr = new Date().toISOString().split('T')[0];
        const todayReview = history.find(h => h.review_date.startsWith(todayStr));
        if (todayReview) {
          setReviewsCached(prev => ({ ...prev, [t.id]: todayReview }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fOpenCombined = (trades: any[]) => trades;
  const fClosedCombined = (trades: any[]) => trades;

  useEffect(() => {
    refreshTrades();
  }, [activeMainTab, activeSubTab]);

  // Polling current spot prices and option premiums
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const pollPrices = async () => {
      const activeOpenPositions = activeMainTab === 'POSITIONAL' ? positionalTrades : fnoTrades;
      if (activeSubTab === 'CLOSED' || activeOpenPositions.length === 0) return;

      const symbols = Array.from(new Set(activeOpenPositions.map(t => t.symbol)));
      
      // 1. Fetch live quotes for spot prices
      const quotesMap: Record<string, number> = {};
      for (const sym of symbols) {
        try {
          const res = await fetch(`/api/quote?symbol=${sym}`);
          const resData = await res.json();
          if (resData?.success && resData?.data?.stock) {
            quotesMap[sym] = resData.data.stock.price;
          }
        } catch (e) {
          console.warn('Failed polling price for', sym, e);
        }
      }
      setLiveQuotes(prev => ({ ...prev, ...quotesMap }));

      // 2. Fetch live option chains for F&O positions
      if (activeMainTab === 'FNO') {
        const chainsMap: Record<string, any[]> = {};
        for (const sym of symbols) {
          try {
            const res = await fetch(`/api/options?symbol=${sym}`);
            const resData = await res.json();
            if (resData?.success && resData?.data?.chain) {
              chainsMap[sym] = resData.data.chain;
            }
          } catch (e) {
            console.warn('Failed polling options chain for', sym, e);
          }
        }
        setLiveOptionChains(prev => ({ ...prev, ...chainsMap }));
      }
    };

    pollPrices();
    interval = setInterval(pollPrices, 12000); // Poll every 12 seconds
    return () => clearInterval(interval);
  }, [positionalTrades, fnoTrades, activeMainTab, activeSubTab]);

  // Form selections and fetches
  useEffect(() => {
    if (!formSymbol) return;

    // Reset details
    const selectedStock = stocksList.find(s => s.symbol === formSymbol);
    if (!selectedStock) return;

    setFormEntryPrice(selectedStock.price);
    setFormTarget(Number((selectedStock.price * 1.07).toFixed(1)));
    setFormStopLoss(Number((selectedStock.price * 0.965).toFixed(1)));

    if (manualType === 'FNO' && selectedStock.category === 'F&O') {
      // Fetch expiries
      const loadExpiries = async () => {
        try {
          const res = await fetch(`/api/options?symbol=${formSymbol}`);
          const resData = await res.json();
          if (resData?.success) {
            // Find expiry
            const chain = resData.data.chain;
            setFormOptionChain(chain);
            
            // Generate future date expiries (mock/from chain if available)
            const expiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
            setFormExpiries([expiry]);
            setFormSelectedExpiry(expiry);

            // Populate first leg strike
            const strikes = chain.map((c: any) => c.strike);
            const atmStrike = strikes[Math.round(strikes.length / 2)] || selectedStock.price;
            setFormFnoLegs([
              { action: 'BUY', strike: atmStrike, option_type: 'CE', entry_premium: 35.0, lots: 1 }
            ]);
          }
        } catch (e) {
          console.error(e);
        }
      };
      loadExpiries();
    }
  }, [formSymbol, manualType]);

  // Calculate live position P&L
  const getPositionalPnL = (trade: PositionalTrade) => {
    const ltp = liveQuotes[trade.symbol] || trade.entry_price;
    const diff = ltp - trade.entry_price;
    const dirFactor = trade.direction === 'LONG' ? 1 : -1;
    const pnl = diff * trade.quantity * dirFactor;
    const pnlPercent = (diff / trade.entry_price) * 100 * dirFactor;
    return { pnl: Math.round(pnl), pnlPercent: Number(pnlPercent.toFixed(2)), ltp };
  };

  // Calculate live F&O P&L
  const getFnoPnL = (trade: FnoTrade) => {
    const chain = liveOptionChains[trade.symbol] || [];
    let totalPnl = 0;
    const legValues = trade.legs.map(leg => {
      const matched = chain.find((c: any) => c.strike === leg.strike);
      const ltp = matched ? (leg.option_type === 'CE' ? matched.call?.ltp : matched.put?.ltp) || leg.entry_premium : leg.entry_premium;
      const legDiff = ltp - leg.entry_premium;
      const actionFactor = leg.action === 'BUY' ? 1 : -1;
      const legPnl = legDiff * leg.lots * leg.lot_size * actionFactor;
      totalPnl += legPnl;
      return { ...leg, current_premium: ltp, pnl: legPnl };
    });
    return { pnl: Math.round(totalPnl), legs: legValues };
  };

  // Metrics Summaries
  const summaries = useMemo(() => {
    if (activeMainTab === 'POSITIONAL') {
      const open = positionalTrades.filter(t => t.status === 'OPEN');
      const closed = positionalTrades.filter(t => t.status === 'CLOSED');
      
      const openPnlSum = open.reduce((acc, t) => acc + getPositionalPnL(t).pnl, 0);
      const wins = closed.filter(t => {
        const exit = t.exit_price || 0;
        const entry = t.entry_price;
        return t.direction === 'LONG' ? exit > entry : exit < entry;
      }).length;
      const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
      
      return { openPnl: openPnlSum, winRate, totalCount: open.length + closed.length };
    } else {
      const open = fnoTrades.filter(t => t.status === 'OPEN');
      const closed = fnoTrades.filter(t => t.status === 'CLOSED');
      
      const openPnlSum = open.reduce((acc, t) => acc + getFnoPnL(t).pnl, 0);
      const wins = closed.filter(t => (t.realized_pnl || 0) > 0).length;
      const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;

      return { openPnl: openPnlSum, winRate, totalCount: open.length + closed.length };
    }
  }, [positionalTrades, fnoTrades, activeMainTab, liveQuotes, liveOptionChains]);

  // Trade handlers
  const handleCreatePosTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedStock = stocksList.find(s => s.symbol === formSymbol);
      if (!selectedStock) return;

      await addPositionalTrade({
        symbol: formSymbol,
        instrument_key: selectedStock.oi ? 'NSE_EQ|INE' : '', // dummy or matched
        source: 'MANUAL',
        direction: formDirection,
        entry_price: formEntryPrice,
        quantity: formQuantity,
        target_price: formTarget || null,
        stop_loss: formStopLoss || null,
        expected_timeline: null,
        ai_rationale: null
      });

      showToast('Manual trade placed!');
      setShowAddModal(false);
      refreshTrades();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleCreateFnoTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let lotSize = 500;
      if (formSymbol === 'NIFTY') lotSize = 25;
      else if (formSymbol === 'BANKNIFTY') lotSize = 15;
      else if (formSymbol === 'RELIANCE') lotSize = 250;
      else if (formSymbol === 'TCS') lotSize = 175;

      const finalLegs = formFnoLegs.map(leg => ({
        action: leg.action,
        strike: Number(leg.strike),
        option_type: leg.option_type,
        entry_premium: Number(leg.entry_premium),
        lots: Number(leg.lots),
        lot_size: lotSize
      }));

      await addFnoTrade({
        symbol: formSymbol,
        instrument_key: '',
        source: 'MANUAL',
        strategy_name: formStrategyLabel,
        expiry_date: formSelectedExpiry,
        legs: finalLegs,
        max_profit_estimate: 'N/A',
        max_loss_estimate: 'N/A',
        breakeven_points: null,
        ai_rationale: null
      });

      showToast('Manual F&O Strategy placed!');
      setShowAddModal(false);
      refreshTrades();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleOpenCloseModal = (id: string, type: 'POSITIONAL' | 'FNO', symbol: string) => {
    let ltp = 0;
    if (type === 'POSITIONAL') {
      const t = positionalTrades.find(x => x.id === id);
      ltp = t ? getPositionalPnL(t).ltp : 0;
    } else {
      const t = fnoTrades.find(x => x.id === id);
      ltp = t ? getFnoPnL(t).pnl : 0; // realized PnL
    }

    setCloseTradeItem({ id, type, symbol, liveLtp: ltp });
    setCloseExitPrice(ltp);
    setShowCloseModal(true);
  };

  const handleConfirmClose = async () => {
    if (!closeTradeItem) return;
    try {
      await closeTrade(
        closeTradeItem.id,
        closeTradeItem.type,
        closeExitPrice,
        closeReason
      );
      showToast('Trade successfully closed!');
      setShowCloseModal(false);
      refreshTrades();
    } catch (e: any) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  // Call 6 AI Review Trigger
  const handleAskAIReview = async (id: string, type: 'POSITIONAL' | 'FNO') => {
    setReviewLoading(prev => ({ ...prev, [id]: true }));
    try {
      const isPos = type === 'POSITIONAL';
      let payload: any = {};

      if (isPos) {
        const trade = positionalTrades.find(t => t.id === id);
        if (!trade) return;
        const pnlStats = getPositionalPnL(trade);

        // Fetch fresh indicators
        const resQuote = await fetch(`/api/quote?symbol=${trade.symbol}`);
        const resQuoteData = await resQuote.json();
        const freshTechnicals = resQuoteData?.success ? resQuoteData.data.stock.technicals : null;

        const resNews = await fetch(`/api/news?symbol=${trade.symbol}`);
        const resNewsData = await resNews.json();
        const freshNews = resNewsData?.success ? resNewsData.data.sentiment : null;

        payload = {
          trade,
          type,
          current_price: pnlStats.ltp,
          current_pnl: pnlStats.pnl,
          technicals: freshTechnicals,
          news: freshNews
        };
      } else {
        const trade = fnoTrades.find(t => t.id === id);
        if (!trade) return;
        const pnlStats = getFnoPnL(trade);

        const resQuote = await fetch(`/api/quote?symbol=${trade.symbol}`);
        const resQuoteData = await resQuote.json();
        const freshPrice = resQuoteData?.success ? resQuoteData.data.stock.price : trade.legs[0].strike;

        const resOption = await fetch(`/api/options?symbol=${trade.symbol}`);
        const resOptionData = await resOption.json();
        const freshOptionChain = resOptionData?.success ? resOptionData.data : null;

        payload = {
          trade,
          type,
          current_price: freshPrice,
          current_pnl: pnlStats.pnl,
          option_chain: freshOptionChain
        };
      }

      const resReview = await fetch('/api/recommend/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const reviewData = await resReview.json();

      if (reviewData?.success) {
        const reviewLogObj = reviewData.data;
        // Save to DB
        const saved = await addReviewLog({
          trade_id: id,
          trade_type: type,
          ai_verdict: reviewLogObj.verdict,
          ai_reasoning: reviewLogObj.reasoning,
          pnl_at_review: payload.current_pnl,
          snapshot_price: payload.current_price,
          confidence: reviewLogObj.confidence,
          key_changes_since_entry: reviewLogObj.key_changes_since_entry,
          suggested_action_detail: reviewLogObj.suggested_action_detail
        });

        setReviewsCached(prev => ({ ...prev, [id]: saved }));
        // Reload history
        const hist = await getReviewHistory(id);
        setReviewHistory(prev => ({ ...prev, [id]: hist }));
        
        setExpandedReviews(prev => ({ ...prev, [id]: true }));
      } else {
        showToast('Review failed: ' + (reviewData.error || 'Unknown error'), 'error');
      }
    } catch (e: any) {
      showToast('Review failed: ' + e.message, 'error');
    } finally {
      setReviewLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // Form Leg controls
  const handleUpdateLeg = (idx: number, patch: Partial<any>) => {
    const updated = [...formFnoLegs];
    updated[idx] = { ...updated[idx], ...patch };
    setFormFnoLegs(updated);
  };

  const handleAddLegForm = () => {
    const defaultStrike = formOptionChain[Math.round(formOptionChain.length / 2)]?.strike || 1000;
    setFormFnoLegs([...formFnoLegs, { action: 'BUY', strike: defaultStrike, option_type: 'CE', entry_premium: 10, lots: 1 }]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header />

      <main className="flex-1 px-4 py-6 md:px-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Dashboard Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight uppercase">Demo Trading Desk</h1>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-bold uppercase">
                Paper Trading
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Test advisory signals and mock strategies with simulated portfolios</p>
          </div>

          <button
            onClick={() => {
              setFormSymbol(stocksList[0]?.symbol || '');
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/15"
          >
            <Plus className="h-4 w-4" />
            New Demo Trade
          </button>
        </div>

        {/* Global Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Tab Open P&L</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black ${summaries.openPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {summaries.openPnl >= 0 ? '+' : ''}₹{summaries.openPnl.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Closed Win Rate</span>
            <span className="text-xl font-black text-white mt-1">{summaries.winRate}%</span>
          </div>
          <div className="border border-zinc-900 bg-zinc-950/40 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Total Positions</span>
            <span className="text-xl font-black text-cyan-455 mt-1">{summaries.totalCount} Trades</span>
          </div>
        </div>

        {/* Main Tab Controls */}
        <div className="flex justify-between items-center border-b border-zinc-900/60 pb-px gap-4">
          <div className="flex gap-2">
            {[
              { id: 'POSITIONAL', label: 'Positional Equity' },
              { id: 'FNO', label: 'F&O Derivatives' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveMainTab(t.id as any);
                  setActiveSubTab('OPEN');
                }}
                className={`px-4 py-2 border-b-2 text-xs font-bold uppercase transition-all ${
                  activeMainTab === t.id
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex bg-zinc-900/80 border border-zinc-800 rounded-lg p-0.5 text-[9px] font-bold">
            <button
              onClick={() => setActiveSubTab('OPEN')}
              className={`px-3 py-1 rounded uppercase transition-all ${
                activeSubTab === 'OPEN' ? 'bg-zinc-800 text-cyan-400 font-bold' : 'text-zinc-500'
              }`}
            >
              Open Positions
            </button>
            <button
              onClick={() => setActiveSubTab('CLOSED')}
              className={`px-3 py-1 rounded uppercase transition-all ${
                activeSubTab === 'CLOSED' ? 'bg-zinc-800 text-cyan-400 font-bold' : 'text-zinc-500'
              }`}
            >
              Closed Logs
            </button>
          </div>
        </div>

        {/* Trade Listings */}
        <div className="space-y-4">
          {activeMainTab === 'POSITIONAL' ? (
            positionalTrades.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
                <TrendingUp className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs uppercase font-bold">No Positional Trades Found</p>
                <p className="text-[10px] text-zinc-650 mt-1">Get suggestions from stock pages or create a manual trade</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {positionalTrades.map(trade => {
                  const { pnl, pnlPercent, ltp } = getPositionalPnL(trade);
                  const isClosed = trade.status === 'CLOSED';
                  const review = reviewsCached[trade.id];
                  const hasReviewHistory = (reviewHistory[trade.id] || []).length > 0;

                  // Progress bar calculation
                  let progressPercent = 50;
                  if (trade.target_price && trade.stop_loss) {
                    const range = trade.target_price - trade.stop_loss;
                    if (range > 0) {
                      progressPercent = Math.max(0, Math.min(100, ((ltp - trade.stop_loss) / range) * 100));
                    }
                  }

                  return (
                    <div key={trade.id} className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 space-y-4 relative overflow-hidden">
                      {/* Top row */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-white">{trade.symbol}</h4>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            trade.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {trade.direction}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            trade.source === 'AI' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-zinc-900 text-zinc-550 border-zinc-800'
                          }`}>
                            {trade.source === 'AI' ? 'AI Suggested' : 'Manual'}
                          </span>
                        </div>

                        {!isClosed && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-zinc-500 uppercase flex items-center gap-1 font-mono">
                              <Clock className="h-3 w-3" />
                              {Math.round((Date.now() - new Date(trade.entry_date).getTime()) / (1000 * 3600 * 24))} Days Held
                            </span>
                            <button
                              onClick={() => handleAskAIReview(trade.id, 'POSITIONAL')}
                              disabled={reviewLoading[trade.id]}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1 transition-all disabled:opacity-50"
                            >
                              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                              {reviewLoading[trade.id] ? 'Reviewing...' : 'Ask AI'}
                            </button>
                            <button
                              onClick={() => handleOpenCloseModal(trade.id, 'POSITIONAL', trade.symbol)}
                              className="px-2.5 py-1 bg-rose-950/20 hover:bg-rose-900/20 border border-rose-500/20 text-rose-400 rounded-lg text-[9px] font-bold uppercase transition-all"
                            >
                              Close Trade
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Middle Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono border-t border-zinc-900/60 pt-4">
                        <div>
                          <span className="text-zinc-500 block font-sans text-[9px] uppercase">Entry price</span>
                          <span className="font-bold text-zinc-300">₹{trade.entry_price}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block font-sans text-[9px] uppercase">
                            {isClosed ? 'Exit price' : 'Current LTP'}
                          </span>
                          <span className="font-bold text-zinc-300">₹{isClosed ? trade.exit_price : ltp}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block font-sans text-[9px] uppercase">Quantity</span>
                          <span className="font-bold text-zinc-300">{trade.quantity}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block font-sans text-[9px] uppercase">PnL</span>
                          <span className={`font-extrabold ${isClosed ? ((trade.exit_price || 0) > trade.entry_price === (trade.direction === 'LONG') ? 'text-emerald-455' : 'text-rose-455') : (pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                            {isClosed ? '' : pnl >= 0 ? '+' : ''}
                            ₹{isClosed ? Math.round((trade.exit_price! - trade.entry_price) * trade.quantity * (trade.direction === 'LONG' ? 1 : -1)).toLocaleString('en-IN') : pnl.toLocaleString('en-IN')}
                            {!isClosed && ` (${pnlPercent}%)`}
                          </span>
                        </div>
                      </div>

                      {/* Target/Stop progress bars */}
                      {!isClosed && trade.target_price && trade.stop_loss && (
                        <div className="space-y-1.5 border-t border-zinc-900/40 pt-3.5">
                          <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-wider">
                            <span className="text-rose-400">Stop loss: ₹{trade.stop_loss}</span>
                            <span className="text-zinc-400">Entry: ₹{trade.entry_price}</span>
                            <span className="text-emerald-400">Target: ₹{trade.target_price}</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-1.5 rounded-full relative overflow-hidden border border-zinc-850">
                            <div 
                              className={`h-full rounded-full transition-all ${pnl >= 0 ? 'bg-gradient-to-r from-cyan-500 to-emerald-500' : 'bg-gradient-to-r from-rose-500 to-cyan-500'}`}
                              style={{ width: `${progressPercent}%` }}
                            />
                            <div className="absolute top-0 bottom-0 w-0.5 bg-zinc-600" style={{ left: '50%' }} />
                          </div>
                        </div>
                      )}

                      {/* Closed Summary Info */}
                      {isClosed && (
                        <div className="border-t border-zinc-900/60 pt-3 text-[10px] text-zinc-500 flex items-center justify-between uppercase font-semibold">
                          <span>Exit Reason: <strong className="text-zinc-300 font-bold">{trade.exit_reason?.replace('_', ' ')}</strong></span>
                          <span>Closed Date: <strong className="text-zinc-300 font-bold">{new Date(trade.exit_date!).toLocaleDateString()}</strong></span>
                        </div>
                      )}

                      {/* Expanded Rationale */}
                      {trade.ai_rationale && (
                        <div className="border-t border-zinc-900/40 pt-3">
                          <button
                            onClick={() => setExpandedRationales(p => ({ ...p, [trade.id]: !p[trade.id] }))}
                            className="text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3 text-cyan-500" />
                            {expandedRationales[trade.id] ? 'Hide Original Thesis' : 'View Original AI Thesis'}
                          </button>
                          {expandedRationales[trade.id] && (
                            <p className="text-[10px] text-zinc-400 mt-2 bg-zinc-900/40 border border-zinc-900 p-3 rounded-lg leading-relaxed font-medium">
                              {trade.ai_rationale}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Active AI Review Verdict Section */}
                      {review && !isClosed && (
                        <div className="border-t border-zinc-900/60 pt-4 space-y-2">
                          <div className={`flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border ${
                            review.ai_verdict === 'CONTINUE' || review.ai_verdict === 'BOOK_PROFIT'
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                              : review.ai_verdict === 'BOOK_LOSS'
                              ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                              : 'bg-blue-500/5 border-blue-500/20 text-blue-400'
                          }`}>
                            <div className="flex items-center gap-2">
                              <Cpu className="h-4 w-4 shrink-0" />
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                AI VERDICT: {review.ai_verdict} (Confidence: {review.confidence || 80}%)
                              </span>
                            </div>

                            {(review.ai_verdict === 'BOOK_PROFIT' || review.ai_verdict === 'BOOK_LOSS') && (
                              <button
                                onClick={() => handleOpenCloseModal(trade.id, 'POSITIONAL', trade.symbol)}
                                className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[9px] font-black uppercase rounded-lg transition-all"
                              >
                                Close Position Now
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => setExpandedReviews(p => ({ ...p, [trade.id]: !p[trade.id] }))}
                            className="text-[9px] font-black text-cyan-400 hover:text-cyan-300 uppercase flex items-center gap-1 pt-1 ml-1"
                          >
                            {expandedReviews[trade.id] ? 'Hide Position Rationale' : 'Read AI Position Rationale'}
                          </button>

                          {expandedReviews[trade.id] && (
                            <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl space-y-3 mt-1.5 animate-fadeIn">
                              <div>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Decision Reasoning</span>
                                <p className="text-[10px] text-zinc-300 leading-relaxed font-medium mt-0.5">
                                  {review.ai_reasoning}
                                </p>
                              </div>

                              {review.key_changes_since_entry && review.key_changes_since_entry.length > 0 && (
                                <div>
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Changes Since Entry</span>
                                  <ul className="list-disc list-inside text-[9.5px] text-zinc-400 space-y-0.5 mt-1 font-medium">
                                    {review.key_changes_since_entry.map((change, i) => (
                                      <li key={i}>{change}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {review.suggested_action_detail && (
                                <div className="p-2 bg-zinc-900 border border-zinc-850 rounded-lg text-[9.5px]">
                                  <span className="text-[8px] text-cyan-400 font-extrabold uppercase tracking-wider block mb-0.5">Suggested Execution</span>
                                  <span className="text-zinc-300 font-bold">{review.suggested_action_detail}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Review Logs History List */}
                      {hasReviewHistory && !isClosed && (
                        <div className="border-t border-zinc-900/40 pt-3">
                          <button
                            onClick={() => setExpandedHistories(p => ({ ...p, [trade.id]: !p[trade.id] }))}
                            className="text-[9px] font-bold text-zinc-500 hover:text-zinc-350 uppercase flex items-center gap-1 ml-1"
                          >
                            Review History ({reviewHistory[trade.id].length})
                          </button>
                          {expandedHistories[trade.id] && (
                            <div className="space-y-1.5 mt-2 bg-zinc-900/10 border border-zinc-900 rounded-lg p-2 max-h-40 overflow-y-auto">
                              {reviewHistory[trade.id].map((log, i) => (
                                <div key={i} className="flex justify-between items-center text-[9px] py-1 border-b border-zinc-900/50 last:border-0 font-mono">
                                  <span className="text-zinc-400 font-bold">{new Date(log.review_date).toLocaleDateString()}</span>
                                  <span className={`font-black ${
                                    log.ai_verdict === 'CONTINUE' || log.ai_verdict === 'BOOK_PROFIT' ? 'text-emerald-400' : 'text-rose-400'
                                  }`}>{log.ai_verdict}</span>
                                  <span className="text-zinc-550">Price: ₹{log.snapshot_price}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            fnoTrades.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
                <Layers3 className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs uppercase font-bold">No F&O Trades Found</p>
                <p className="text-[10px] text-zinc-650 mt-1">Get suggestions from stock pages or create a manual trade</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {fnoTrades.map(trade => {
                  const { pnl, legs } = getFnoPnL(trade);
                  const isClosed = trade.status === 'CLOSED';
                  const review = reviewsCached[trade.id];
                  const hasReviewHistory = (reviewHistory[trade.id] || []).length > 0;

                  return (
                    <div key={trade.id} className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-5 space-y-4 relative overflow-hidden">
                      {/* Top row */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-white">{trade.symbol}</h4>
                          <span className="text-[9px] font-black bg-zinc-900 border border-zinc-850 text-zinc-300 px-1.5 py-0.5 rounded uppercase">
                            {trade.strategy_name}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            trade.source === 'AI' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-zinc-900 text-zinc-550 border-zinc-800'
                          }`}>
                            {trade.source === 'AI' ? 'AI Suggested' : 'Manual'}
                          </span>
                        </div>

                        {!isClosed && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-zinc-500 uppercase flex items-center gap-1 font-mono">
                              <Calendar className="h-3 w-3" />
                              Expiry: {trade.expiry_date}
                            </span>
                            <button
                              onClick={() => handleAskAIReview(trade.id, 'FNO')}
                              disabled={reviewLoading[trade.id]}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1 transition-all disabled:opacity-50"
                            >
                              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                              {reviewLoading[trade.id] ? 'Reviewing...' : 'Ask AI'}
                            </button>
                            <button
                              onClick={() => handleOpenCloseModal(trade.id, 'FNO', trade.symbol)}
                              className="px-2.5 py-1 bg-rose-950/20 hover:bg-rose-900/20 border border-rose-500/20 text-rose-400 rounded-lg text-[9px] font-bold uppercase transition-all"
                            >
                              Close Trade
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Option Legs Table */}
                      <div className="border border-zinc-900 rounded-xl overflow-hidden text-xs">
                        <div className="grid grid-cols-5 bg-zinc-900/40 p-2 border-b border-zinc-900 text-[8px] text-zinc-500 font-bold uppercase tracking-wider text-center">
                          <span>Action</span>
                          <span>Strike</span>
                          <span>Type</span>
                          <span>Entry</span>
                          <span>LTP</span>
                        </div>
                        <div className="divide-y divide-zinc-900 font-mono text-center">
                          {legs.map((leg, idx) => (
                            <div key={idx} className="grid grid-cols-5 p-2 items-center bg-zinc-950/5 text-[11px]">
                              <span className={`font-bold ${leg.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {leg.action}
                              </span>
                              <span className="text-zinc-200 font-bold">{leg.strike}</span>
                              <span className="text-zinc-300 font-bold">{leg.option_type}</span>
                              <span className="text-zinc-500">₹{leg.entry_premium}</span>
                              <span className="text-zinc-300 font-bold">₹{leg.current_premium}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Profit summary values */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono border-t border-zinc-900/40 pt-3.5">
                        <div>
                          <span className="text-zinc-550 block font-sans text-[8px] uppercase">Max Profit</span>
                          <span className="font-bold text-zinc-400">{trade.max_profit_estimate || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-zinc-550 block font-sans text-[8px] uppercase">Max Loss</span>
                          <span className="font-bold text-zinc-400">{trade.max_loss_estimate || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-zinc-550 block font-sans text-[8px] uppercase">Expiry Date</span>
                          <span className="font-bold text-zinc-300">{trade.expiry_date}</span>
                        </div>
                        <div>
                          <span className="text-zinc-550 block font-sans text-[8px] uppercase">PnL</span>
                          <span className={`font-extrabold ${isClosed ? ((trade.realized_pnl || 0) >= 0 ? 'text-emerald-455' : 'text-rose-455') : (pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                            {isClosed ? '' : pnl >= 0 ? '+' : ''}
                            ₹{isClosed ? trade.realized_pnl?.toLocaleString('en-IN') : pnl.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Closed Summary Info */}
                      {isClosed && (
                        <div className="border-t border-zinc-900/60 pt-3 text-[10px] text-zinc-500 flex items-center justify-between uppercase font-semibold">
                          <span>Exit Reason: <strong className="text-zinc-300 font-bold">{trade.exit_reason?.replace('_', ' ')}</strong></span>
                          <span>Closed Date: <strong className="text-zinc-300 font-bold">{new Date(trade.exit_date!).toLocaleDateString()}</strong></span>
                        </div>
                      )}

                      {/* Expandable Rationale */}
                      {trade.ai_rationale && (
                        <div className="border-t border-zinc-900/40 pt-3">
                          <button
                            onClick={() => setExpandedRationales(p => ({ ...p, [trade.id]: !p[trade.id] }))}
                            className="text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3 text-cyan-500" />
                            {expandedRationales[trade.id] ? 'Hide Original Thesis' : 'View Original AI Thesis'}
                          </button>
                          {expandedRationales[trade.id] && (
                            <p className="text-[10px] text-zinc-400 mt-2 bg-zinc-900/40 border border-zinc-900 p-3 rounded-lg leading-relaxed font-medium">
                              {trade.ai_rationale}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Active AI Review Verdict Section */}
                      {review && !isClosed && (
                        <div className="border-t border-zinc-900/60 pt-4 space-y-2">
                          <div className={`flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border ${
                            review.ai_verdict === 'CONTINUE' || review.ai_verdict === 'BOOK_PROFIT'
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                              : review.ai_verdict === 'BOOK_LOSS'
                              ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                              : 'bg-blue-500/5 border-blue-500/20 text-blue-400'
                          }`}>
                            <div className="flex items-center gap-2">
                              <Cpu className="h-4 w-4 shrink-0" />
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                AI VERDICT: {review.ai_verdict} (Confidence: {review.confidence || 80}%)
                              </span>
                            </div>

                            {(review.ai_verdict === 'BOOK_PROFIT' || review.ai_verdict === 'BOOK_LOSS') && (
                              <button
                                onClick={() => handleOpenCloseModal(trade.id, 'FNO', trade.symbol)}
                                className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[9px] font-black uppercase rounded-lg transition-all"
                              >
                                Close Position Now
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => setExpandedReviews(p => ({ ...p, [trade.id]: !p[trade.id] }))}
                            className="text-[9px] font-black text-cyan-400 hover:text-cyan-300 uppercase flex items-center gap-1 pt-1 ml-1"
                          >
                            {expandedReviews[trade.id] ? 'Hide Position Rationale' : 'Read AI Position Rationale'}
                          </button>

                          {expandedReviews[trade.id] && (
                            <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl space-y-3 mt-1.5 animate-fadeIn">
                              <div>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Decision Reasoning</span>
                                <p className="text-[10px] text-zinc-300 leading-relaxed font-medium mt-0.5">
                                  {review.ai_reasoning}
                                </p>
                              </div>

                              {review.key_changes_since_entry && review.key_changes_since_entry.length > 0 && (
                                <div>
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Changes Since Entry</span>
                                  <ul className="list-disc list-inside text-[9.5px] text-zinc-400 space-y-0.5 mt-1 font-medium">
                                    {review.key_changes_since_entry.map((change, i) => (
                                      <li key={i}>{change}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {review.suggested_action_detail && (
                                <div className="p-2 bg-zinc-900 border border-zinc-850 rounded-lg text-[9.5px]">
                                  <span className="text-[8px] text-cyan-400 font-extrabold uppercase tracking-wider block mb-0.5">Suggested Execution</span>
                                  <span className="text-zinc-300 font-bold">{review.suggested_action_detail}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Review Logs History List */}
                      {hasReviewHistory && !isClosed && (
                        <div className="border-t border-zinc-900/40 pt-3">
                          <button
                            onClick={() => setExpandedHistories(p => ({ ...p, [trade.id]: !p[trade.id] }))}
                            className="text-[9px] font-bold text-zinc-500 hover:text-zinc-355 uppercase flex items-center gap-1 ml-1"
                          >
                            Review History ({reviewHistory[trade.id].length})
                          </button>
                          {expandedHistories[trade.id] && (
                            <div className="space-y-1.5 mt-2 bg-zinc-900/10 border border-zinc-900 rounded-lg p-2 max-h-40 overflow-y-auto">
                              {reviewHistory[trade.id].map((log, i) => (
                                <div key={i} className="flex justify-between items-center text-[9px] py-1 border-b border-zinc-900/50 last:border-0 font-mono">
                                  <span className="text-zinc-400 font-bold">{new Date(log.review_date).toLocaleDateString()}</span>
                                  <span className={`font-black ${
                                    log.ai_verdict === 'CONTINUE' || log.ai_verdict === 'BOOK_PROFIT' ? 'text-emerald-400' : 'text-rose-400'
                                  }`}>{log.ai_verdict}</span>
                                  <span className="text-zinc-555">PnL: ₹{log.pnl_at_review}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </main>

      {/* Manual Demo Trade Placement Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative my-8">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Plus className="h-4.5 w-4.5 text-cyan-400" />
              Place Manual Demo Trade
            </h3>

            {/* Switch selector */}
            <div className="flex bg-zinc-900 border border-zinc-850 rounded-lg p-0.5 text-[9px] font-bold mb-4 uppercase">
              <button 
                onClick={() => { setManualType('POSITIONAL'); setFormSymbol(stocksList[0]?.symbol || ''); }}
                className={`flex-1 py-1.5 rounded transition-all ${
                  manualType === 'POSITIONAL' ? 'bg-zinc-800 text-cyan-400 font-bold' : 'text-zinc-500'
                }`}
              >
                Positional Equity
              </button>
              <button 
                onClick={() => { setManualType('FNO'); setFormSymbol(stocksList.filter(s => s.category === 'F&O')[0]?.symbol || ''); }}
                className={`flex-1 py-1.5 rounded transition-all ${
                  manualType === 'FNO' ? 'bg-zinc-800 text-cyan-400 font-bold' : 'text-zinc-500'
                }`}
              >
                F&O Options Spread
              </button>
            </div>

            {manualType === 'POSITIONAL' ? (
              <form onSubmit={handleCreatePosTrade} className="space-y-4 text-xs">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Select Symbol</label>
                  <select
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-bold focus:outline-none uppercase cursor-pointer"
                  >
                    {stocksList.map(s => (
                      <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Direction</label>
                    <select
                      value={formDirection}
                      onChange={(e) => setFormDirection(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-bold focus:outline-none uppercase cursor-pointer"
                    >
                      <option value="LONG">LONG (Buy)</option>
                      <option value="SHORT">SHORT (Sell)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Entry Price (₹)</label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={formEntryPrice}
                      onChange={(e) => setFormEntryPrice(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Quantity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-mono font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Target Price (₹)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={formTarget || ''}
                      onChange={(e) => setFormTarget(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-mono font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Stop Loss (₹)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={formStopLoss || ''}
                      onChange={(e) => setFormStopLoss(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs uppercase rounded-xl transition-all shadow-md shadow-cyan-500/15"
                >
                  Place Trade
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreateFnoTrade} className="space-y-4 text-xs animate-fadeIn">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Select F&O Symbol</label>
                  <select
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-bold focus:outline-none uppercase cursor-pointer"
                  >
                    {stocksList.filter(s => s.category === 'F&O').map(s => (
                      <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Strategy Name</label>
                    <input
                      type="text"
                      required
                      value={formStrategyLabel}
                      onChange={(e) => setFormStrategyLabel(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Expiry Date</label>
                    <select
                      value={formSelectedExpiry}
                      onChange={(e) => setFormSelectedExpiry(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-bold focus:outline-none cursor-pointer"
                    >
                      {formExpiries.map(exp => (
                        <option key={exp} value={exp}>{exp}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Repeatable Legs config */}
                <div className="border border-zinc-900 rounded-xl overflow-hidden">
                  <div className="bg-zinc-900/50 px-3 py-1.5 border-b border-zinc-900 text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex justify-between items-center">
                    <span>Option Legs</span>
                    <button 
                      type="button" 
                      onClick={handleAddLegForm}
                      className="text-[9px] text-cyan-400 font-extrabold uppercase hover:underline"
                    >
                      + Add Leg
                    </button>
                  </div>
                  <div className="divide-y divide-zinc-900 max-h-48 overflow-y-auto p-2 space-y-2">
                    {formFnoLegs.map((leg, idx) => (
                      <div key={idx} className="flex gap-2 items-center font-mono">
                        <select
                          value={leg.action}
                          onChange={(e) => handleUpdateLeg(idx, { action: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-300 rounded p-1 text-center w-16"
                        >
                          <option value="BUY">BUY</option>
                          <option value="SELL">SELL</option>
                        </select>
                        <select
                          value={leg.strike}
                          onChange={(e) => handleUpdateLeg(idx, { strike: Number(e.target.value) })}
                          className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 rounded p-1 flex-1 text-center font-bold"
                        >
                          {formOptionChain.map(item => (
                            <option key={item.strike} value={item.strike}>{item.strike}</option>
                          ))}
                        </select>
                        <select
                          value={leg.option_type}
                          onChange={(e) => handleUpdateLeg(idx, { option_type: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-300 rounded p-1 text-center w-14"
                        >
                          <option value="CE">CE</option>
                          <option value="PE">PE</option>
                        </select>
                        <input
                          type="number"
                          step="0.05"
                          placeholder="Premium"
                          value={leg.entry_premium}
                          onChange={(e) => handleUpdateLeg(idx, { entry_premium: Number(e.target.value) })}
                          className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 rounded p-1 text-center w-16 font-bold"
                        />
                        <input
                          type="number"
                          placeholder="Lots"
                          min="1"
                          value={leg.lots}
                          onChange={(e) => handleUpdateLeg(idx, { lots: Number(e.target.value) })}
                          className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 rounded p-1 text-center w-12 font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs uppercase rounded-xl transition-all shadow-md shadow-cyan-500/15"
                >
                  Place Options Strategy
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Exit confirmation modal overlay */}
      {showCloseModal && closeTradeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle className="h-4.5 w-4.5 text-cyan-450" />
              Confirm Position Exit
            </h3>
            <p className="text-[10px] text-zinc-500 mb-4 uppercase">Close Demo Position</p>

            <div className="space-y-4 text-xs">
              <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-850 font-mono flex justify-between">
                <div>
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Symbol</span>
                  <span className="font-bold text-zinc-200">{closeTradeItem.symbol}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block font-sans uppercase">Live PnL / LTP</span>
                  <span className={`font-bold ${closeTradeItem.liveLtp >= 0 ? 'text-emerald-450' : 'text-rose-450'}`}>
                    ₹{closeTradeItem.liveLtp.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">
                  {closeTradeItem.type === 'POSITIONAL' ? 'Exit Price (₹)' : 'Final Realized PnL (₹)'}
                </label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={closeExitPrice}
                  onChange={(e) => setCloseExitPrice(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-250 rounded-lg p-2 font-mono font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Reason for Exit</label>
                <select
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2 font-bold focus:outline-none cursor-pointer uppercase"
                >
                  <option value="MANUAL_CLOSE">MANUAL CLOSE</option>
                  <option value="TARGET_HIT">TARGET HIT</option>
                  <option value="STOP_LOSS_HIT">STOP LOSS HIT</option>
                  <option value="AI_SUGGESTED_EXIT">AI SUGGESTED EXIT</option>
                  <option value="EXPIRY">EXPIRY</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold text-xs uppercase rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClose}
                className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs uppercase rounded-xl transition-all shadow-md shadow-cyan-500/15"
              >
                Confirm Exit
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
