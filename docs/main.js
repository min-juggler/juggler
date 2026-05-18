'use strict';

// ===== ジャグラー設定値テーブル =====
const JUGGLER_SETTINGS = {
  "default": {
    1: { bb: 287.4, rb: 442.5, combined: 176.0 },
    2: { bb: 282.5, rb: 393.9, combined: 163.8 },
    3: { bb: 273.1, rb: 331.8, combined: 149.3 },
    4: { bb: 264.3, rb: 287.4, combined: 138.2 },
    5: { bb: 252.2, rb: 252.2, combined: 126.1 },
    6: { bb: 240.9, rb: 240.9, combined: 120.5 },
  },
  "ネオアイムジャグラーEX": {
    1: { bb: 297.9, rb: 455.1, combined: 181.9 },
    2: { bb: 289.5, rb: 399.6, combined: 168.2 },
    3: { bb: 278.3, rb: 341.3, combined: 153.2 },
    4: { bb: 268.0, rb: 292.6, combined: 140.8 },
    5: { bb: 255.0, rb: 255.0, combined: 127.5 },
    6: { bb: 242.0, rb: 242.0, combined: 121.0 },
  },
  "ミスタージャグラー": {
    1: { bb: 300.7, rb: 491.3, combined: 190.2 },
    2: { bb: 291.0, rb: 409.6, combined: 170.7 },
    3: { bb: 279.7, rb: 357.0, combined: 158.0 },
    4: { bb: 268.4, rb: 306.3, combined: 143.5 },
    5: { bb: 256.0, rb: 256.0, combined: 128.0 },
    6: { bb: 240.1, rb: 240.1, combined: 120.1 },
  },
};

const SETTING_EV_PER_GAME = {
  1: -0.52, 2: -0.39, 3: -0.21,
  4: -0.08, 5: 0.12,  6: 0.31,
};

const COINS_PER_1000YEN = 50;
const GAME_SPEED = 400;

// ===== ストレージ =====
const Storage = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

// ===== 設定推測ロジック =====
function getMachineSettings(machineName) {
  for (const key of Object.keys(JUGGLER_SETTINGS)) {
    if (key !== 'default' && machineName.includes(key)) return JUGGLER_SETTINGS[key];
  }
  return JUGGLER_SETTINGS.default;
}

function calcSettingLikelihood(stand, settings) {
  const { games, bb, rb } = stand;
  if (!games || games < 100) return null;
  if (!bb || !rb) return null;
  const bbProb = games / bb;   // 実際のBB確率の分母（小さいほど良い）
  const rbProb = games / rb;

  if (!isFinite(bbProb) || !isFinite(rbProb)) return null;

  const likelihoods = {};
  for (const [setting, vals] of Object.entries(settings)) {
    const s = parseInt(setting);
    // 実測値が設定値より「良い（小さい）」場合は距離0とみなす
    // → 設定6より良い台は設定6との差が0として扱われ正しく高評価になる
    const bbDiff = Math.max(0, bbProb - vals.bb);
    const rbDiff = Math.max(0, rbProb - vals.rb);
    const bbScore = 1 / (1 + bbDiff / vals.bb);
    const rbScore = 1 / (1 + rbDiff / vals.rb);
    likelihoods[s] = bbScore * 0.4 + rbScore * 0.6;
  }
  const total = Object.values(likelihoods).reduce((a, b) => a + b, 0);
  const probs = {};
  for (const [s, l] of Object.entries(likelihoods)) probs[parseInt(s)] = l / total;
  return probs;
}

function calcExpectedSetting(probs) {
  if (!probs) return null;
  return Object.entries(probs).reduce((sum, [s, p]) => sum + parseInt(s) * p, 0);
}

function calcExpectedProfitFromProbs(probs, timeMin, budgetYen) {
  if (!probs) return null;
  const games = Math.floor(timeMin / 60 * GAME_SPEED);
  const maxGamesFromBudget = Math.floor((budgetYen / 20) * (1000 / 3));
  const actualGames = Math.min(games, maxGamesFromBudget);
  const weightedEvCoins = Object.entries(SETTING_EV_PER_GAME)
    .reduce((sum, [s, ev]) => sum + (probs[parseInt(s)] || 0) * ev, 0);
  return Math.round(weightedEvCoins * actualGames * 4);
}

function calcScore(probs, expectedSetting, stand) {
  if (!probs || !expectedSetting) return 0;
  const highProb = (probs[4] || 0) + (probs[5] || 0) + (probs[6] || 0);
  const s6prob = probs[6] || 0;
  const gameBonus = Math.min(stand.games / 3000, 1.0);
  return Math.min(100, Math.round(highProb * 50 + s6prob * 30 + gameBonus * 20));
}

function scoreToStars(score) {
  if (score >= 80) return '★★★★★';
  if (score >= 60) return '★★★★☆';
  if (score >= 40) return '★★★☆☆';
  if (score >= 20) return '★★☆☆☆';
  return '★☆☆☆☆';
}

function scoreToColor(score) {
  if (score >= 70) return '#e63946';
  if (score >= 50) return '#f4a261';
  if (score >= 30) return '#457b9d';
  return '#adb5bd';
}

