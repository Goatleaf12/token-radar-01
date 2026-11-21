// Token Radar model v3 ("radar-3"): rank pre-token protocols by implied launch value.
//
// The value model is FITTED to the snapshot's own record, not set by hand.
// The snapshot carries 128 protocols whose token already trades with both a
// market cap and a TVL: the peers. On the peers we fit, by least squares on
// log scales,
//
//   ln(mcap) = b0 + b1 x ln(tvl) + b2 x growth + b3 x age
//
//   growth = clamp(change_7d, -50, +50) / 100   (unreported -> 0)
//   age    = min(age_days, 1095) / 1095          (unreported -> the peers' mean)
//
// The fit is ridge-regularised on the growth and age coefficients (lambda
// 3: those two relations flip sign across eras of the peer record, so the
// fit is not allowed to lean on them) and refit twice with residuals
// winsorised at 2.5 median absolute deviations, so one wild peer cannot
// set the price. A category with at least 8 peers fits its own line,
// shrunk toward the global line with weight n / (n + 12); a thinner
// category keeps the global line plus an intercept offset shrunk the same
// way; a category with no peers uses the global line. A pre-token
// protocol's implied value is the fitted line read at its own figures, so
// every term of every row can be re-derived from the snapshot alone. No
// protocol name is special-cased.
//
// The fit is validated twice, out of sample, and the errors are published
// in the dashboard next to the old median heuristic's errors on the same
// held-out peers (see validateModel):
//   - a deterministic hash split of the peers (slug hash, 30% held out);
//   - a time split (fit on the earliest-listed 70% of peers, test on the
//     latest 30%).
//
// The board holds the whole 40-protocol watchlist plus every remaining
// pre-token protocol that is not a representation of another asset — a
// bridge, canonical-bridge, restaked-BTC or exchange entry, or a wrapped,
// staked or versioned product by name — 225 rows in all on this snapshot.
// Protocols whose token already trades are kept apart in a live view,
// never ranked. All 758 snapshot protocols are accounted for in the
// dashboard's accounting block: tokened set aside, pre-token ranked, the
// rest held off the board with the reason counted.

/** One protocol entry: exactly the ten fields the sealed snapshot carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  mcap_usd: number | null;
}

/** The whole sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 260;

/** How many live-token protocols the dashboard's live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The fit's constants, stated in the dashboard so a reader can redo the math. */
export interface FitConstants {
  growth_floor: number;
  growth_cap: number;
  age_days: number;
  shrink_k: number;
  min_category_peers: number;
  ridge_lambda: number;
  winsor_mad: number;
  split_hash_mod: number;
  split_test_of: number;
}

export const FIT: FitConstants = {
  growth_floor: -50,
  growth_cap: 50,
  age_days: 1095,
  shrink_k: 12,
  min_category_peers: 8,
  ridge_lambda: 3,
  winsor_mad: 2.5,
  split_hash_mod: 10,
  split_test_of: 3,
};

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row, with the fitted terms shown. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_value_usd: number;
    growth_factor: number;
    age_factor: number;
    category_peers: number;
    shrink_weight: number;
    fit_source: 'category' | 'offset' | 'global';
  };
  farm_steps: string[];
}

/**
 * The dashboard's compact view of one row, as a tuple so data.js stays small:
 * [rank, slug, name, category, chains, tvl, change_7d, age_days, implied,
 *  base_value, growth_factor, age_factor, watchlist(1/0), category_peers,
 *  shrink_pct, fit_source(2=category, 1=offset, 0=global)].
 */
