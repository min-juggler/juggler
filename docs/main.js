'use strict';

// ===== 半角カタカナ → 全角カタカナ変換（表示用） =====
function hw2fw(s) {
  if (!s) return s;
  // 濁点・半濁点の組み合わせを先に処理
  s = s.replace(/ｶﾞ/g,'ガ').replace(/ｷﾞ/g,'ギ').replace(/ｸﾞ/g,'グ').replace(/ｹﾞ/g,'ゲ').replace(/ｺﾞ/g,'ゴ')
       .replace(/ｻﾞ/g,'ザ').replace(/ｼﾞ/g,'ジ').replace(/ｽﾞ/g,'ズ').replace(/ｾﾞ/g,'ゼ').replace(/ｿﾞ/g,'ゾ')
       .replace(/ﾀﾞ/g,'ダ').replace(/ﾁﾞ/g,'ヂ').replace(/ﾂﾞ/g,'ヅ').replace(/ﾃﾞ/g,'デ').replace(/ﾄﾞ/g,'ド')
       .replace(/ﾊﾞ/g,'バ').replace(/ﾋﾞ/g,'ビ').replace(/ﾌﾞ/g,'ブ').replace(/ﾍﾞ/g,'ベ').replace(/ﾎﾞ/g,'ボ')
       .replace(/ﾊﾟ/g,'パ').replace(/ﾋﾟ/g,'ピ').replace(/ﾌﾟ/g,'プ').replace(/ﾍﾟ/g,'ペ').replace(/ﾎﾟ/g,'ポ')
       .replace(/ｳﾞ/g,'ヴ');
  // 単独半角カタカナ
  const m = {'ｱ':'ア','ｲ':'イ','ｳ':'ウ','ｴ':'エ','ｵ':'オ',
    'ｶ':'カ','ｷ':'キ','ｸ':'ク','ｹ':'ケ','ｺ':'コ',
    'ｻ':'サ','ｼ':'シ','ｽ':'ス','ｾ':'セ','ｿ':'ソ',
    'ﾀ':'タ','ﾁ':'チ','ﾂ':'ツ','ﾃ':'テ','ﾄ':'ト',
    'ﾅ':'ナ','ﾆ':'ニ','ﾇ':'ヌ','ﾈ':'ネ','ﾉ':'ノ',
    'ﾊ':'ハ','ﾋ':'ヒ','ﾌ':'フ','ﾍ':'ヘ','ﾎ':'ホ',
    'ﾏ':'マ','ﾐ':'ミ','ﾑ':'ム','ﾒ':'メ','ﾓ':'モ',
    'ﾔ':'ヤ','ﾕ':'ユ','ﾖ':'ヨ',
    'ﾗ':'ラ','ﾘ':'リ','ﾙ':'ル','ﾚ':'レ','ﾛ':'ロ',
    'ﾜ':'ワ','ｦ':'ヲ','ﾝ':'ン',
    'ｧ':'ァ','ｨ':'ィ','ｩ':'ゥ','ｪ':'ェ','ｫ':'ォ',
    'ｯ':'ッ','ｬ':'ャ','ｭ':'ュ','ｮ':'ョ','ｰ':'ー'};
  return s.split('').map(c => m[c] || c).join('');
}

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

// 辛口判定の基準（厳しめ）: これを満たす台が無ければ「撤退推奨」
// もっと辛く → 数字を上げる / 甘く → 下げる
const VERDICT_MIN_HIGH56 = 0.55;  // 設定5以上である確率がこれ以上
const VERDICT_MIN_GAMES = 3000;   // 信頼できるサンプル数

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

// 各設定の「当てはまり度」(0〜1)を両側ガウスで算出。設定値に近いほど高い。
// 合成確率を主軸(0.45)、REG重視(0.35)、BIG軽め(0.20)。ジャグラーの設定差の出方に合わせた重み。
function _rawLikelihoods(stand, settings) {
  const { games } = stand;
  if (!games || games < 100) return null;
  // サンプル(G数)が少ないほど分布を広げる(自信を下げる)
  const k = Math.max(0.12, 0.14 * Math.sqrt(2500 / Math.max(games, 800)));
  const gauss = (obs, exp) => { const z = (obs - exp) / (exp * k); return Math.exp(-0.5 * z * z); };
  const raw = {};

  // ダイナム等: BB/RB内訳がなく合成確率のみ
  if (stand.combined_only) {
    const combProb = stand.combined_prob || (stand.total_bonus > 0 ? games / stand.total_bonus : 0);
    if (!combProb || !isFinite(combProb)) return null;
    for (const [setting, vals] of Object.entries(settings)) {
      const expComb = vals.combined || (1 / (1 / vals.bb + 1 / vals.rb));
      raw[parseInt(setting)] = gauss(combProb, expComb);
    }
    return raw;
  }

  const { bb, rb } = stand;
  if (!bb || !rb) return null;
  const bbProb = games / bb, rbProb = games / rb, combProb = games / (bb + rb);
  if (!isFinite(bbProb) || !isFinite(rbProb)) return null;
  for (const [setting, vals] of Object.entries(settings)) {
    const expComb = vals.combined || (1 / (1 / vals.bb + 1 / vals.rb));
    const bbScore = gauss(bbProb, vals.bb);
    const rbScore = gauss(rbProb, vals.rb);
    const combScore = gauss(combProb, expComb);
    raw[parseInt(setting)] = Math.pow(bbScore, 0.20) * Math.pow(rbScore, 0.35) * Math.pow(combScore, 0.45);
  }
  return raw;
}

function calcSettingLikelihood(stand, settings) {
  const raw = _rawLikelihoods(stand, settings);
  if (!raw) return null;
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  const probs = {};
  for (const [s, l] of Object.entries(raw)) probs[parseInt(s)] = l / total;
  return probs;
}

