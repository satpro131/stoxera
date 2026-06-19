import { NextResponse } from 'next/server';
import { getAIRecommendation } from '@/utils/mockData';
import { assembleAdvisoryContext, getLiveOptionChainData } from '@/utils/advisory';
import { calculateMaxPain } from '@/utils/formulas';

export const maxDuration = 60; // Allow up to 60s for Gemini AI responses

// Call 1: Technical Signals Pillar Schema
const technicalSchema = {
  type: 'OBJECT',
  properties: {
    trend_bias: {
      type: 'STRING',
      enum: ['Strong Bullish', 'Bullish', 'Neutral', 'Bearish', 'Strong Bearish']
    },
    summary: { type: 'STRING' },
    key_signals: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    data_quality_issues: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    confidence: { type: 'INTEGER' }
  },
  required: ['trend_bias', 'summary', 'key_signals', 'data_quality_issues', 'confidence']
};

// Call 2: Fundamental Valuation Pillar Schema
const fundamentalSchema = {
  type: 'OBJECT',
  properties: {
    valuation_verdict: {
      type: 'STRING',
      enum: ['Undervalued', 'Fairly Valued', 'Overvalued']
    },
    summary: { type: 'STRING' },
    strengths: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    concerns: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    confidence: { type: 'INTEGER' }
  },
  required: ['valuation_verdict', 'summary', 'strengths', 'concerns', 'confidence']
};

// Call 3: News & Sentiment Pillar Schema
const newsSchema = {
  type: 'OBJECT',
  properties: {
    sentiment: {
      type: 'STRING',
      enum: ['Strongly Positive', 'Positive', 'Mixed', 'Negative', 'Strongly Negative']
    },
    summary: { type: 'STRING' },
    positive_factors: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    negative_factors: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    confidence: { type: 'INTEGER' }
  },
  required: ['sentiment', 'summary', 'positive_factors', 'negative_factors', 'confidence']
};

// Call 4: Final Synthesis Schema
const synthesisSchema = {
  type: 'OBJECT',
  properties: {
    recommendation: {
      type: 'STRING',
      enum: ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']
    },
    confidence: { type: 'INTEGER' },
    horizon: { type: 'STRING' },
    rationale: { type: 'STRING' },
    risk_flags: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    dominant_factor: {
      type: 'STRING',
      enum: ['Technical', 'Fundamental', 'News']
    }
  },
  required: ['recommendation', 'confidence', 'horizon', 'rationale', 'risk_flags', 'dominant_factor']
};

// Call 5A: F&O Strategy Schema
const foStrategySchema = {
  type: 'OBJECT',
  properties: {
    options_strategy: {
      type: 'OBJECT',
      properties: {
        no_trade_possible: { type: 'BOOLEAN' },
        reasoning: { type: 'STRING' },
        strategy_name: { type: 'STRING' },
        setup_type: {
          type: 'STRING',
          enum: ['Rangebound Income', 'Directional Bullish', 'Directional Bearish', 'Volatility Play']
        },
        expiry_used: { type: 'STRING' },
        legs: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['BUY', 'SELL'] },
              strike: { type: 'NUMBER' },
              option_type: { type: 'STRING', enum: ['CE', 'PE'] },
              premium_reference: { type: 'NUMBER' }
            },
            required: ['action', 'strike', 'option_type', 'premium_reference']
          }
        },
        max_profit_estimate: { type: 'STRING' },
        max_loss_estimate: { type: 'STRING' },
        breakeven_points: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        estimated_win_probability: { type: 'INTEGER' },
        risk_factors: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        rationale: { type: 'STRING' }
      },
      required: [
        'no_trade_possible', 'reasoning', 'strategy_name', 'setup_type', 'expiry_used',
        'legs', 'max_profit_estimate', 'max_loss_estimate', 'breakeven_points',
        'estimated_win_probability', 'risk_factors', 'rationale'
      ]
    },
    positional_trade: {
      type: 'OBJECT',
      properties: {
        no_trade_possible: { type: 'BOOLEAN' },
        reasoning: { type: 'STRING' },
        direction: { type: 'STRING', enum: ['Long', 'Short'] },
        entry_point: { type: 'STRING' },
        target_price: { type: 'STRING' },
        stop_loss: { type: 'STRING' },
        expected_timeline: { type: 'STRING' },
        risk_reward_ratio: { type: 'STRING' },
        rationale: { type: 'STRING' }
      },
      required: [
        'no_trade_possible', 'reasoning', 'direction', 'entry_point',
        'target_price', 'stop_loss', 'expected_timeline', 'risk_reward_ratio', 'rationale'
      ]
    }
  },
  required: ['options_strategy', 'positional_trade']
};