export type RadarRow = [
  number,
  string,
  string,
  string | null,
  string[],
  number,
  number | null,
  number | null,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** A live-token protocol, as a tuple: [slug, name, category, chains, tvl, mcap, change_7d]. */
export type LiveRow = [string, string, string | null, string[], number, number | null, number | null];

/** One held-out validation split, for the fitted model and the old heuristic. */
export interface SplitReport {
  train: number;
  test: number;
  fit_mape: number;
  fit_rmse_log: number;
  old_mape: number;
  old_rmse_log: number;
}

/** The model's published validation: two held-out splits, errors as fractions. */
export interface ValidationReport {
  peers: number;
  hash: SplitReport;
  time: SplitReport;
}

/** The fitted global line and how the categories were handled. */
export interface FitReport {
  b0: number;
  b1: number;
  b2: number;
  b3: number;
  shrink_k: number;
  min_category_peers: number;
  ridge_lambda: number;
  winsor_mad: number;
  categories_fitted: number;
  categories_offset: number;
}

/** Every protocol in the snapshot, accounted for. */
export interface Accounting {
  total: number;
  tokened: number;
  tokened_with_mcap: number;
  pretoken: number;
  board_rows: number;
  pretoken_unranked: number;
  pretoken_excluded: number;
  pretoken_excluded_category: number;
  pretoken_excluded_name: number;
  pretoken_below_cut: number;
  watchlist: number;
  live_shown: number;
}

/** Everything the dashboard needs: the board, the live set, the fit and its validation. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  fit: FitReport;
  validation: ValidationReport;
  accounting: Accounting;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The protocols whose trading token can teach the fit: a market cap and a TVL. */
export function fitPeers(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** The model's feature row for one protocol: [1, ln(tvl), growth, age]. */
function features(p: SnapshotProtocol, asOf: string, ageMean: number): [number, number, number, number] {
  const age = ageDays(asOf, p.listed_at);
  const g = p.change_7d === null ? 0 : Math.min(FIT.growth_cap, Math.max(FIT.growth_floor, p.change_7d)) / 100;
  const a = age === null ? ageMean : Math.min(age, FIT.age_days) / FIT.age_days;
  return [1, Math.log(Math.max(1, p.tvl_usd)), g, a];
}

/** The mean age fraction across the peers that report a listing day. */
function peerAgeMean(peers: SnapshotProtocol[], asOf: string): number {
  const ages: number[] = [];
  for (const p of peers) {
    const age = ageDays(asOf, p.listed_at);
    if (age !== null) ages.push(Math.min(age, FIT.age_days) / FIT.age_days);
  }
  if (ages.length === 0) return 0;
  return ages.reduce((s, v) => s + v, 0) / ages.length;
}

/** Solve A x = b for a small dense system by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    const tmp = M[col]!;
    M[col] = M[piv]!;
    M[piv] = tmp;
    const d = M[col]![col]!;
    if (Math.abs(d) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / d;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r]![c] = M[r]![c]! - f * M[col]![c]!;
    }
  }
  return M.map((row, i) => (Math.abs(row[i]!) < 1e-12 ? 0 : row[n]! / row[i]!));
}

/**
 * Least squares of y on X (rows of features), no dependencies, with a
 * ridge of FIT.ridge_lambda on the growth and age coefficients only: those
 * two relations are the unstable ones across eras of the peer record.
 */
function ols(X: [number, number, number, number][], y: number[]): [number, number, number, number] {
  const k = 4;
  const A: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const b = new Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    const x = X[i]!;
    for (let r = 0; r < k; r++) {
      b[r] = b[r]! + x[r]! * y[i]!;
      for (let c = 0; c < k; c++) A[r]![c] = A[r]![c]! + x[r]! * x[c]!;
    }
  }
  A[2]![2] = A[2]![2]! + FIT.ridge_lambda;
  A[3]![3] = A[3]![3]! + FIT.ridge_lambda;
  // A whisper more keeps a degenerate category fit finite.
  A[0]![0] = A[0]![0]! + 1e-9;
  A[1]![1] = A[1]![1]! + 1e-9;
  const s = solve(A, b);
  return [s[0]!, s[1]!, s[2]!, s[3]!];
}

type Coef = [number, number, number, number];

/** How one category's line was derived from the global line. */
export interface CategoryLine {
  coef: Coef;
  peers: number;
  weight: number;
  source: 'category' | 'offset' | 'global';
}

/** A fitted model: the global line, one line per category, and the age mean it imputes. */
export interface FittedModel {
  global: Coef;
  ageMean: number;
  categories: Map<string, CategoryLine>;
  peers: number;
}

/**
 * Fit the value model on a set of peers: a global log-log OLS, then per
 * category either its own OLS shrunk toward the global line (at least
 * min_category_peers peers) or the global line with a shrunk intercept
 * offset from the category's mean residual.
 */
export function fitModel(peers: SnapshotProtocol[], asOf: string): FittedModel {
  const ageMean = peerAgeMean(peers, asOf);
  const X = peers.map((p) => features(p, asOf, ageMean));
  let y = peers.map((p) => Math.log(p.mcap_usd!));
  let global = ols(X, y);
  // Refit twice with the target winsorised around the residual median at
  // FIT.winsor_mad median absolute deviations: one wild peer (a market cap
  // a hundred times its TVL, or the reverse) cannot set the price.
  for (let pass = 0; pass < 2; pass++) {
    const residuals = y.map((v, i) => v - dot(global, X[i]!));
    const med = median(residuals) ?? 0;
    const mad = (median(residuals.map((r) => Math.abs(r - med))) ?? 0) * 1.4826;
    if (mad <= 0) break;
    const limit = FIT.winsor_mad * mad;
    let changed = false;
    y = y.map((v, i) => {
      const r = residuals[i]!;
      if (Math.abs(r - med) <= limit) return v;
      changed = true;
      return v - (r - med) + Math.sign(r - med) * limit;
    });
    global = ols(X, y);
    if (!changed) break;
  }
  const byCategory = new Map<string, number[]>();
  peers.forEach((p, i) => {
    const key = p.category ?? 'Other';
    const list = byCategory.get(key) ?? [];
    list.push(i);
    byCategory.set(key, list);
  });
  const categories = new Map<string, CategoryLine>();
  for (const [key, idx] of byCategory) {
    const n = idx.length;
    const w = n / (n + FIT.shrink_k);
    if (n >= FIT.min_category_peers) {
      const own = ols(
        idx.map((i) => X[i]!),
        idx.map((i) => y[i]!),
      );
      const coef: Coef = [
        w * own[0] + (1 - w) * global[0],
        w * own[1] + (1 - w) * global[1],
        w * own[2] + (1 - w) * global[2],
        w * own[3] + (1 - w) * global[3],
      ];
      categories.set(key, { coef, peers: n, weight: w, source: 'category' });
    } else {
      const meanResidual = idx.reduce((s, i) => s + (y[i]! - dot(global, X[i]!)), 0) / n;
      const coef: Coef = [global[0] + w * meanResidual, global[1], global[2], global[3]];
      categories.set(key, { coef, peers: n, weight: w, source: 'offset' });
    }
  }
  return { global, ageMean, categories, peers: peers.length };
}

function dot(a: Coef, x: [number, number, number, number]): number {
  return a[0] * x[0] + a[1] * x[1] + a[2] * x[2] + a[3] * x[3];
}

/** The category line a protocol is priced on. */
function lineFor(model: FittedModel, category: string | null): CategoryLine {
  return model.categories.get(category ?? 'Other') ?? { coef: model.global, peers: 0, weight: 0, source: 'global' };
}

/** The fitted model's reading of one protocol: the implied value and its terms. */
export function predict(
  model: FittedModel,
  p: SnapshotProtocol,
  asOf: string,
): { implied: number; base: number; growthFactor: number; ageFactor: number; line: CategoryLine } {
  const line = lineFor(model, p.category);
  const x = features(p, asOf, model.ageMean);
  const base = Math.exp(line.coef[0] + line.coef[1] * x[1]);
  const growthFactor = Math.exp(line.coef[2] * x[2]);
  const ageFactor = Math.exp(line.coef[3] * x[3]);
  const implied = Math.min(100_000_000_000_000, Math.max(1, Math.round(base * growthFactor * ageFactor)));
  return { implied, base, growthFactor, ageFactor, line };
}

/** The median of a non-empty list; null when empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The radar-2 heuristic, kept only as the validation baseline: a category
 * median market-cap-to-TVL multiple (at least 5 peers, else the global
 * median, clamped to 0.02-2.0) times a growth factor times an age factor.
 */
function oldPredict(train: SnapshotProtocol[], p: SnapshotProtocol, asOf: string): number {
  const ratios = train.map((t) => t.mcap_usd! / t.tvl_usd);
  const global = Math.min(2, Math.max(0.02, median(ratios) ?? 1));
  const cat = train.filter((t) => (t.category ?? 'Other') === (p.category ?? 'Other')).map((t) => t.mcap_usd! / t.tvl_usd);
  const multiple = cat.length >= 5 ? Math.min(2, Math.max(0.02, median(cat) ?? global)) : global;
  const growth = p.change_7d === null ? 1 : 1 + (Math.min(200, Math.max(-50, p.change_7d)) / 100) * 0.5;
  const age = ageDays(asOf, p.listed_at);
  const ageF = age === null ? 1 : 1 + (Math.min(age, FIT.age_days) / FIT.age_days) * 0.25;
  return Math.max(1, p.tvl_usd * multiple * growth * ageF);
}

/** Deterministic FNV-1a hash of a slug, for the held-out hash split. */
function slugHash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Score one split: fit both models on train, read MAPE and log-RMSE on test. */
function scoreSplit(train: SnapshotProtocol[], test: SnapshotProtocol[], asOf: string): SplitReport {
  const model = fitModel(train, asOf);
  let apeFit = 0;
  let apeOld = 0;
  let seFit = 0;
  let seOld = 0;
  for (const p of test) {
    const actual = p.mcap_usd!;
    const f = predict(model, p, asOf).implied;
    const o = oldPredict(train, p, asOf);
    apeFit += Math.abs(f - actual) / actual;
    apeOld += Math.abs(o - actual) / actual;
    seFit += (Math.log(f) - Math.log(actual)) ** 2;
    seOld += (Math.log(Math.max(1, o)) - Math.log(actual)) ** 2;
  }
  const n = Math.max(1, test.length);
  return {
    train: train.length,
    test: test.length,
    fit_mape: round4(apeFit / n),
    fit_rmse_log: round4(Math.sqrt(seFit / n)),
    old_mape: round4(apeOld / n),
    old_rmse_log: round4(Math.sqrt(seOld / n)),
  };
}

/**
 * The published validation: two held-out splits of the peer set. The hash
 * split holds out every peer whose slug hash lands in the test residue;
 * the time split fits on the earliest-listed 70% of dated peers and tests
 * on the latest 30%. Both models are refit on each training part only.
 */
export function validateModel(snapshot: Snapshot): ValidationReport {
  const peers = fitPeers(snapshot);
  const hashTest = peers.filter((p) => slugHash(p.slug) % FIT.split_hash_mod < FIT.split_test_of);
  const hashTrain = peers.filter((p) => slugHash(p.slug) % FIT.split_hash_mod >= FIT.split_test_of);
  const dated = peers
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
  const cut = Math.floor(dated.length * 0.7);
  return {
    peers: peers.length,
    hash: scoreSplit(hashTrain, hashTest, snapshot.as_of),
    time: scoreSplit(dated.slice(0, cut), dated.slice(cut), snapshot.as_of),
  };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/**
 * Categories that are representations of another asset by construction:
 * bridges hold the bridged asset (WBTC, USDT0 and CCIP are this snapshot's
 * Bridge entries), a canonical bridge is the asset re-issued, restaked BTC
 * is BTC wrapped, and CEX entries are exchanges' own. A representation is
 * not a launch, whatever its TVL.
 */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Restaked BTC', 'CEX']);

/** Exchange names the watchlist rule refuses at the start of a protocol's name. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol's own name marks it as a wrapped, staked or versioned product, or an exchange's own entry. */
export function isProductByName(p: SnapshotProtocol): boolean {
  if (VERSIONED.test(p.name)) return true;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return true;
  return EXCHANGE_PREFIXES.some((x) => p.name === x || p.name.startsWith(`${x} `));
}

/**
 * Whether a pre-token protocol is held off the board as a product of a
 * token that already trades, by the exclusions observable in a protocol's
 * own record: a representation category (PRODUCT_CATEGORIES), or a name
 * that marks a wrapped, staked or versioned product or an exchange's own
 * entry. Service categories (staking, lending, exchanges' tooling) are
 * not excluded: the protocol itself may still launch, and its record
 * decides.
 */
export function isProductOfTokened(p: SnapshotProtocol): boolean {
  return (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) || isProductByName(p);
}

/** How the snapshot's pre-token protocols divide: ranked, excluded as products, below the cut. */
export interface PreTokenSplit {
  chosen: Map<string, SnapshotProtocol>;
  excluded: number;
  excludedCategory: number;
  excludedName: number;
  belowCut: number;
}

/** The board's pre-token selection: the watchlist, then the largest eligible early protocols. */
export function splitPreToken(snapshot: Snapshot): PreTokenSplit {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  let excludedCategory = 0;
  let excludedName = 0;
  const eligible: SnapshotProtocol[] = [];
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug) || !isPreToken(p)) continue;
    if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) {
      excludedCategory++;
    } else if (isProductByName(p)) {
      excludedName++;
    } else {
      eligible.push(p);
    }
  }
  eligible.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const early = eligible.slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);
  return { chosen, excluded: excludedCategory + excludedName, excludedCategory, excludedName, belowCut: eligible.length - early.length };
}