function rankMedal(rank) {
  if (rank === 1) return { icon: '🥇', color: '#FFD700' };
  if (rank === 2) return { icon: '🥈', color: '#C0C0C0' };
  if (rank === 3) return { icon: '🥉', color: '#CD7F32' };
  return { icon: `${rank}`, color: '#e63946' };
}

function buildReasonTags(stand, probs, expectedSetting) {
  const tags = [];
  if (!probs) return tags;
  const s6prob = probs[6] || 0;
  const s56prob = (probs[5] || 0) + s6prob;
  const highProb = (probs[4] || 0) + s56prob;
  if (s6prob > 0.3) tags.push({ text: `設定6推定${Math.round(s6prob * 100)}%`, good: true });
  else if (s56prob > 0.4) tags.push({ text: `設定5/6推定${Math.round(s56prob * 100)}%`, good: true });
  else if (highProb > 0.5) tags.push({ text: `高設定推定${Math.round(highProb * 100)}%`, good: true });
  if (stand.rb > 0 && stand.games > 0) {
    const rbRate = stand.games / stand.rb;
    if (rbRate < 250) tags.push({ text: `RB好調 1/${Math.round(rbRate)}`, good: true });
  }
  if (stand.games > 2000) tags.push({ text: `十分なサンプル ${stand.games}G`, good: true });
  else if (stand.games < 500) tags.push({ text: `サンプル少 ${stand.games}G`, good: false });
  if (expectedSetting < 3) tags.push({ text: '低設定寄り', good: false });
  return tags;
}

// ===== データ =====
let storeData = null;
let prevStoreData = null;
let allStands = [];
let prevAllStands = [];

const GITHUB_BASE = 'https://raw.githubusercontent.com/min-juggler/juggler/main/data/';

async function loadData() {
  const urls = ['data/stores.json', GITHUB_BASE + 'stores.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url + '?t=' + Date.now());
      if (!res.ok) continue;
      storeData = await res.json();
      buildAllStands();
      updateDataStatus();
      populateStoreSelect();
      // 前日データも読み込む
      loadPrevData(url.replace('stores.json', 'stores_prev.json'));
      return true;
    } catch { continue; }
  }
  updateDataStatus(null);
  return false;
}

async function loadPrevData(url) {
  try {
    const res = await fetch(url + '?t=' + Date.now());
    if (!res.ok) return;
    prevStoreData = await res.json();
    prevAllStands = [];
    for (const [storeId, store] of Object.entries(prevStoreData.stores)) {
      for (const machine of store.machines) {
        for (const stand of machine.stands) {
          prevAllStands.push({ ...stand, store_id: storeId, store_name: store.name, machine_name: machine.machine_name });
        }
      }
    }
  } catch { prevAllStands = []; }
}

function buildAllStands() {
  allStands = [];
  if (!storeData) return;
  for (const [storeId, store] of Object.entries(storeData.stores)) {
    for (const machine of store.machines) {
      for (const stand of machine.stands) {
        allStands.push({ ...stand, store_id: storeId, store_name: store.name, machine_name: machine.machine_name });
      }
    }
  }
}

function updateDataStatus() {
  const el = document.getElementById('data-last-update');
  if (storeData?.fetched_at) {
    const d = new Date(storeData.fetched_at);
    el.textContent = `最終更新: ${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  } else {
    el.textContent = 'データ未取得 — scraper.pyを実行してください';
  }
}

function populateStoreSelect() {
  if (!storeData) return;
  const sel = document.getElementById('select-store');
  sel.innerHTML = '<option value="all">全店舗</option>';
  for (const [id, store] of Object.entries(storeData.stores)) {
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = store.name;
    sel.appendChild(opt);
  }
}

// ===== 分析 =====
function scoreStands(stands, budget, timeMin) {
  return stands.map(stand => {
    const settings = getMachineSettings(stand.machine_name || '');
    const probs = calcSettingLikelihood(stand, settings);
    const expectedSetting = calcExpectedSetting(probs);
    const score = calcScore(probs, expectedSetting, stand);
    const expectedProfit = calcExpectedProfitFromProbs(probs, timeMin, budget);
    const tags = buildReasonTags(stand, probs, expectedSetting);
    return { ...stand, probs, expectedSetting, score, expectedProfit, tags };
  });
}

function analyze() {
  const budget = parseInt(document.getElementById('input-budget').value) || 5000;
  const timeMin = parseInt(document.getElementById('input-time').value) || 60;
  const storeFilter = document.getElementById('select-store').value;

  const filterStore = stands => storeFilter === 'all' ? stands : stands.filter(s => s.store_id === storeFilter);

  // ===== 朝イチランキング（前日データ） =====
  const prevStands = filterStore(prevAllStands);
  if (prevStands.length > 0) {
    const prevScored = scoreStands(prevStands, budget, timeMin).sort((a, b) => b.score - a.score);
    // 前日スコア40以上 = 据え置き期待台
    const morning = prevScored.filter(s => s.score >= 40).slice(0, 10);
    morning.forEach(s => { s._morning = true; });
    renderMorningList(morning);
  } else {
    document.getElementById('morning-section').classList.add('hidden');
  }

  // ===== 夕方ランキング（当日データ・1000G以上） =====
  const todayStands = filterStore(allStands);
  if (todayStands.length === 0) { showEmptyState(); return; }

  const scored = scoreStands(todayStands, budget, timeMin).sort((a, b) => b.score - a.score);
  // 夕方：1000G以上で高スコア台
  const evening = scored.filter(s => s.games >= 1000 && s.score >= 45).slice(0, 10);
  renderEveningList(evening);
  renderAllStands(scored);
}

function renderMorningList(stands) {
  const section = document.getElementById('morning-section');
  const list = document.getElementById('morning-list');
  const badge = document.getElementById('morning-count');
  section.classList.remove('hidden');
  badge.textContent = `${stands.length}台`;
  if (stands.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">🌅</div><p>前日データがありません</p></div>`;
    return;
  }
  list.innerHTML = stands.map((s, i) => buildStandCard(s, i + 1, '昨日高設定')).join('');
}

