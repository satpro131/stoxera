import { NextResponse } from 'next/server';
import { getUpstoxQuotes } from '@/utils/upstox';

export const maxDuration = 60; // 60 seconds

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol.toUpperCase();

    const { searchParams } = new URL(request.url);
    const instrumentKey = searchParams.get('instrument_key');

    if (!instrumentKey) {
      return NextResponse.json(
        { success: false, error: 'instrument_key parameter is required' },
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

    const upstoxQuotes = await getUpstoxQuotes([symbol], [instrumentKey]);
    
    // Upstox returns keys with a colon (e.g. NSE_EQ:RELIANCE), while instrumentKey has a pipe (e.g. NSE_EQ|RELIANCE)
    const quote = Object.values(upstoxQuotes).find(
      (q: any) => q.instrument_token === instrumentKey
    ) as any;

    if (!quote) {
      return NextResponse.json(
        { success: false, error: `Quote not found for instrument key: ${instrumentKey}` },
        { status: 404 }
      );
    }

    const lastPrice = Number(quote.last_price || 0);
    const netChange = Number(quote.net_change || 0);
    const prevClose = lastPrice - netChange;
    const percentageChange = prevClose !== 0 ? Number(((netChange / prevClose) * 100).toFixed(2)) : 0;
    const volume = Number(quote.volume || 0);

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        instrument_key: instrumentKey,
        last_price: lastPrice,
        net_change: netChange,
        percentage_change: percentageChange,
        volume: volume
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
