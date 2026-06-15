import { NextResponse } from 'next/server';
import { getStocks, getOHLCV } from '@/utils/mockData';
import { getUpstoxQuotes, getUpstoxCandles, UPSTOX_RESPONSE_MAP } from '@/utils/upstox';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();
    const timeframe = searchParams.get('timeframe') || '1d';
    const limit = Number(searchParams.get('limit')) || 100;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol parameter is required' }, { status: 400 });
    }

    const stocks = getStocks();
    let stock = stocks.find(s => s.symbol === symbol);

    if (!stock) {
      return NextResponse.json({ success: false, error: 'Stock not found' }, { status: 404 });
    }

    let chart = getOHLCV(symbol, timeframe, limit);
    const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;

    if (token) {
      try {
        // 1. Fetch live quote
        const upstoxQuotes = await getUpstoxQuotes([symbol]);
        const upstoxResponseKeys = Object.keys(UPSTOX_RESPONSE_MAP);
        const matchingKey = upstoxResponseKeys.find(
          key => UPSTOX_RESPONSE_MAP[key] === symbol
        );

        const quote = matchingKey ? upstoxQuotes[matchingKey] : null;

        if (quote) {
          const lastPrice = Number(quote.last_price);
          const closePrice = Number(quote.ohlc?.close || lastPrice);
          const change = lastPrice - closePrice;
          const changePercent = (change / (closePrice || 1)) * 100;
          const volume = Number(quote.volume || stock.volume);

          const ratio = lastPrice / stock.price;
          const support = stock.technicals.support.map(s => Number((s * ratio).toFixed(2)));
          const resistance = stock.technicals.resistance.map(r => Number((r * ratio).toFixed(2)));

          stock = {
            ...stock,
            price: Number(lastPrice.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            prevClose: Number(closePrice.toFixed(2)),
            volume,
            technicals: {
              ...stock.technicals,
              sma20: Number((stock.technicals.sma20 * ratio).toFixed(2)),
              sma50: Number((stock.technicals.sma50 * ratio).toFixed(2)),
              sma200: Number((stock.technicals.sma200 * ratio).toFixed(2)),
              bollingerBands: {
                upper: Number((stock.technicals.bollingerBands.upper * ratio).toFixed(2)),
                middle: Number((stock.technicals.bollingerBands.middle * ratio).toFixed(2)),
                lower: Number((stock.technicals.bollingerBands.lower * ratio).toFixed(2))
              },
              support,
              resistance
            }
          };
        }

        // 2. Fetch live candles
        const upstoxCandles = await getUpstoxCandles(symbol, timeframe);
        if (upstoxCandles.length > 0) {
          chart = upstoxCandles.slice(-limit); // limit size
        }
      } catch (err) {
        console.warn(`Failed to fetch Upstox quote/candles for ${symbol}, falling back:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        stock,
        chart
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
