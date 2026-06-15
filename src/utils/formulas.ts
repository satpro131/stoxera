// Cumulative Standard Normal Distribution approximation (Abramowitz and Stegun)
export function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804; // 1 / sqrt(2 * pi)
  const probs = d * Math.exp(-x * x / 2);
  const c = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) {
    return 1 - probs * c;
  }
  return probs * c;
}

// Probability Density Function of standard normal distribution
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface OptionGreeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

/**
 * Calculates option price and Greeks using Black-Scholes
 * @param S Stock Price
 * @param K Strike Price
 * @param t Time to expiration in years (e.g. days/365)
 * @param r Risk-free rate (e.g. 0.07 for 7%)
 * @param sigma Volatility (e.g. 0.20 for 20%)
 * @param isCall true for Call, false for Put
 */
export function calculateBlackScholes(
  S: number,
  K: number,
  t: number,
  r: number,
  sigma: number,
  isCall: boolean
): OptionGreeks {
  // Edge cases
  if (t <= 0) {
    const intrinsic = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
    return { price: intrinsic, delta: isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0 };
  }
  if (sigma <= 0) {
    sigma = 0.0001; // Avoid division by zero
  }

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * t) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);

  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const N_d1 = normalCDF(-d1);
  const N_d2 = normalCDF(-d2);

  const expTerm = Math.exp(-r * t);

  let price = 0;
  let delta = 0;
  let theta = 0;

  if (isCall) {
    price = S * Nd1 - K * expTerm * Nd2;
    delta = Nd1;
    theta = -((S * normalPDF(d1) * sigma) / (2 * Math.sqrt(t))) - r * K * expTerm * Nd2;
  } else {
    price = K * expTerm * N_d2 - S * N_d1;
    delta = Nd1 - 1;
    theta = -((S * normalPDF(d1) * sigma) / (2 * Math.sqrt(t))) + r * K * expTerm * N_d2;
  }

  const gamma = normalPDF(d1) / (S * sigma * Math.sqrt(t));
  const vega = S * Math.sqrt(t) * normalPDF(d1);

  // Convert theta to per-day basis
  return {
    price: Math.max(0, price),
    delta,
    gamma,
    theta: theta / 365,
    vega: vega / 100 // Expressed as change per 1% change in volatility
  };
}

/**
 * Numerically finds Implied Volatility using Newton-Raphson method
 */
export function calculateImpliedVolatility(
  marketPrice: number,
  S: number,
  K: number,
  t: number,
  r: number,
  isCall: boolean
): number {
  let sigma = 0.30; // Initial guess
  const maxIterations = 100;
  const precision = 0.0001;

  for (let i = 0; i < maxIterations; i++) {
    const bs = calculateBlackScholes(S, K, t, r, sigma, isCall);
    const diff = bs.price - marketPrice;
    if (Math.abs(diff) < precision) {
      return sigma;
    }
    // Vega is derivative of option price with respect to volatility
    // Our vega is divided by 100 above, let's scale it back
    const vega = bs.vega * 100;
    if (Math.abs(vega) < 0.0001) {
      // Avoid division by zero, use bisection step
      sigma += diff > 0 ? -0.02 : 0.02;
    } else {
      sigma -= diff / vega;
    }

    // Volatility bounds
    if (sigma < 0.001) sigma = 0.001;
    if (sigma > 3.0) sigma = 3.0;
  }

  return sigma;
}

export interface StrikePain {
  strike: number;
  callPain: number;
  putPain: number;
  totalPain: number;
}

/**
 * Calculates the Max Pain strike price
 * Max pain is the strike price where options buyers stand to lose the maximum amount of money.
 */
export function calculateMaxPain(
  strikes: number[],
  callOI: Record<number, number>, // strike -> Open Interest
  putOI: Record<number, number>   // strike -> Open Interest
): { maxPainPrice: number; detailedPain: StrikePain[] } {
  let minPain = Infinity;
  let maxPainPrice = strikes[0] || 0;
  const detailedPain: StrikePain[] = [];

  for (const targetStrike of strikes) {
    let callPain = 0;
    let putPain = 0;

    for (const strike of strikes) {
      // Call buyers lose money if targetStrike <= strike. Otherwise, option is in-the-money and they exercise.
      // Wait, pain is what buyers LOSE (value at expiry is 0, they lose premium), 
      // but wait! A simpler and standard way of calculating Max Pain is:
      // Loss of value (payout by sellers) at targetStrike for option buyers.
      // Payout for Call sellers: Max(0, targetStrike - strike) * Call_OI
      // Payout for Put sellers: Max(0, strike - targetStrike) * Put_OI
      // The option writers (sellers) want to minimize their payout.
      // So Max Pain is the price where option sellers payout the least (i.e. buyers lose the most of their value).
      
      const cOI = callOI[strike] || 0;
      const pOI = putOI[strike] || 0;

      if (targetStrike > strike) {
        callPain += (targetStrike - strike) * cOI;
      }
      if (targetStrike < strike) {
        putPain += (strike - targetStrike) * pOI;
      }
    }

    const totalPain = callPain + putPain;
    detailedPain.push({ strike: targetStrike, callPain, putPain, totalPain });

    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainPrice = targetStrike;
    }
  }

  return { maxPainPrice, detailedPain };
}
