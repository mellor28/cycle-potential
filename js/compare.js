import {
  DEFAULT_QUARTER_IDX,
  QUARTERS,
  STRETCH_SHORT,
  UNIVERSES,
  applyLivePrices,
  esc,
  fetchLiveQuotes,
  fmtMoney,
  fmtPrice,
  fmtUsd,
  fmtX,
  loadBundle,
  projectAtDate,
  quarterIndexFromParam,
  quarterParam,
} from "./model.js";
import { footerHtml, headerHtml, moodHtml, timelineHtml } from "./ui.js";

const MAX = 4;
const DEFAULTS = ["SOL", "JUP", "HYPE", "BTC"];

const state = {
  symbols: [...DEFAULTS],
  scenarioId: "base-case",
  quarter: DEFAULT_QUARTER_IDX,
  investment: "100",
  picker: false,
  copied: false,
};

let bundle = null;
let quotes = null;
const app = document.querySelector("#app");

function liveTokens() {
  return applyLivePrices(bundle.tokens, quotes);
}

function selectedTokens() {
  return state.symbols
    .map((symbol) => liveTokens().find((token) => token.symbol === symbol))
    .filter(Boolean);
}

function currentScenario() {
  return bundle.scenarios.find((scenario) => scenario.id === state.scenarioId) || bundle.scenarios[4];
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("tokens");
  if (raw) {
    const found = [];
    for (const part of raw.split(",")) {
      const token = bundle.tokens.find((item) => item.symbol.toLowerCase() === part.trim().toLowerCase());
      if (token && !found.includes(token.symbol)) found.push(token.symbol);
    }
    if (found.length) {
      state.symbols = (found.length === 1 && found[0] !== "SOL" ? ["SOL", ...found] : found).slice(0, MAX);
    }
  }
  const scenario = params.get("scenario");
  if (scenario) {
    const match = bundle.scenarios.find((item) => item.id === scenario || item.id.startsWith(scenario.toLowerCase()));
    if (match) state.scenarioId = match.id;
  }
  const quarter = quarterIndexFromParam(params.get("quarter"));
  if (quarter >= 0) state.quarter = quarter;
  const investment = params.get("investment");
  if (investment && Number.isFinite(parseFloat(investment)) && parseFloat(investment) > 0) state.investment = investment;
}

function queryString() {
  return new URLSearchParams({
    tokens: state.symbols.join(","),
    token: state.symbols[0] || "SOL",
    scenario: state.scenarioId,
    quarter: quarterParam(state.quarter),
    investment: state.investment || "100",
  }).toString();
}

function writeUrl() {
  history.replaceState(null, "", `${location.pathname}?${queryString()}`);
}

function rankings() {
  const scenario = currentScenario();
  const amount = parseFloat(state.investment);
  const dollars = Number.isFinite(amount) && amount > 0 ? amount : 0;
  return selectedTokens()
    .map((token) => {
      const at = projectAtDate(token, scenario, state.quarter);
      return { token, at, multiple: at.priceMid / token.priceUsd, outcome: dollars > 0 ? dollars * (at.priceMid / token.priceUsd) : 0 };
    })
    .sort((a, b) => b.multiple - a.multiple);
}