function renderEveningList(stands) {
  const section = document.getElementById('evening-section');
  const list = document.getElementById('evening-list');
  const badge = document.getElementById('evening-count');
  section.classList.remove('hidden');
  badge.textContent = `${stands.length}台`;
  if (stands.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">🌆</div><p>1000G以上の高設定期待台がありません</p></div>`;
    return;
  }
  list.innerHTML = stands.map((s, i) => buildStandCard(s, i + 1, '設定確定期待')).join('');
}

// ===== 描画 =====
function renderRecommendList(stands) {
  const section = document.getElementById('recommend-section');
  const list = document.getElementById('recommend-list');
  const badge = document.getElementById('recommend-count');
  section.classList.remove('hidden');
  badge.textContent = `${stands.length}台`;
  if (stands.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>条件に合う台が見つかりません</p></div>`;
    return;
  }
  list.innerHTML = stands.map((s, i) => buildStandCard(s, i + 1)).join('');
}

function buildStandCard(s, rank, label = null) {
  const medal = rankMedal(rank);
  const stars = scoreToStars(s.score);
  const color = scoreToColor(s.score);
  const rankClass = rank <= 3 ? `rank-${rank}` : '';
  const bbRate = s.bb > 0 ? `1/${Math.round(s.games / s.bb)}` : '-';
  const rbRate = s.rb > 0 ? `1/${Math.round(s.games / s.rb)}` : '-';
  const combinedRate = (s.bb + s.rb) > 0 ? `1/${Math.round(s.games / (s.bb + s.rb))}` : '-';
  const estSetting = s.expectedSetting ? s.expectedSetting.toFixed(1) : '-';
  const profitClass = (s.expectedProfit || 0) >= 0 ? 'expect-positive' : 'expect-negative';
  const profitSign = (s.expectedProfit || 0) >= 0 ? '+' : '';
  const profitText = s.expectedProfit !== null
    ? `<span class="${profitClass}">${profitSign}${s.expectedProfit.toLocaleString()}円</span>`
    : '<span>-</span>';
  const tagsHtml = s.tags.map(t =>
    `<span class="tag ${t.good ? 'tag-good' : 'tag-warn'}">${t.text}</span>`
  ).join('');

  // 設定確率のミニバー（設定4〜6の合計）
  const highProb = ((s.probs?.[4] || 0) + (s.probs?.[5] || 0) + (s.probs?.[6] || 0)) * 100;

  return `
  <div class="stand-card ${rankClass}" onclick="showDetail('${s.store_id}','${s.rack_no}')">
    <div class="stand-card-header">
      <div class="stand-rank" style="color:${medal.color}">${medal.icon}</div>
      <div class="stand-info">
        <div class="stand-machine">${s.machine_name || '-'}</div>
        <div class="stand-rack">${s.rack_no}番台</div>
        <div class="stand-store-tag">${s.store_name}</div>
        ${label ? `<div class="stand-store-tag" style="background:#fff3cd;color:#856404;margin-top:3px">${label}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div class="stars">${stars}</div>
        <div class="score-label" style="color:${color}">スコア ${s.score}</div>
      </div>
    </div>
    <div class="stand-data-grid">
      <div class="stand-data-cell">
        <span class="data-label">BB確率</span>
        <span class="data-value">${bbRate}</span>
      </div>
      <div class="stand-data-cell">
        <span class="data-label">RB確率</span>
        <span class="data-value">${rbRate}</span>
      </div>
      <div class="stand-data-cell">
        <span class="data-label">合算</span>
        <span class="data-value">${combinedRate}</span>
      </div>
      <div class="stand-data-cell">
        <span class="data-label">推定設定</span>
        <span class="data-value" style="color:${color}">${estSetting}</span>
      </div>
    </div>
    <div class="setting-bar-wrap">
      <div class="setting-bar-label">
        <span>高設定（4以上）確率</span>
        <span style="color:${color}">${Math.round(highProb)}%</span>
      </div>
      <div class="setting-bar-track">
        <div class="setting-bar-fill" style="width:${Math.min(100, highProb)}%;background:${color}"></div>
      </div>
    </div>
    <div class="expect-line">
      <span>期待収支（目安）</span>
      ${profitText}
    </div>
    ${tagsHtml ? `<div class="reason-tags">${tagsHtml}</div>` : ''}
  </div>`;
}

function renderAllStands(stands) {
  document.getElementById('all-stands-section').classList.remove('hidden');
  document.getElementById('all-stands-list').innerHTML = stands.map((s, i) => buildStandCard(s, i + 1)).join('');
}

function showEmptyState() {
  document.getElementById('recommend-section').classList.remove('hidden');
  document.getElementById('recommend-list').innerHTML =
    `<div class="empty-state"><div class="icon">📭</div><p>scraper.pyを実行してデータを取得してください</p></div>`;
}

// ===== 台詳細モーダル（グラフ付き） =====
let chartSetting = null;
let chartProb = null;

function showDetail(storeId, rackNo) {
  const stand = allStands.find(s => s.store_id === storeId && String(s.rack_no) === String(rackNo));
  if (!stand) return;

  const settings = getMachineSettings(stand.machine_name || '');
  const probs = calcSettingLikelihood(stand, settings);

  const bbRate = stand.bb > 0 ? `1/${Math.round(stand.games / stand.bb)}` : '-';
  const rbRate = stand.rb > 0 ? `1/${Math.round(stand.games / stand.rb)}` : '-';
  const diffColor = (stand.diff || 0) >= 0 ? '#2d6a4f' : '#e63946';
  const diffSign = (stand.diff || 0) >= 0 ? '+' : '';

  document.getElementById('modal-body').innerHTML = `
    <h3>${stand.machine_name} <span style="color:#e63946">${stand.rack_no}番台</span></h3>
    <p style="color:#999;font-size:12px;margin-bottom:14px">${stand.store_name}</p>
    <div class="modal-grid">
      <div class="modal-cell"><div class="label">ゲーム数</div><div class="value">${(stand.games||0).toLocaleString()}G</div></div>
      <div class="modal-cell"><div class="label">差枚数</div><div class="value" style="color:${diffColor}">${diffSign}${(stand.diff||0).toLocaleString()}</div></div>
      <div class="modal-cell"><div class="label">BB確率</div><div class="value">${bbRate}</div></div>
      <div class="modal-cell"><div class="label">RB確率</div><div class="value">${rbRate}</div></div>
    </div>

    <h4 style="font-size:13px;font-weight:700;margin:14px 0 8px;color:#555">設定推測確率</h4>
    <div style="position:relative;height:160px">
      <canvas id="chart-setting-prob"></canvas>
    </div>

    <h4 style="font-size:13px;font-weight:700;margin:16px 0 8px;color:#555">BB/RB確率 vs 設定基準値</h4>
    <div style="position:relative;height:160px">
      <canvas id="chart-bb-rb"></canvas>
    </div>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');

  // 少し待ってからグラフ描画（DOM確定後）
  requestAnimationFrame(() => {
    drawSettingProbChart(probs);
    drawBBRBChart(stand, settings);
  });
}

function drawSettingProbChart(probs) {
  if (chartSetting) { chartSetting.destroy(); chartSetting = null; }
  const canvas = document.getElementById('chart-setting-prob');
  if (!canvas) return;

  if (!probs) {
    canvas.parentElement.innerHTML = '<p style="color:#999;font-size:13px;padding:20px 0;text-align:center">ゲーム数不足（最低100G必要）</p>';
    return;
  }

  const labels = ['設定1', '設定2', '設定3', '設定4', '設定5', '設定6'];
  const values = [1,2,3,4,5,6].map(s => Math.round((probs[s] || 0) * 100));
  const colors = values.map((v, i) => {
    if (i >= 4) return '#e63946';
    if (i >= 3) return '#f4a261';
    return '#adb5bd';
  });

  chartSetting = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw}%` } }
      },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', font: { size: 11 } }, grid: { color: '#f0f0f0' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

