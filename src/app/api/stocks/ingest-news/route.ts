import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const KEYWORDS_MAP: Record<string, string[]> = {
  RELIANCE: ['Reliance', 'Ambani', 'RIL', 'Jio'],
  TCS: ['TCS', 'Tata Consultancy'],
  INFOSYS: ['Infosys', 'Infy', 'Narayana Murthy'],
  HDFCBANK: ['HDFC', 'HDFCBANK'],
  ICICIBANK: ['ICICI', 'ICICIBANK'],
  SBIN: ['SBI', 'State Bank of India', 'SBIN'],
  ZOMATO: ['Zomato', 'Blinkit'],
  SUZLON: ['Suzlon', 'Wind energy'],
  JIOFIN: ['Jio Financial', 'JIOFIN'],
  IREDA: ['IREDA', 'Renewable Energy Dev'],
  TRENT: ['Trent', 'Zudio', 'Westside']
};

function parseRss(xmlText: string) {
  const items: any[] = [];
  const regex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    const content = match[1];
    const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
    const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
    const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    const description = content.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
    items.push({
      headline: title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
      url: link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
      published_at: pubDate,
      raw_text: description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim()
    });
  }
  return items;
}

async function analyzeSentiment(headline: string, rawText: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a financial sentiment analyzer. Analyze the following news article. Respond with a JSON object containing: {"sentiment": "Positive" | "Negative" | "Neutral", "summary": "One line summary under 12 words"}'
            },
            {
              role: 'user',
              content: `Headline: ${headline}\nText: ${rawText}`
            }
          ],
          response_format: { type: 'json_object' }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const resultObj = JSON.parse(data.choices[0].message.content);
        return {
          sentiment: resultObj.sentiment as 'Positive' | 'Negative' | 'Neutral',
          summary: resultObj.summary as string
        };
      }
    } catch (err) {
      console.warn('[OpenAI Sentiment] Failed, falling back to heuristics:', err);
    }
  }

  // Heuristic Fallback
  const text = (headline + ' ' + rawText).toLowerCase();
  const positiveWords = ['win', 'gain', 'growth', 'rebound', 'climb', 'profit', 'rise', 'upgrade', 'jv', 'record high', 'double', 'secures', 'positive', 'expansion'];
  const negativeWords = ['slip', 'loss', 'down', 'penalty', 'fine', 'penalty', 'fell', 'drop', 'slump', 'bearish', 'weak', 'decline', 'negative', 'penalty'];

  let posCount = 0;
  let negCount = 0;
  positiveWords.forEach(w => { if (text.includes(w)) posCount++; });
  negativeWords.forEach(w => { if (text.includes(w)) negCount++; });

  let sentiment: 'Positive' | 'Negative' | 'Neutral' = 'Neutral';
  if (posCount > negCount) sentiment = 'Positive';
  else if (negCount > posCount) sentiment = 'Negative';

  let summary = headline;
  if (summary.length > 65) {
    summary = summary.substring(0, 62) + '...';
  }

  return { sentiment, summary };
}

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'src', 'utils', 'newsDb.json');
    let dbData: Record<string, any[]> = {};

    try {
      const content = await fs.readFile(dbPath, 'utf-8');
      dbData = JSON.parse(content);
    } catch {
      console.warn('[Ingest News] Database file missing or empty, starting fresh');
    }

    const fetchedArticles: any[] = [];

    // 1. Fetch GDELT Project updates query
    try {
      const gdeltRes = await fetch(
        'https://api.gdeltproject.org/api/v2/doc/doc?query=india%20finance%20stock&mode=UpdatesList&format=JSON',
        { next: { revalidate: 0 } }
      );
      if (gdeltRes.ok) {
        const data = await gdeltRes.json();
        const articles = data.articles || [];
        for (const art of articles) {
          fetchedArticles.push({
            headline: art.title,
            source: art.source || 'GDELT',
            url: art.url,
            published_at: art.seendate || new Date().toISOString(),
            raw_text: art.title
          });
        }
      }
    } catch (err) {
      console.warn('[GDELT fetch] Failed:', err);
    }

    // 2. Fetch Moneycontrol RSS Feed
    try {
      const rssRes = await fetch('https://www.moneycontrol.com/rss/MC_India_Business.xml', { next: { revalidate: 0 } });
      if (rssRes.ok) {
        const text = await rssRes.text();
        const rssItems = parseRss(text);
        fetchedArticles.push(...rssItems.map(item => ({ ...item, source: 'Moneycontrol' })));
      }
    } catch (err) {
      console.warn('[Moneycontrol RSS fetch] Failed:', err);
    }

    // 3. Fetch Economic Times RSS Feed (Markets)
    try {
      const etRssRes = await fetch('https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', { next: { revalidate: 0 } });
      if (etRssRes.ok) {
        const text = await etRssRes.text();
        const rssItems = parseRss(text);
        fetchedArticles.push(...rssItems.map(item => ({ ...item, source: 'Economic Times' })));
      }
    } catch (err) {
      console.warn('[Economic Times RSS fetch] Failed:', err);
    }

    // 4. Fetch Finnhub News (if key is configured)
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      try {
        const finnhubRes = await fetch(
          `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`,
          { next: { revalidate: 0 } }
        );
        if (finnhubRes.ok) {
          const articles = await finnhubRes.json();
          if (Array.isArray(articles)) {
            for (const art of articles) {
              fetchedArticles.push({
                headline: art.headline || art.title || '',
                source: art.source || 'Finnhub',
                url: art.url || '',
                published_at: art.datetime ? new Date(art.datetime * 1000).toISOString() : new Date().toISOString(),
                raw_text: art.summary || art.headline || ''
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Finnhub fetch] Failed:', err);
      }
    }

    // 3. Match keyword to tag symbols and analyze sentiment
    let count = 0;
    for (const art of fetchedArticles) {
      // Dedup check: check if URL already exists in database
      let exists = false;
      for (const symbol in dbData) {
        if (dbData[symbol].some((a: any) => a.url === art.url)) {
          exists = true;
          break;
        }
      }
      if (exists) continue;

      let matchedSymbol = 'GLOBAL';
      for (const symbol in KEYWORDS_MAP) {
        const kwList = KEYWORDS_MAP[symbol];
        if (kwList.some(kw => art.headline.includes(kw) || art.raw_text.includes(kw))) {
          matchedSymbol = symbol;
          break;
        }
      }

      const analysis = await analyzeSentiment(art.headline, art.raw_text);
      const newArticle = {
        id: `${matchedSymbol.toLowerCase()}-${Date.now()}-${count++}`,
        headline: art.headline,
        source: art.source || 'RSS Feed',
        url: art.url,
        published_at: art.published_at || new Date().toISOString(),
        raw_text: art.raw_text,
        sentiment: analysis.sentiment,
        summary: analysis.summary
      };

      if (!dbData[matchedSymbol]) {
        dbData[matchedSymbol] = [];
      }
      dbData[matchedSymbol].unshift(newArticle);
      
      // Limit to 20 articles per category
      if (dbData[matchedSymbol].length > 20) {
        dbData[matchedSymbol] = dbData[matchedSymbol].slice(0, 20);
      }
    }

    await fs.writeFile(dbPath, JSON.stringify(dbData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'News ingestion completed successfully',
      addedCount: count
    });
  } catch (error: any) {
    console.error('[Ingest News Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
