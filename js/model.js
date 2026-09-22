/** Cycle scenario engine.
 * Macro-first allocation: total crypto market cap → sector pool → token share
 * → value-capture factor → projected supply. Paths move in log space from
 * today's market cap toward that peak. Assumptions live in data/.
 */

export const QUARTERS = [
  "Q3 2026",
  "Q4 2026",
  "Q1 2027",
  "Q2 2027",
  "Q3 2027",
  "Q4 2027",
  "Q1 2028",
  "Q2 2028",
  "Q3 2028",
  "Q4 2028",
  "Q1 2029",
  "Q2 2029",
  "Q3 2029",
  "Q4 2029",
];

export const N_QUARTERS = QUARTERS.length;
export const DEFAULT_QUARTER_IDX = 11;
export const HALVING_IDX = 7;
export const PEAK_WINDOW_START_IDX = 11;
export const PEAK_WINDOW_END_IDX = 13;
export const PRIOR_ATH = 4.27e12;

export const UNIVERSES = {
  solana: "Solana Ecosystem",
  global: "Global Crypto",
};

const SECTOR_LABELS = {
  "solana-defi": "Solana DeFi",
  "consumer-speculation": "consumer speculation",
  oracle: "oracles",
  "mobile-consumer": "mobile / consumer",
  "perp-dex": "perp DEXs",
};

export const STRETCH_SHORT = {
  supported: "fundamentally supported",
  reasonable: "reasonable multiple expansion",
  aggressive: "aggressive vs the historical band",
  stretched: "historically stretched",
  extreme: "extreme / euphoria territory",
};

export const STRETCH_LONG = {
  supported: "fundamentally supported — below the revenue band",
  reasonable: "reasonable multiple expansion",
  aggressive: "aggressive — above the historical band",
  stretched: "historically stretched — only peak-narrative leaders have sustained it",
  extreme: "extreme / euphoria territory — far beyond any sustained multiple",
};

export function sectorLabel(id) {
  return SECTOR_LABELS[id] || id;
}

export function pctOf(index) {
  return (index / (N_QUARTERS - 1)) * 100;
}

export function quarterParam(index) {
  const [q, year] = QUARTERS[index].split(" ");
  return `${year}-${q}`;
}

export function quarterIndexFromParam(value) {
  if (!value) return -1;
  const match = String(value).match(/^(\d{4})-(Q[1-4])$/i);
  if (!match) return -1;
  return QUARTERS.indexOf(`${match[2].toUpperCase()} ${match[1]}`);
}

function geoMean([low, high]) {
  return Math.sqrt(low * high);
}

export function supplyAt(schedule, quarterIdx) {
  const points = (schedule || [])
    .map((entry) => ({ i: QUARTERS.indexOf(entry.q), s: entry.supply }))
    .filter((entry) => entry.i >= 0)
    .sort((a, b) => a.i - b.i);
  if (!points.length) return NaN;
  if (quarterIdx <= points[0].i) return points[0].s;
  if (quarterIdx >= points[points.length - 1].i) return points[points.length - 1].s;
  for (let i = 1; i < points.length; i++) {
    if (quarterIdx <= points[i].i) {
      const prev = points[i - 1];
      const next = points[i];
      const t = (quarterIdx - prev.i) / (next.i - prev.i);
      return prev.s + t * (next.s - prev.s);
    }
  }
  return points[points.length - 1].s;
}

function peakAllocation(token, scenario) {
  let mcapMid;
  let trace;
  if (token.modelType === "monetary") {
    const range = token.monetary?.sharesByScenario?.[scenario.id];
    if (!range) throw new Error(`${token.symbol}: missing share band for ${scenario.id}`);
    const share = geoMean(range);
    mcapMid = (share / 100) * scenario.totalCryptoMcap;
    trace = {
      totalCryptoMcap: scenario.totalCryptoMcap,
      shareOfTotalPct: share,
    };
  } else {
    if (!token.v2) throw new Error(`${token.symbol}: missing sector allocation`);
    const intensity = scenario.intensity;
    const [shareLow, shareHigh] = token.v2.shareOfSectorRange;
    const [captureLow, captureHigh] = token.v2.valueCaptureRange;
    const sharePct = shareLow + (shareHigh - shareLow) * intensity;
    const capturePct = captureLow + (captureHigh - captureLow) * intensity;
    const allocPct = scenario.sectorAllocPct[token.v2.sector];
    const sectorPoolMcap = scenario.totalCryptoMcap * (allocPct / 100);
    mcapMid = (sharePct / 100) * sectorPoolMcap * capturePct;
    trace = {
      totalCryptoMcap: scenario.totalCryptoMcap,
      sector: token.v2.sector,
      allocPct,
      sharePct,
      capturePct,
      sectorPoolMcap,
    };
  }

  const mcapLow = mcapMid / (1 + scenario.bandPct);
  const mcapHigh = mcapMid * (1 + scenario.bandPct);
  let impliedRevMultiple = null;
  let stretch = null;
  if (token.modelType === "revenue" && token.annualizedRevenueUsd) {
    impliedRevMultiple =
      mcapMid / (token.annualizedRevenueUsd * geoMean(scenario.activityFactorRange));
    const [bandLow, bandHigh] = scenario.revMultipleRange;
    if (impliedRevMultiple < bandLow) stretch = "supported";
    else if (impliedRevMultiple <= bandHigh) stretch = "reasonable";
    else if (impliedRevMultiple <= 1.5 * bandHigh) stretch = "aggressive";
    else if (impliedRevMultiple <= 2.5 * bandHigh) stretch = "stretched";
    else stretch = "extreme";
  }

  return { mcapLow, mcapMid, mcapHigh, trace, impliedRevMultiple, stretch };
}

