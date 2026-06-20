import { NextResponse } from 'next/server';

const reviewSchema = {
  type: 'OBJECT',
  properties: {
    verdict: {
      type: 'STRING',
      enum: ['CONTINUE', 'BOOK_PROFIT', 'BOOK_LOSS', 'ADJUST']
    },
    reasoning: { type: 'STRING' },
    confidence: { type: 'INTEGER' },
    key_changes_since_entry: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    suggested_action_detail: { type: 'STRING' }
  },
  required: ['verdict', 'reasoning', 'confidence', 'key_changes_since_entry', 'suggested_action_detail']
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { trade, type, current_price, current_pnl, technicals, news, option_chain } = body;

    if (!trade || !type) {
      return NextResponse.json({ success: false, error: 'Trade and type are required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (geminiKey) {
      try {
        let prompt = '';
        if (type === 'POSITIONAL') {
          prompt = `
You are a Senior Risk Officer and Investment Advisor reviewing an open Positional Cash Trade.
Determine if the trader should Continue, Book Profit, Book Loss, or Adjust the position based on the original thesis and fresh data.

[ORIGINAL TRADE CONTEXT]
Symbol: ${trade.symbol}
Direction: ${trade.direction}
Entry Price: ₹${trade.entry_price}
Target Price: ₹${trade.target_price || 'N/A'}
Stop Loss: ₹${trade.stop_loss || 'N/A'}
Entry Date: ${trade.entry_date}
Original Rationale: ${trade.ai_rationale || 'User-placed manual trade'}
Expected Timeline: ${trade.expected_timeline || 'N/A'}

[CURRENT POSITION STATE]
Current Price: ₹${current_price}
Current PnL: ₹${current_pnl}
Days Held: ${Math.round((Date.now() - new Date(trade.entry_date).getTime()) / (1000 * 3600 * 24))} days

[FRESH TECHNICAL SIGNALS]
Daily RSI: ${technicals?.rsi || 'N/A'}
Daily Trend: ${technicals?.trend || 'N/A'}
SMA 20: ₹${technicals?.sma20 || 'N/A'}
Support 1: ₹${technicals?.support?.[0] || 'N/A'}, Resistance 1: ₹${technicals?.resistance?.[0] || 'N/A'}
MACD Histogram: ${technicals?.macd?.histogram || 'N/A'}

[FRESH NEWS SENTIMENT]
News Sentiment Label: ${news?.label || 'Neutral'}
News Sentiment Score: ${news?.score || 0}
Recent Article Count: ${news?.totalCount || 0}

Please analyze if the support/resistance structure holds. Recommend action details explicitly.
`;
        } else {
          prompt = `
You are an Options Portfolio Manager reviewing an open F&O Options Strategy.
Determine if the trader should Continue, Book Profit, Book Loss, or Adjust the strategy. Consider time decay (theta) and IV changes.

[ORIGINAL TRADE CONTEXT]
Symbol: ${trade.symbol}
Strategy: ${trade.strategy_name}
Expiry Date: ${trade.expiry_date}
Original Rationale: ${trade.ai_rationale || 'User-placed manual trade'}
Max Profit Estimate: ${trade.max_profit_estimate || 'N/A'}
Max Loss Estimate: ${trade.max_loss_estimate || 'N/A'}

[CURRENT POSITION STATE]
Current Price: ₹${current_price}
Current Realized/Unrealized PnL: ₹${current_pnl}
Days to Expiry: ${Math.max(0, Math.round((new Date(trade.expiry_date).getTime() - Date.now()) / (1000 * 3600 * 24)))} days

[OPTIONS CHAIN & DERIVATIVES CONTEXT]
Put-Call Ratio (PCR): ${option_chain?.pcr || 'N/A'}
Max Pain Strike: ${option_chain?.maxPain || 'N/A'}
Buildup: ${option_chain?.buildupType || 'Neutral'}

Please suggest an exit or adjustment verdict.
`;
        }

        const result = await callGemini(model, prompt, reviewSchema, geminiKey);
        return NextResponse.json({
          success: true,
          source: `Gemini AI (${model})`,
          data: result
        });
      } catch (err: any) {
        console.warn('[Review Gemini Pipeline Failed - falling back to Rule Engine]:', err);
      }
    }

    // Rule-Based Position Review Fallback Engine
    const isPositional = type === 'POSITIONAL';
    let verdict: 'CONTINUE' | 'BOOK_PROFIT' | 'BOOK_LOSS' | 'ADJUST' = 'CONTINUE';
    let reasoning = '';
    const keyChanges: string[] = [];
    let suggestedAction = '';

    if (isPositional) {
      const entryPrice = trade.entry_price;
      const currentPriceNum = Number(current_price);
      const targetPrice = trade.target_price ? Number(trade.target_price) : entryPrice * 1.07;
      const stopLossPrice = trade.stop_loss ? Number(trade.stop_loss) : entryPrice * 0.965;
      const direction = trade.direction;

      const pnlPct = ((currentPriceNum - entryPrice) / entryPrice) * 100 * (direction === 'LONG' ? 1 : -1);

      if (direction === 'LONG') {
        if (currentPriceNum >= targetPrice * 0.95) {
          verdict = 'BOOK_PROFIT';
          reasoning = `The stock is trading at ₹${currentPriceNum}, within 5% of its primary target (₹${targetPrice}). Technical structures show the stock is meeting resistance boundaries. Recommend closing to secure gains.`;
          suggestedAction = 'Book profits immediately at current market price.';
          keyChanges.push(`Price surged close to target level of ₹${targetPrice}`);
        } else if (currentPriceNum <= stopLossPrice * 1.02) {
          verdict = 'BOOK_LOSS';
          reasoning = `The stock has slipped to ₹${currentPriceNum}, dangerously close to or below the stop loss (₹${stopLossPrice}). Key support levels have been violated, indicating the long thesis is no longer active.`;
          suggestedAction = 'Exit position to protect remaining capital.';
          keyChanges.push(`Price breached critical support near stop loss of ₹${stopLossPrice}`);
        } else {
          verdict = 'CONTINUE';
          reasoning = `The position is currently in consolidation at ₹${currentPriceNum}. RSI is hovering around ${technicals?.rsi || 50}, which is in a stable trading zone. The stock continues to hold above major moving averages.`;
          suggestedAction = 'Hold position with a trailing stop loss.';
          keyChanges.push('Consolidation above primary S1 support.');
        }
      } else { // SHORT
        if (currentPriceNum <= targetPrice * 1.05) {
          verdict = 'BOOK_PROFIT';
          reasoning = `The stock has dropped to ₹${currentPriceNum}, meeting target expectation zones near ₹${targetPrice}. Sell volume exhaustion is visible, suggesting potential rebound. Recommend locking in gains.`;
          suggestedAction = 'Book short position profits now.';
          keyChanges.push(`Price dropped close to short target level of ₹${targetPrice}`);
        } else if (currentPriceNum >= stopLossPrice * 0.98) {
          verdict = 'BOOK_LOSS';
          reasoning = `The stock has risen to ₹${currentPriceNum}, approaching the short stop loss boundary at ₹${stopLossPrice}. Technical indicators show a bullish momentum squeeze, invalidating short positions.`;
          suggestedAction = 'Cover short position to limit drawdowns.';
          keyChanges.push(`Price squeezed above short-term resistance near stop loss of ₹${stopLossPrice}`);
        } else {
          verdict = 'CONTINUE';
          reasoning = `The short position remains in a downtrend channels. RSI is weak around ${technicals?.rsi || 45}, and overhead resistance level R1 (₹${technicals?.resistance?.[0] || 'N/A'}) remains unthreatened.`;
          suggestedAction = 'Keep short position open, targeting S1 support.';
          keyChanges.push('Trend continuation with weak momentum.');
        }
      }
    } else { // FNO
      const daysToExpiry = Math.max(0, Math.round((new Date(trade.expiry_date).getTime() - Date.now()) / (1000 * 3600 * 24)));
      const pnlVal = Number(current_pnl);

      if (daysToExpiry <= 3) {
        if (pnlVal > 0) {
          verdict = 'BOOK_PROFIT';
          reasoning = `With only ${daysToExpiry} days remaining until expiry, theta decay has extracted most of the option's value. Proximity to expiry increases gamma risk. Recommend booking profit to avoid end-of-series volatility.`;
          suggestedAction = 'Exit spread contracts to lock in option premiums.';
          keyChanges.push(`Only ${daysToExpiry} days left to contract expiry`);
        } else {
          verdict = 'BOOK_LOSS';
          reasoning = `Options are close to expiry with a negative P&L of ₹${pnlVal}. Minimal time value remains, reducing the mathematical probability of a turnaround. Recommend closing to prevent total premium loss.`;
          suggestedAction = 'Close options spread to salvage remaining premium.';
          keyChanges.push('Gamma risk spike near contract expiry');
        }
      } else {
        if (pnlVal >= 3000) {
          verdict = 'BOOK_PROFIT';
          reasoning = `The trade has reached a favorable net profit. Implied Volatility (IV) levels are cooling down, reducing option values as planned. Recommend taking profits early rather than holding to expiry.`;
          suggestedAction = 'Book profits on the spread legs.';
          keyChanges.push('Option premiums decayed favorably');
        } else if (pnlVal <= -3000) {
          verdict = 'ADJUST';
          reasoning = `The underlying price has moved against the spread strikes, threatening the outer legs. However, with ${daysToExpiry} days remaining, adjusting or rolling the threatened legs is viable.`;
          suggestedAction = 'Roll threatened option legs to a wider strike width.';
          keyChanges.push('Price threatened the boundary strike levels');
        } else {
          verdict = 'CONTINUE';
          reasoning = `The option strategy is behaving within expectations. Put-Call Ratio (PCR) is stable at ${option_chain?.pcr || 1.0}, and spot price is comfortable near Max Pain strike ${option_chain?.maxPain || 'N/A'}.`;
          suggestedAction = 'Continue holding to harvest theta decay.';
          keyChanges.push('Spot price trading close to Max Pain strike');
        }
      }
    }

    return NextResponse.json({
      success: true,
      source: 'Rule Engine',
      data: {
        verdict,
        reasoning,
        confidence: 80,
        key_changes_since_entry: keyChanges,
        suggested_action_detail: suggestedAction
      }
    });
  } catch (error: any) {
    console.error('[AI Position Review API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
