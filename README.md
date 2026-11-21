# Token Radar

225 pre-token DeFi protocols ranked by implied launch value — an entry for
make.fun's **token-radar-01** bounty ($1,325; 1st $1,000).

## The model (radar-3)

The value model is fitted to the sealed snapshot's own record, not set by
hand. The snapshot's 128 protocols whose token already trades, with a
market cap and a TVL both recorded, are the peers. Least squares on log
scales fits

```
ln(mcap) = b0 + b1 x ln(tvl) + b2 x growth + b3 x age
```

- **growth**: the seven-day TVL change clamped to −50%..+50%, as a
  fraction (unreported counts as 0).
- **age**: days since DefiLlama first tracked the protocol, capped at
  1,095 and scaled to 0–1 (unreported reads as the peers' mean).

The growth and age coefficients carry a ridge of 3 (those relations flip
sign across eras of the peer record), and the fit is refit with residuals
winsorised at 2.5 median absolute deviations. A category with at least 8
peers fits its own line, shrunk toward the global line with weight
n/(n+12); a thinner category keeps the global line plus an intercept
offset shrunk the same way. A pre-token protocol's implied value is the
fitted line read at its own figures. No protocol name is special-cased.

The fit is validated twice out of sample — a deterministic hash split and
a time split of the peers — and both errors are published in the
dashboard next to the previous model's (radar-2's category-median
heuristic, kept as the baseline). On the time split the fitted model
wins both metrics (MAPE 280% vs 1,330%; log RMSE 2.44 vs 2.66); on the
hash split it wins the log RMSE (1.53 vs 1.64).

## The board

The board holds the whole 40-protocol watchlist plus 185 further
pre-token protocols. Held off the board, and counted in the dashboard's
accounting block: representation categories (bridge, canonical bridge,
restaked BTC, CEX) and protocols marked by name as wrapped, staked,
versioned or exchange products — 117 in all, so every one of the 758
snapshot protocols is accounted for: 416 record a token and are set
aside, 342 record none, 225 of those are ranked here. Protocols whose
token already trades are set aside in a separate live-token view with
their market caps.

## The dashboard

`dashboard/` is a static page (no framework, no network): an integrity
strip with the coverage and held-out error numbers, a sortable,
filterable board, a detail view per protocol with the fitted terms, a
costed farm verdict and a six-step farm plan with costs and times, a
model panel with the validation table and the full accounting, and a
live-token tab. `dashboard/index.html` reads `data.js`, written beside
it by `main.ts`.

Wording is deliberate: a protocol on this board *records no token* in the
snapshot. That is not proof it has none.

## Run it

Node 22+:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Writes `out/board.json`, `out/data.js`, `out/dashboard/`,
`out/screenshots/` and `out/dossier.json`. The run is deterministic:
run it twice and the outputs are byte-identical.

## License

MIT.
