import {
  DEFAULT_QUARTER_IDX,
  PRIOR_ATH,
  QUARTERS,
  STRETCH_LONG,
  UNIVERSES,
  applyLivePrices,
  cyclePhase,
  esc,
  fetchLiveQuotes,
  fmtMoney,
  fmtPrice,
  fmtSupply,
  fmtUsd,
  fmtX,
  loadBundle,
  projectAtDate,
  quarterIndexFromParam,
  quarterParam,
  sectorLabel,
} from "./model.js";
import { footerHtml, headerHtml, moodHtml, timelineHtml } from "./ui.js";

const state = {
  universe: "solana",
  symbol: "SOL",
  scenarioId: "base-case",
  quarter: DEFAULT_QUARTER_IDX,
  investment: "100",
  copied: false,
};

let bundle = null;
let quotes = null;

const app = document.querySelector("#app");

function tokensInUniverse() {
  return applyLivePrices(bundle.tokens, quotes).filter((token) => token.universe === state.universe);
}

function currentToken() {
  const list = tokensInUniverse();
  return list.find((token) => token.symbol === state.symbol) || list[0];
}

function currentScenario() {
  return bundle.scenarios.find((scenario) => scenario.id === state.scenarioId) || bundle.scenarios[4];
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  const token = bundle.tokens.find((item) => item.symbol.toLowerCase() === (params.get("token") || "").toLowerCase());
  if (token) {
    state.universe = token.universe;
    state.symbol = token.symbol;
  }
  const scenario = params.get("scenario");
  if (scenario) {
    const match = bundle.scenarios.find((item) => item.id === scenario || item.id.startsWith(scenario.toLowerCase()));
    if (match) state.scenarioId = match.id;
  }
  const quarter = quarterIndexFromParam(params.get("quarter"));
  if (quarter >= 0) state.quarter = quarter;
  const investment = params.get("investment");
  if (investment && Number.isFinite(parseFloat(investment)) && parseFloat(investment) > 0) {
    state.investment = investment;
  }
}

function writeUrl() {
  const params = new URLSearchParams({
    token: state.symbol,
    scenario: state.scenarioId,
    quarter: quarterParam(state.quarter),
    investment: state.investment || "100",
  });
  history.replaceState(null, "", `${location.pathname}?${params}`);
}

function queryString() {
  const params = new URLSearchParams({
    token: state.symbol,
    tokens: state.symbol,
    scenario: state.scenarioId,
    quarter: quarterParam(state.quarter),
    investment: state.investment || "100",
  });
  return params.toString();
}

