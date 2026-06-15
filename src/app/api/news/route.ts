import { NextResponse } from 'next/server';
import { getNews } from '@/utils/mockData';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();

    const news = getNews(symbol || undefined);

    // Calculate aggregated sentiment score
    const totalScore = news.reduce((acc, curr) => acc + curr.score, 0);
    const avgScore = news.length > 0 ? Number((totalScore / news.length).toFixed(2)) : 0;
    
    let label: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
    if (avgScore > 0.2) label = 'Bullish';
    else if (avgScore < -0.2) label = 'Bearish';

    return NextResponse.json({
      success: true,
      data: {
        symbol: symbol || 'GLOBAL',
        sentiment: {
          score: avgScore,
          label
        },
        articles: news
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