function drawBBRBChart(stand, settings) {
  if (chartProb) { chartProb.destroy(); chartProb = null; }
  const canvas = document.getElementById('chart-bb-rb');
  if (!canvas) return;

  const labels = ['設定1', '設定2', '設定3', '設定4', '設定5', '設定6'];
  const bbBaselines = [1,2,3,4,5,6].map(s => +(1 / settings[s].bb * 1000).toFixed(2));
  const rbBaselines = [1,2,3,4,5,6].map(s => +(1 / settings[s].rb * 1000).toFixed(2));
  const actualBB = stand.bb && stand.games ? +(stand.bb / stand.games * 1000).toFixed(2) : null;
  const actualRB = stand.rb && stand.games ? +(stand.rb / stand.games * 1000).toFixed(2) : null;

  chartProb = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'BB基準値',
          data: bbBaselines,
          borderColor: '#457b9d',
          backgroundColor: 'rgba(69,123,157,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
        },
        {
          label: 'RB基準値',
          data: rbBaselines,
          borderColor: '#2d6a4f',
          backgroundColor: 'rgba(45,106,79,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
        },
        ...(actualBB !== null ? [{
          label: 'この台BB',
          data: Array(6).fill(actualBB),
          borderColor: '#e63946',
          borderWidth: 2,
          borderDash: [5, 3],
          pointRadius: 0,
          fill: false,
        }] : []),
        ...(actualRB !== null ? [{
          label: 'この台RB',
          data: Array(6).fill(actualRB),
          borderColor: '#f4a261',
          borderWidth: 2,
          borderDash: [5, 3],
          pointRadius: 0,
          fill: false,
        }] : []),
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 14 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}‰` } }
      },
      scales: {
        y: { ticks: { font: { size: 10 }, callback: v => v + '‰' }, grid: { color: '#f0f0f0' } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ===== 月間収支グラフ =====
let chartMonthly = null;

function renderMonthlySummary() {
  const records = Storage.get('juggler_records', []);
  const now = new Date();
  const thisMonth = records.filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const total = thisMonth.reduce((sum, r) => sum + (r.profit || r.return - r.invest), 0);
  const wins = thisMonth.filter(r => (r.profit || r.return - r.invest) >= 0).length;
  const winRate = thisMonth.length > 0 ? Math.round(wins / thisMonth.length * 100) : '-';

  const totalEl = document.getElementById('monthly-total');
  totalEl.textContent = `${total >= 0 ? '+' : ''}${total.toLocaleString()}円`;
  totalEl.className = `amount ${total >= 0 ? 'positive' : 'negative'}`;
  document.getElementById('monthly-count').textContent = `${thisMonth.length}回`;
  document.getElementById('monthly-winrate').textContent = `${winRate}%`;

  drawMonthlyChart(thisMonth);
}

function drawMonthlyChart(records) {
  if (chartMonthly) { chartMonthly.destroy(); chartMonthly = null; }
  const canvas = document.getElementById('chart-monthly');
  if (!canvas) return;

  if (records.length === 0) {
    canvas.parentElement.style.display = 'none';
    return;
  }
  canvas.parentElement.style.display = '';

  // 日付順にソート
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  // 累積収支
  let cumulative = 0;
  const labels = [];
  const cumulData = [];
  const barData = [];
  const barColors = [];

  for (const r of sorted) {
    const profit = r.profit || (r.return - r.invest);
    cumulative += profit;
    const d = new Date(r.date);
    labels.push(`${d.getMonth()+1}/${d.getDate()}`);
    cumulData.push(cumulative);
    barData.push(profit);
    barColors.push(profit >= 0 ? 'rgba(45,106,79,0.7)' : 'rgba(230,57,70,0.7)');
  }

  chartMonthly = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: '累積収支',
          data: cumulData,
          borderColor: '#e63946',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.2,
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: '1回収支',
          data: barData,
          backgroundColor: barColors,
          borderRadius: 4,
          yAxisID: 'y',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 14 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw >= 0 ? '+' : ''}${ctx.raw.toLocaleString()}円`
          }
        }
      },
      scales: {
        y: {
          ticks: { font: { size: 10 }, callback: v => (v >= 0 ? '+' : '') + v.toLocaleString() },
          grid: { color: '#f0f0f0' }
        },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ===== 収支記録 =====
function saveRecord() {
  const date = document.getElementById('record-date').value;
  const machine = document.getElementById('record-machine').value.trim();
  const rack = document.getElementById('record-rack').value;
  const invest = parseInt(document.getElementById('record-invest').value) || 0;
  const ret = parseInt(document.getElementById('record-return').value) || 0;
  const games = parseInt(document.getElementById('record-games').value) || 0;
  if (!date || !machine) { alert('日付と機種名は必須です'); return; }
  const records = Storage.get('juggler_records', []);
  records.unshift({ id: Date.now(), date, machine, rack, invest, return: ret, games, profit: ret - invest });
  Storage.set('juggler_records', records);
  renderRecords();
  renderMonthlySummary();
}

function renderRecords() {
  const records = Storage.get('juggler_records', []);
  const list = document.getElementById('record-list');
  if (records.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">📝</div><p>まだ記録がありません</p></div>`;
    return;
  }
  list.innerHTML = records.map(r => {
    const profit = r.profit || (r.return - r.invest);
    return `
    <div class="record-item">
      <div class="record-item-left">
        <div class="record-date">${r.date}</div>
        <div class="record-machine-name">${r.machine} ${r.rack ? r.rack+'番台' : ''}</div>
        <div style="font-size:12px;color:#999">${r.games ? r.games+'G' : ''}</div>
      </div>
      <div class="record-result" style="color:${profit>=0?'#2d6a4f':'#e63946'}">
        ${profit>=0?'+':''}${profit.toLocaleString()}円
      </div>
    </div>`;
  }).join('');
}

// ===== イベント =====
function initEvents() {
  document.getElementById('btn-analyze').addEventListener('click', analyze);

  document.getElementById('btn-reload').addEventListener('click', async () => {
    await loadData();
    analyze();
  });

  document.getElementById('btn-record-toggle').addEventListener('click', () => {
    document.getElementById('view-main').classList.add('hidden');
    document.getElementById('view-record').classList.remove('hidden');
    renderRecords();
    renderMonthlySummary();
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    document.getElementById('view-record').classList.add('hidden');
    document.getElementById('view-main').classList.remove('hidden');
  });

  document.getElementById('btn-save-record').addEventListener('click', saveRecord);

  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').classList.add('hidden');
    }
  });

  document.getElementById('sort-select').addEventListener('change', () => {
    const key = document.getElementById('sort-select').value;
    const budget = parseInt(document.getElementById('input-budget').value) || 5000;
    const timeMin = parseInt(document.getElementById('input-time').value) || 60;
    const scored = scoreStands(allStands, budget, timeMin);
    const sortFns = {
      score: (a, b) => b.score - a.score,
      bb_prob: (a, b) => (b.bb/(b.games||1)) - (a.bb/(a.games||1)),
      combined_prob: (a, b) => ((b.bb+b.rb)/(b.games||1)) - ((a.bb+a.rb)/(a.games||1)),
      diff: (a, b) => (b.diff||0) - (a.diff||0),
    };
    scored.sort(sortFns[key] || sortFns.score);
    renderAllStands(scored);
  });

  document.getElementById('record-date').value = new Date().toISOString().slice(0, 10);
}

