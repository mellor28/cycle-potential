# Cycle Potential

Independent reimplementation of the public [Cycle Potential](https://cyclepotential.com) scenario explorer.

Pick a token, choose how strong the next crypto cycle is, and move along a timeline from mid-2026 through the end of 2029. The page shows a modeled potential price, what a dollar amount today could become on that path, and the market-cap, share, and supply assumptions behind the number.

These are scenario estimates. They are not price predictions and not investment advice.

## What it does

- **Explore** — one token, eight cycle strengths, a quarter-by-quarter timeline, an investment translator, and the allocation chain.
- **Compare** — up to four tokens on the same scenario and the same date, ranked by multiple.

The model is macro-first. Each strength is a total-crypto regime. That total is allocated to a sector, then to the token's share of the sector, then through a value-capture factor, then divided by projected supply. The timeline walks from today's market cap toward that peak in log space. Numbers and notes live in `data/` so they can be checked.

Market prices try a live CoinGecko overlay and fall back to the 2026-07-16 snapshot in `data/tokens.json`.

## Run locally

```bash
python3 -m http.server 4173
```

Open http://localhost:4173
