import { NextResponse } from 'next/server';
import https from 'https';
import zlib from 'zlib';

export const maxDuration = 120; // Allow up to 2 minutes for download and decompression

export async function GET() {
  const url = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz';

  return new Promise<Response>((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode !== 200) {
        resolve(NextResponse.json({ error: `Failed to fetch from Upstox: HTTP ${res.statusCode}` }, { status: res.statusCode || 500 }));
        return;
      }

      const gunzip = zlib.createGunzip();
      res.pipe(gunzip);

      let data = '';
      gunzip.on('data', (chunk) => {
        data += chunk.toString();
      });

      gunzip.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(NextResponse.json(parsed));
        } catch (err: any) {
          resolve(NextResponse.json({ error: `Parse error: ${err.message}` }, { status: 500 }));
        }
      });

      gunzip.on('error', (err: any) => {
        resolve(NextResponse.json({ error: `Gunzip error: ${err.message}` }, { status: 500 }));
      });
    }).on('error', (err: any) => {
      resolve(NextResponse.json({ error: `Request error: ${err.message}` }, { status: 500 }));
    });
  });
}
