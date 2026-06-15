# Stoxera 🚀
> Next-Gen AI-Driven Equity & Derivatives (F&O) Advisory and Option Strategy Playbook Platform.

Stoxera is a premium, real-time analytics and advisory platform designed for tracking Indian equities, index derivatives, and stock futures & options (F&O). It integrates live price feeds, open interest analytics, and technical indicators with multi-LLM syntheses to generate actionable buy/sell/hold/avoid trade setups and automated option strategy suggestions.

---

## 🌟 Core Features

### 1. AI Advisory & Trade Setup Dashboard
A unified cockpit for trade decisions that combines qualitative AI insights with quantitative market parameters in one view:
- **Multi-Model Advisory Synthesizer**: Computes signals (Buy/Sell/Hold/Avoid), confidence scores, suggested holding horizons, and synthesizes final rationale.
- **Factor Assessment Breakdown**: Expands to detail specific news sentiment, fundamental valuation, and technical signal reviews.
- **Collapsible Layout**: Automatically hides breakdowns by default to bring the strategy planner above the fold.

### 2. High-Probability Trade Playbook
- **AI Suggested Option Strategy**: Maps AI recommendations directly to optimal option setups (e.g. Bullish recommendation → *Bull Call Spread*, Bearish → *Bear Put Spread*, Neutral → *Iron Condor*).
- **One-Click Configuration**: Reconfigures the Option Strategy Builder instantly to match the recommended strategy.
- **Strategy Risk Factors**: Focuses specifically on strategy-level risks (e.g. time decay (Theta) drag, capped upside, or conditions for maximum loss).

### 3. AI Chart Pattern Detector & Visual Overlay
- **Dashed Pattern Overlays**: Connects upper and lower boundary trendlines (Dashed Yellow/Cyan) directly onto candles.
- **Multi-Timeframe Scanning**:
  - **Bullish Flag (1-Hour)**: Flags continuation breakout channels.
  - **Ascending Triangle (15-Min)**: Marks overhead horizontal resistance and rising support.
  - **Double Bottom (Daily)**: Marks double-valley bottom support and peak necklines.
- **Breakout Targets & Stop Losses**: Calculates pattern targets dynamically based on current price actions.

### 4. Technical Indicators & Pivot Levels
- **Momentum Gauge**: Renders RSI (14) with a clean progress bar, MACD histogram values, and trend statuses.
- **Moving Averages (SMA)**: Tracks SMA 20, 50, and 200 with real-time "Price Above/Below" indicators.
- **Pivot Stack**: Stacked R1 Resistance, Spot Price, and S1 Support cards to visualize immediate support & resistance boundaries.

### 5. Interactive Option Strategy Planner
- **Multi-Leg Builder**: Configure custom positions or load templates (*Bull Call Spread, Bear Put Spread, Long/Short Straddle, Iron Condor, Covered Call*).
- **Position Leg Modifier**: Edit Buy/Sell actions, CE/PE contracts, strikes, premiums, and lots.
- **Payoff Chart Profile**: Interactive Recharts payoff curve demonstrating net profit/loss profile at expiration.
- **Price Simulator Slider**: Slide simulated spot prices +/- 15% to immediately calculate net expiry P&L.

### 6. Live Option Chain & OI Heatmaps
- **Call/Put Option Chain**: Centralized Strike listing with in-the-money (ITM) shading, premium quotes, and volumes.
- **OI Profile Bar Chart**: Recharts bar chart mapping Call vs Put Open Interest (OI) by strike, overlaid with current spot marker.
- **PCR & Max Pain**: Computes dynamic Put-Call Ratio (PCR) and Max Pain strikes (point minimizing options writer loss).

---

## 🛠️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Vanilla CSS (glowing boundaries, premium glassmorphism dark-theme)
- **Charts & Visualizations**:
  - **TradingView Lightweight Charts** (v5) - Real-time and historical candlestick and volume charts.
  - **Recharts** - Options payoff curves and Open Interest profile charts.
- **State Management**: Zustand
- **Query Caching**: TanStack React Query

---

## 📂 Project Structure

- **`/src/app`**: Core routing pages and backend API routes:
  - `/stock/[symbol]`: Stock detail page housing technical charts, live option chains, and the combined **AI Advisory & Trade Setup** interface.
  - `/api/quote`: Translates Upstox candle data to standardized client formats.
  - `/api/options`: Finds expiries and computes option chain parameters (PCR, Max Pain, etc.).
  - `/api/recommend`: Synthesizer engine (integrating technicals, news, and fundamentals).
- **`/src/components`**: Reusable frontend components:
  - `header.tsx`: Mini tickers, index indices, and quick stock selectors.
  - `stock/candleChart.tsx`: Main lightweight candlestick chart.
  - `stock/patternChart.tsx`: AI pattern analyzer lightweight chart with trendline overlays.
  - `stock/strategyPlanner.tsx`: Options Strategy Builder and recommended playbook banner.
- **`/src/utils`**: Mathematical and API fetch helpers:
  - `formulas.ts`: Black-Scholes pricing models, Greeks, IV solvers, and Max Pain math.
  - `upstox.ts`: Bearer token headers, instrument mapping, and historical candles.
  - `mockData.ts`: Realistic fallback databases for offline/off-market hours.

---

## 🚀 Getting Started

### 1. Environment Setup (`.env.local`)
Create a `.env.local` file at the root of the project to configure live data feeds:

```env
# Upstox Analytics Token for live quotes, candles, and option chains
UPSTOX_ANALYTICS_TOKEN="your_upstox_analytics_token"

# Optional: Google Gemini API Key for dynamic advisory generation
GEMINI_API_KEY="your-google-gemini-api-key"
```

*Note: If no Upstox token is provided, the platform automatically runs in a high-fidelity mock mode using historical databases.*

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### 4. Build Production Bundle
```bash
npm run build
```