// Call 5B: Non-F&O Positional Trade Schema
const nonFoStrategySchema = {
  type: 'OBJECT',
  properties: {
    no_trade_possible: { type: 'BOOLEAN' },
    reasoning: { type: 'STRING' },
    direction: { type: 'STRING', enum: ['Long', 'Short'] },
    entry_point: { type: 'STRING' },
    target_price: { type: 'STRING' },
    expected_profit_percent: { type: 'STRING' },
    stop_loss: { type: 'STRING' },
    stop_loss_percent: { type: 'STRING' },
    expected_timeline: { type: 'STRING' },
    risk_reward_ratio: { type: 'STRING' },
    rationale: { type: 'STRING' }
  },
  required: [
    'no_trade_possible', 'reasoning', 'direction', 'entry_point', 'target_price',
    'expected_profit_percent', 'stop_loss', 'stop_loss_percent', 'expected_timeline',
    'risk_reward_ratio', 'rationale'
  ]
};

async function callGemini(model: string, prompt: string, schema: any, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.substring(0, 250)}`);
  }

  const resData = await response.json();
  const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }
  return JSON.parse(text.trim());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();
    const model = searchParams.get('model') || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const instrumentKey = searchParams.get('instrument_key') || undefined;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol parameter is required' }, { status: 400 });
    }

    // Assemble unified fresh context
    const context = await assembleAdvisoryContext(symbol, instrumentKey);
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        // Call 1: Technical signals prompt
        const technicalPrompt = `
CURRENT PRICE — all comparisons below must be relative to this exact value: ₹${context.price}
Symbol: ${context.symbol}

Please analyze the multi-timeframe technical indicator data below:
Daily RSI: ${context.technicals.rsi}
Daily Trend Bias: ${context.technicals.trend}
Daily SMA 20: ₹${context.technicals.sma20}
Daily SMA 50: ₹${context.technicals.sma50}
Daily SMA 200: ₹${context.technicals.sma200}
Daily Support levels: ${context.technicals.support.join(', ')}
Daily Resistance levels: ${context.technicals.resistance.join(', ')}
Daily MACD Line: ${context.technicals.macd.macdLine}, Signal Line: ${context.technicals.macd.signalLine}, Histogram: ${context.technicals.macd.histogram}

Explicit Instruction Block:
Before forming any conclusion, verify each SMA/support/resistance value is plausible relative to CURRENT PRICE. If any indicator value appears inconsistent with current price (e.g., differs by more than 30%), flag it in data_quality_issues instead of using it in your reasoning. Do not silently reason around inconsistent data.
`;

        // Call 2: Fundamental valuation prompt
        const fundamentalPrompt = `
Symbol: ${context.symbol}
Sector: ${context.sector}
As-Of Date: ${context.fundamentals.as_of_date || new Date().toISOString().split('T')[0]}

Please analyze the fundamental valuation metrics below:
Market Cap: ${context.fundamentals.marketCap}
P/E Ratio: ${context.fundamentals.pe}
P/B Ratio: ${context.fundamentals.pb}
ROE: ${context.fundamentals.roe}%
ROCE: ${context.fundamentals.roce}%
Debt-to-Equity: ${context.fundamentals.debtToEquity}
EPS Growth YoY: ${context.fundamentals.epsGrowth}%
Revenue Growth YoY: ${context.fundamentals.revenueGrowth}%
Promoter Holding: ${context.fundamentals.promoterHolding}%
Dividend Yield: ${context.fundamentals.dividendYield}%

