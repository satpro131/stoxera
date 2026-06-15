import { NextResponse } from 'next/server';
import { getStocks, getNews, getOptionChain, getAIRecommendation } from '@/utils/mockData';
import { calculateMaxPain } from '@/utils/formulas';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol parameter is required' }, { status: 400 });
    }

    const stocks = getStocks();
    const stock = stocks.find(s => s.symbol === symbol);

    if (!stock) {
      return NextResponse.json({ success: false, error: 'Stock not found' }, { status: 404 });
    }

    const news = getNews(symbol);
    const hasFO = stock.category === 'F&O';

    let optionsSummary = 'N/A (Not an F&O stock)';
    if (hasFO) {
      const optionChain = getOptionChain(symbol);
      let totalCallOI = 0;
      let totalPutOI = 0;
      const strikes: number[] = [];
      const callOI: Record<number, number> = {};
      const putOI: Record<number, number> = {};

      optionChain.forEach(item => {
        totalCallOI += item.call.oi;
        totalPutOI += item.put.oi;
        strikes.push(item.strike);
        callOI[item.strike] = item.call.oi;
        putOI[item.strike] = item.put.oi;
      });

      const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '0';
      const { maxPainPrice } = calculateMaxPain(strikes, callOI, putOI);
      optionsSummary = `Put-Call Ratio (PCR): ${pcr}, Max Pain Price: ${maxPainPrice}, Buildup: ${stock.buildupType || 'Neutral'}`;
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      // Premium feature: live call to Gemini API!
      const prompt = `
You are an expert equity and derivatives (F&O) advisor in the Indian stock market (NSE/BSE).
Your task is to analyze the following comprehensive stock data and generate a structured recommendation (Buy, Sell, Hold, or Avoid).

[STOCK METADATA]
Symbol: ${stock.symbol}
Name: ${stock.name}
Sector: ${stock.sector}
Current Price: ₹${stock.price}
Change: ₹${stock.change} (${stock.changePercent}%)

[FUNDAMENTALS]
P/E: ${stock.fundamentals.pe}
P/B: ${stock.fundamentals.pb}
ROE: ${stock.fundamentals.roe}%
ROCE: ${stock.fundamentals.roce}%
Debt-to-Equity: ${stock.fundamentals.debtToEquity}
EPS Growth: ${stock.fundamentals.epsGrowth}%
Revenue Growth: ${stock.fundamentals.revenueGrowth}%
Promoter Holding: ${stock.fundamentals.promoterHolding}%
Dividend Yield: ${stock.fundamentals.dividendYield}%

[TECHNICALS]
RSI: ${stock.technicals.rsi}
Trend: ${stock.technicals.trend}
SMA 20: ₹${stock.technicals.sma20}
SMA 50: ₹${stock.technicals.sma50}
SMA 200: ₹${stock.technicals.sma200}
Support levels: [${stock.technicals.support.join(', ')}]
Resistance levels: [${stock.technicals.resistance.join(', ')}]

[F&O DERIVATIVES SUMMARY]
${optionsSummary}

[RECENT NEWS & SENTIMENT]
${news.map((item, i) => `${i+1}. [${item.source}][${item.sentiment}] ${item.title} - ${item.summary}`).join('\n')}

Based on the above factors, please perform a detailed synthesis. CITE specific factors (e.g. "strong RSI breakout", "high PE multiple", "positive retail news") in your analysis.
Generate your output strictly in JSON format. Do not write any markdown code blocks (like \`\`\`json) or conversational text outside of the JSON.

Expected JSON schema:
{
  "symbol": "${stock.symbol}",
  "recommendation": "Buy" | "Sell" | "Hold" | "Avoid",
  "confidenceScore": <integer between 0 and 100>,
  "holdingPeriod": "e.g. 1-2 Weeks or 3-6 Months",
  "reasoningSummary": {
    "newsSentiment": "<Synthesized news flow overview>",
    "fundamentals": "<Synthesized financial valuation assessment>",
    "technicals": "<Synthesized momentum, support/resistance trend assessment>",
    "finalSynthesis": "<Clear, actionable explanation connecting all signals into the final recommendation>"
  },
  "riskFlags": [
    "<risk factor 1>",
    "<risk factor 2>"
  ]
}
`;

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const resData = await response.json();
        const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) {
          const parsed = JSON.parse(responseText.trim());
          return NextResponse.json({ success: true, source: 'Gemini AI', data: parsed });
        }
      } catch (err) {
        console.error('Gemini API call failed, falling back to local engine:', err);
      }
    }

    // Fallback to local rule-based engine
    const localRec = getAIRecommendation(symbol);
    return NextResponse.json({ success: true, source: 'Rule Engine', data: localRec });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