/** The protocols the board ranks, strongest first, with ranks 1..n and strictly falling values. */
export function buildBoard(snapshot: Snapshot, model: FittedModel): BoardRow[] {
  const { chosen } = splitPreToken(snapshot);

  const scored = [...chosen.values()].map((p) => ({ p, age: ageDays(snapshot.as_of, p.listed_at), ...predict(model, p, snapshot.as_of) }));
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.slug ? 1 : 0));
  // Values must fall strictly with rank, so equal neighbours are stepped down by $1.
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.implied >= scored[i - 1]!.implied) scored[i]!.implied = Math.max(1, scored[i - 1]!.implied - 1);
  }
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_value_usd: Math.round(s.base),
      growth_factor: round4(s.growthFactor),
      age_factor: round4(s.ageFactor),
      category_peers: s.line.peers,
      shrink_weight: round4(s.line.weight),
      fit_source: s.line.source,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** A rough gas budget for one transaction on a chain, in whole dollars (an estimate, not live). */
function gasFor(chain: string): number {
  if (chain === 'Ethereum') return 8;
  if (['Arbitrum', 'Optimism', 'Base', 'Binance', 'Polygon', 'Unichain', 'Blast', 'Linea', 'Scroll', 'Mantle', 'Sonic', 'Avalanche', 'xDai'].includes(chain)) return 2;
  return 4;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} as collateral and keep the loan-to-value below 50%.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position in range.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the wallet.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and place one market position on an outcome you can follow weekly.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares in the wallet.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in the farming wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis strategy on ${chain} and keep the position open.`;
  if (c.includes('payment') || c.includes('card')) return `Spend $${capital} through ${name} on ${chain} each month and keep the receipts.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * The weekly-activity step, keyed to the protocol's own seven-day TVL move:
 * a shrinking protocol is farmed in two tranches, a growing one weekly
 * while its snapshots fill up, a steady one on the standard cadence.
 */