Assess these metrics in relation to standard sector norms. Contextualize whether the P/E is stretched relative to the sector rather than an absolute number. Note the freshness of data if the as_of_date is old (>45 days).
`;

        // Call 3: News & Sentiment prompt
        const newsArticles = context.newsSentiment.articles.slice(0, 15);
        const newsPrompt = `
Symbol: ${context.symbol}

Please analyze the recent news articles (last 7-10 days, max 15 articles) below:
${newsArticles.map((art, idx) => `
Article ${idx + 1}:
Headline: ${art.headline || art.title}
Source: ${art.source}
Published At: ${art.published_at}
Summary: ${art.summary}
Muted/Source Sentiment: ${art.sentiment}
`).join('\n')}

Explicit Instructions:
1. Distinguish between events that are merely labeled positive/negative by a source and events that are factually positive/negative for the business. A one-time legal cost or settlement is a negative financial event even if a headline frames it neutrally or positively.
2. Weight recency — more recent news should be weighted more heavily than older news.
`;

        // Run Call 1, 2, 3 in parallel
        const [techResult, fundResult, newsResult] = await Promise.all([
          callGemini(model, technicalPrompt, technicalSchema, geminiKey).catch(err => {
            console.error('[Pillar Technical] Failed:', err);
            return {
              trend_bias: 'Neutral',
              summary: 'Failed to analyze technical signals pillar.',
              key_signals: [],
              data_quality_issues: ['Technical analysis pipeline timed out/failed'],
              confidence: 0,
              failed: true
            };
          }),
          callGemini(model, fundamentalPrompt, fundamentalSchema, geminiKey).catch(err => {
            console.error('[Pillar Fundamental] Failed:', err);
            return {
              valuation_verdict: 'Fairly Valued',
              summary: 'Failed to analyze fundamental valuation pillar.',
              strengths: [],
              concerns: [],
              confidence: 0,
              failed: true
            };
          }),
          callGemini(model, newsPrompt, newsSchema, geminiKey).catch(err => {
            console.error('[Pillar News] Failed:', err);
            return {
              sentiment: 'Mixed',
              summary: 'Failed to analyze news & sentiment pillar.',
              positive_factors: [],
              negative_factors: [],
              confidence: 0,
              failed: true
            };
          })
        ]);

        // Call 4: Synthesis
        const optionContext = context.options
          ? `Option Chain context: PCR ${context.options.pcr}, Max Pain strike ${context.options.maxPain}, Buildup: ${context.options.buildupType || 'Neutral'}`
          : 'Option Chain context: N/A';

        const synthesisPrompt = `
You are the Lead Investment Strategist finalizing a stock advisory report.
Synthesize the outputs from our three analytical pillars below into a single recommendation.

Symbol: ${context.symbol}
Sector: ${context.sector}
Current Price: ₹${context.price}
${optionContext}

[PILLAR 1: TECHNICAL SIGNALS ANALYSIS]
${JSON.stringify(techResult, null, 2)}

[PILLAR 2: FUNDAMENTAL VALUATION ANALYSIS]
${JSON.stringify(fundResult, null, 2)}

[PILLAR 3: NEWS & SENTIMENT ANALYSIS]
${JSON.stringify(newsResult, null, 2)}

