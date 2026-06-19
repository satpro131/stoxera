import { NewsItem } from './mockData';

// Basic HTML entity decoder
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"');
}

// Simple rule-based sentiment analyzer for titles
function analyzeSentiment(title: string): { sentiment: 'Bullish' | 'Bearish' | 'Neutral'; score: number } {
  const bullishKeywords = [
    'rise', 'jump', 'gain', 'surge', 'soar', 'expand', 'profit', 'growth', 'up', 'rebound', 'climb',
    'bullish', 'buy', 'upgrade', 'won', 'secures', 'partnership', 'record high', 'positive', 'double'
  ];
  
  const bearishKeywords = [
    'fall', 'drop', 'slump', 'decline', 'loss', 'down', 'penalty', 'fine', 'investigation', 'audit',
    'bearish', 'sell', 'downgrade', 'lost', 'debt', 'risk', 'warning', 'inflation', 'caution', 'crash'
  ];

  const lowerTitle = title.toLowerCase();
  let score = 0;

  bullishKeywords.forEach(word => {
    if (lowerTitle.includes(word)) score += 0.25;
  });

  bearishKeywords.forEach(word => {
    if (lowerTitle.includes(word)) score -= 0.25;
  });

  // Clamp score between -1.0 and 1.0
  score = Math.max(-1.0, Math.min(1.0, score));

  let sentiment: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (score > 0.1) sentiment = 'Bullish';
  else if (score < -0.1) sentiment = 'Bearish';

  return { sentiment, score };
}

/**
 * Fetch news dynamically from Google News RSS feed for a search query
 */
async function fetchRssFeed(query: string, category: NewsItem['category'], maxItems: number = 5): Promise<Omit<NewsItem, 'id'>[]> {
  try {
    // Search Google News RSS with India English localization
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Google News RSS responded with: ${res.statusText}`);
    }

    const text = await res.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items: Omit<NewsItem, 'id'>[] = [];
    let match;

    while ((match = itemRegex.exec(text)) !== null && items.length < maxItems) {
      const itemContent = match[1];
      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const descriptionMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);

      let title = titleMatch ? titleMatch[1] : '';
      const link = linkMatch ? linkMatch[1] : '';
      const pubDate = pubDateMatch ? pubDateMatch[1] : new Date().toISOString();
      const source = sourceMatch ? sourceMatch[1] : 'News';
      let description = descriptionMatch ? descriptionMatch[1] : '';

      // Clean up title (Google News appends " - Source Name" to title)
      if (source && title.endsWith(` - ${source}`)) {
        title = title.substring(0, title.length - (source.length + 3));
      }

      const decodedTitle = decodeHtmlEntities(title);
      const { sentiment, score } = analyzeSentiment(decodedTitle);
      
      // Clean description
      description = decodeHtmlEntities(description.replace(/<[^>]*>/g, ''));

      items.push({
        timestamp: new Date(pubDate).toISOString(),
        source,
        title: decodedTitle,
        summary: description || decodedTitle,
        sentiment,
        score,
        category,
        url: link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
      });
    }

    return items;
  } catch (error) {
    console.error(`Error fetching news for query "${query}":`, error);
    return [];
  }
}

/**
 * Fetch live news for a specific stock and its sector
 */
export async function getLiveNews(symbol: string, name: string, sector: string): Promise<NewsItem[]> {
  try {
    // 1. Query for the specific company
    const companyQuery = `"${name}" OR "${symbol} stock" OR "${symbol} share price"`;
    // 2. Query for the sector in India
    const sectorQuery = `"${sector} sector India" OR "${sector} industry India" OR "${sector} news India"`;

    // Fetch both in parallel
    const [companyArticles, sectorArticles] = await Promise.all([
      fetchRssFeed(companyQuery, 'Company', 5),
      fetchRssFeed(sectorQuery, 'Sector', 3)
    ]);

    // Merge and add ID
    const merged = [...companyArticles, ...sectorArticles].map((item, index) => ({
      ...item,
      id: `live-news-${symbol}-${index}-${Date.now()}`
    }));

    // If we fetched articles, return them
    if (merged.length > 0) {
      return merged;
    }
  } catch (error) {
    console.error(`Failed to gather live news for ${symbol}:`, error);
  }

  // Fallback to empty array if all else fails
  return [];
}
