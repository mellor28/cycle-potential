import {
  HALVING_IDX,
  PEAK_WINDOW_END_IDX,
  PEAK_WINDOW_START_IDX,
  QUARTERS,
  esc,
  pctOf,
} from "./model.js";

const FACES = [
  `<path d="M9 22c2.2-3 11.8-3 14 0"/><path d="M10 12h.2"/><path d="M22 12h.2"/>`,
  `<path d="M10 21c2 2 10 2 12 0"/><circle cx="11.5" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="20.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>`,
  `<path d="M10.5 20h11"/><circle cx="11.5" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="20.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>`,
  `<path d="M10 19.5c2 1.4 10 1.4 12 0"/><circle cx="11.5" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="20.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>`,
  `<path d="M10 18.5c2.2 3.2 9.6 3.2 12 0"/><circle cx="11.5" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="20.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>`,
  `<path d="M9.5 18c2.4 4 10.6 4 13 0"/><circle cx="11.5" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="20.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>`,
  `<path d="M9 17.5c2.6 5 11.4 5 14 0"/><path d="M9.5 11.5c1.2-1.4 3.2-1.4 4.2.2"/><path d="M18.3 11.7c1-1.6 3-1.6 4.2.2"/>`,
  `<path d="M16 20.5v.2"/><path d="M12.2 19.2l-1.2 1.6"/><path d="M19.8 19.2l1.2 1.6"/><path d="M11.2 14.2l1.6-1.1 1.5 1.2-1.5 1.1z" fill="currentColor"/><path d="M17.7 14.2l1.6-1.1 1.5 1.2-1.5 1.1z" fill="currentColor"/><path d="M16 6.5v2"/><path d="M8.5 8.2l1.6 1.4"/><path d="M23.5 8.2l-1.6 1.4"/>`,
];

export function faceSvg(index) {
  return `<svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="16" r="12.2"/>${FACES[index] || ""}</svg>`;
}

export function logoMark() {
  return `<svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#f5c518"/><path d="M7 20c3-1 4.5-6 8-6s4 5 10 2" fill="none" stroke="#0b0b0b" stroke-width="2.4" stroke-linecap="round"/><circle cx="23" cy="15.2" r="1.7" fill="#0b0b0b"/></svg>`;
}

export function headerHtml({ page, query }) {
  const exploreHref = `index.html?${query}`;
  const compareHref = `compare.html?${query}`;
  return `<header class="header">
    <a class="brand" href="${esc(exploreHref)}">${logoMark()} Cycle Potential</a>
    <nav class="nav" aria-label="Cycle Potential modes">
      <a href="${esc(exploreHref)}" ${page === "explore" ? 'aria-current="page"' : ""}>Explore</a>
      <a href="${esc(compareHref)}" ${page === "compare" ? 'aria-current="page"' : ""}>Compare</a>
    </nav>
    <a class="domain" href="https://cyclepotential.com" target="_blank" rel="noopener noreferrer">cyclepotential.com</a>
  </header>`;
}

export function timelineHtml(selected) {
  const n = pctOf(selected);
  const peakLeft = pctOf(PEAK_WINDOW_START_IDX);
  const peakRight = 100 - pctOf(PEAK_WINDOW_END_IDX);
  const halving = pctOf(HALVING_IDX);
  return `<div class="timeline">
    <div class="track">
      <div class="peak-band" style="left:${peakLeft}%;right:${peakRight}%"></div>
      <div class="halving-tick" style="left:${halving}%"></div>
      <input class="cycle-range" type="range" min="0" max="${QUARTERS.length - 1}" step="1" value="${selected}" aria-label="Timeline — when" aria-valuetext="${esc(QUARTERS[selected])}" style="background:linear-gradient(to right, var(--accent) ${n}%, var(--grid) ${n}%)">
    </div>
    <div class="quarter-readout"><span data-live="readout" style="left:clamp(2.6rem, ${n}%, calc(100% - 2.6rem))">${esc(QUARTERS[selected])}</span></div>
    <div class="markers">
      <button type="button" class="left" data-jump="0"><span class="short">today</span><span class="long">Jul 2026 · today</span></button>
      <button type="button" class="mid" data-jump="${HALVING_IDX}" style="left:${halving}%"><span class="short">halving</span><span class="long">expected halving</span></button>
      <button type="button" class="right" data-jump="${PEAK_WINDOW_START_IDX}"><span class="short">peak window</span><span class="long">potential peak window</span></button>
    </div>
  </div>`;
}

export function footerHtml(asOf) {
  return `<footer class="footer">
    <p>Scenario estimates, not price predictions and not investment advice.</p>
    <p>Independent reimplementation of the public <a href="https://cyclepotential.com">Cycle Potential</a> model. Snapshot ${esc(asOf)}, with a live CoinGecko overlay when the browser can reach it.</p>
  </footer>`;
}

export function moodHtml(scenarios, selected) {
  const buttons = scenarios
    .map(
      (scenario, index) => `<button type="button" role="radio" aria-checked="${index === selected}" aria-label="${esc(scenario.label)}" title="${esc(scenario.label)}" data-mood="${index}">${faceSvg(index)}</button>`,
    )
    .join("");
  return `<div class="eyebrow">how strong is the next cycle?</div>
    <div class="moods" role="radiogroup" aria-label="Cycle strength">${buttons}</div>
    <div class="mood-label">${esc(scenarios[selected].label)}</div>`;
}