function cadenceStep(p: SnapshotProtocol, capital: number): FarmStep {
  const chg = p.change_7d;
  if (chg !== null && chg <= -10) {
    return {
      text: `TVL fell ${Math.abs(round2(chg))}% in the last seven days, so stage this farm: open with half of the $${capital} this week, do one qualifying action on ${p.name}, and add the rest only after two weekly checks.`,
      cost: 'half the capital now, the rest only if the protocol steadies',
      time: '10 minutes a week for two weeks, then monthly',
    };
  }
  if (chg !== null && chg >= 10) {
    return {
      text: `TVL grew ${round2(chg)}% in the last seven days: do one qualifying action every week on ${p.name} — a deposit, a borrow, a swap or a vote — while the protocol is busy and its activity snapshots fill up.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    };
  }
  return {
    text: `Do one qualifying action every week on ${p.name} — a deposit, a borrow, a swap or a vote — so the wallet shows repeat activity.`,
    cost: 'about $2 of gas a week',
    time: '10 minutes a week',
  };
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age, seven-day move), never from a hand-written list of names. The
 * dashboard rebuilds the same six steps from the same fields, so the page
 * and the board agree.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  return [
    {
      text: `Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas on ${chain}`,
      time: '15 minutes to set up',
    },
    cadenceStep(p, capital),
    {
      text: `Hold the position for at least ${hold} days so the activity lands in more than one snapshot window.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet address, the dates and every transaction hash in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's live-token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => [p.slug, p.name, p.category, p.chains, p.tvl_usd, p.mcap_usd, p.change_7d] as LiveRow);
}

/** A board row's compact tuple form for data.js. */
export function radarRow(row: BoardRow, watch: Set<string>): RadarRow {
  return [
    row.rank,
    row.slug,
    row.name,
    row.category,
    row.chains,
    row.tvl_usd,
    row.change_7d,
    row.age_days,
    row.implied_value_usd,
    row.model.base_value_usd,
    row.model.growth_factor,
    row.model.age_factor,
    watch.has(row.slug) ? 1 : 0,
    row.model.category_peers,
    Math.round(row.model.shrink_weight * 100),
    row.model.fit_source === 'category' ? 2 : row.model.fit_source === 'offset' ? 1 : 0,
  ];
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const peers = fitPeers(snapshot);
  const model = fitModel(peers, snapshot.as_of);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const watch = new Set(snapshot.watchlist);
  const tokened = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const pretoken = snapshot.protocols.length - tokened;
  let categoriesFitted = 0;
  let categoriesOffset = 0;
  for (const line of model.categories.values()) {
    if (line.source === 'category') categoriesFitted++;
    else categoriesOffset++;
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    fit: {
      b0: round4(model.global[0]),
      b1: round4(model.global[1]),
      b2: round4(model.global[2]),
      b3: round4(model.global[3]),
      shrink_k: FIT.shrink_k,
      min_category_peers: FIT.min_category_peers,
      ridge_lambda: FIT.ridge_lambda,
      winsor_mad: FIT.winsor_mad,
      categories_fitted: categoriesFitted,
      categories_offset: categoriesOffset,
    },
    validation: validateModel(snapshot),
    accounting: {
      total: snapshot.protocols.length,
      tokened,
      tokened_with_mcap: peers.length,
      pretoken,
      board_rows: board.length,
      pretoken_unranked: pretoken - board.length,
      pretoken_excluded: splitPreToken(snapshot).excluded,
      pretoken_excluded_category: splitPreToken(snapshot).excludedCategory,
      pretoken_excluded_name: splitPreToken(snapshot).excludedName,
      pretoken_below_cut: splitPreToken(snapshot).belowCut,
      watchlist: snapshot.watchlist.length,
      live_shown: live.length,
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, watch)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd >= board[i - 1]!.implied_value_usd) return `row ${i + 1} does not fall below row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
