import { NextResponse } from 'next/server';
import { getStocks, getOptionChain } from '@/utils/mockData';
import { getUpstoxOptionChain, UPSTOX_INSTRUMENT_MAP } from '@/utils/upstox';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol.toUpperCase();

    const { searchParams } = new URL(request.url);
    const expiry = searchParams.get('expiry');
    let instrumentKey = searchParams.get('instrument_key');

    if (!expiry) {
      return NextResponse.json(
        { success: false, error: 'expiry parameter is required' },
        { status: 400 }
      );
    }

    if (!instrumentKey) {
      instrumentKey = UPSTOX_INSTRUMENT_MAP[symbol] || null;
    }

    const stocks = getStocks();
    const stock = stocks.find(s => s.symbol === symbol);
    if (!stock) {
      return NextResponse.json({ success: false, error: 'Stock not found' }, { status: 404 });
    }

    let finalOptionChain = getOptionChain(symbol);
    let underlyingPrice = stock.price;

    const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;
    if (token) {
      try {
        const upstoxChain = await getUpstoxOptionChain(symbol, expiry, instrumentKey || undefined);
        if (upstoxChain.length > 0) {
          underlyingPrice = Number(upstoxChain[0].underlying_spot_price || underlyingPrice);

          const mappedChain = upstoxChain.map(item => {
            const strike = Number(item.strike_price);

            const defaultOptionData = {
              ltp: 0,
              change: 0,
              changePercent: 0,
              volume: 0,
              oi: 0,
              oiChange: 0,
              oiChangePercent: 0,
              iv: 0,
              delta: 0,
              theta: 0,
              vega: 0,
              gamma: 0
            };

            const mapSide = (optionObj: any) => {
              if (!optionObj) return defaultOptionData;
              const mData = optionObj.market_data || {};
              const greeks = optionObj.option_greeks || {};

              const ltp = Number(mData.ltp || 0);
              const closePrice = Number(mData.close_price || ltp);
              const change = ltp - closePrice;
              const changePercent = (change / (closePrice || 1)) * 100;

              const oi = Number(mData.oi || 0);
              const prevOi = Number(mData.prev_oi || oi);
              const oiChange = oi - prevOi;
              const oiChangePercent = (oiChange / (prevOi || 1)) * 100;

              return {
                ltp: Number(ltp.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: Number(mData.volume || 0),
                oi,
                oiChange,
                oiChangePercent: Number(oiChangePercent.toFixed(2)),
                iv: Number((greeks.iv || 0).toFixed(2)),
                delta: Number((greeks.delta || 0).toFixed(3)),
                theta: Number((greeks.theta || 0).toFixed(3)),
                vega: Number((greeks.vega || 0).toFixed(3)),
                gamma: Number((greeks.gamma || 0).toFixed(5))
              };
            };

            return {
              strike,
              call: mapSide(item.call_options),
              put: mapSide(item.put_options)
            };
          });

          finalOptionChain = mappedChain.sort((a, b) => a.strike - b.strike);
        }
      } catch (err) {
        console.warn(`Failed to fetch Upstox option chain for ${symbol}, falling back:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        underlyingPrice: Number(underlyingPrice.toFixed(2)),
        chain: finalOptionChain
      }
    });
  } catch (error: any) {
    console.error('[Option Chain API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
