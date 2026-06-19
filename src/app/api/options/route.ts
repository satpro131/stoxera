import { NextResponse } from 'next/server';
import { getStocks, getOptionChain } from '@/utils/mockData';
import { calculateMaxPain } from '@/utils/formulas';
import { getUpstoxExpiries, getUpstoxOptionChain } from '@/utils/upstox';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();
    const instrumentKey = searchParams.get('instrument_key');

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol parameter is required' }, { status: 400 });
    }

    const stocks = getStocks();
    const stock = stocks.find(s => s.symbol === symbol);

    if (!stock) {
      return NextResponse.json({ success: false, error: 'Stock not found' }, { status: 404 });
    }

    if (stock.category !== 'F&O') {
      return NextResponse.json({ success: false, error: 'Symbol is not F&O eligible' }, { status: 400 });
    }

    // Default mock data variables
    let finalOptionChain = getOptionChain(symbol);
    let underlyingPrice = stock.price;
    const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;

    if (token) {
      try {
        // 1. Fetch available expiries & select nearest
        const expiries = await getUpstoxExpiries(symbol, instrumentKey || undefined);
        if (expiries.length > 0) {
          const nearestExpiry = expiries[0];
          
          // 2. Fetch Option Chain from Upstox
          const upstoxChain = await getUpstoxOptionChain(symbol, nearestExpiry, instrumentKey || undefined);
          
          if (upstoxChain.length > 0) {
            // Get underlying spot price from response
            underlyingPrice = Number(upstoxChain[0].underlying_spot_price || underlyingPrice);

            // 3. Map Upstox option chain data to our clean schema
            const mappedChain = upstoxChain.map(item => {
              const strike = Number(item.strike_price);

              // Setup default values for call/put in case Upstox returns null
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

            // Sort chain ascending by strike price
            finalOptionChain = mappedChain.sort((a, b) => a.strike - b.strike);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch Upstox option chain for ${symbol}, falling back:`, err);
      }
    }

    // Calculate PCR & Max Pain dynamically
    let totalCallOI = 0;
    let totalPutOI = 0;
    const strikes: number[] = [];
    const callOI: Record<number, number> = {};
    const putOI: Record<number, number> = {};

    finalOptionChain.forEach(item => {
      totalCallOI += item.call.oi;
      totalPutOI += item.put.oi;
      strikes.push(item.strike);
      callOI[item.strike] = item.call.oi;
      putOI[item.strike] = item.put.oi;
    });

    const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 0;
    const { maxPainPrice, detailedPain } = calculateMaxPain(strikes, callOI, putOI);

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        underlyingPrice: Number(underlyingPrice.toFixed(2)),
        totalCallOI,
        totalPutOI,
        pcr,
        maxPainPrice,
        detailedPain,
        chain: finalOptionChain
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
