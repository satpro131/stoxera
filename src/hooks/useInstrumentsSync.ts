import { useState, useEffect } from 'react';
import { syncInstrumentsInBrowser, getMetadata } from '@/utils/dbClient';

export function useInstrumentsSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState('');
  const [syncComplete, setSyncComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAndSync() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const lastSync = await getMetadata('last_sync_date');
        
        if (lastSync === today) {
          setSyncComplete(true);
          return;
        }

        setIsSyncing(true);
        const result = await syncInstrumentsInBrowser((msg) => {
          setProgress(msg);
        });

        if (result.success) {
          setSyncComplete(true);
        } else {
          setError(result.message || 'Sync failed');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to sync database');
      } finally {
        setIsSyncing(false);
      }
    }

    checkAndSync();
  }, []);

  return { isSyncing, progress, syncComplete, error };
}
