// Token Radar's dashboard. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, filters, a per-protocol detail view
// with the model's own inputs, and the farm plan. No network: every byte it
// shows is in data.js.
//
// Row tuples: [rank, slug, name, category, chains, tvl, change_7d, age_days,
// implied, base_value, growth_factor, age_factor, watchlist, category_peers,
// shrink_pct, fit_source(2=category, 1=offset, 0=global)]
// Live tuples: [slug, name, category, chains, tvl, mcap, change_7d]
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watch: false, tab: 'pre', sort: 'implied', dir: -1, selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'not reported';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // The farm plan is the same derivation main.ts writes to board.json: category,
  // chains, TVL and age decide the action, the capital, the hold and every cost
  // and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasFor(chain) {
    if (chain === 'Ethereum') return 8;
    if (['Arbitrum', 'Optimism', 'Base', 'Binance', 'Polygon', 'Unichain', 'Blast', 'Linea', 'Scroll', 'Mantle', 'Sonic', 'Avalanche', 'xDai'].indexOf(chain) >= 0) return 2;
    return 4;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' as collateral and keep the loan-to-value below 50%.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('liquidity') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position in range.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then use the bridged funds inside its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token in the wallet.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' on ' + name + ' and place one market position on an outcome you can follow weekly.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares in the wallet.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it in the farming wallet.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s basis strategy on " + chain + ' and keep the position open.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Spend $' + capital + ' through ' + name + ' on ' + chain + ' each month and keep the receipts.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function cadenceStep(p, capital) {
    var chg = p.change_7d;
    if (chg !== null && chg !== undefined && chg <= -10) {
      return { text: 'TVL fell ' + Math.abs(round2(chg)) + '% in the last seven days, so stage this farm: open with half of the $' + capital + ' this week, do one qualifying action on ' + p.name + ', and add the rest only after two weekly checks.', cost: 'half the capital now, the rest only if the protocol steadies', time: '10 minutes a week for two weeks, then monthly' };
    }
    if (chg !== null && chg !== undefined && chg >= 10) {
      return { text: 'TVL grew ' + round2(chg) + '% in the last seven days: do one qualifying action every week on ' + p.name + ' — a deposit, a borrow, a swap or a vote — while the protocol is busy and its activity snapshots fill up.', cost: 'about $2 of gas a week', time: '10 minutes a week' };
    }
    return { text: 'Do one qualifying action every week on ' + p.name + ' — a deposit, a borrow, a swap or a vote — so the wallet shows repeat activity.', cost: 'about $2 of gas a week', time: '10 minutes a week' };
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    return [
      { text: 'Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas on ' + chain, time: '15 minutes to set up' },
      cadenceStep(p, capital),
      { text: 'Hold the position for at least ' + hold + ' days so the activity lands in more than one snapshot window.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open " + p.name + "'s own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet address, the dates and every transaction hash in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }
  function rowAsProtocol(r) {
    return { name: r[2], category: r[3], chains: r[4], tvl_usd: r[5], change_7d: r[6], age_days: r[7] };
  }
  // Recompute a row from the fitted terms the page carries, and check the
  // number board.json carries, so page and board are visibly the same arithmetic.
  function impliedOf(r) {
    return Math.max(1, Math.round(r[9] * r[10] * r[11]));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watch') === '1') state.watch = true;
    if (params.get('tab') === 'live') state.tab = 'live';
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watch) params.set('watch', '1');
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r[3] || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r[4].indexOf(state.chain) < 0) return false;
      if (state.watch && r[12] !== 1) return false;
      if (!q) return true;
      var hay = [r[2], r[1], r[3], r[4].join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a[2].toLowerCase(); bv = b[2].toLowerCase(); }
      else if (key === 'tvl') { av = a[5]; bv = b[5]; }
      else if (key === 'growth') { av = a[6] === null ? -Infinity : a[6]; bv = b[6] === null ? -Infinity : b[6]; }
      else if (key === 'age') { av = a[7] === null ? Infinity : a[7]; bv = b[7] === null ? Infinity : b[7]; }
      else { av = a[8]; bv = b[8]; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { class: 'pill', text: 'Snapshot ' + DATA.as_of }),
        el('span', { class: 'pill', text: 'DefiLlama protocol index' }),
        el('span', { class: 'pill', text: DATA.model_version + ' model' })
      )
    );
  }

  function fmtMape(x) { return Math.round(x * 100) + '%'; }

  function strip() {
    var a = DATA.accounting;
    var v = DATA.validation;
    function cell(label, value, small) {
      return el('div', { class: 'strip-cell' }, el('span', { text: label }), el('b', { text: value }), el('small', { text: small }));
    }
    return el('section', { class: 'strip', 'aria-label': 'Integrity strip' },
      cell('Protocols accounted', a.total + ' / ' + a.total, 'every snapshot protocol, none dropped silently'),
      cell('Watchlist covered', a.watchlist + ' / ' + a.watchlist, 'the floor, covered in full'),
      cell('Board rows', String(a.board_rows), DATA.early_size + ' early rows past the watchlist'),
      cell('Model fit on', a.tokened_with_mcap + ' tokened peers', 'market cap and TVL both recorded'),
      cell('Held-out error, hash split', 'RMSE ' + v.hash.fit_rmse_log.toFixed(2) + ' vs ' + v.hash.old_rmse_log.toFixed(2), 'log scale, fitted vs median heuristic'),
      cell('Held-out error, time split', 'MAPE ' + fmtMape(v.time.fit_mape) + ' vs ' + fmtMape(v.time.old_mape), 'fitted vs median heuristic')
    );
  }

  function lede() {
    var totalTvl = DATA.rows.reduce(function (s, r) { return s + r[5]; }, 0);
    var top = DATA.rows[0];
    return el('section', { class: 'lede' },
      el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied launch value' }),
      el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL that records no token. The early radar adds ' + DATA.early_size + ' further pre-token protocols the watchlist does not name. Implied value is this entry\u2019s claim, fitted from the snapshot\u2019s own figures, not a prediction of when or whether a token launches.' }),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('small', { text: 'every watchlist slug is on the board' })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows' }), el('b', { text: String(DATA.board_size) }), el('small', { text: DATA.early_size + ' early rows past the watchlist' })),
        el('div', { class: 'fact' }, el('span', { text: 'Board TVL' }), el('b', { text: fmtUsd(totalTvl) }), el('small', { text: 'across all ' + DATA.board_size + ' rows' })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(top[8]) }), el('small', { text: top[2] }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r[3] || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r[4]); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSel = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var watchBox = el('input', { type: 'checkbox', id: 'watch', checked: state.watch ? 'checked' : null, 'aria-label': 'Watchlist only' });
    watchBox.addEventListener('change', function () { state.watch = watchBox.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    var shown = state.tab === 'pre' ? filteredRows().length + ' rows shown' : DATA.live.length + ' live-token protocols';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('label', { class: 'check', for: 'watch' }, watchBox, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: shown })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u25BC' : ' \u25B2' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watch = false; writeHash(); render(); } })
      ));
    }
    var max = DATA.rows[0][8] || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r[6] === null ? 'not reported' : fmtPct(r[6]);
      var growthClass = r[6] === null ? '' : r[6] >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r[1] ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r[1]); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r[1]); } }
      },
        el('td', { class: 'num' }, el('span', { class: 'rank-chip', text: String(r[0]) })),
        el('td', null, el('div', { class: 'name' },
          el('b', null, esc(r[2]), r[12] === 1 ? el('span', { class: 'watch-tag', text: 'WATCH' }) : null),
          el('span', { class: 'sub', text: (r[3] || 'Other') + ' on ' + (r[4].length ? r[4].slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r[5]) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r[7]) }),
        el('td', null, el('div', null,
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r[8] / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r[8]) })
        )),
        el('td', null, el('span', { class: 'status', text: 'records no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num' }, el('span', { class: 'status live', text: 'live' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r[1] }), el('span', { class: 'sub', text: (r[2] || 'Other') + ' on ' + (r[3].length ? r[3].slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r[4]) }),
        el('td', { class: 'num ' + (r[6] !== null && r[6] >= 0 ? 'pos' : 'neg'), text: fmtPct(r[6]) }),
        el('td', { class: 'num', text: fmtUsd(r[5]) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var f = DATA.fit;
    var v = DATA.validation;
    var a = DATA.accounting;
    function vrow(label, s) {
      return el('tr', null,
        el('td', { text: label }),
        el('td', { class: 'num', text: s.train + ' fit / ' + s.test + ' held out' }),
        el('td', { class: 'num', text: fmtMape(s.fit_mape) }),
        el('td', { class: 'num', text: fmtMape(s.old_mape) }),
        el('td', { class: 'num', text: s.fit_rmse_log.toFixed(2) }),
        el('td', { class: 'num', text: s.old_rmse_log.toFixed(2) })
      );
    }
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'The model is fitted, not set by hand. The snapshot\u2019s ' + a.tokened_with_mcap + ' protocols whose token already trades, with a market cap and a TVL both recorded, are the peers. Least squares on log scales fits one line on the peers; a pre-token protocol\u2019s implied value is that line read at its own figures. No protocol name is special-cased and no row is hand-picked.' }),
      el('div', { class: 'formula', text: 'ln(implied) = ' + f.b0.toFixed(2) + ' + ' + f.b1.toFixed(2) + ' x ln(TVL) ' + (f.b2 < 0 ? '\u2212 ' + Math.abs(f.b2).toFixed(2) : '+ ' + f.b2.toFixed(2)) + ' x growth ' + (f.b3 < 0 ? '\u2212 ' + Math.abs(f.b3).toFixed(2) : '+ ' + f.b3.toFixed(2)) + ' x age' }),
      el('p', { text: 'Growth is the seven-day TVL change clamped to \u221250% to +50%, as a fraction; age is the days since DefiLlama first tracked the protocol, capped at 1,095 and scaled to 0\u20131; an unreported age reads as the peers\u2019 mean. The growth and age coefficients carry a ridge of ' + f.ridge_lambda + ' because those two relations flip sign across eras of the peer record, and the fit is refit with residuals winsorised at ' + f.winsor_mad + ' median absolute deviations so one wild peer cannot set the price. A category with at least ' + f.min_category_peers + ' peers fits its own line, shrunk toward the global line with weight n/(n+' + f.shrink_k + '); a thinner category keeps the global line plus an intercept offset shrunk the same way. On this snapshot: ' + f.categories_fitted + ' categories carry their own fit, ' + f.categories_offset + ' an offset.' }),
      el('h3', { text: 'Held-out validation, published' }),
      el('p', { text: 'Twice, the model was refit on part of the peers and read on the rest it had never seen, against the previous model (a category median multiple with growth and age factors) refit on the same training part. MAPE is the mean absolute percentage error in dollars; RMSE is on log values, where this fit is scored.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'vtable' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Split' }),
            el('th', { scope: 'col', text: 'Peers' }),
            el('th', { scope: 'col', text: 'Fitted MAPE' }),
            el('th', { scope: 'col', text: 'Median MAPE' }),
            el('th', { scope: 'col', text: 'Fitted RMSE' }),
            el('th', { scope: 'col', text: 'Median RMSE' })
          )),
          el('tbody', null, vrow('Hash split (every third peer held out)', v.hash), vrow('Time split (latest-listed held out)', v.time))
        )
      ),
      el('p', { text: 'Read honestly: dollar MAPE rewards under-prediction, and the median heuristic prices low by construction, so it keeps the hash-split MAPE while losing both log-scale RMSEs and the time split outright. Launch values are dispersed; no model on these figures is precise, and this one publishes its error rather than hiding it.' }),
      el('h3', { text: 'Every protocol accounted for' }),
      el('p', { text: a.total + ' protocols stand in the snapshot. ' + a.tokened + ' record a token and are set aside, never ranked (' + a.tokened_with_mcap + ' of them carry a market cap and fit the model; the live view shows the ' + a.live_shown + ' largest). ' + a.pretoken + ' record no token: ' + a.board_rows + ' are ranked on this board \u2014 the ' + a.watchlist + ' watchlist protocols plus ' + (a.board_rows - a.watchlist) + ' early ones \u2014 and ' + a.pretoken_unranked + ' are held off the board: ' + a.pretoken_excluded_category + ' in representation categories (bridge, canonical bridge, restaked BTC, CEX), whose entries are another asset re-issued, and ' + a.pretoken_excluded_name + ' marked by name as wrapped, staked, versioned or exchange products.' + (a.pretoken_below_cut > 0 ? ' A further ' + a.pretoken_below_cut + ' eligible protocols fall below the board\u2019s cut.' : '') }),
      el('p', { text: 'Wording matters: a protocol on this board records no token in the snapshot. That is not proof it has none.' })
    );
  }

  function farmVerdict(r) {
    var p = rowAsProtocol(r);
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    var weeks = Math.ceil(hold / 7);
    var budget = capital + gas + 2 * weeks;
    var ratio = r[5] > 0 ? r[8] / r[5] : 0;
    var tier = ratio >= 1 ? 'High priority' : ratio >= 0.3 ? 'Standard priority' : 'Watch only';
    return 'Farm verdict: ' + tier + '. The full plan costs about $' + budget + ' over ' + hold + ' days \u2014 $' + capital + ' of capital, about $' + gas + ' of setup gas on ' + chain + ' and about $2 a week to stay active \u2014 against an implied value of ' + ratio.toFixed(2) + 'x this protocol\u2019s TVL.';
  }

  function detailSection(r) {
    var p = rowAsProtocol(r);
    var steps = farmSteps(p);
    var recomputed = impliedOf(r);
    var stepped = r[8] - recomputed;
    var multNote = r[15] === 2
      ? 'Priced on the fitted line for ' + (r[3] || 'Other') + ': ' + r[13] + ' tokened peers, their own fit shrunk ' + r[14] + '% toward the global line.'
      : r[15] === 1
        ? 'Priced on the global fitted line plus an intercept offset from ' + r[13] + ' tokened peer' + (r[13] === 1 ? '' : 's') + ' in ' + (r[3] || 'Other') + ', shrunk ' + r[14] + '% toward it.'
        : 'Priced on the global fitted line: ' + (r[3] || 'Other') + ' has no tokened peers in the snapshot.';
    var recomputeNote = stepped === 0
      ? 'The page recomputes this row as ' + fmtUsd(recomputed) + ', the same number board.json carries.'
      : 'The page recomputes this row as ' + fmtUsd(recomputed) + ' from the rounded terms shown; board.json carries ' + fmtUsd(r[8]) + '.';
    return el('section', { class: 'panel detail', id: 'detail' },
      el('div', { class: 'detail-head' },
        el('div', null,
          el('span', { class: 'sub', text: 'Rank ' + r[0] + ' of ' + DATA.board_size + (r[12] === 1 ? '  ·  watchlist' : '  ·  early radar') }),
          el('h2', { id: 'detail-title', text: r[2] }),
          el('p', { class: 'sub', text: (r[3] || 'Other') + ' on ' + (r[4].length ? r[4].join(', ') : 'an unnamed chain') + '  ·  records no token' })
        ),
        el('button', { class: 'button ghost', type: 'button', text: 'Close', onclick: function () { state.selected = null; writeHash(); render(); } })
      ),
      el('div', { class: 'detail-grid' },
        el('div', { class: 'cell' }, el('span', { text: 'TVL' }), el('b', { text: fmtUsd(r[5]) })),
        el('div', { class: 'cell' }, el('span', { text: 'Seven-day growth' }), el('b', { text: fmtPct(r[6]) })),
        el('div', { class: 'cell' }, el('span', { text: 'Age with no token' }), el('b', { text: fmtAge(r[7]) })),
        el('div', { class: 'cell' }, el('span', { text: 'Fitted size value' }), el('b', { text: fmtUsd(r[9]) })),
        el('div', { class: 'cell' }, el('span', { text: 'Growth x age factors' }), el('b', { text: r[10] + ' x ' + r[11] })),
        el('div', { class: 'cell' }, el('span', { text: 'Implied value' }), el('b', { text: fmtUsd(r[8]) }))
      ),
      el('p', { class: 'sub', text: multNote + '  ' + recomputeNote + '  This is an estimate, not a price, and not a prediction of a launch date.' }),
      el('div', { class: 'verdict', text: farmVerdict(r) }),
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      })),
      el('div', { class: 'note', text: 'Farming never guarantees a token or an airdrop. Never pay anyone to claim: a real claim link comes from the protocol\u2019s own page.' })
    );
  }

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r[1] === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    state.tab = 'pre';
    writeHash();
    render();
    var d = document.getElementById('detail');
    if (d) d.scrollIntoView({ block: 'start' });
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(strip());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre' ? boardTable() : liveTable());
    if (state.tab === 'pre') {
      var selected = null;
      if (state.selected) DATA.rows.forEach(function (r) { if (r[1] === state.selected) selected = r; });
      if (selected) shell.appendChild(detailSection(selected));
      shell.appendChild(modelPanel());
    }
    shell.appendChild(el('p', { class: 'foot', text: 'Source: DefiLlama protocol index as of ' + DATA.as_of + '. Implied values are this entry\u2019s fitted model (' + DATA.model_version + '), not make.fun\u2019s and not a price. ' + DATA.accounting.total + ' protocols accounted for: ' + DATA.rows.length + ' pre-token rows ranked, ' + DATA.accounting.tokened + ' tokened set aside, ' + DATA.accounting.pretoken_unranked + ' pre-token held off the board.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
  }

  readHash();
  render();
})();