// ===== デモデータ =====
function loadDemoData() {
  storeData = {
    fetched_at: new Date().toISOString(),
    stores: {
      yonezawa: {
        name: "アイランド米沢店",
        machines: [{
          machine_name: "S ネオアイムジャグラーEX KK②",
          count: 18,
          stands: [
            { rack_no: 3,  games: 2850, bb: 14, rb: 16, diff:  320 },
            { rack_no: 5,  games: 3120, bb: 16, rb: 17, diff:  680 },
            { rack_no: 8,  games: 1240, bb:  4, rb:  3, diff: -420 },
            { rack_no: 11, games: 2960, bb: 12, rb: 14, diff: -180 },
            { rack_no: 14, games: 3400, bb: 19, rb: 20, diff: 1240 },
            { rack_no: 17, games:  890, bb:  2, rb:  3, diff: -310 },
            { rack_no: 21, games: 2200, bb: 10, rb: 11, diff:  140 },
            { rack_no: 24, games: 3050, bb: 15, rb: 18, diff:  920 },
          ]
        }, {
          machine_name: "S ミスタージャグラー KK⑤",
          count: 5,
          stands: [
            { rack_no: 32, games: 1800, bb:  7, rb:  8, diff:  -90 },
            { rack_no: 33, games: 2400, bb: 11, rb: 12, diff:  460 },
            { rack_no: 35, games:  950, bb:  3, rb:  2, diff: -280 },
          ]
        }]
      },
      kaminoyama: {
        name: "1円劇場上山店",
        machines: [{
          machine_name: "S ネオアイムジャグラーEX KK②",
          count: 18,
          stands: [
            { rack_no: 101, games: 3200, bb: 17, rb: 15, diff:  540 },
            { rack_no: 103, games: 2700, bb: 11, rb: 13, diff: -120 },
            { rack_no: 105, games: 3600, bb: 21, rb: 22, diff: 1580 },
            { rack_no: 107, games: 1100, bb:  3, rb:  4, diff: -340 },
          ]
        }]
      }
    }
  };
  buildAllStands();
  populateStoreSelect();
  document.getElementById('data-last-update').textContent = '⚠️ デモデータ (scraper.pyを実行してください)';
}

