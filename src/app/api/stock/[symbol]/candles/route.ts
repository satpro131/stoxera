import { NextResponse } from 'next/server';
import { UPSTOX_INSTRUMENT_MAP } from '@/utils/upstox';

export const maxDuration = 60; // 60 seconds

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol.toUpperCase();

    const { searchParams } = new URL(request.url);
    const interval = searchParams.get('interval') || '1d';
    let instrumentKey = searchParams.get('instrument_key');

    if (!instrumentKey) {
      instrumentKey = UPSTOX_INSTRUMENT_MAP[symbol] || null;
    }

    if (!instrumentKey) {
      return NextResponse.json(
        { success: false, error: 'instrument_key parameter is required and could not be resolved' },
        { status: 400 }
      );
    }

    const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Upstox token is not configured' },
        { status: 500 }
      );
    }

    // Map interval to Upstox V3 parameters
    let unit = 'days';
    let intervalVal = 1;
    let daysBack = 120;

    switch (interval) {
      case '1m':
        unit = 'minutes';
        intervalVal = 1;
        daysBack = 3;
        break;
      case '5m':
        unit = 'minutes';
        intervalVal = 5;
        daysBack = 3;
        break;
      case '15m':
        unit = 'minutes';
        intervalVal = 15;
        daysBack = 7;
        break;
      case '30m':
        unit = 'minutes';
        intervalVal = 30;
        daysBack = 15;
        break;
      case '1h':
        unit = 'minutes';
        intervalVal = 60;
        daysBack = 30;
        break;
      case '1d':
        unit = 'days';
        intervalVal = 1;
        daysBack = 120;
        break;
      case '1w':
        unit = 'weeks';
        intervalVal = 1;
        daysBack = 730; // 2 years
        break;
      default:
        unit = 'days';
        intervalVal = 1;
        daysBack = 120;
    }

    // Calculate dynamic dates (use tomorrow's date to avoid timezone mismatches and get latest day's data)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const toDate = tomorrow.toISOString().split('T')[0];
    
    const fromDateObj = new Date();
    fromDateObj.setDate(fromDateObj.getDate() - daysBack);
    const fromDate = fromDateObj.toISOString().split('T')[0];

    const upstoxUrl = `https://api.upstox.com/v3/historical-candle/${encodeURIComponent(
      instrumentKey
    )}/${unit}/${intervalVal}/${toDate}/${fromDate}`;

    const intradayUrl = `https://api.upstox.com/v3/historical-candle/intraday/${encodeURIComponent(
      instrumentKey
    )}/${unit}/${intervalVal}`;

    console.log(`[Candles API] Requesting historical: ${upstoxUrl} and intraday: ${intradayUrl}`);

    const [histResponse, intraResponse] = await Promise.all([
      fetch(upstoxUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      }),
      fetch(intradayUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      }).catch(err => {
        console.warn('Failed to fetch intraday candles, continuing with historical:', err);
        return null;
      })
    ]);

    if (!histResponse.ok) {
      const errText = await histResponse.text();
      throw new Error(`Upstox candles error: ${histResponse.status} - ${errText}`);
    }

    const histData = await histResponse.json();
    if (histData?.status !== 'success') {
      throw new Error(histData?.errors?.[0]?.message || 'Failed to fetch candles');
    }

    const formatCandles = (rawList: any[]) => {
      return rawList.map((c: any[]) => {
        const timeStr = c[0];
        const time = interval.includes('d') || interval.includes('w')
          ? timeStr.split('T')[0]
          : Math.floor(new Date(timeStr).getTime() / 1000);

        return {
          time,
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4]),
          volume: Number(c[5])
        };
      }).reverse(); // Reverse to chronological order
    };

    const formattedHist = formatCandles(histData.data?.candles || []);

    let formattedIntra: any[] = [];
    if (intraResponse && intraResponse.ok) {
      const intraData = await intraResponse.json();
      if (intraData?.status === 'success') {
        formattedIntra = formatCandles(intraData.data?.candles || []);
      }
    }

    // Merge and deduplicate by time key
    const candleMap = new Map();
    for (const c of formattedHist) {
      candleMap.set(c.time, c);
    }
    for (const c of formattedIntra) {
      candleMap.set(c.time, c);
    }

    const merged = Array.from(candleMap.values()).sort((a, b) => {
      if (typeof a.time === 'string' && typeof b.time === 'string') {
        return a.time.localeCompare(b.time);
      }
      return (a.time as number) - (b.time as number);
    });

    return NextResponse.json({
      success: true,
      data: merged
    });
  } catch (error: any) {
    console.error('[Candles API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
