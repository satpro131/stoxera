import { NextResponse } from 'next/server';
import { getUpstoxQuotes, getUpstoxExpiries } from '@/utils/upstox';

export async function GET() {
  try {
    const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'Upstox Token (UPSTOX_ANALYTICS_TOKEN or UPSTOX_ACCESS_TOKEN) is missing from your environment. Please add it to your .env.local file.'
      });
    }

    // Attempt a diagnostic quote call for RELIANCE
    let quoteResult = null;
    let expiriesResult = null;
    let errorLog = null;

    try {
      quoteResult = await getUpstoxQuotes(['RELIANCE']);
      expiriesResult = await getUpstoxExpiries('RELIANCE');
    } catch (err: any) {
      errorLog = err.message || err;
    }

    return NextResponse.json({
      success: errorLog ? false : true,
      diagnostics: {
        tokenConfigured: true,
        tokenExcerpt: `${token.substring(0, 10)}...${token.substring(token.length - 10)}`,
        error: errorLog,
        relianceQuoteDump: quoteResult,
        relianceExpiriesDump: expiriesResult
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