// ===== 店舗認証カード =====
const STORE_AUTH_URLS = [
  { name: 'アイランド米沢店',  url: 'https://island.pt.teramoba2.com/yonezawa/' },
  { name: '1円劇場上山店', url: 'https://island.pt.teramoba2.com/kaminoyama/' },
];

// ===== GitHubトークン保存 =====
function saveToken() {
  const el = document.getElementById('input-token');
  if (!el) return;
  const token = el.value.trim();
  if (!token) { alert('トークンを入力してください'); return; }
  Storage.set('github_token', token);
  el.value = '';
  alert('✅ トークンを保存しました');
  buildBookmarklet();
}

// ===== ブックマークレット本体（直接埋め込み） =====
function buildInlineBookmarklet(token, repo) {
  return `(async function(){
var sid=location.href.includes('yonezawa')?'yonezawa':location.href.includes('kaminoyama')?'kaminoyama':null;
if(!sid){alert('店舗サイトで実行してください');return;}
var sname={yonezawa:'アイランド米沢店',kaminoyama:'1円劇場上山店'}[sid];
var hid={yonezawa:292,kaminoyama:1303}[sid];
var bar=document.createElement('div');
bar.style='position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:85vw;word-break:break-all';
bar.textContent='🎰 v4 データ取得中...';document.body.appendChild(bar);
async function push(result){
  var total=result.machines.reduce((a,m)=>a+m.stands.length,0);
  bar.textContent='📡 GitHubへ送信中...('+total+'台)';
  var sha=null,cur={};
  try{var er=await fetch('https://api.github.com/repos/${repo}/contents/data/stores.json',{headers:{'Authorization':'token ${token}','Accept':'application/vnd.github.v3+json'}});
  if(er.ok){var ej=await er.json();sha=ej.sha;cur=JSON.parse(atob(ej.content.replace(/\\n/g,'')));}}catch(e){}
  if(!cur.stores)cur={fetched_at:null,stores:{}};
  cur.fetched_at=new Date().toISOString();cur.stores[sid]=result;
  var js=JSON.stringify(cur,null,2);
  var body={message:'データ更新 '+new Date().toLocaleString('ja'),content:btoa(unescape(encodeURIComponent(js))),branch:'main'};
  if(sha)body.sha=sha;
  var pr=await fetch('https://api.github.com/repos/${repo}/contents/data/stores.json',{method:'PUT',headers:{'Authorization':'token ${token}','Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(body)});
  if(pr.ok){bar.style.background='#2d6a4f';bar.textContent='✅ '+sname+' '+total+'台 送信完了！';}
  else{bar.style.background='#888';bar.textContent='⚠️ 送信失敗: '+(await pr.text()).slice(0,80);}
}
try{
  var today=new Date().toISOString().slice(0,10);
  var urlKindCode=new URLSearchParams(location.search).get('kind_code')||'Z';

  // standlist_slotページからAES鍵とIVを取得
  var listR=await fetch('/'+sid+'/standlist_slot?kind_code='+urlKindCode,{credentials:'include'});
  var listH=await listR.text();
  var dpM=listH.match(/data-page="([^"]+)"/);
  var encKey=null,encIv=null;
  if(dpM){try{var dpP=JSON.parse(dpM[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n))).props||{};
  if(dpP.data){encKey=dpP.data.key;encIv=dpP.data.iv;}
  // propsからhall_idを取得できれば上書き
  var propsHid=dpP.hall_id||dpP.hallId||(dpP.data&&dpP.data.hall_id)||(dpP.hall&&dpP.hall.id);
  if(propsHid)hid=parseInt(propsHid);}catch(e){}}
  bar.textContent='key='+(encKey?encKey.slice(0,16)+'...':'none')+' iv='+(encIv!==null&&encIv!==undefined?String(encIv).slice(0,24):'null')+' hid='+hid;
  await new Promise(r=>setTimeout(r,4000));

  // performanceエントリから実際のmachine_list URLを探す
  var perfMlUrl=performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('machine_list'));
  var mlUrl;
  if(perfMlUrl){
    mlUrl=perfMlUrl.replace(/target_date=[^&]+/,'target_date='+today);
    bar.textContent='perf URL発見: '+mlUrl.slice(mlUrl.indexOf('/rack_info'));
  } else {
    mlUrl='/'+sid+'/rack_info/machine_list?hall_id='+hid+'&kind_code='+urlKindCode+'&target_date='+today+'&disp=2&place=&history_day=3';
    bar.textContent='手動URL: '+mlUrl;
  }
  await new Promise(r=>setTimeout(r,4000));
  var mlR=await fetch(mlUrl,{credentials:'include'});
  var mlText=await mlR.text();
  bar.textContent='machine_list status:'+mlR.status+' len:'+mlText.length+' 先頭:'+mlText.slice(0,60);
  await new Promise(r=>setTimeout(r,5000));

  // 404ならkind_code=21でリトライ
  if(mlR.status===404&&urlKindCode!=='21'){
    bar.textContent='404→kind_code=21でリトライ中...';
    await new Promise(r=>setTimeout(r,2000));
    mlUrl='/'+sid+'/rack_info/machine_list?hall_id='+hid+'&kind_code=21&target_date='+today+'&disp=2&place=&history_day=3';
    mlR=await fetch(mlUrl,{credentials:'include'});
    mlText=await mlR.text();
    bar.textContent='retry status:'+mlR.status+' len:'+mlText.length+' 先頭:'+mlText.slice(0,60);
    await new Promise(r=>setTimeout(r,4000));
  }
  if(!mlR.ok){bar.textContent='❌ machine_list '+mlR.status+' URL='+mlUrl.slice(0,60);setTimeout(()=>bar.remove(),8000);return;}
  if(!encKey){bar.textContent='❌ AES鍵なし';setTimeout(()=>bar.remove(),5000);return;}

  function h2b(h){var b=new Uint8Array(h.length/2);for(var i=0;i<h.length;i+=2)b[i/2]=parseInt(h.substr(i,2),16);return b;}

  // レスポンスはJSON文字列 "base64..." なのでparse
  var cipherB64;
  try{cipherB64=JSON.parse(mlText);}catch(e){cipherB64=mlText;}
  if(typeof cipherB64==='object'&&cipherB64!==null){
    cipherB64=cipherB64.data||cipherB64.cipher||cipherB64.content||JSON.stringify(cipherB64);
  }
  cipherB64=String(cipherB64);

  // Laravel形式チェック: atob(cipherB64) が JSON({iv,value,mac}) かどうか
  var laravelIv=null,laravelValue=null;
  try{var inner=JSON.parse(atob(cipherB64));if(inner&&inner.iv&&inner.value){laravelIv=inner.iv;laravelValue=inner.value;}}catch(e){}

  var cipherBytes,finalIvBytes;
  if(laravelIv){
    // Laravel形式: ivとvalueをそれぞれbase64デコード
    finalIvBytes=Uint8Array.from(atob(laravelIv),c=>c.charCodeAt(0));
    try{cipherBytes=Uint8Array.from(atob(laravelValue),c=>c.charCodeAt(0));}
    catch(e){bar.textContent='Laravel value base64失敗:'+e.message;await new Promise(r=>setTimeout(r,5000));return;}
    bar.textContent='Laravel形式! iv='+laravelIv.slice(0,20)+' ivBytes:'+finalIvBytes.length+' cipher:'+cipherBytes.length;
    await new Promise(r=>setTimeout(r,4000));
  } else {
    // 生形式: page props の IV を使用
    if(!encIv){bar.textContent='❌ IV なし(props:null, Laravel形式でもない)';setTimeout(()=>bar.remove(),5000);return;}
    try{cipherBytes=Uint8Array.from(atob(cipherB64),c=>c.charCodeAt(0));}
    catch(e){bar.textContent='base64失敗:'+e.message+' 先頭:'+cipherB64.slice(0,50);await new Promise(r=>setTimeout(r,6000));return;}
    var ivStr=String(encIv);
    finalIvBytes=/^[0-9a-fA-F]+$/.test(ivStr)&&ivStr.length%2===0?h2b(ivStr):Uint8Array.from(atob(ivStr),c=>c.charCodeAt(0));
    bar.textContent='生形式 cipherBytes:'+cipherBytes.length+' ivBytes:'+finalIvBytes.length;
    await new Promise(r=>setTimeout(r,3000));
  }

  var decrypted=null;
  var keyBytes=h2b(encKey);

  for(var [modeName,ivLen] of [['AES-CBC',16],['AES-GCM',12]]){
    try{
      var ck=await crypto.subtle.importKey('raw',keyBytes,{name:modeName},false,['decrypt']);
      var usedIv=finalIvBytes.slice(0,ivLen);
      var plain=await crypto.subtle.decrypt({name:modeName,iv:usedIv},ck,cipherBytes);
      decrypted=JSON.parse(new TextDecoder().decode(plain));
      bar.textContent='✅ 復号成功('+modeName+')! isArray:'+Array.isArray(decrypted)+' len:'+(Array.isArray(decrypted)?decrypted.length:Object.keys(decrypted).length);
      await new Promise(r=>setTimeout(r,5000));
      break;
    }catch(e){
      bar.textContent='復号失敗('+modeName+'): '+e.message;
      await new Promise(r=>setTimeout(r,3000));
    }
  }

  if(!decrypted){bar.textContent='❌ 全復号失敗';setTimeout(()=>bar.remove(),6000);return;}

  // 台データを機種別にグループ化
  var stands=Array.isArray(decrypted)?decrypted:(decrypted.data||decrypted.items||Object.values(decrypted));
  // フィールド名デバッグ: 最初の台のキーと値を表示
  if(stands.length>0){
    var s0=stands[0];
    var dbg=Object.entries(s0).map(([k,v])=>k+'='+String(v).slice(0,10)).join(' ');
    bar.textContent='[1]'+dbg;
    await new Promise(r=>setTimeout(r,12000));
  }
  var mmap={};
  stands.forEach(s=>{var mn=s.machine_name||s.ki_name||'不明';if(!mmap[mn])mmap[mn]=[];mmap[mn].push({rack_no:String(s.rack_no||s.dai_no||'?'),machine_name:mn,games:parseInt(s.total_games||s.games||0),bb:parseInt(s.bb_count||s.bb||0),rb:parseInt(s.rb_count||s.rb||0),diff:parseInt(s.diff||s.sa_mai||0)});});
  var result={name:sname,machines:[]};
  for(var[mn2,sts2]of Object.entries(mmap))result.machines.push({machine_name:mn2,count:sts2.length,stands:sts2});
  var totalStands=stands.length;
  bar.textContent='✅ '+totalStands+'台 機種:'+result.machines.length+' GitHub送信中...';
  await push(result);
}catch(e){bar.style.background='#888';bar.textContent='❌ '+e.message;}
setTimeout(()=>bar.remove(),8000);
})();`;
}

