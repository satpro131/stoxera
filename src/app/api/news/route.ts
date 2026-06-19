import { NextResponse } from 'next/server';
import { getNews, getStocks } from '@/utils/mockData';
import { getLiveNews } from '@/utils/news';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();

    let news: any[] = [];
    if (symbol) {
      const stock = getStocks().find(s => s.symbol === symbol);
      if (stock) {
        news = await getLiveNews(symbol, stock.name, stock.sector);
      }
    }

    if (news.length === 0) {
      news = getNews(symbol || undefined);
    }

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