Explicit Instructions:
1. Explicitly weigh and reconcile disagreement: If the three pillars disagree (e.g., strong fundamentals but bearish technicals), state this conflict explicitly in the rationale rather than averaging it away silently.
2. Set investment horizon based on which pillar dominates the call: e.g. a technical-driven call should suggest a shorter horizon (days-weeks) than a fundamentals-driven call (months).
`;

        const synthesisResult = await callGemini(model, synthesisPrompt, synthesisSchema, geminiKey);

        // Call 5: Trade Strategy Suggestion (Sequential)
        let tradeSetup: any = null;
        let validationError: string | null = null;
        const isFO = context.category === 'F&O';

        const maxRetries = 2;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (isFO) {
              const rawChain = await getLiveOptionChainData(symbol, instrumentKey);
              const relevantChain = rawChain;

              const foPrompt = `
You are an Options Trading Strategist specializing in Indian derivatives markets (NSE/BSE).
Your goal is to suggest a viable options strategy AND a separate cash market positional trade for: ${symbol} (Current Price: ₹${context.price}).

[FINAL SYNTHESIS REPORT]
${JSON.stringify(synthesisResult, null, 2)}

[TECHNICAL ANALYSIS SUMMARY]
${JSON.stringify(techResult, null, 2)}

[OPTION CHAIN DATA FOR NEAREST EXPIRIES]
${JSON.stringify(relevantChain.slice(0, 25), null, 2)}

[DERIVATIVES SUMMARY]
Put-Call Ratio (PCR): ${context.options?.pcr || 'N/A'}
Max Pain Strike: ${context.options?.maxPain || 'N/A'}
Total Call Open Interest: ${context.options?.totalCallOI || 0}
Total Put Open Interest: ${context.options?.totalPutOI || 0}

Explicit Instructions:
1. Only suggest a strategy if the available option chain data supports a definable risk-reward setup with strikes that actually have meaningful OI/liquidity (avoid strikes with near-zero OI or volume — these are not tradeable). If the setup is unclear, conflicting, or no strikes have adequate liquidity to construct a sensible trade, return no_trade_possible: true and explain why in reasoning — do not force a strategy.
2. Consider both a near-term options strategy (using the option chain/expiry data) AND a separate positional (cash market) trade suggestion using the underlying stock itself, independent of expiry. These should be returned as two separate fields and evaluated independently — it's possible one is viable and the other is not.
3. Select strikes only from the provided option chain data — do not invent strikes or premiums. Reference actual LTP values provided for each leg.
`;
              tradeSetup = await callGemini(model, foPrompt, foStrategySchema, geminiKey);

              // Server-side validation rules
              if (tradeSetup && !tradeSetup.options_strategy.no_trade_possible) {
                const legs = tradeSetup.options_strategy.legs || [];
                for (const leg of legs) {
                  const matched = rawChain.find(item => item.strike === leg.strike);
                  if (!matched) {
                    throw new Error(`Invalid strike ${leg.strike} suggested by LLM.`);
                  }
                  const ltp = leg.option_type === 'CE' ? matched.call?.ltp : matched.put?.ltp;
                  if (ltp !== undefined && ltp > 0) {
                    const diff = Math.abs(leg.premium_reference - ltp);
                    if (diff / ltp > 0.35 && diff > 15) {
                      throw new Error(`Suggested premium ${leg.premium_reference} deviates too far from actual LTP ${ltp}.`);
                    }
                  }
                }
              }
            } else {
              const nonFoPrompt = `
You are a Positional Equity Trader.
Suggest a cash market positional trade setup for: ${symbol} (Current Price: ₹${context.price}).

[FINAL SYNTHESIS REPORT]
${JSON.stringify(synthesisResult, null, 2)}

[TECHNICAL SIGNALS]
Daily RSI: ${context.technicals.rsi}
Trend Bias: ${context.technicals.trend}
SMA 20: ₹${context.technicals.sma20}
SMA 50: ₹${context.technicals.sma50}
Daily SMA 200: ₹${context.technicals.sma200}
Support levels: ${context.technicals.support.join(', ')}
Resistance levels: ${context.technicals.resistance.join(', ')}
MACD Line: ${context.technicals.macd.macdLine}, Signal Line: ${context.technicals.macd.signalLine}, Histogram: ${context.technicals.macd.histogram}

