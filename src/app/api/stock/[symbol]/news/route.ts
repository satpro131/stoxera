import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol.toUpperCase();

    const dbPath = path.join(process.cwd(), 'src', 'utils', 'newsDb.json');
    let dbData: Record<string, any[]> = {};

    try {
      const content = await fs.readFile(dbPath, 'utf-8');
      dbData = JSON.parse(content);
    } catch {
      console.warn('[News API] Database file missing or empty');
    }

    const specificNews = dbData[symbol] || [];
    const globalNews = dbData['GLOBAL'] || [];

    // Merge specific and global news, keeping duplicates checked by URL
    const merged = [...specificNews];
    for (const item of globalNews) {
      if (!merged.some(m => m.url === item.url)) {
        merged.push(item);
      }
    }

    // Sort by published date (newest first)
    const sorted = merged.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    return NextResponse.json({
      success: true,
      data: sorted
    });
  } catch (error: any) {
    console.error('[News API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
