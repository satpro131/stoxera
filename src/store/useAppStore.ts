import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  timeframe: string;
  setTimeframe: (timeframe: string) => void;
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  toggleWatchlist: (symbol: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedSymbol: 'RELIANCE',
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol.toUpperCase() }),
      timeframe: '1d',
      setTimeframe: (timeframe) => set({ timeframe }),
      watchlist: ['RELIANCE', 'NIFTY', 'HDFCBANK', 'TCS', 'ZOMATO'],
      addToWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.includes(symbol)
            ? state.watchlist
            : [...state.watchlist, symbol.toUpperCase()],
        })),
      removeFromWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.filter((s) => s !== symbol.toUpperCase()),
        })),
      toggleWatchlist: (symbol) =>
        set((state) => {
          const sym = symbol.toUpperCase();
          const exists = state.watchlist.includes(sym);
          return {
            watchlist: exists
              ? state.watchlist.filter((s) => s !== sym)
              : [...state.watchlist, sym],
          };
        }),
      activeTab: 'overview',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'stoxera-storage', // local storage key
    }
  )
);
