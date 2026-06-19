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

    const dbPath = path.join(process.cwd(), 'src', 'utils', 'fundamentalsDb.json');
    let dbData: Record<string, any> = {};

    try {
      const content = await fs.readFile(dbPath, 'utf-8');
      dbData = JSON.parse(content);
    } catch (err) {
      console.warn('[Fundamentals API] Database file missing or empty:', err);
    }

    const fundamentals = dbData[symbol] || null;

    if (!fundamentals) {
      return NextResponse.json(
        { success: false, error: 'Fundamentals not found for this symbol' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: fundamentals
    });
  } catch (error: any) {
    console.error('[Fundamentals API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
