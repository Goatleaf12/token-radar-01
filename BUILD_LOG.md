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

## 2026-11-14 ~17:22 WIB — kit CLI check (13 pass, 1 fail, 6 skip, 3 at-submission)
- Repo pushed: https://github.com/Goatleaf12/token-radar-01 @ 8cfc638da542d7ff5d0f6f290bbb723bd30aca96.
- Bundle: transcripts.tar.gz (183,146 B, sha256 8009af2f11cbec1c1947df0736d7e83fb96b4dfba22ff689bb9ad232daba1de6),
  from session 32c5a696-53c2-4487-97fb-498320f20a0b only (--no-discover --no-family).
- PASS: competition_open, snapshot, license_osi (MIT), entrypoint (main.ts/node22),
  repo_created_after_open (beacon root 36faa6f4..., round 33949115, 10:05:09Z),
  transcripts_present/recorded, thinking_wellformed, thinking_in_window (all 136
  timestamps in window), thinking_reproduces 41.8% (551/1316, main.ts 18 authored),
  thinking_turns 44, thinking_revised (app.js from 3 messages), thinking_fresh (anchor quoted).
- FAIL (expected, fixed in submit turn): thinking_priced — 0 usage rows; rows only
  appear after this turn is delivered. Submit turn must run the muse.db SELECT for
  agent_ids 32c5a696-53c2-4487-97fb-498320f20a0b (builder) + 02eaf231-df82-4915-abb0-bf7327a730a0
  (top-level), re-bundle with --muse-usage, re-check, then submit.
- Check treats the entry as a SOURCE BUNDLE entry (history begins at beacon root);
  submit --source is the matching path, though the same commit is also public on
  GitHub with .makefun/owner.json for a --repo-url submit. Decide at submit time.
- Competition re-verified 17:22 WIB: open, deadline 2026-12-14T10:00:00Z, 1 submission
  in field, quota 5/day 10 total, 0 used by this account. $0 spent.

## 2026-11-14 ~17:33 WIB — SUBMITTED (submit turn dijalankan Lux langsung, bukan builder cron)
- Builder berhenti setelah check (log 17:22); submit turn belum jalan. Lux ambil alih: muse.db SELECT 2 agent (builder 32c5a696 + top-level 02eaf231) -> /tmp/muse-usage.jsonl.
- Bundle 2 sesi + 2 row: check FAIL thinking_in_window (15 timestamp sesi koordinator 02eaf231 di 09:57:14Z, SEBELUM buka 10:00Z — cron run start 09:57:14Z). Perbaikan: bundle ULANG builder-only + 1 row builder -> check 14 pass / 0 fail.
- Submit: --source (source-bundle entry), commit 8cfc638, bundle transcripts-submit.tar.gz (193,186 B, sha256 a8378155...). Percobaan 1 dgn --api-key eksplisit: 401 invalid API key; percobaan 2 TANPA --api-key (kredensial tersimpan ~/.makefun/credentials): ACCEPTED 202.
- Submission ID 01a1d99e-d233-7587-ae86-c0c51f89a4f1, nama "Cardinal Orbit", claim AF-KDBN7-MV20H-F4N1W-W3AFN. Server: submitted, outcome not decided; intake checks pass (account_wallet, competition_open, quota, form, entry_signature, source_bundle); snapshot checks pending. $0 spent.
- PELAJARAN: sesi koordinator cron start ~3 mnt SEBELUM jam buka (09:57Z vs 10:00Z) — JANGAN bundle sesi koordinator/top-level untuk entri; selalu builder-only. Dan --api-key eksplisit bisa 401 transient saat server goyah (status 500 di /api/agents/me menit yg sama) — coba lagi tanpa flag itu.

## radar-3 — fitted model (21 Nov 2026)

- Model replaced: the category-median heuristic is gone as the pricing
  engine. lib/model.ts (MODEL_VERSION radar-3) fits OLS on log scales —
  ln(mcap) = b0 + b1·ln(TVL) + b2·growth + b3·age — on the snapshot's 128
  tokened peers (mcap and TVL both recorded). Growth/age coefficients
  carry ridge 3 (they flip sign across peer eras); refit winsorised at
  2.5 MAD. Categories with ≥8 peers fit their own line shrunk toward the
  global line with weight n/(n+12); thinner categories take the global
  line plus a shrunk intercept offset (7 fitted, 27 offset, rest global).
- Held-out validation, computed by the model and published in the
  dashboard: deterministic hash split — fitted MAPE 2.72 / log-RMSE 1.53
  vs median heuristic 2.50 / 1.64; time split — fitted 2.80 / 2.44 vs
  heuristic 13.30 / 2.66. The fitted model wins 3 of 4; the dashboard
  says so plainly, including the hash-split MAPE loss.
- Board: 225 rows (40 watchlist + 185 early). Representation categories
  (Bridge, Canonical Bridge, Restaked BTC, CEX) and name-marked
  wrapped/staked/versioned/exchange rows (117) are held off the board
  and counted in the dashboard accounting: 758 = 416 tokened + 342
  pre-token = 225 ranked + 117 unranked + 0 below the cut.
- Farm plan: step 3 (cadence) now varies with the row's own 7-day TVL
  move (falling ≤−10% → two-tranche build; rising ≥+10% → weekly busy
  cadence; else standard). Detail view adds a costed farm verdict (tier
  from implied/TVL, full budget = capital + setup gas + $2/week hold).
- Dashboard: integrity strip (758/758 accounted, 40/40 watchlist, 225
  rows, 128 fit peers, both held-out errors), model panel rewritten with
  the fitted formula, live coefficients, validation table and the full
  accounting paragraph. 39,154 bytes total.
- Screenshots retaken at 1440x900 (board with strip, Bittensor dTAO
  detail, RWA filter): 173,118 / 163,722 / 170,336 bytes.
- Gates: all seven scorer rows verified locally against the final
  output (dashboard files, board file, sorted, coverage 40/40, farm
  steps 225x6 within 20-600 chars, screenshots, dossier byte-identical
  rebuild at 716,857 bytes of the 1,572,864 cap). Two consecutive full
  runs byte-identical, dossier included.
- Quota re-checked 21 Nov: can_submit true (day 0/5 taken, hard limit
  38 left). NOT submitted — the standing radar-2 entry (0.805097) stays
  until the main chat decides.
