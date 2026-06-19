import { NextResponse } from 'next/server';
import { getUpstoxExpiries, UPSTOX_INSTRUMENT_MAP } from '@/utils/upstox';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol.toUpperCase();

    const { searchParams } = new URL(request.url);
    let instrumentKey = searchParams.get('instrument_key');

    if (!instrumentKey) {
      instrumentKey = UPSTOX_INSTRUMENT_MAP[symbol] || null;
    }

    const expiries = await getUpstoxExpiries(symbol, instrumentKey || undefined);

    return NextResponse.json({
      success: true,
      data: expiries
    });
  } catch (error: any) {
    console.error('[Expiries API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