function render({ partial = false } = {}) {
  const focus = document.activeElement;
  const focusId = focus?.id;
  const caret = focus?.selectionStart;
  const scenario = currentScenario();
  const scenarioIndex = bundle.scenarios.indexOf(scenario);
  const rows = rankings();
  const top = rows[0]?.multiple || 1;
  const amount = parseFloat(state.investment);
  const dollars = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const chips = state.symbols
    .map(
      (symbol) => `<span class="chip">${esc(symbol)}${state.symbols.length > 1 ? `<button type="button" data-remove="${esc(symbol)}" aria-label="Remove ${esc(symbol)}">×</button>` : ""}</span>`,
    )
    .join("");

  const picker = state.picker
    ? `<button type="button" class="backdrop" data-close="1" aria-label="Close token picker"></button>
      <div class="picker-pop" role="dialog" aria-label="Select tokens to compare">
        <div class="picker-head"><strong>Select up to ${MAX} tokens</strong><span>${state.symbols.length} of ${MAX} selected</span></div>
        ${Object.entries(UNIVERSES).map(([id, label]) => `<div class="picker-group"><p>${label}</p><div class="picker">${liveTokens().filter((token) => token.universe === id).map((token) => {
          const on = state.symbols.includes(token.symbol);
          return `<button type="button" data-toggle="${esc(token.symbol)}" aria-pressed="${on}">${esc(token.symbol)}${on ? " ✓" : ""}</button>`;
        }).join("")}</div></div>`).join("")}
        <div class="actions" style="margin-top:0.8rem"><button type="button" class="ghost" data-close="1">Done</button></div>
      </div>`
    : "";

  const list = rows
    .map((row, index) => {
      const width = Math.max(4, (row.multiple / Math.max(top, 1e-9)) * 100);
      const anchor = row.token.cycleAnchor;
      const dilution = (row.at.supply / row.token.circSupply - 1) * 100;
      const anchorBit = anchor
        ? ` — ${fmtX(row.at.mcapMid / anchor.peakMcap)} ${anchor.basis === "realized" ? `the verified ${esc(anchor.peakDate)} peak` : "its comparable-derived anchor"} (${fmtUsd(anchor.peakMcap)})`
        : "";
      const supplyBit = dilution > 0.5 ? `grows ${dilution.toFixed(0)}% by then — dilution is priced in` : "is essentially flat";
      const stretchBit = row.at.peak.stretch ? ` At the scenario peak the valuation is ${esc(STRETCH_SHORT[row.at.peak.stretch])}.` : "";
      const govBit = row.token.governanceOnly ? ` ⚠ ${esc(row.token.symbol)} holders currently capture none of its protocol revenue.` : "";
      return `<article>
        <div class="rank">
          <div class="rank-no">#${index + 1}</div>
          <div class="rank-name"><strong>${esc(row.token.symbol)}</strong><span>${esc(row.token.name)}</span></div>
          <div class="rank-val">
            <strong>${dollars > 0 ? `${fmtMoney(dollars)} → ${fmtMoney(row.outcome)}` : "—"}</strong>
            <span>${fmtX(row.multiple)} · ${fmtPrice(row.at.priceMid)} per ${esc(row.token.symbol)}</span>
          </div>
          <div class="meter"><i style="width:${width}%;opacity:${index === 0 ? 1 : 0.4}"></i></div>
        </div>
        <details class="why">
          <summary>Why this ranks #${index + 1} <span class="flip">▼</span></summary>
          <p>Implies a <b>${fmtUsd(row.at.mcapMid)} market cap</b> at ${quarterName()} ${anchorBit}. Supply ${supplyBit}.${stretchBit}${govBit}</p>
        </details>
      </article>`;
    })
    .join("");

  if (partial && document.querySelector(".rank-list") && document.querySelector(".cycle-range")) {
    document.querySelector(".rank-list").innerHTML = list;
    const label = document.querySelector("[data-live='compare-eyebrow']");
    if (label) {
      label.textContent = state.quarter === 0
        ? "today · Q3 2026"
        : `potential outcome · ${quarterName()} · ${scenario.label}`;
    }
    const n = (state.quarter / (QUARTERS.length - 1)) * 100;
    const readout = document.querySelector("[data-live='readout']");
    if (readout) {
      readout.style.left = `clamp(2.6rem, ${n}%, calc(100% - 2.6rem))`;
      readout.textContent = QUARTERS[state.quarter];
    }
    const range = document.querySelector(".cycle-range");
    range.setAttribute("aria-valuetext", QUARTERS[state.quarter]);
    range.style.background = `linear-gradient(to right, var(--accent) ${n}%, var(--grid) ${n}%)`;
    return;
  }

  app.innerHTML = `<main class="wrap compare-wrap">
    ${headerHtml({ page: "compare", query: queryString() })}
    <p class="today">Same amount, same scenario, same date — which token could do more?</p>
    <section class="chips">
      ${chips}
      ${state.symbols.length < MAX ? `<button type="button" class="ghost" id="add">+ Add tokens</button>` : ""}
      ${picker}
    </section>
    <section>${moodHtml(bundle.scenarios, scenarioIndex)}</section>
    ${timelineHtml(state.quarter)}
    <section class="invest">
      <label class="amount"><span>$</span><input id="investment" inputmode="decimal" aria-label="Investment amount in USD, applied to each token" value="${esc(state.investment)}"></label>
      <span>in each token today</span>
    </section>
    <p class="eyebrow" data-live="compare-eyebrow">${state.quarter === 0 ? "today · Q3 2026" : `potential outcome · ${quarterName()} · ${esc(scenario.label)}`}</p>
    ${rows.length > 1 ? `<p class="fine">Bars show each outcome relative to the top-ranked token (= 100%).</p>` : ""}
    <div class="rank-list">${list}</div>
    ${rows.length < 2 ? `<p class="today">Add at least one more token to turn this into a ranking.</p>` : ""}
    <p class="fine">Every token is measured at the same quarter under the same scenario — never each at its own individual peak.</p>
    <div class="actions"><button type="button" class="ghost" id="share">${state.copied ? "Link copied ✓" : "Share comparison"}</button></div>
    <div class="center"><a class="linkish" href="index.html?${esc(queryString())}">Want the full story on one token? <strong>Open the Scenario explorer →</strong></a></div>
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

function quarterName() {
  return QUARTERS[state.quarter];
}

app.addEventListener("click", (event) => {
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
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    state.symbols = state.symbols.filter((symbol) => symbol !== remove.dataset.remove);
    writeUrl();
    render();
    return;
  }
  const toggle = event.target.closest("[data-toggle]");
  if (toggle) {
    const symbol = toggle.dataset.toggle;
    if (state.symbols.includes(symbol)) state.symbols = state.symbols.filter((item) => item !== symbol);
    else if (state.symbols.length < MAX) {
      state.symbols = [...state.symbols, symbol];
      if (state.symbols.length >= MAX) state.picker = false;
    }
    writeUrl();
    render();
    return;
  }
  if (event.target.id === "add") {
    state.picker = !state.picker;
    render();
    return;
  }
  if (event.target.closest("[data-close]")) {
    state.picker = false;
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
});

app.addEventListener("input", (event) => {
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
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.picker) {
    state.picker = false;
    render();
    return;
  }
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
});

bundle = await loadBundle();
readUrl();
render();
writeUrl();
quotes = await fetchLiveQuotes(bundle.tokens);
if (quotes) render();
