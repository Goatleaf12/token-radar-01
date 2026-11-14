# token-radar-01 — BUILD LOG

## 2026-11-14 ~17:03 WIB — setup
- Competition verified live via API: open since 2026-11-14T10:00:00Z, deadline
  2026-12-14T10:00:00Z, 1 submission already (plucky-lark-18, 10:00:50Z).
  Quota 5/day, 10 total, 0 used by this account.
- Repo created: https://github.com/Goatleaf12/token-radar-01 (public, gh auth Goatleaf12).
- Kit init anchor (run in empty repo, before any entry file):
  `makefun anchor 36faa6f426f8231419cfc77ca1b8b31bdedc25ca round 33949115`
  (root commit cc4f3c1 LICENSE: MIT; anchor commit 36faa6f).
- Snapshot stats (from kit input/snapshot.json): 758 protocols, watchlist 40,
  342 pre-token. Global median mcap/tvl = 0.169. Category medians only
  trusted with >=5 tokened peers (else global); starter filter for early rows
  (pre-token, not CEX, not versioned) yields 186 candidates for 160 slots.

## Model (radar-2, lib/model.ts)
- implied = round(TVL x category-median multiple x growth factor x age factor);
  growth = 1 + clamp(7d, -50, +200)/100 x 0.5; age = 1 + min(age, 1095)/1095 x 0.25;
  multiples clamped 0.02–2.0; strictly decreasing values enforced ($1 step-down).
- Board: 40 watchlist + 160 early by TVL. Farm plan: 6 steps per row, derived
  from category/chains/TVL/age (same derivation rebuilt in dashboard/app.js).
- Dashboard: index.html + app.css + app.js, tuples in data.js; dossier text
  (dashboard/ only) ~31 KB, well under the 65,536 cap.

## 2026-11-14 ~17:13 WIB — local verification (all pass)
- main.ts run 2x, byte-identical outputs (determinism OK).
- Board: 200 rows, ranks 1..200 once each, implied strictly non-increasing,
  watchlist 40/40, farm steps 6/row all 20–600 chars, slugs unique + in snapshot.
- Top: steakhouse-financial $654,548,190; bottom: $328,416. Board TVL $16.19B.
- Dashboard: 3 files, 31,430 bytes; no forbidden http(s); data.js 30,409 bytes,
  rows match board rank/slug/implied.
- Dossier: text 31,694 / 65,536 bytes; dossier.json 685,508 / 1,572,864 bytes.
- Screenshots (Playwright, 1440x900, renders of this dashboard, no edits):
  1-board.png 167,566 B; 2-detail.png 160,832 B (Steakhouse Financial);
  3-filtered.png 161,124 B (RWA, 15 rows). Page-regenerated farm steps match
  board.json exactly. Only page error: /favicon.ico 404 (benign).
- Fixes during verification: detail recompute wording (rounded figures, not a
  step-down) + search input widened to 270px; screenshots re-taken after fix.