function alongPath(startMcap, targetMcap, progress) {
  return Math.exp(Math.log(startMcap) + progress * (Math.log(targetMcap) - Math.log(startMcap)));
}

export function projectAtDate(token, scenario, quarterIdx) {
  const peak = peakAllocation(token, scenario);
  const idx = Math.max(0, Math.min(quarterIdx, scenario.path.length - 1));
  const progress = scenario.path[idx] ?? 1;
  const supply = supplyAt(token.supplySchedule, idx);
  const mcapLow = alongPath(token.marketCap, peak.mcapLow, progress);
  const mcapMid = alongPath(token.marketCap, peak.mcapMid, progress);
  const mcapHigh = alongPath(token.marketCap, peak.mcapHigh, progress);
  return {
    quarterIdx: idx,
    progress,
    supply,
    mcapLow,
    mcapMid,
    mcapHigh,
    priceLow: mcapLow / supply,
    priceMid: mcapMid / supply,
    priceHigh: mcapHigh / supply,
    peak,
  };
}

export function cyclePhase(scenario, quarterIdx) {
  const path = scenario.path;
  const idx = Math.max(0, Math.min(quarterIdx, path.length - 1));
  const progress = path[idx] ?? 1;
  const peakIdx = path.indexOf(1);
  if (scenario.intensity <= 0.05) {
    if (idx >= peakIdx) return "Bottomed out · stagnation";
    return progress < 0.5 ? "Breakdown" : "Capitulation";
  }
  if (idx > peakIdx && progress < 1) return "Cooling off";
  if (progress >= 1) {
    if (scenario.intensity >= 0.85) return "Euphoria · potential peak";
    if (scenario.intensity >= 0.5) return "Potential peak";
    return "Cycle high";
  }
  if (progress < 0.15) return "Accumulation";
  if (progress < 0.4) return "Recovery";
  if (progress < 0.72) return "Expansion";
  if (progress < 0.93) return "Bull market";
  return scenario.intensity >= 0.7 ? "Mania" : "Late cycle";
}

export function fmtUsd(value) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toPrecision(3)}`;
}

export function fmtPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e3) return `$${Math.round(value).toLocaleString("en-US")}`;
  return `$${Number(value.toPrecision(3))}`;
}

export function fmtMoney(value) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1e6) return fmtUsd(value);
  if (value >= 100) return `$${Math.round(value).toLocaleString("en-US")}`;
  return fmtUsd(value);
}

export function fmtX(value) {
  if (!Number.isFinite(value)) return "—";
  if (value > 0 && value < 0.01) return "<0.01×";
  if (value >= 100) return `${value.toFixed(0)}×`;
  if (value >= 10) return `${value.toFixed(1)}×`;
  return `${value.toFixed(2)}×`;
}

export function fmtSupply(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function applyLivePrices(tokens, quotes) {
  if (!quotes) return tokens;
  return tokens.map((token) => {
    const quote = quotes[token.coingeckoId];
    if (!quote?.usd) return token;
    return {
      ...token,
      priceUsd: quote.usd,
      marketCap: quote.usd_market_cap || token.marketCap,
    };
  });
}

export async function loadBundle() {
  const [tokenFile, scenarioFile] = await Promise.all([
    fetch("data/tokens.json").then((res) => res.json()),
    fetch("data/scenarios.json").then((res) => res.json()),
  ]);
  return {
    asOf: tokenFile.asOf,
    tokens: tokenFile.tokens,
    scenarios: scenarioFile.scenarios,
  };
}

export async function fetchLiveQuotes(tokens) {
  const ids = tokens.map((token) => token.coingeckoId).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}
