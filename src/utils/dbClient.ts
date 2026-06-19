const DB_NAME = 'stoxera_db';
const DB_VERSION = 1;

export interface Instrument {
  instrument_key: string;
  trading_symbol: string;
  name: string;
  exchange: string;
  segment: string;
  instrument_type: string;
  expiry?: number;
  strike?: number;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('instruments')) {
        const store = db.createObjectStore('instruments', { keyPath: 'instrument_key' });
        store.createIndex('trading_symbol', 'trading_symbol', { unique: false });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('exchange', 'exchange', { unique: false });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };
  });
}

export async function getMetadata(key: string): Promise<any> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('metadata', 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function setMetadata(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('metadata', 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to set metadata in IndexedDB:', err);
  }
}

const SYMBOL_ALIASES: Record<string, string> = {
  INFOSYS: 'INFY',
  NIFTY: 'Nifty 50',
  BANKNIFTY: 'Nifty Bank',
  FINNIFTY: 'Nifty Fin Service'
};

/**
 * Client-side instrument key lookup
 */
export async function getInstrumentKeyClient(symbol: string, exchange = 'NSE'): Promise<string | null> {
  try {
    const db = await openDB();
    const lookupSymbol = SYMBOL_ALIASES[symbol] || symbol;

    return new Promise((resolve) => {
      const transaction = db.transaction('instruments', 'readonly');
      const store = transaction.objectStore('instruments');

      // 1. Match trading_symbol index
      const symbolIndex = store.index('trading_symbol');
      const request = symbolIndex.getAll(lookupSymbol);

      request.onsuccess = () => {
        const results = request.result || [];
        const matched = results.find(r => r.exchange === exchange);
        if (matched) {
          resolve(matched.instrument_key);
          return;
        }

        // 2. Match name index (e.g. for Nifty 50 index)
        const nameIndex = store.index('name');
        const nameRequest = nameIndex.getAll(lookupSymbol);

        nameRequest.onsuccess = () => {
          const nameResults = nameRequest.result || [];
          const nameMatched = nameResults.find(r => r.exchange === exchange);
          if (nameMatched) {
            resolve(nameMatched.instrument_key);
            return;
          }

          // 3. Fallback to case-insensitive cursor check (rarely hit)
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = (event: any) => {
            const cursor = event.target.result;
            if (cursor) {
              const val = cursor.value;
              if (
                val.exchange === exchange &&
                val.trading_symbol &&
                val.trading_symbol.toLowerCase() === lookupSymbol.toLowerCase()
              ) {
                resolve(val.instrument_key);
                return;
              }
              cursor.continue();
            } else {
              resolve(null);
            }
          };
        };
      };

      transaction.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Sync instruments from proxy to browser IndexedDB
 */
export async function syncInstrumentsInBrowser(
  onProgress?: (progress: string) => void
): Promise<{ success: boolean; count?: number; message?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastSync = await getMetadata('last_sync_date');
    
    if (lastSync === today) {
      return { success: true, message: 'Instruments already synced today.' };
    }

    onProgress?.('Fetching master list (~5-10s)...');
    const response = await fetch('/api/stocks/download-instruments');
    if (!response.ok) {
      throw new Error(`Failed to fetch instruments: HTTP ${response.status}`);
    }

    onProgress?.('Parsing JSON...');
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid response structure (expected array)');
    }

    onProgress?.(`Storing ${data.length.toLocaleString()} instruments local...`);
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('instruments', 'readwrite');
      const store = transaction.objectStore('instruments');

      store.clear(); // Clear old instruments

      for (const item of data) {
        store.put({
          instrument_key: item.instrument_key,
          trading_symbol: item.trading_symbol || null,
          name: item.name || null,
          exchange: item.exchange || null,
          segment: item.segment || null,
          instrument_type: item.instrument_type || null,
          expiry: item.expiry || null,
          strike: item.strike_price !== undefined && item.strike_price !== null ? Number(item.strike_price) : null
        });
      }

      transaction.oncomplete = async () => {
        await setMetadata('last_sync_date', today);
        onProgress?.('Sync complete!');
        resolve({ success: true, count: data.length });
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } catch (err: any) {
    console.error('Browser sync failed:', err);
    return { success: false, message: err.message };
  }
}