// ===== ブックマークレット =====
function buildBookmarklet() {
  const token = Storage.get('github_token', '');
  const repo  = 'min-juggler/juggler';
  if (!token) {
    const el = document.getElementById('bookmarklet-link');
    if (el) {
      el.textContent = '⚠️ 下でトークンを設定してください';
      el.href = '#';
      el.style.background = '#aaa';
    }
    return;
  }

  const loader = buildInlineBookmarklet(token, repo);
  const code = loader;

  const el = document.getElementById('bookmarklet-link');
  if (el) {
    el.href = 'javascript:' + encodeURIComponent(code);
    el.textContent = '🎰 ジャグラーデータ取得';
    el.style.background = '#e63946';
  }
}

function buildAuthCard() {
  const container = document.getElementById('auth-store-buttons');
  if (!container) return;
  container.innerHTML = STORE_AUTH_URLS.map(s => `
    <a class="auth-store-btn" href="${s.url}" target="_blank" rel="noopener">
      <span>📍 ${s.name}</span>
      <span class="arrow">認証ページへ →</span>
    </a>
  `).join('');
}

function showAuthCard(show) {
  const card = document.getElementById('auth-card');
  if (card) card.classList.toggle('hidden', !show);
}

// ===== スマホURL バナー =====
function injectPhoneBanner() {
  // localhostでない = スマホからアクセス中のため不要
  if (!location.hostname.includes('localhost') && !location.hostname.includes('127.')) return;
  const banner = document.createElement('div');
  banner.className = 'phone-banner';
  banner.innerHTML = `
    📱 スマホから見るには同じWiFiで
    <code>http://<strong>MacのIPアドレス</strong>:8080/app/index.html</code>
    を開いてください
  `;
  document.querySelector('.header').insertAdjacentElement('afterend', banner);
}

// ===== 初期化 =====
async function init() {
  initEvents();
  buildAuthCard();
  buildBookmarklet();
  injectPhoneBanner();

  const hasData = await loadData();
  const hasRealData = hasData && allStands.length > 0;

  if (!hasRealData) {
    showAuthCard(true);   // データなし → 認証カードを表示
    loadDemoData();
    analyze();
  } else {
    showAuthCard(false);  // データあり → 認証カードを隠す
    analyze();
  }
}

init();