function bandsHtml(token, scenarioIndex) {
  const points = bundle.scenarios.map((scenario) => projectAtDate(token, scenario, state.quarter));
  const prices = points.flatMap((point) => [point.priceLow, point.priceHigh]);
  prices.push(token.priceUsd);
  const min = Math.min(...prices) / 1.35;
  const max = Math.max(...prices) * 1.35;
  const pos = (price) => ((Math.log10(price) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 100;
  const rows = bundle.scenarios
    .map((scenario, index) => {
      const point = points[index];
      const left = pos(point.priceLow);
      const width = Math.max(pos(point.priceHigh) - left, 0.8);
      return `<button type="button" class="band ${index === scenarioIndex ? "selected" : ""}" data-mood="${index}">
        <span class="name">${esc(scenario.label)}</span>
        <span class="rail">
          <i></i>
          <b style="left:${left}%;width:${width}%"></b>
          <s style="left:${pos(point.priceMid)}%"></s>
          <u style="left:${pos(token.priceUsd)}%"></u>
        </span>
        <span class="range-label">${fmtUsd(point.priceLow)} – ${fmtUsd(point.priceHigh)}</span>
      </button>`;
    })
    .join("");
  return `<div class="bands" role="img" aria-label="Implied price bands for ${esc(token.symbol)}">${rows}</div>
    <div class="legend">
      <span><i class="tick"></i> today (${fmtUsd(token.priceUsd)})</span>
      <span><i class="mid"></i> model mid</span>
      <span>log scale</span>
    </div>`;
}

function whyHtml(token, scenario, at) {
  const multiple = at.priceMid / token.priceUsd;
  const change = (multiple - 1) * 100;
  const changeText = `${change >= 0 ? "+" : ""}${change >= 100 ? Math.round(change).toLocaleString("en-US") : change.toFixed(0)}%`;
  const peakIdx = scenario.path.indexOf(1);
  const share = token.modelType === "monetary"
    ? `${esc(token.symbol)} captures ~${at.peak.trace.shareOfTotalPct.toFixed(1)}% of the total market → ${fmtUsd(at.peak.mcapMid)} peak target`
    : `${at.peak.trace.allocPct.toFixed(2)}% of the market goes to the ${esc(sectorLabel(at.peak.trace.sector))} pool → ${esc(token.symbol)} takes ${at.peak.trace.sharePct.toFixed(1)}% × ${Math.round(at.peak.trace.capturePct * 100)}% value capture → ${fmtUsd(at.peak.mcapMid)} peak target`;
  const dilution = at.supply / token.circSupply;
  const supplyNote = dilution > 1.005
    ? `(+${((dilution - 1) * 100).toFixed(0)}% vs today, unlocks included)`
    : "(essentially flat vs today)";
  const pathNote = at.progress < 1
    ? `At ${Math.round(at.progress * 100)}% of this scenario's path, `
    : "";
  const anchor = token.cycleAnchor;
  const vsPeak = anchor ? at.mcapMid / anchor.peakMcap : null;
  const peakPhrase = at.progress < 1 && peakIdx > 0 && state.quarter < peakIdx
    ? ` (the modeled cycle tops around ${QUARTERS[peakIdx]})`
    : at.progress < 1 && state.quarter > peakIdx
      ? ` — past the modeled top (${QUARTERS[peakIdx]}), so the price has rolled off`
      : "";
  const anchorSentence = anchor
    ? ` — about ${fmtX(vsPeak)} ${esc(token.symbol)}'s ${esc(anchor.peakDate)} ${anchor.basis === "realized" ? "peak market cap" : "comparable-derived anchor"} (${fmtUsd(anchor.peakMcap)})`
    : "";
  const chain = token.modelType === "monetary"
    ? `<p><span class="ink">The allocation chain:</span> this regime assumes ${fmtUsd(scenario.totalCryptoMcap)} of total crypto at its peak (${fmtX(scenario.totalCryptoMcap / PRIOR_ATH)} the Oct 2025 ATH) with ${esc(token.symbol)} taking ~${at.peak.trace.shareOfTotalPct.toFixed(1)}% of it (range ${token.monetary.sharesByScenario[scenario.id][0]}–${token.monetary.sharesByScenario[scenario.id][1]}%). ${esc(token.monetary.note)} → ${fmtUsd(at.peak.mcapMid)} peak target.</p>`
    : `<p><span class="ink">The allocation chain:</span> ${fmtUsd(scenario.totalCryptoMcap)} total crypto (${fmtX(scenario.totalCryptoMcap / PRIOR_ATH)} the Oct 2025 ATH) → ${at.peak.trace.allocPct.toFixed(2)}% allocated to the ${esc(sectorLabel(at.peak.trace.sector))} pool = ${fmtUsd(at.peak.trace.sectorPoolMcap)} → ${esc(token.symbol)} takes ${at.peak.trace.sharePct.toFixed(1)}% of it × ${Math.round(at.peak.trace.capturePct * 100)}% value-capture factor → ${fmtUsd(at.peak.mcapMid)} peak target.${anchor?.basis === "realized" ? ` For scale: recreating ${esc(token.symbol)}'s verified peak market cap (${fmtUsd(anchor.peakMcap)}) at ${QUARTERS[state.quarter]} supply prices ${fmtPrice(anchor.peakMcap / at.supply)}.` : ""}</p>
      ${at.peak.stretch ? `<p><span class="ink">Fundamental reality check (at the scenario peak):</span> ${esc(STRETCH_LONG[at.peak.stretch])} (implied ${fmtX(at.peak.impliedRevMultiple)} revenue vs the ${scenario.revMultipleRange[0]}–${scenario.revMultipleRange[1]}× band seen at peaks of this strength). Fundamentals explain the stretch. They do not cap the scenario.</p>` : ""}
      ${anchor ? `<p>Anchor note: ${esc(anchor.note)}</p>` : ""}`;

  const comps = (token.comparables || [])
    .map((item) => `${esc(item.name)}: ${fmtUsd(item.valueUsd)}`)
    .join(" · ");

  return `<div class="rows">
      <div class="row"><b>Market environment</b><span>${esc(scenario.label)} — ${fmtUsd(scenario.totalCryptoMcap)} total crypto at the cycle peak (${fmtX(scenario.totalCryptoMcap / PRIOR_ATH)} the Oct 2025 ATH) · ${esc(scenario.env.liquidity)} liquidity · ${esc(scenario.env.monetaryPolicy)} policy</span></div>
      <div class="row"><b>Token share</b><span>${share}</span></div>
      <div class="row"><b>Supply assumption</b><span>${fmtSupply(at.supply)} projected ${esc(token.symbol)} by ${QUARTERS[state.quarter]} ${supplyNote}</span></div>
      <div class="row"><b>Result</b><span>${pathNote}${fmtUsd(at.mcapMid)} market cap ÷ ${fmtSupply(at.supply)} supply ≈ <b>${fmtPrice(at.priceMid)}</b> (${fmtX(multiple)} from today)</span></div>
    </div>
    ${token.governanceOnly ? `<p class="warn">⚠ ${esc(token.symbol)} currently captures none of its protocol's revenue — stronger outcomes implicitly require governance to switch value capture on.</p>` : ""}
    ${multiple < 1.2 ? `<p class="warn">⚠ Why so low? ${esc(token.symbol)}'s projected supply grows ${((dilution - 1) * 100).toFixed(0)}% by ${QUARTERS[state.quarter]} — dilution eats the cycle upside here.</p>` : ""}
    <details class="nested">
      <summary>Read full methodology <span class="flip">▼</span></summary>
      <div class="prose">
        <p><span class="ink">${esc(scenario.label)}:</span> ${esc(scenario.description)} (${esc(scenario.anchor)})</p>
        <p><span class="ink">${QUARTERS[state.quarter]}</span> sits at ${Math.round(at.progress * 100)}% of this scenario's path${peakPhrase}. It implies a <span class="ink">${fmtUsd(at.mcapMid)} market cap</span>${anchorSentence}. Divided by <span class="ink">${fmtSupply(at.supply)} projected supply at ${QUARTERS[state.quarter]}</span> (unlocks included) → <span class="ink">${fmtPrice(at.priceMid)}</span> (${fmtX(multiple)} from today, ${changeText}). Model range at this date: ${fmtPrice(at.priceLow)}–${fmtPrice(at.priceHigh)}.</p>
        ${chain}
        <p>Environment assumed: liquidity ${esc(scenario.env.liquidity)} · monetary policy ${esc(scenario.env.monetaryPolicy)} · regulation ${esc(scenario.env.regulation)} · retail ${esc(scenario.env.retail)} · institutions ${esc(scenario.env.institutions)} · BTC dominance ~${scenario.env.btcDominancePct}%. Timing (recovery in 2027, the expected ~Apr 2028 halving, a potential 2029 peak window) is an assumption, not a certainty. This is a scenario estimate, never a prediction.</p>
      </div>
    </details>`;
}

function fundamentalsHtml(token, at) {
  const feeLabel = token.modelType === "monetary" ? "Network fees / yr" : "Revenue / yr";
  const feeValue = token.modelType === "monetary" ? token.annualizedFeesUsd ?? 0 : token.annualizedRevenueUsd ?? 0;
  const fdvNote = token.fdv / token.marketCap > 1.5 ? `${fmtX(token.fdv / token.marketCap)} the market cap` : "";
  const comps = (token.comparables || []).map((item) => `${esc(item.name)}: ${fmtUsd(item.valueUsd)}`).join(" · ");
  return `<div class="stats">
      <div class="stat"><span>Market cap</span><strong>${fmtUsd(token.marketCap)}</strong></div>
      <div class="stat"><span>FDV</span><strong>${fmtUsd(token.fdv)}</strong>${fdvNote ? `<em>${fdvNote}</em>` : ""}</div>
      <div class="stat"><span>${feeLabel}</span><strong>${fmtUsd(feeValue)}</strong><em>current run-rate</em></div>
      <div class="stat"><span>Supply ${QUARTERS[state.quarter]}</span><strong>${fmtSupply(at.supply)}</strong><em>${((at.supply / token.circSupply - 1) * 100).toFixed(1)}% vs today</em></div>
    </div>
    <div class="notes">
      <p><span class="ink">Unlocks:</span> ${esc(token.unlockNote || "")}</p>
      <p><span class="ink">Value capture:</span> ${esc(token.valueCapture || "")}</p>
      ${token.marketShareNote ? `<p><span class="ink">Market position:</span> ${esc(token.marketShareNote)}</p>` : ""}
      ${comps ? `<p><span class="ink">Reference points:</span> ${comps}</p>` : ""}
      ${token.caveats ? `<p><span class="ink">Caveats:</span> ${esc(token.caveats)}</p>` : ""}
    </div>`;
}

function methodologyHtml() {
  return `<div class="prose">
    <p>The headline number is the token's representative potential price at the selected quarter under the selected cycle strength. It is never a present fair value and never a prediction. Today is the starting point. The faces choose how strong the next cycle is. The timeline chooses the moment in it. Labels such as "Mania" or "Euphoria · potential peak" describe where that path is in time.</p>
    <p>The engine is macro-first. Each strength is a whole-market regime: a total crypto market cap at the cycle peak (base case about $6T, 1.4× the prior all-time high, the smallest peak-to-peak growth any crypto cycle has delivered; everything-aligns about $12T, 2.8×, inside the 3.6× precedent of 2017 to 2021), plus bitcoin dominance, liquidity, policy, and participation. That total is allocated down: sector pool, then the token's share of its sector, then a value-capture factor, then divided by projected supply. Quieter regimes lean on cash flow. Hotter regimes lean on narrative and prospective share. Verified historical peak market caps are calibration checks, not ceilings, and they always use market cap rather than price, because supply changes. A revenue-multiple check labels each result from fundamentally supported through extreme. It never caps the result.</p>
    <p>Calibration uses the $736B post-FTX trough, about $2.29T at the July 2026 snapshot, the $4.27T October 2025 all-time high, cross-cycle peak growth of 1.4× to 3.6×, and observed revenue multiples from that research (Pump.fun around 2–3× and Lido under 10× in weak markets, Jupiter around 12× recently, Uniswap around 207× at peak narrative).</p>
    <p>Market data: CoinGecko live overlay when available, otherwise the ${esc(bundle.asOf)} snapshot in <span class="ink">data/tokens.json</span>. Fees and revenue: DefiLlama 30-day run rates, as compiled in that snapshot. Unlock schedules: project docs, hand-checked in the same dataset. Every assumption in this rebuild is in <span class="ink">data/</span> and can be challenged. This is an independent reimplementation of the public Cycle Potential model. It is not investment advice.</p>
  </div>`;
}

function paintLive(token, scenario, at, dollars, outcome) {
  const peakIdx = scenario.path.indexOf(1);
  const peakPrice = projectAtDate(token, scenario, peakIdx).priceMid;
  const showPeak = at.priceMid < 0.95 * peakPrice;
  const peaked = state.quarter > peakIdx;
  const phase = cyclePhase(scenario, state.quarter);
  const priceEyebrow = document.querySelector("[data-live='eyebrow']");
  const price = document.querySelector("[data-live='price']");
  const phaseEl = document.querySelector("[data-live='phase']");
  const readout = document.querySelector("[data-live='readout']");
  const outcomeEl = document.querySelector("[data-live='outcome']");
  const range = document.querySelector(".cycle-range");
  if (!price) return false;
  priceEyebrow.textContent = state.quarter === 0 ? `today · ${QUARTERS[0]}` : `next-cycle potential · ${QUARTERS[state.quarter]}`;
  price.textContent = fmtPrice(at.priceMid);
  phaseEl.innerHTML = `<span class="ink">${esc(phase)}</span>${showPeak ? ` · ${peaked ? "peaked at" : "potential peak"} <button type="button" data-jump="${peakIdx}">${fmtPrice(peakPrice)} in ${QUARTERS[peakIdx]}</button>` : ""}`;
  const n = (state.quarter / (QUARTERS.length - 1)) * 100;
  readout.style.left = `clamp(2.6rem, ${n}%, calc(100% - 2.6rem))`;
  readout.textContent = QUARTERS[state.quarter];
  if (range && document.activeElement !== range) range.value = String(state.quarter);
  if (range) {
    range.setAttribute("aria-valuetext", QUARTERS[state.quarter]);
    range.style.background = `linear-gradient(to right, var(--accent) ${n}%, var(--grid) ${n}%)`;
  }
  outcomeEl.textContent = dollars > 0 ? fmtMoney(outcome) : "—";
  const why = document.querySelector("[data-live='why']");
  const bands = document.querySelector("[data-live='bands']");
  const funds = document.querySelector("[data-live='funds']");
  const glance = document.querySelector("[data-live='glance-title']");
  if (why) why.innerHTML = whyHtml(token, scenario, at);
  if (bands) bands.innerHTML = bandsHtml(token, bundle.scenarios.indexOf(scenario));
  if (funds) funds.innerHTML = fundamentalsHtml(token, at);
  if (glance) glance.textContent = `All scenarios at a glance · ${QUARTERS[state.quarter]}`;
  return true;
}

function render({ partial = false } = {}) {
  const token = currentToken();
  state.symbol = token.symbol;
  const scenario = currentScenario();
  const at = projectAtDate(token, scenario, state.quarter);
  const amount = parseFloat(state.investment);
  const dollars = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const outcome = dollars > 0 ? (dollars / token.priceUsd) * at.priceMid : 0;
  if (partial && paintLive(token, scenario, at, dollars, outcome)) return;

  const focus = document.activeElement;
  const focusId = focus?.id;
  const caret = focus?.selectionStart;
  const scenarioIndex = bundle.scenarios.indexOf(scenario);
  const peakIdx = scenario.path.indexOf(1);
  const peakPrice = projectAtDate(token, scenario, peakIdx).priceMid;
  const showPeak = at.priceMid < 0.95 * peakPrice;
  const peaked = state.quarter > peakIdx;
  const phase = cyclePhase(scenario, state.quarter);
  const list = tokensInUniverse();

  app.innerHTML = `<main class="wrap">
    ${headerHtml({ page: "explore", query: queryString() })}
    <div class="universe">
      <div class="universe-switch" role="radiogroup" aria-label="Universe">
        ${Object.entries(UNIVERSES).map(([id, label]) => `<button type="button" role="radio" data-universe="${id}" aria-checked="${state.universe === id}">${label}</button>`).join("")}
      </div>
    </div>
    <nav class="token-row" aria-label="Token">
      ${list.map((item) => `<button type="button" data-token="${item.symbol}" aria-pressed="${item.symbol === token.symbol}">${esc(item.symbol)}</button>`).join("")}
    </nav>
    <p class="today"><strong>${esc(token.symbol)}</strong> · today ${fmtPrice(token.priceUsd)}</p>
    <section>${moodHtml(bundle.scenarios, scenarioIndex)}</section>
    <section>
      <div class="eyebrow" data-live="eyebrow">${state.quarter === 0 ? `today · ${QUARTERS[0]}` : `next-cycle potential · ${QUARTERS[state.quarter]}`}</div>
      <div class="price" data-live="price" aria-live="polite">${fmtPrice(at.priceMid)}</div>
      <div class="phase" data-live="phase"><span class="ink">${esc(phase)}</span>${showPeak ? ` · ${peaked ? "peaked at" : "potential peak"} <button type="button" data-jump="${peakIdx}">${fmtPrice(peakPrice)} in ${QUARTERS[peakIdx]}</button>` : ""}</div>
    </section>
    ${timelineHtml(state.quarter)}
    <section class="invest">
      <label class="amount"><span>$</span><input id="investment" inputmode="decimal" aria-label="Investment amount in USD" value="${esc(state.investment)}"></label>
      <span>today →</span>
      <span class="outcome" data-live="outcome" aria-live="polite">${dollars > 0 ? fmtMoney(outcome) : "—"}</span>
      <span>in this scenario</span>
    </section>
    <p class="fine">Scenario estimate — not a price prediction</p>
    <div class="actions"><button type="button" class="ghost" id="share">${state.copied ? "Link copied ✓" : "Share scenario"}</button></div>
    <div class="center"><a class="linkish" href="compare.html?${esc(queryString())}">Compare ${esc(token.symbol)} with other tokens →</a></div>
    <div class="panels">
      <details class="panel"><summary><span class="chev">▶</span> Why this price?</summary><div class="panel-body" data-live="why">${whyHtml(token, scenario, at)}</div></details>
      <details class="panel"><summary><span class="chev">▶</span> <span data-live="glance-title">All scenarios at a glance · ${QUARTERS[state.quarter]}</span></summary><div class="panel-body" data-live="bands">${bandsHtml(token, scenarioIndex)}</div></details>
      <details class="panel"><summary><span class="chev">▶</span> Token fundamentals</summary><div class="panel-body" data-live="funds">${fundamentalsHtml(token, at)}</div></details>
      <details class="panel"><summary><span class="chev">▶</span> Methodology, sources & disclaimer</summary><div class="panel-body">${methodologyHtml()}</div></details>
    </div>
    ${footerHtml(bundle.asOf)}
  </main>`;

  if (focusId) {
    const next = document.getElementById(focusId);
    if (next) {
      next.focus();
      if (typeof caret === "number") next.setSelectionRange(caret, caret);
    }
  }
}

function onClick(event) {
  const universe = event.target.closest("[data-universe]");
  if (universe && universe.dataset.universe !== state.universe) {
    state.universe = universe.dataset.universe;
    state.symbol = tokensInUniverse()[0].symbol;
    writeUrl();
    render();
    return;
  }
  const tokenBtn = event.target.closest("[data-token]");
  if (tokenBtn) {
    state.symbol = tokenBtn.dataset.token;
    writeUrl();
    render();
    return;
  }
  const mood = event.target.closest("[data-mood]");
  if (mood) {
    state.scenarioId = bundle.scenarios[Number(mood.dataset.mood)].id;
    writeUrl();
    render();
    return;
  }
  const jump = event.target.closest("[data-jump]");
  if (jump) {
    state.quarter = Number(jump.dataset.jump);
    writeUrl();
    render();
    return;
  }
  if (event.target.id === "share") {
    const url = `${location.origin}${location.pathname}?${queryString()}`;
    navigator.clipboard?.writeText(url).then(() => {
      state.copied = true;
      render();
      setTimeout(() => {
        state.copied = false;
        render();
      }, 1600);
    }).catch(() => {});
  }
}

function onInput(event) {
  if (event.target.id === "investment") {
    state.investment = event.target.value;
    writeUrl();
    render();
  }
  if (event.target.classList?.contains("cycle-range")) {
    state.quarter = Number(event.target.value);
    writeUrl();
    render({ partial: true });
  }
}

function onKeydown(event) {
  const group = event.target.closest(".moods");
  if (!group) return;
  const index = bundle.scenarios.findIndex((item) => item.id === state.scenarioId);
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    state.scenarioId = bundle.scenarios[Math.min(bundle.scenarios.length - 1, index + 1)].id;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    state.scenarioId = bundle.scenarios[Math.max(0, index - 1)].id;
  } else return;
  writeUrl();
  render();
  document.querySelector(`.moods [data-mood="${bundle.scenarios.findIndex((item) => item.id === state.scenarioId)}"]`)?.focus();
}

app.addEventListener("click", onClick);
app.addEventListener("input", onInput);
app.addEventListener("keydown", onKeydown);

bundle = await loadBundle();
readUrl();
app.innerHTML = `<main class="wrap"><p class="loading">Loading scenarios…</p></main>`;
render();
writeUrl();
quotes = await fetchLiveQuotes(bundle.tokens);
if (quotes) render();