Explicit Instructions:
1. Entry point should reference an actual technical level (support, pivot, or moving average) already provided — do not pick an arbitrary number disconnected from the given levels.
2. If the recommendation from synthesis is Hold or the technical/fundamental signals are too conflicting to define a clear entry/exit, return no_trade_possible: true with reasoning, rather than forcing an entry.
3. Tie the expected timeline to the dominant factor: if the call is primarily technically driven, timeline should be short (days to a few weeks). If primarily fundamentally driven, timeline should be longer (months) to allow the thesis to play out.
`;
              tradeSetup = await callGemini(model, nonFoPrompt, nonFoStrategySchema, geminiKey);
            }
            break; // success
          } catch (err: any) {
            console.warn(`[Call 5 Attempt ${attempt}] Validation or LLM failed:`, err.message);
            validationError = err.message;
            if (attempt === maxRetries) {
              // Final fallback
              if (isFO) {
                tradeSetup = {
                  options_strategy: {
                    no_trade_possible: true,
                    reasoning: `Validation failure on LLM output: ${err.message}`,
                    strategy_name: 'N/A',
                    setup_type: 'Rangebound Income',
                    expiry_used: '',
                    legs: [],
                    max_profit_estimate: 'N/A',
                    max_loss_estimate: 'N/A',
                    breakeven_points: [],
                    estimated_win_probability: 0,
                    risk_factors: [],
                    rationale: ''
                  },
                  positional_trade: {
                    no_trade_possible: true,
                    reasoning: 'Validation failure on LLM output.',
                    direction: 'Long',
                    entry_point: 'N/A',
                    target_price: 'N/A',
                    stop_loss: 'N/A',
                    expected_timeline: 'N/A',
                    risk_reward_ratio: 'N/A',
                    rationale: ''
                  }
                };
              } else {
                tradeSetup = {
                  no_trade_possible: true,
                  reasoning: `Validation failure on LLM output: ${err.message}`,
                  direction: 'Long',
                  entry_point: 'N/A',
                  target_price: 'N/A',
                  expected_profit_percent: 'N/A',
                  stop_loss: 'N/A',
                  stop_loss_percent: 'N/A',
                  expected_timeline: 'N/A',
                  risk_reward_ratio: 'N/A',
                  rationale: ''
                };
              }
            }
          }
        }

        const responseData = {
          ...synthesisResult,
          // Compatibility mappings
          confidenceScore: synthesisResult.confidence,
          holdingPeriod: synthesisResult.horizon,
          reasoningSummary: {
            newsSentiment: newsResult.summary,
            fundamentals: fundResult.summary,
            technicals: techResult.summary,
            finalSynthesis: synthesisResult.rationale
          },
          riskFlags: synthesisResult.risk_flags,
          pillars: {
            technical: techResult,
            fundamental: fundResult,
            news: newsResult
          },
          tradeSetup
        };

        return NextResponse.json({
          success: true,
          source: `Gemini AI (${model})`,
          data: responseData
        });
      } catch (geminiError: any) {
        console.warn('[Gemini API Pipeline Failed - falling back to Rule Engine]:', geminiError);
        // Fall through to the Rule Engine
      }
    }

    // Fallback to local rule-based engine
    const localRec = getAIRecommendation(symbol);
    const isFO = context.category === 'F&O';

    const direction: 'Long' | 'Short' = (localRec.recommendation === 'Sell' || localRec.recommendation === 'Avoid') ? 'Short' : 'Long';
    const entry = context.price;

    let target = 0;
    let stopLoss = 0;

    if (direction === 'Long') {
      target = context.technicals.resistance[0] > context.price 
        ? context.technicals.resistance[0] 
        : Math.round(context.price * 1.07 * 10) / 10;
      stopLoss = context.technicals.support[0] < context.price 
        ? context.technicals.support[0] 
        : Math.round(context.price * 0.965 * 10) / 10;
    } else {
      target = context.technicals.support[0] < context.price 
        ? context.technicals.support[0] 
        : Math.round(context.price * 0.93 * 10) / 10;
      stopLoss = context.technicals.resistance[0] > context.price 
        ? context.technicals.resistance[0] 
        : Math.round(context.price * 1.035 * 10) / 10;
    }

    const expectedProfitPercent = direction === 'Long'
      ? `+${((target - entry) / entry * 100).toFixed(1)}%`
      : `-${((entry - target) / entry * 100).toFixed(1)}%`;

    const stopLossPercent = direction === 'Long'
      ? `-${((entry - stopLoss) / entry * 100).toFixed(1)}%`
      : `+${((stopLoss - entry) / entry * 100).toFixed(1)}%`;

    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(target - entry);
    const risk_reward_ratio = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : '1:2.0';

    const expectedTimeline = localRec.holdingPeriod || '2-4 Weeks';

    let rationale = '';
    if (localRec.recommendation === 'Hold') {
      rationale = `The stock exhibits rangebound consolidation with RSI at ${context.technicals.rsi} near middle zone. Standard positioning suggests accumulation close to support level S1 (₹${context.technicals.support[0]}) targeting resistance R1 (₹${context.technicals.resistance[0]}).`;
    } else if (direction === 'Long') {
      rationale = `${context.symbol} shows bullish momentum with RSI at ${context.technicals.rsi} and is trading above critical support S1 (₹${context.technicals.support[0]}). Favorable entry near current spot price ₹${context.price} targeting resistance R1 (₹${context.technicals.resistance[0]}) with a stop below support.`;
    } else {
      rationale = `${context.symbol} displays bearish signals with RSI at ${context.technicals.rsi} trading below resistance levels. We suggest a short tactical trade targeting support S1 (₹${context.technicals.support[0]}) with a stop loss just above R1 (₹${context.technicals.resistance[0]}).`;
    }

    let defaultTradeSetup: any;

    if (isFO) {
      let lotSize = 500;
      if (symbol === 'NIFTY') lotSize = 25;
      else if (symbol === 'BANKNIFTY') lotSize = 15;
      else if (symbol === 'RELIANCE') lotSize = 250;
      else if (symbol === 'TCS') lotSize = 175;

      const chain = await getLiveOptionChainData(symbol, instrumentKey) || [];
      let atmStrike = Math.round(context.price);
      let atmIndex = -1;
      let minDiff = Infinity;
      chain.forEach((item: any, idx: number) => {
        const diff = Math.abs(item.strike - context.price);
        if (diff < minDiff) {
          minDiff = diff;
          atmStrike = item.strike;
          atmIndex = idx;
        }
      });

      if (atmIndex === -1 && chain.length > 0) {
        atmIndex = Math.floor(chain.length / 2);
        atmStrike = chain[atmIndex].strike;
      }

      const spacing = chain.length > 1 ? Math.abs(chain[1].strike - chain[0].strike) : 50;

      let strategy_name = 'Iron Condor';
      let setup_type = 'Rangebound Income';
      let legs: any[] = [];
      let max_profit_estimate = '₹10,000';
      let max_loss_estimate = '₹5,000';
      let breakeven_points: string[] = [];
      let estimated_win_probability = 62;
      let optionsRationale = '';
      let risk_factors: string[] = [];

      if (localRec.recommendation === 'Hold') {
        strategy_name = 'Iron Condor';
        setup_type = 'Rangebound Income';
        estimated_win_probability = 70;
        
        const otmPutIdx = Math.max(0, atmIndex - 2);
        const farOtmPutIdx = Math.max(0, atmIndex - 4);
        const otmCallIdx = Math.min(chain.length - 1, atmIndex + 2);
        const farOtmCallIdx = Math.min(chain.length - 1, atmIndex + 4);

        const leg1_strike = chain[otmPutIdx]?.strike || (atmStrike - 2 * spacing);
        const leg2_strike = chain[farOtmPutIdx]?.strike || (atmStrike - 4 * spacing);
        const leg3_strike = chain[otmCallIdx]?.strike || (atmStrike + 2 * spacing);
        const leg4_strike = chain[farOtmCallIdx]?.strike || (atmStrike + 4 * spacing);

        const p1 = chain[otmPutIdx]?.put?.ltp || 15;
        const p2 = chain[farOtmPutIdx]?.put?.ltp || 5;
        const p3 = chain[otmCallIdx]?.call?.ltp || 16;
        const p4 = chain[farOtmCallIdx]?.call?.ltp || 6;

        legs = [
          { action: 'SELL', strike: leg1_strike, option_type: 'PE', premium_reference: p1 },
          { action: 'BUY', strike: leg2_strike, option_type: 'PE', premium_reference: p2 },
          { action: 'SELL', strike: leg3_strike, option_type: 'CE', premium_reference: p3 },
          { action: 'BUY', strike: leg4_strike, option_type: 'CE', premium_reference: p4 }
        ];

        const netCredit = (p1 - p2) + (p3 - p4);
        const maxProfit = netCredit * lotSize;
        const width = leg1_strike - leg2_strike;
        const maxLoss = (width - netCredit) * lotSize;

        max_profit_estimate = `₹${Math.round(maxProfit).toLocaleString('en-IN')}`;
        max_loss_estimate = `₹${Math.round(maxLoss).toLocaleString('en-IN')}`;
        breakeven_points = [`₹${Math.round(leg1_strike - netCredit)}`, `₹${Math.round(leg3_strike + netCredit)}`];
        optionsRationale = `With ${symbol} exhibiting rangebound consolidation (RSI at ${context.technicals.rsi}), selling an Iron Condor collects net premium credit of ₹${netCredit.toFixed(1)} per share, maximizing yield as long as the price stays between support ₹${leg1_strike} and resistance ₹${leg3_strike}.`;
        risk_factors = ['Sudden gap up/down breaking outer strikes', 'Spike in implied volatility (IV) expansion'];
      } else if (direction === 'Long') {
        strategy_name = 'Bull Call Spread';
        setup_type = 'Directional Bullish';
        estimated_win_probability = 65;

        const buyStrikeIdx = atmIndex;
        const sellStrikeIdx = Math.min(chain.length - 1, atmIndex + 2);

        const leg1_strike = chain[buyStrikeIdx]?.strike || atmStrike;
        const leg2_strike = chain[sellStrikeIdx]?.strike || (atmStrike + 2 * spacing);

        const p1 = chain[buyStrikeIdx]?.call?.ltp || 50;
        const p2 = chain[sellStrikeIdx]?.call?.ltp || 20;

        legs = [
          { action: 'BUY', strike: leg1_strike, option_type: 'CE', premium_reference: p1 },
          { action: 'SELL', strike: leg2_strike, option_type: 'CE', premium_reference: p2 }
        ];

        const netDebit = p1 - p2;
        const maxLoss = netDebit * lotSize;
        const maxProfit = (leg2_strike - leg1_strike - netDebit) * lotSize;

        max_profit_estimate = `₹${Math.round(maxProfit).toLocaleString('en-IN')}`;
        max_loss_estimate = `₹${Math.round(maxLoss).toLocaleString('en-IN')}`;
        breakeven_points = [`₹${Math.round(leg1_strike + netDebit)}`];
        optionsRationale = `With ${symbol} showing a strong bullish breakout pattern and trend (${context.technicals.trend}), buying a Bull Call Spread reduces premium entry cost to ₹${netDebit.toFixed(1)} per share. Capital is strictly capped while enabling solid leverage for a move towards resistance.`;
        risk_factors = ['Time decay (theta) drag if stock price stagnates', 'Price failing to cross breakeven by expiry'];
      } else {
        strategy_name = 'Bear Put Spread';
        setup_type = 'Directional Bearish';
        estimated_win_probability = 68;

        const buyStrikeIdx = atmIndex;
        const sellStrikeIdx = Math.max(0, atmIndex - 2);

        const leg1_strike = chain[buyStrikeIdx]?.strike || atmStrike;
        const leg2_strike = chain[sellStrikeIdx]?.strike || (atmStrike - 2 * spacing);

        const p1 = chain[buyStrikeIdx]?.put?.ltp || 50;
        const p2 = chain[sellStrikeIdx]?.put?.ltp || 20;

        legs = [
          { action: 'BUY', strike: leg1_strike, option_type: 'PE', premium_reference: p1 },
          { action: 'SELL', strike: leg2_strike, option_type: 'PE', premium_reference: p2 }
        ];

        const netDebit = p1 - p2;
        const maxLoss = netDebit * lotSize;
        const maxProfit = (leg1_strike - leg2_strike - netDebit) * lotSize;

        max_profit_estimate = `₹${Math.round(maxProfit).toLocaleString('en-IN')}`;
        max_loss_estimate = `₹${Math.round(maxLoss).toLocaleString('en-IN')}`;
        breakeven_points = [`₹${Math.round(leg1_strike - netDebit)}`];
        optionsRationale = `With ${symbol} showing a bearish breakdown and trend (${context.technicals.trend}), buying a Bear Put Spread reduces premium entry cost to ₹${netDebit.toFixed(1)} per share. This allows high-probability leverage for a move towards support.`;
        risk_factors = ['Time decay (theta) drag if stock price consolidates', 'Sudden bullish trend reversal'];
      }

      defaultTradeSetup = {
        options_strategy: {
          no_trade_possible: false,
          reasoning: '',
          strategy_name,
          setup_type,
          expiry_used: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
          legs,
          max_profit_estimate,
          max_loss_estimate,
          breakeven_points,
          estimated_win_probability,
          risk_factors,
          rationale: optionsRationale
        },
        positional_trade: {
          no_trade_possible: false,
          reasoning: '',
          direction,
          entry_point: `₹${Math.round(entry)}`,
          target_price: `₹${Math.round(target)}`,
          stop_loss: `₹${Math.round(stopLoss)}`,
          expected_timeline: expectedTimeline,
          risk_reward_ratio,
          rationale
        }
      };
    } else {
      defaultTradeSetup = {
        no_trade_possible: false,
        reasoning: '',
        direction,
        entry_point: `₹${Math.round(entry)}`,
        target_price: `₹${Math.round(target)}`,
        expected_profit_percent: expectedProfitPercent,
        stop_loss: `₹${Math.round(stopLoss)}`,
        stop_loss_percent: stopLossPercent,
        expected_timeline: expectedTimeline,
        risk_reward_ratio,
        rationale
      };
    }

    return NextResponse.json({
      success: true,
      source: 'Rule Engine',
      data: {
        ...localRec,
        pillars: {
          technical: {
            trend_bias: localRec.recommendation === 'Buy' ? 'Bullish' : localRec.recommendation === 'Avoid' ? 'Bearish' : 'Neutral',
            summary: localRec.reasoningSummary.technicals,
            key_signals: ['Rule-based engine assessment'],
            data_quality_issues: [],
            confidence: localRec.confidenceScore
          },
          fundamental: {
            valuation_verdict: localRec.recommendation === 'Buy' ? 'Undervalued' : localRec.recommendation === 'Avoid' ? 'Overvalued' : 'Fairly Valued',
            summary: localRec.reasoningSummary.fundamentals,
            strengths: [],
            concerns: [],
            confidence: localRec.confidenceScore
          },
          news: {
            sentiment: localRec.recommendation === 'Buy' ? 'Positive' : localRec.recommendation === 'Avoid' ? 'Negative' : 'Mixed',
            summary: localRec.reasoningSummary.newsSentiment,
            positive_factors: [],
            negative_factors: [],
            confidence: localRec.confidenceScore
          }
        },
        tradeSetup: defaultTradeSetup
      }
    });
  } catch (error: any) {
    console.error('[AI Advisory API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
