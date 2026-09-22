# Cycle Potential

**How strong is the next crypto cycle?**

Live site: [mellor28.github.io/cycle-potential](https://mellor28.github.io/cycle-potential/)

Cycle Potential is a scenario explorer for crypto prices. You pick a token, decide how strong the next cycle is, and slide through time from mid-2026 to the end of 2029. The page shows a modeled potential price for that path, what a dollar amount invested today could become, and the market, share, and supply assumptions that produce the number.

It answers a “what would have to be true” question. It does not forecast the future, and it is not investment advice.

This is an independent reimplementation of the public [Cycle Potential](https://cyclepotential.com) model. It is not the official Marino site.

## What you can do

**Explore** looks at one token at a time.

1. Choose a universe: the Solana ecosystem, or a small set of global assets (Bitcoin, Ethereum, BNB, Hyperliquid, Zcash, NEAR).
2. Pick a token.
3. Choose a cycle strength. Eight faces run from a failed cycle to a case where everything aligns.
4. Move the timeline. Quarters run from Q3 2026 through Q4 2029. Markers call out today, the expected April 2028 Bitcoin halving, and a potential 2029 peak window.
5. Type an amount in dollars. The page translates that stake into the outcome on the path you selected.

The big number is the representative price at that quarter under that strength. A line under it names where the cycle is in time — accumulation, expansion, late cycle, a potential peak, or cooling off after a blow-off top. Clicking the peak figure jumps the timeline to the modeled top.

Open **Why this price?** for the chain behind the figure: the total crypto market assumed at the peak, the token’s share of that market, projected supply (unlocks included), and the resulting market cap divided into a price. **All scenarios at a glance** draws every strength on one log-scale chart for the quarter you selected. **Token fundamentals** shows market cap, fully diluted value, fees or revenue, supply growth, unlocks, and how the token captures value.

**Compare** puts up to four tokens on the same strength and the same date. Bars are ranked by multiple, so the question is which token could do more with the same dollar, not which one has the highest price. Every token is measured at that shared moment, never each at its own individual peak.

Share copies a link that restores the token, scenario, quarter, and amount.

## How a price is built

The model is macro-first. The face you pick is not a mood for one coin. It is a regime for the whole crypto market: a total market cap at the cycle peak, bitcoin’s share of that market, and a sketch of liquidity, policy, regulation, and who is participating.

That total is then allocated downward:

1. A sector pool, as a percent of all crypto.
2. The token’s share of its sector.
3. A value-capture factor, for tokens that are not the monetary asset of a network.
4. Projected circulating supply at the quarter you picked.

Monetary assets such as SOL and BTC are priced as a share of the whole market. Application tokens are priced from their sector pool. Past peak market caps are used as calibration checks, always in market-cap terms rather than raw price, because supply changes. Where a token has revenue, a multiple check labels the result from fundamentally supported through extreme. That label explains the stretch. It does not cap the price.

The timeline does not jump straight to the peak. It walks in log space from today’s market cap toward the scenario peak. Base case, for example, is about 95% of the way there in Q2 2029 and tops in Q3 2029. Only the hottest regimes model a real post-top drop.

The strength ladder is anchored to history. Prior cycle peaks grew about 3.6× from 2017 to 2021 and about 1.4× from 2021 to 2025. The October 2025 all-time high used here is about $4.27T.

| Strength | What it assumes at the cycle peak |
| --- | --- |
| Breakdown | No real next cycle. Total crypto falls toward $1.5T. |
| Bear case | A shallow bounce to about $2.5T, still far below the prior high. |
| Weak cycle | Healing toward about $3.5T, approaching but not reclaiming the high. |
| Conservative | A muted cycle that slightly exceeds the prior high, about $4.5T. |
| Base case | About $6T, 1.4× the prior high — the smallest peak-to-peak growth any crypto cycle has delivered. |
| Strong cycle | About $8T, 1.9× the prior high. |
| Bull case | About $10T, 2.3× the prior high. Liquidity and narrative dominate. |
| Everything aligns | About $12T, 2.8× the prior high, inside the 3.6× precedent of 2017–2021. |

## Where the numbers come from

Assumptions are in the open:

- `data/tokens.json` — prices, supply schedules, fees or revenue, unlock notes, and share bands. Snapshot date: 16 July 2026.
- `data/scenarios.json` — the eight regimes, their market totals, sector allocations, and quarterly paths.
- `js/model.js` — the allocation and the path from today to the selected quarter.

When the browser can reach CoinGecko, today’s price and market cap are overlaid live. Fees, revenue, and unlock schedules stay on the snapshot. If the live quote fails, the page uses the snapshot and still runs.

Market data in that snapshot came from CoinGecko. Fees and revenue are DefiLlama 30-day run rates. Unlock schedules were taken from project docs and checked by hand in the original research. This rebuild carries those published assumptions so the same inputs produce the same kind of result.

## Run it locally

```bash
python3 -m http.server 4173
```

Open http://localhost:4173

## Disclaimer

Scenario estimates only. Nothing here is a price prediction, a recommendation, or investment advice.
