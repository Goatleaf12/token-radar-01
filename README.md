# Token Radar

200 pre-token DeFi protocols ranked by implied launch value — an entry for
make.fun's **token-radar-01** bounty ($1,325; 1st $1,000).

## The model (radar-2)

Implied value comes only from the sealed snapshot's own figures:

```
implied = round( tvl x multiple x growth_factor x age_factor )
```

- **multiple**: the median market-cap-to-TVL ratio of the tokened protocols
  in the same category, when the category has at least 5 tokened peers;
  otherwise the global median across all tokened protocols. Clamped to
  0.02–2.0.
- **growth_factor**: `1 + clamp(change_7d, -50, +200) / 100 x 0.5`
  (unreported 7d change counts as 1.0).
- **age_factor**: `1 + min(age_days, 1095) / 1095 x 0.25`
  (missing listing date counts as 1.0).

No protocol name is special-cased. The board holds the whole 40-protocol
watchlist plus the 160 pre-token protocols below the $50M floor with the
largest TVL. Protocols whose token already trades are set aside in a
separate live-token view with their market caps.

## The dashboard

`dashboard/` is a static page (no framework, no network): a sortable,
filterable board, a detail view per protocol with the formula broken down
and a six-step farm plan with costs and times, and a live-token tab.
`dashboard/index.html` reads `data.js`, written beside it by `main.ts`.

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