// 最良設定への当てはまり度(0〜1)。BB/RB/合成が互いに矛盾する台ほど低くなる。
function calcFitQuality(stand, settings) {
  const raw = _rawLikelihoods(stand, settings);
  if (!raw) return 0;
  return Math.max(...Object.values(raw));
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

// 【辛口】RB確率ペナルティ。マイジャグ/アイム等はRBが設定の主軸。
// BBが上振れて合成が良く見えても、RBが低設定域なら大きく減点する。
// サンプル不足(RB<4 or 1500G未満)は「判定不能」として減点しない。
function rbPenaltyFactor(stand, settings) {
  if (stand.combined_only || !settings) return 1;
  const rb = parseInt(stand.rb) || 0, games = stand.games || 0;
  if (games < 1500 || rb < 4) return 1;
  const rbProb = games / rb;
  const rb4 = settings[4] && settings[4].rb, rb2 = settings[2] && settings[2].rb, rb1 = settings[1] && settings[1].rb;
  if (!rb4 || !rb2 || !rb1) return 1;
  if (rbProb <= rb4) return 1;            // 設定4以上のRB → 減点なし
  if (rbProb >= rb1) return 0.12;         // 設定1より悪いRB → ほぼ壊滅
  if (rbProb >= rb2) return 0.3;          // 設定2以下のRB → 大幅減点
  const t = (rbProb - rb4) / (rb2 - rb4); // 設定4〜2の間を線形に 1.0→0.3
  return 1 - t * 0.7;
}

// 【辛口】RBの試行回数が少ないと高設定判定を割り引く。RB主軸ゆえRB数が肝。
function rbConfidence(stand) {
  if (stand.combined_only) return 1;
  const rb = parseInt(stand.rb) || 0;
  if (rb >= 10) return 1;
  if (rb <= 2) return 0.5;
  return 0.5 + (rb - 2) * 0.0625;        // RB2→0.5, RB10→1.0
}

function calcScore(probs, expectedSetting, stand, fit = 1, settings = null) {
  if (!probs || !expectedSetting) return 0;
  const highProb = (probs[4] || 0) + (probs[5] || 0) + (probs[6] || 0);
  const s6prob = probs[6] || 0;
  const gameBonus = Math.min(stand.games / 3000, 1.0);
  // 設定推定の部分は「当てはまり度 × RB確率ペナルティ × RB試行回数の信頼度」で割引（辛口）
  const rbPen = rbPenaltyFactor(stand, settings);
  const rbConf = rbConfidence(stand);
  const settingPart = (highProb * 55 + s6prob * 25) * fit * rbPen * rbConf;
  // 差枚ボーナス: 勝ってても過信しない（BB上振れ差枚対策で+側は弱め+4まで、-側は-8まで素直に減点）
  const diff = stand.diff || 0;
  const diffBonus = stand.combined_only ? 0 : (diff >= 0 ? Math.min(4, diff / 400) : Math.max(-8, diff / 250));
  // 合成のみの店(ダイナム系)はBB上振れを見抜けないぶん一律で辛口割引
  const combPenalty = stand.combined_only ? 0.8 : 1;
  return Math.max(0, Math.min(100, Math.round((settingPart + gameBonus * 20 + diffBonus) * combPenalty)));
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
  if (!stand.combined_only && stand.rb > 0 && stand.games > 0) {
    const rbRate = stand.games / stand.rb;
    const set = getMachineSettings(stand.machine_name || '');
    if (rbRate < 250) tags.push({ text: `RB好調 1/${Math.round(rbRate)}`, good: true });
    // 【辛口】RBが低設定域なら警告（BB上振れ・差枚に騙されない）
    else if (stand.games >= 1500 && stand.rb >= 4 && set[2] && rbRate >= set[2].rb) {
      tags.push({ text: `RB不調 1/${Math.round(rbRate)}（低設定濃厚）`, good: false });
      if ((stand.diff || 0) > 300) tags.push({ text: 'BB上振れ注意（差枚に騙されるな）', good: false });
    } else if (stand.games >= 1500 && stand.rb >= 4 && set[4] && rbRate > set[4].rb) {
      tags.push({ text: `RBやや不足 1/${Math.round(rbRate)}`, good: false });
    }
  }
  if (stand.combined_only && stand.combined_prob > 0) {
    if (stand.combined_prob < 135) tags.push({ text: `合成好調 1/${Math.round(stand.combined_prob)}`, good: true });
    else if (stand.combined_prob > 170) tags.push({ text: `合成不調 1/${Math.round(stand.combined_prob)}`, good: false });
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
let historyData = {};  // { "YYYY-MM-DD": { stores: { sid: { machines: [...] } } } }
let prevPivotDate = null;     // 朝イチ基準にした「前日」の日付
let storeTendencyMap = {};    // sid -> analyzeStoreTendency結果（朝イチ台のタグ用）

const GITHUB_BASE = 'https://raw.githubusercontent.com/min-juggler/juggler/main/docs/data/';

// 古いスクリプト由来の店舗IDを正規IDへ寄せる（iOSショートカットの旧版対策）
const STORE_ALIAS = {
  'dynam_a736724': 'dynam_tendo',
  'dynam-a736724': 'dynam_tendo',
  'dynam-a725254': 'dynam_yonezawa',
};
const STORE_NAME_FIX = {
  'dynam_tendo': 'ダイナム天童店',
  'dynam_yonezawa': 'ダイナム米沢店',
};
function normalizeStoresDict(stores) {
  if (!stores) return stores;
  const cnt = s => (s.machines || []).reduce((a, m) => a + (m.stands ? m.stands.length : 0), 0);
  for (const [bad, good] of Object.entries(STORE_ALIAS)) {
    if (!stores[bad]) continue;
    if (!stores[good] || cnt(stores[bad]) > cnt(stores[good])) {
      stores[good] = stores[bad];
    }
    delete stores[bad];
  }
  for (const [id, nm] of Object.entries(STORE_NAME_FIX)) {
    if (stores[id]) stores[id].name = nm;
  }
  return stores;
}

async function loadData() {
  // raw.githubusercontent.com を先に試す（GitHub PagesはCDNキャッシュで更新が遅い）
  const urls = [GITHUB_BASE + 'stores.json', 'data/stores.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) continue;
      storeData = await res.json();
      normalizeStoresDict(storeData.stores);
      buildAllStands();
      updateDataStatus();
      populateStoreSelect();
      // 履歴データを読み込む（朝イチ用の前日データもここで作る）
      await loadHistoryData(url.replace('stores.json', 'history.json'));
      return true;
    } catch { continue; }
  }
  updateDataStatus(null);
  return false;
}

async function loadHistoryData(url) {
  try {
    const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    historyData = await res.json();
    // 各日の店舗IDも正規化（旧版スクリプト対策）
    for (const day of Object.values(historyData)) {
      if (day && day.stores) normalizeStoresDict(day.stores);
    }
    // 朝イチ用：最新の履歴日を「前日（据え置き基準）」として展開
    buildPrevFromHistory();
    // 履歴読み込み完了後に傾向タブを更新
    renderTrendTab();
  } catch { historyData = {}; }
}

// 最新の履歴日を「前日（据え置き基準）」として朝イチ用データを作る
function buildPrevFromHistory() {
  prevAllStands = [];
  const dates = Object.keys(historyData || {}).sort();
  if (!dates.length) return;
  prevPivotDate = dates[dates.length - 1];
  const stores = historyData[prevPivotDate]?.stores || {};
  for (const [storeId, store] of Object.entries(stores)) {
    for (const machine of (store.machines || [])) {
      const displayName = hw2fw(machine.machine_name);
      for (const stand of (machine.stands || [])) {
        prevAllStands.push({ ...stand, store_id: storeId, store_name: store.name, machine_name: stand.machine_name || displayName });
      }
    }
  }
}

async function loadPrevData(url) {
  try {
    const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    prevStoreData = await res.json();
    normalizeStoresDict(prevStoreData.stores);
    prevAllStands = [];
    for (const [storeId, store] of Object.entries(prevStoreData.stores)) {
      for (const machine of store.machines) {
        const displayName = hw2fw(machine.machine_name);
        for (const stand of machine.stands) {
          prevAllStands.push({ ...stand, store_id: storeId, store_name: store.name, machine_name: displayName });
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
      // 半角カタカナ → 全角カタカナに変換して表示用に正規化
      const displayName = hw2fw(machine.machine_name);
      for (const stand of machine.stands) {
        allStands.push({ ...stand, store_id: storeId, store_name: store.name, machine_name: displayName });
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
    el.textContent = 'データ未取得 — 店舗サイトでブックマークを実行してください';
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
    const fit = calcFitQuality(stand, settings);
    const score = calcScore(probs, expectedSetting, stand, fit, settings);
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

  // ===== 店舗の据え置き傾向を全店分まとめて算出 =====
  buildTendencyMap();

  // ===== 店舗の傾向（据え置き分析） =====
  renderTendency(storeFilter);

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

  // ===== 辛口判定（鉄板台 / 撤退推奨） =====
  // 仕事終わり到着前提: 当日データで「設定5以上が濃厚」かつ十分なサンプルの台だけ
  const high56 = s => (s.probs ? (s.probs[5] || 0) + (s.probs[6] || 0) : 0);
  const verdict = scored.filter(s => s.games >= VERDICT_MIN_GAMES && high56(s) >= VERDICT_MIN_HIGH56).slice(0, 8);
  renderVerdict(verdict);

  // 夕方：1000G以上で高スコア台
  const evening = scored.filter(s => s.games >= 1000 && s.score >= 45).slice(0, 10);
  renderEveningList(evening);
  renderAllStands(scored);
  // 店舗フィルターに合わせて傾向タブの店舗も切り替え
  if (storeFilter !== 'all') trendStoreId = storeFilter;
  renderTrendTab();
}

// 店舗の据え置き傾向を履歴から分析
// 高設定=推定設定4.2以上(3000G以上)。前日高設定→翌日も高設定の割合を全体率と比較
function analyzeStoreTendency(sid) {
  const dates = Object.keys(historyData).sort();
  const highByDate = {}, allByDate = {};
  const rack = {}; // rk -> {hi, tot, machine}
  let baseHit = 0, baseTot = 0;
  for (const d of dates) {
    const machines = historyData[d]?.stores?.[sid]?.machines || [];
    const high = new Set(), all = new Set();
    for (const m of machines) for (const st of (m.stands || [])) {
      const s = { ...st, machine_name: st.machine_name || m.machine_name };
      if (!(s.games >= 3000)) continue;
      const es = calcExpectedSetting(calcSettingLikelihood(s, getMachineSettings(s.machine_name || '')));
      if (es == null) continue;
      const rk = String(s.rack_no);
      all.add(rk); baseTot++;
      const r = rack[rk] || (rack[rk] = { hi: 0, tot: 0, machine: s.machine_name });
      r.tot++;
      if (es >= 4.2) { high.add(rk); baseHit++; r.hi++; }
    }
    highByDate[d] = high; allByDate[d] = all;
  }
  let contHit = 0, contTot = 0;
  for (let i = 1; i < dates.length; i++) {
    const prevH = highByDate[dates[i - 1]] || new Set();
    const curH = highByDate[dates[i]] || new Set();
    const curAll = allByDate[dates[i]] || new Set();
    for (const rk of prevH) {
      if (!curAll.has(rk)) continue; // 翌日も十分回っている台のみ対象
      contTot++;
      if (curH.has(rk)) contHit++;
    }
  }
  const base = baseTot ? baseHit / baseTot : 0;
  const cont = contTot ? contHit / contTot : 0;
  let signal = 'none';
  if (contTot >= 10) signal = cont >= base * 1.3 ? 'strong' : (cont > base ? 'weak' : 'none');
  // データの信頼度（日数と連続判定サンプル数から）
  let confidence = 'low';
  if (dates.length >= 20 && contTot >= 20) confidence = 'high';
  else if (dates.length >= 12 && contTot >= 10) confidence = 'mid';
  const needDays = confidence === 'low' ? Math.max(1, 14 - dates.length) : 0;
  // 高設定を入れやすい台番号（朝イチの目安）: 全体率の1.5倍以上 & 6日以上記録
  const rackRows = Object.entries(rack)
    .filter(([rk, r]) => r.tot >= 6 && r.hi >= 2 && r.hi / r.tot >= Math.max(0.35, base * 1.5))
    .map(([rk, r]) => ({ rack: rk, hi: r.hi, tot: r.tot, rate: r.hi / r.tot, machine: r.machine }))
    .sort((a, b) => b.rate - a.rate || b.tot - a.tot)
    .slice(0, 6);
  return { days: dates.length, base, cont, contTot, signal, confidence, needDays, rackRows };
}

// 全店舗の据え置き傾向をまとめて算出（朝イチ台のタグ付け用にキャッシュ）
function buildTendencyMap() {
  storeTendencyMap = {};
  for (const sid of Object.keys(storeData?.stores || {})) {
    try { storeTendencyMap[sid] = analyzeStoreTendency(sid); } catch { /* skip */ }
  }
}

// 判定に十分なサンプル(前日高設定→翌日の連続判定数)があるか。
// 日数ではなくサンプル数が主軸。小規模店は日数が多くてもサンプルが貯まりにくい。
function tendencyHasEnough(t) { return t && t.contTot >= 3; }

// 据え置き店としての分かりやすい判定文（信頼度込み）
function tendencyVerdict(t) {
  // サンプルが極端に少ない場合のみ「判定中」
  if (!tendencyHasEnough(t)) {
    let note;
    if (!t) note = 'まだ判定に十分なデータがありません';
    else if (t.days < 14) note = `あと約${Math.max(1, 14 - t.days)}日通えばラフ判定できます（現在${t.days}日分）`;
    else note = `据え置き判定のサンプル不足（${t.days}日分あるが対象台が少ない小規模店）。3000G以上回る台が増えると判定できます。`;
    return { label: '⏳ 判定中（データ不足）', cls: 't-none', note };
  }
  const ratio = t.base > 0 ? t.cont / t.base : 0;
  // サンプルが中途半端(3〜7件) or 信頼度lowなら「参考」扱い
  const rough = t.contTot < 8 || t.confidence === 'low';
  const conf = t.confidence === 'high' ? '信頼度:高'
    : rough ? `参考(サンプル${t.contTot}件)` : '信頼度:中';
  if (t.signal === 'strong' || (rough && ratio >= 1.3)) return {
    label: rough ? '△ 据え置き傾向あり(参考)' : '✅ 据え置き店', cls: rough ? 't-weak' : 't-strong', conf,
    note: '前日の高設定台が翌日も残りやすい傾向。' + (rough ? 'サンプルが少ないので参考程度に。' : '朝イチは昨日の高設定台（🌅）が買い。') };
  if (t.signal === 'weak' || (rough && ratio > 1)) return {
    label: '△ やや据え置き', cls: 't-weak', conf,
    note: '多少の据え置き傾向あり。前日台は参考程度に。' };
  return { label: '❌ 据え置き弱い（リセット寄り）', cls: 't-none', conf,
    note: '前日データに頼りすぎない方が無難。朝イチは博打になりやすい。' };
}

function renderTendency(storeFilter) {
  const section = document.getElementById('tendency-section');
  const list = document.getElementById('tendency-list');
  if (!historyData || Object.keys(historyData).length < 3) { section.classList.add('hidden'); return; }

  const sids = storeFilter === 'all'
    ? Object.keys(storeData?.stores || {})
    : [storeFilter];
  const cards = [];
  for (const sid of sids) {
    const name = storeData?.stores?.[sid]?.name || sid;
    const t = analyzeStoreTendency(sid);
    const v = tendencyVerdict(t);
    // サンプルが極端に少ない店だけ判定文を大きく出す（3件以上あれば参考として詳細表示）
    if (!tendencyHasEnough(t)) {
      cards.push(`<div class="tendency-card">
        <div class="t-store">${name}</div>
        <div class="t-verdict ${v.cls}">${v.label}</div>
        <div class="t-advice">${v.note}</div></div>`);
      continue;
    }
    const ratio = t.base > 0 ? (t.cont / t.base) : 0;
    const advice = v.note;
    let rackHtml = '';
    if (t.rackRows && t.rackRows.length) {
      const items = t.rackRows.map(r =>
        `<div class="t-rack-item"><span class="t-rack-no">${r.rack}番</span>
         <span class="t-rack-machine">${hw2fw(r.machine || '')}</span>
         <span class="t-rack-rate">過去${r.tot}日中${r.hi}日 (${Math.round(r.rate * 100)}%)</span></div>`
      ).join('');
      rackHtml = `<div class="t-rack-wrap">
        <div class="t-rack-title">🎯 高設定を入れやすい台（朝イチの目安）</div>
        ${items}
        <div class="t-rack-note">※過去データの傾向です。当日のデータが出たら上の判定を優先してください。</div>
      </div>`;
    }
    cards.push(`<div class="tendency-card">
      <div class="t-store">${name}</div>
      <div class="t-verdict ${v.cls}">${v.label} <span class="t-conf">${v.conf || ''}</span></div>
      <div class="t-row"><span>全体の高設定率</span><span class="t-val">${Math.round(t.base * 100)}%</span></div>
      <div class="t-row"><span>前日高設定→翌日も高設定</span><span class="t-val">${Math.round(t.cont * 100)}%${ratio >= 1.1 ? `（通常の${ratio.toFixed(1)}倍）` : ''}</span></div>
      <div class="t-row"><span>分析サンプル</span><span class="t-val">${t.days}日 / ${t.contTot}件</span></div>
      <div class="t-advice">💡 ${advice}</div>
      ${rackHtml}
    </div>`);
  }
  if (cards.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  list.innerHTML = cards.join('');
}

function renderVerdict(stands) {
  const section = document.getElementById('verdict-section');
  const banner = document.getElementById('verdict-banner');
  const list = document.getElementById('verdict-list');
  section.classList.remove('hidden');

  if (stands.length === 0) {
    banner.className = 'verdict-banner verdict-stop';
    banner.innerHTML = `
      <div class="verdict-title">🚪 今日は打てる台なし</div>
      <div class="verdict-sub">基準（設定5以上の確率${Math.round(VERDICT_MIN_HIGH56*100)}%以上・${VERDICT_MIN_GAMES.toLocaleString()}G以上）を満たす台がありません。<br>無理に打たず<b>撤退推奨</b>です。</div>`;
    list.innerHTML = '';
    return;
  }

  banner.className = 'verdict-banner verdict-go';
  banner.innerHTML = `
    <div class="verdict-title">🔥 鉄板候補 ${stands.length}台</div>
    <div class="verdict-sub">この台が<b>空いていたら打ち</b>。<br>全部埋まっていて空かないなら撤退推奨です。</div>`;
  list.innerHTML = stands.map((s, i) => buildStandCard(s, i + 1, '鉄板候補')).join('');
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
  // 各台に「その店が据え置き店か」のタグを付ける（信頼して狙えるか一目で分かるように）
  stands.forEach(s => { s._trust = morningTrustTag(s.store_id); });
  list.innerHTML = stands.map((s, i) => buildStandCard(s, i + 1, '昨日高設定')).join('');
}

// 朝イチ台に出す「据え置き信頼度」タグ
function morningTrustTag(sid) {
  const t = storeTendencyMap[sid];
  const v = tendencyVerdict(t);
  if (v.cls === 't-strong') return { text: '✅ 据え置き店◎ 信じて狙える', good: true };
  if (v.cls === 't-weak')   return { text: '△ やや据え置き 参考程度', good: true };
  if (t && (t.confidence === 'low' || t.contTot < 8))
    return { text: '⚠️ 据え置きデータ不足 自己責任', good: false };
  return { text: '❌ リセット寄り 朝イチは博打', good: false };
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
  const combinedRate = s.combined_only
    ? (s.combined_prob > 0 ? `1/${Math.round(s.combined_prob)}` : '-')
    : ((s.bb + s.rb) > 0 ? `1/${Math.round(s.games / (s.bb + s.rb))}` : '-');
  const estSetting = s.expectedSetting ? s.expectedSetting.toFixed(1) : '-';
  const profitClass = (s.expectedProfit || 0) >= 0 ? 'expect-positive' : 'expect-negative';
  const profitSign = (s.expectedProfit || 0) >= 0 ? '+' : '';
  const profitText = s.expectedProfit !== null
    ? `<span class="${profitClass}">${profitSign}${s.expectedProfit.toLocaleString()}円</span>`
    : '<span>-</span>';
  const tagsHtml = ((s._trust ? [s._trust] : []).concat(s.tags)).map(t =>
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
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">
          <div class="stand-store-tag">🏪 ${s.store_name}</div>
          ${label ? `<div class="stand-store-tag" style="background:#fff3cd;color:#856404">⭐ ${label}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <div class="stars">${stars}</div>
        <div class="score-label" style="color:${color}">スコア ${s.score}</div>
      </div>
    </div>
    <div class="stand-data-grid">
      ${s.combined_only ? `
      <div class="stand-data-cell">
        <span class="data-label">G数</span>
        <span class="data-value">${(s.games||0).toLocaleString()}</span>
      </div>
      <div class="stand-data-cell">
        <span class="data-label">大当り</span>
        <span class="data-value">${s.total_bonus||0}回</span>
      </div>
      <div class="stand-data-cell">
        <span class="data-label">合成確率</span>
        <span class="data-value">${combinedRate}</span>
      </div>` : `
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
      </div>`}
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
  const combRate = stand.combined_prob > 0 ? `1/${Math.round(stand.combined_prob)}` : '-';

  const modalCells = stand.combined_only ? `
      <div class="modal-cell"><div class="label">ゲーム数</div><div class="value">${(stand.games||0).toLocaleString()}G</div></div>
      <div class="modal-cell"><div class="label">大当り回数</div><div class="value">${stand.total_bonus||0}回</div></div>
      <div class="modal-cell"><div class="label">合成確率</div><div class="value">${combRate}</div></div>
      <div class="modal-cell"><div class="label">推定設定</div><div class="value">${stand.expectedSetting?stand.expectedSetting.toFixed(1):'-'}</div></div>` : `
      <div class="modal-cell"><div class="label">ゲーム数</div><div class="value">${(stand.games||0).toLocaleString()}G</div></div>
      <div class="modal-cell"><div class="label">差枚数</div><div class="value" style="color:${diffColor}">${diffSign}${(stand.diff||0).toLocaleString()}</div></div>
      <div class="modal-cell"><div class="label">BB確率</div><div class="value">${bbRate}</div></div>
      <div class="modal-cell"><div class="label">RB確率</div><div class="value">${rbRate}</div></div>`;

  document.getElementById('modal-body').innerHTML = `
    <h3>${stand.machine_name} <span style="color:#e63946">${stand.rack_no}番台</span></h3>
    <p style="color:#999;font-size:12px;margin-bottom:14px">${stand.store_name}${stand.combined_only?' ・BB/RB内訳なし(合成確率で判定)':''}</p>
    <div class="modal-grid">${modalCells}</div>

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

  document.getElementById('btn-reload').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.textContent = '⏳ 読込中...';
    btn.disabled = true;
    await loadData();
    analyze();
    btn.textContent = '↻ 再読み込み';
    btn.disabled = false;
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

// ===== 傾向分析 =====
let trendStoreId = null;
let trendMachine = null;

function renderTrendTab() {
  const section = document.getElementById('trend-section');
  if (!historyData || !Object.keys(historyData).length) return;
  section.classList.remove('hidden');

  // 店舗タブ
  const storeTabs = document.getElementById('trend-store-tabs');
  const storeIds = [...new Set(Object.values(historyData).flatMap(d => Object.keys(d.stores || {})))];
  if (!trendStoreId || !storeIds.includes(trendStoreId)) trendStoreId = storeIds[0];

  storeTabs.innerHTML = storeIds.map(sid => {
    const name = Object.values(historyData).map(d => d.stores?.[sid]?.name).find(n => n) || sid;
    const active = sid === trendStoreId;
    return `<button onclick="setTrendStore('${sid}')" style="padding:4px 12px;border-radius:16px;border:none;cursor:pointer;font-size:12px;font-weight:${active?'700':'400'};background:${active?'#e63946':'#eee'};color:${active?'#fff':'#333'}">${name}</button>`;
  }).join('');

  renderTrendMachineTabs();
}

function setTrendStore(sid) {
  trendStoreId = sid;
  trendMachine = null;
  renderTrendTab();
}

function renderTrendMachineTabs() {
  const machineTabs = document.getElementById('trend-machine-tabs');
  const machines = [...new Set(
    Object.values(historyData)
      .flatMap(d => (d.stores?.[trendStoreId]?.machines || []).map(m => m.machine_name))
  )].map(mn => hw2fw(mn));

  if (!trendMachine || !machines.includes(trendMachine)) trendMachine = machines[0];

  machineTabs.innerHTML = machines.map(mn => {
    const active = mn === trendMachine;
    return `<button onclick="setTrendMachine('${mn.replace(/'/g,"\\'")}')" style="padding:3px 10px;border-radius:12px;border:none;cursor:pointer;font-size:11px;font-weight:${active?'700':'400'};background:${active?'#1d3557':'#eee'};color:${active?'#fff':'#333'}">${mn}</button>`;
  }).join('');

  renderTrendTable();
}

function setTrendMachine(mn) {
  trendMachine = mn;
  renderTrendMachineTabs();
}

function estimateSetting(g, bb, rb) {
  if (g < 1500 || bb < 3) return null;
  const SETTINGS = {1:{bb:287.4,rb:442.5},2:{bb:282.5,rb:393.9},3:{bb:273.1,rb:331.8},4:{bb:264.3,rb:287.4},5:{bb:252.2,rb:252.2},6:{bb:240.9,rb:240.9}};
  const bbR = g / bb, rbR = rb > 0 ? g / rb : 9999;
  let best = 1, bestScore = 9999;
  for (const [s, v] of Object.entries(SETTINGS)) {
    const score = Math.abs(bbR - v.bb)/v.bb*0.4 + Math.abs(rbR - v.rb)/v.rb*0.6;
    if (score < bestScore) { bestScore = score; best = parseInt(s); }
  }
  return best;
}

// 合算確率のみの店（ダイナム等 combined_only）用の設定推定。
// BB/RBの内訳が取れないため合算（総ボーナス）1/xで判定する。
// 目安値は汎用ジャグラーのBB/RB合成: 6=1/120.5,5=1/126,4=1/137.6,3=1/149.8,2=1/164.5,1=1/174.2
const COMBINED_SETTINGS = {1:174.2,2:164.5,3:149.8,4:137.6,5:126.1,6:120.5};
function estimateSettingCombined(g, bonus) {
  if (g < 1500 || bonus < 3) return null;
  const cr = g / bonus;
  let best = 1, bestScore = 9999;
  for (const [s, v] of Object.entries(COMBINED_SETTINGS)) {
    const score = Math.abs(cr - v) / v;
    if (score < bestScore) { bestScore = score; best = parseInt(s); }
  }
  return best;
}

// スタンド1件から設定推定（内訳ありは通常、combined_onlyは合算で）
function standEstimate(s) {
  if (!s) return null;
  const bonus = parseInt(s.total_bonus) || 0;
  if (s.combined_only || ((parseInt(s.bb)||0) === 0 && (parseInt(s.rb)||0) === 0 && bonus > 0)) {
    return estimateSettingCombined(s.games, bonus);
  }
  return estimateSetting(s.games, s.bb, s.rb);
}

const SETTING_COLORS = {
  6: '#2d6a4f', 5: '#52b788', 4: '#b7e4c7',
  3: '#ffe066', 2: '#ffa94d', 1: '#ff6b6b',
};
const SETTING_TEXT_COLORS = { 6:'#fff', 5:'#fff', 4:'#333', 3:'#333', 2:'#333', 1:'#fff' };

function renderTrendTable() {
  const wrap = document.getElementById('trend-table');
  const dates = Object.keys(historyData).sort();
  if (!dates.length || !trendStoreId || !trendMachine) { wrap.innerHTML = ''; return; }

  // 台番 → 日付 → データ
  const rackMap = {};
  for (const date of dates) {
    const machines = historyData[date]?.stores?.[trendStoreId]?.machines || [];
    for (const m of machines) {
      if (hw2fw(m.machine_name) !== trendMachine) continue;
      for (const s of m.stands) {
        if (!rackMap[s.rack_no]) rackMap[s.rack_no] = {};
        rackMap[s.rack_no][date] = s;
      }
    }
  }

  const racks = Object.keys(rackMap).sort((a, b) => parseInt(a) - parseInt(b));
  if (!racks.length) { wrap.innerHTML = '<p style="color:#999;font-size:12px">データなし</p>'; return; }

  // 据え置き台（設定4以上が2日以上連続）をハイライト
  const keepRacks = new Set();
  for (const rack of racks) {
    const dmap = rackMap[rack];
    let consec = 0;
    for (const d of dates) {
      const s = dmap[d];
      const est = standEstimate(s);
      if (est && est >= 4) { consec++; if (consec >= 2) { keepRacks.add(rack); break; } }
      else consec = 0;
    }
  }

  const shortDates = dates.map(d => d.slice(5)); // MM-DD

  let html = `<table style="border-collapse:collapse;font-size:12px;min-width:${60 + dates.length * 54}px">`;
  html += '<thead><tr>';
  html += '<th style="padding:4px 8px;text-align:left;position:sticky;left:0;background:#fff;z-index:1;border-bottom:1px solid #ddd;white-space:nowrap">台番</th>';
  for (const d of shortDates) {
    html += `<th style="padding:4px 6px;text-align:center;border-bottom:1px solid #ddd;min-width:48px;color:#666">${d}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const rack of racks) {
    const isKeep = keepRacks.has(rack);
    html += `<tr style="background:${isKeep?'#f0fff4':''}">`;
    html += `<td style="padding:4px 8px;position:sticky;left:0;background:${isKeep?'#f0fff4':'#fff'};z-index:1;font-weight:${isKeep?'700':'400'};white-space:nowrap">${rack}番${isKeep?' 🔥':''}</td>`;
    for (const date of dates) {
      const s = rackMap[rack]?.[date];
      if (!s) { html += '<td style="padding:4px 6px;text-align:center;color:#ccc">-</td>'; continue; }
      const est = standEstimate(s);
      const bg = est ? SETTING_COLORS[est] : '#eee';
      const tc = est ? SETTING_TEXT_COLORS[est] : '#999';
      const isComb = s.combined_only || ((parseInt(s.bb)||0) === 0 && (parseInt(s.rb)||0) === 0 && (parseInt(s.total_bonus)||0) > 0);
      const tip = s.games > 0
        ? (isComb
            ? `${s.games}G 合算1/${s.combined_prob || Math.round(s.games/(s.total_bonus||1))} (ボーナス${s.total_bonus||0}回)`
            : `${s.games}G BB${s.bb} RB${s.rb} 差${s.diff>=0?'+':''}${s.diff}`)
        : '';
      html += `<td style="padding:2px 4px;text-align:center" title="${tip}">`;
      if (est) {
        html += `<span style="display:inline-block;background:${bg};color:${tc};border-radius:4px;padding:2px 6px;font-weight:700">${est}</span>`;
        if (s.games > 0) html += `<div style="font-size:10px;color:#999">${Math.round(s.games/100)/10}k</div>`;
      } else if (s.games > 0) {
        html += `<span style="color:#aaa;font-size:10px">${Math.round(s.games/100)/10}k</span>`;
      } else {
        html += '<span style="color:#ddd">-</span>';
      }
      html += '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  // 凡例と据え置き台サマリー
  const keepList = [...keepRacks];
  if (keepList.length) {
    html += `<div style="margin-top:12px;padding:10px;background:#f0fff4;border-radius:8px;border:1px solid #b7e4c7">`;
    html += `<div style="font-size:12px;font-weight:700;color:#2d6a4f;margin-bottom:4px">🔥 据え置き候補台（設定4以上が2日以上連続）</div>`;
    html += keepList.map(r => `<span style="display:inline-block;background:#2d6a4f;color:#fff;border-radius:12px;padding:2px 10px;margin:2px;font-size:12px">${r}番</span>`).join('');
    html += '</div>';
  }

  wrap.innerHTML = html;
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
  { name: 'アイランド米沢店',  url: 'https://island.pt.teramoba2.com/yonezawa/standlist_slot?kind_code=Z' },
  { name: '1円劇場上山店', url: 'https://island.pt.teramoba2.com/kaminoyama/standlist_slot?kind_code=Z' },
  { name: 'ベガスベガス米沢店', url: 'https://vegasmobile.pt.teramoba2.com/hl-105/rack_info_kt?kind_code=21' },
  { name: 'ダイナム米沢店', url: 'https://www.dynam-data.jp/h/a725254/cgi-bin/nc-v13-001.php?cd_ps=2' },
  { name: 'ダイナム天童店', url: 'https://www.dynam-data.jp/h/a736724/cgi-bin/nc-v13-001.php?cd_ps=2' },
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

// ===== ブックマークレット（自動更新ローダー） =====
// bookmarklet_code.js を毎回GitHubから取得するため、再ドラッグ不要
function buildInlineBookmarklet(token, repo, dayOffset = 0) {
  return `(async function(){
var T='${token}',R='${repo}';
window.__JUG_DAYOFF__=${dayOffset};
try{
  var r=await fetch('https://raw.githubusercontent.com/'+R+'/main/docs/bookmarklet_code.js?_='+Date.now(),{cache:'no-store'});
  if(!r.ok){alert('コード取得失敗 '+r.status);return;}
  eval((await r.text()).replace(/__TOKEN__/g,T).replace(/__REPO__/g,R));
}catch(e){alert('ローダーエラー: '+e.message);}
})();`;
}

// 1クリックで直近3日分（今日・昨日・一昨日）を取得。既存日は上書きなので重複しない＝穴埋め用。
function buildInline3DayBookmarklet(token, repo, days = 3) {
  return `(async function(){
var T='${token}',R='${repo}';
try{
  var r=await fetch('https://raw.githubusercontent.com/'+R+'/main/docs/bookmarklet_code.js?_='+Date.now(),{cache:'no-store'});
  if(!r.ok){alert('コード取得失敗 '+r.status);return;}
  var code=(await r.text()).replace(/__TOKEN__/g,T).replace(/__REPO__/g,R);
  for(var o=0;o>-${days};o--){
    window.__JUG_DAYOFF__=o;
    try{ await eval(code); }catch(e){ console.log('day',o,e); }
    if(o>-${days}+1)await new Promise(r=>setTimeout(r,2500)); // 連続PUTのsha競合回避
  }
}catch(e){alert('ローダーエラー: '+e.message);}
})();`;
}

// ===== （旧）直接埋め込み版（参考のため残す） =====
function _buildInlineBookmarkletOld(token, repo) {
  return `(async function(){
var sid=location.href.includes('yonezawa')?'yonezawa':location.href.includes('kaminoyama')?'kaminoyama':null;
if(!sid){alert('店舗サイトで実行してください');return;}
var sname={yonezawa:'アイランド米沢店',kaminoyama:'1円劇場上山店'}[sid];
var hid={yonezawa:292,kaminoyama:1303}[sid];
var bar=document.createElement('div');
bar.style='position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:85vw;word-break:break-all';
bar.textContent='🎰 v6 データ取得中...';document.body.appendChild(bar);
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

  // AES鍵・IVの取得: 複数URLを試みる
  var encKey=null,encIv=null,propsKindList=[],rawDP='';
  async function tryGetKey(url){
    try{
      var r=await fetch(url,{credentials:'include'});
      var h=await r.text();
      var m=h.match(/data-page="([^"]+)"/);
      if(!m)return null;
      var rd=m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n));
      var p=JSON.parse(rd).props||{};
      if(p.data&&p.data.key){rawDP=rd;return p;}
    }catch(e){}
    return null;
  }
  // ①kind_codeのみ ②マイジャグラーV指定 ③ゴーゴージャグラー指定
  var seedMachines=['%EF%BE%8F%EF%BD%B2%EF%BD%BC%EF%BE%9E%EF%BD%AC%EF%BD%B8%EF%BE%9E%EF%BE%97%EF%BD%B0V','%A5%B4%A1%BC%A5%B4%A1%BC%A5%B8%A5%E3%A5%B0%A5%E9%A1%BC3'];
  var dpP=await tryGetKey('/'+sid+'/standlist_slot?kind_code='+urlKindCode);
  if(!dpP){
    for(var sm of seedMachines){
      dpP=await tryGetKey('/'+sid+'/standlist_slot?kind_code='+urlKindCode+'&machine_name='+sm);
      if(dpP)break;
    }
  }
  if(dpP){
    encKey=dpP.data.key;encIv=dpP.data.iv;
    var propsHid=dpP.hall_id||dpP.hallId||(dpP.data&&dpP.data.hall_id);
    if(propsHid)hid=parseInt(propsHid);
    var mr=dpP.machine_ranking_items||dpP.machines||dpP.kind_list;
    if(mr){
      var src=Array.isArray(mr)?mr:(mr.slot||mr[urlKindCode]||Object.values(mr)[0]||[]);
      if(Array.isArray(src))propsKindList=src.map(m=>m.machine_name||m.ki_name||m.name||m.ki_mei).filter(Boolean);
    }
    [...rawDP.matchAll(/"machine_name"\s*:\s*"([^"]+)"/g)].forEach(m=>{if(!propsKindList.includes(m[1]))propsKindList.push(m[1]);});
    [...rawDP.matchAll(/"ki_name"\s*:\s*"([^"]+)"/g)].forEach(m=>{if(!propsKindList.includes(m[1]))propsKindList.push(m[1]);});
  }
  bar.textContent='key='+(encKey?encKey.slice(0,16)+'...':'none')+' iv='+(encIv!=null?String(encIv).slice(0,24):'null')+' hid='+hid;
  await new Promise(r=>setTimeout(r,3000));
  if(!encKey){bar.textContent='❌ AES鍵なし';setTimeout(()=>bar.remove(),5000);return;}

  function h2b(h){var b=new Uint8Array(h.length/2);for(var i=0;i<h.length;i+=2)b[i/2]=parseInt(h.substr(i,2),16);return b;}

  // 機種名収集: ①performance URL ②props ③現ページのリンク ④standlist HTML内のmachine_name
  var machineNames=[];
  var addMn=function(mn){if(mn&&!machineNames.includes(mn))machineNames.push(mn);};
  performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('machine_list')).forEach(u=>{
    try{addMn(new URL(u).searchParams.get('machine_name'));}catch(e){}
  });
  propsKindList.forEach(addMn);
  document.querySelectorAll('a[href*="machine_name"]').forEach(a=>{
    try{addMn(new URL(a.href).searchParams.get('machine_name'));}catch(e){}
  });
  // rawDP(decodedJSON)からmachine_nameを正規表現で全抽出（最も確実）
  [...rawDP.matchAll(/"machine_name"\s*:\s*"([^"]+)"/g)].forEach(m=>addMn(m[1]));
  bar.textContent='機種 '+machineNames.length+'件: '+(machineNames.slice(0,3).map(n=>decodeURIComponent(n).slice(0,6)).join(' ')+(machineNames.length>3?'...':''));
  await new Promise(r=>setTimeout(r,3000));
  if(machineNames.length===0){bar.textContent='❌ 機種名取得失敗。機種一覧ページで実行してください。';setTimeout(()=>bar.remove(),8000);return;}

  // 復号ヘルパー
  async function decryptMl(txt){
    var cb;try{cb=JSON.parse(txt);}catch(e){cb=txt;}
    if(typeof cb==='object'&&cb!==null)cb=cb.data||cb.cipher||cb.content||JSON.stringify(cb);
    cb=String(cb);
    var lIv=null,lVal=null;
    try{var inn=JSON.parse(atob(cb));if(inn&&inn.iv&&inn.value){lIv=inn.iv;lVal=inn.value;}}catch(e){}
    var cBytes,ivBytes;
    if(lIv){ivBytes=Uint8Array.from(atob(lIv),c=>c.charCodeAt(0));cBytes=Uint8Array.from(atob(lVal),c=>c.charCodeAt(0));}
    else{
      if(!encIv)return null;
      try{cBytes=Uint8Array.from(atob(cb),c=>c.charCodeAt(0));}catch(e){return null;}
      var ivS=String(encIv);
      ivBytes=/^[0-9a-fA-F]+$/.test(ivS)&&ivS.length%2===0?h2b(ivS):Uint8Array.from(atob(ivS),c=>c.charCodeAt(0));
    }
    var kB=h2b(encKey);
    for(var [mode,ivL] of [['AES-CBC',16],['AES-GCM',12]]){
      try{var ck=await crypto.subtle.importKey('raw',kB,{name:mode},false,['decrypt']);
        var pl=await crypto.subtle.decrypt({name:mode,iv:ivBytes.slice(0,ivL)},ck,cBytes);
        return JSON.parse(new TextDecoder().decode(pl));}catch(e){}
    }
    return null;
  }

  // 機種ごとにループして全台取得
  var allStands=[];
  for(var i=0;i<machineNames.length;i++){
    var mname=machineNames[i];
    bar.textContent='['+(i+1)+'/'+machineNames.length+'] '+decodeURIComponent(mname).slice(0,14)+'...';
    try{
      var mlR=await fetch('/'+sid+'/rack_info/machine_list?hall_id='+hid+'&kind_code='+urlKindCode+'&machine_name='+encodeURIComponent(mname)+'&target_date='+today+'&disp=2&place=&history_day=3',{credentials:'include'});
      if(!mlR.ok)continue;
      var dec=await decryptMl(await mlR.text());
      if(dec){var ss=Array.isArray(dec)?dec:(dec.data||dec.items||Object.values(dec));ss.forEach(s=>allStands.push(s));}
    }catch(e){}
  }

  if(allStands.length===0){bar.textContent='❌ 全台データ取得失敗';setTimeout(()=>bar.remove(),8000);return;}
  var mmap={};
  allStands.forEach(s=>{var mn=s.machine_name||s.ki_name||'不明';if(!mmap[mn])mmap[mn]=[];mmap[mn].push({rack_no:String(s.rack_no||s.dai_no||'?'),machine_name:mn,games:parseInt(s.all_game_count||s.total_games||s.games||0),bb:parseInt(s.bonus_1||s.bb_count||s.bb||0),rb:parseInt(s.bonus_2||s.rb_count||s.rb||0),diff:parseInt(s.substraction||s.diff||s.sa_mai||0)});});
  var result={name:sname,machines:[]};
  for(var[mn2,sts2]of Object.entries(mmap))result.machines.push({machine_name:mn2,count:sts2.length,stands:sts2});
  bar.textContent='✅ '+allStands.length+'台 機種:'+result.machines.length+' GitHub送信中...';
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

  // メイン: 1クリックで直近3日分を取得（穴埋め・自動リカバリ）
  const el = document.getElementById('bookmarklet-link');
  if (el) {
    el.href = 'javascript:' + encodeURIComponent(buildInline3DayBookmarklet(token, repo, 3));
    el.textContent = '🎰 データ取得（直近3日分）';
    el.style.background = '#e63946';
  }

  // サブ: 今日だけを軽く取得（急ぎ・時短用）
  const elY = document.getElementById('bookmarklet-link-yesterday');
  if (elY) {
    elY.href = 'javascript:' + encodeURIComponent(buildInlineBookmarklet(token, repo, 0));
    elY.textContent = '⚡ 今日だけ取得（時短）';
    elY.style.background = '#457b9d';
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

  // 認証カード(データ取得方法)は毎日取り直すため常に表示する
  showAuthCard(true);
  if (!hasRealData) {
    loadDemoData();
    analyze();
  } else {
    analyze();
  }
}

init();
