// ジャグラーデータ取得ブックマークレット本体
// ローダーから new Function('token', code)(token) で呼ばれる
(async function() {
  var sid = location.href.includes('yonezawa') ? 'yonezawa'
          : location.href.includes('kaminoyama') ? 'kaminoyama' : null;
  if (!sid) { alert('店舗サイトで実行してください'); return; }
  var sname = { yonezawa: 'アイランド米沢店', kaminoyama: '1円劇場上山店' }[sid];
  var repo  = 'min-juggler/juggler';

  var bar = document.createElement('div');
  bar.style = 'position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:13px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:80vw;word-break:break-all';
  bar.textContent = '🎰 機種一覧取得中...';
  document.body.appendChild(bar);

  try {
    // ジャグラー一覧ページをfetchしてHTMLをDOMパース
    var listResp = await fetch('/' + sid + '/standlist_slot?kind_code=21');
    var listHtml = await listResp.text();
    var parser   = new DOMParser();
    var listDoc  = parser.parseFromString(listHtml, 'text/html');

    // 機種リンクを探す（standlist_slotページ内のhref）
    var links = [...listDoc.querySelectorAll('a[href*="standlist_slot"]')];
    // 重複除去してURLセットを作る
    var seen = new Set();
    var machineUrls = [];
    for (var a of links) {
      var href = a.href || a.getAttribute('href');
      if (!href) continue;
      // 相対URLを絶対URLに変換
      if (href.startsWith('/')) href = location.origin + href;
      if (!seen.has(href) && href.includes('machine_name')) {
        seen.add(href);
        machineUrls.push(href);
      }
    }

    bar.textContent = '機種リンク数: ' + machineUrls.length + ' | 先頭:' + (machineUrls[0] || 'なし').slice(-60);
    await new Promise(r => setTimeout(r, 10000));

    if (!machineUrls.length) {
      // リンクがない場合、data-pageのpropsから機種一覧を探す
      var dpMatch = listHtml.match(/data-page="([^"]+)"/);
      if (dpMatch) {
        try {
          var dp = JSON.parse(dpMatch[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n)));
          var props = dp.props || {};
          // machine_ranking_itemsから機種ごとのURLを構築
          var items = props.machine_ranking_items || [];
          bar.textContent = 'machine_ranking_items: ' + items.length + ' 先頭:' + JSON.stringify(items[0]||{}).slice(0,150);
          await new Promise(r => setTimeout(r, 12000));
          if (items.length) {
            for (var item of items) {
              var mn  = item.machine_name || item.kind_name || '';
              var mne = item.machine_name_enc || item.kind_name_enc || encodeURIComponent(mn);
              var mkc = item.kind_code || 21;
              if (mn && !seen.has(mn)) { seen.add(mn); machineUrls.push('/' + sid + '/standlist_slot?kind_code=' + mkc + '&machine_name=' + mne); }
            }
          }
        } catch(e) { bar.textContent = 'parse err: ' + e.message; await new Promise(r=>setTimeout(r,8000)); }
      }
    }

    if (!machineUrls.length) {
      bar.textContent = '❌ 機種URLなし';
      await new Promise(r => setTimeout(r, 6000)); bar.remove(); return;
    }

    var result = { name: sname, machines: [] };

    for (var url of machineUrls) {
      var fullUrl = url.startsWith('/') ? location.origin + url : url;
      // URLからmachine_nameを抽出
      var usp = new URLSearchParams(fullUrl.split('?')[1] || '');
      var mname_enc = usp.get('machine_name') || '';
      bar.textContent = '🎰 取得中: ' + decodeURIComponent(mname_enc);

      var mresp = await fetch(fullUrl);
      var mhtml = await mresp.text();
      var mdoc  = parser.parseFromString(mhtml, 'text/html');

      // 方法1: HTMLテーブルから台データをパース
      var stands = parseStandsFromDom(mdoc, decodeURIComponent(mname_enc));

      // 方法2: HTMLテーブルが空ならdata-pageを試す
      if (!stands.length) {
        var mm = mhtml.match(/data-page="([^"]+)"/);
        if (mm) {
          try {
            var mp = JSON.parse(mm[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n))).props || {};
            var rl = mp.stand_list || mp.stands || mp.rack_list || mp.dai_data_list || [];
            if (Array.isArray(rl) && rl.length) {
              stands = rl.map(s => ({
                rack_no: String(s.rack_no || s.dai_no || s.no || '?'),
                machine_name: decodeURIComponent(mname_enc),
                games: parseInt(s.total_games || s.games || s.gk || 0),
                bb:    parseInt(s.bb_count   || s.bb    || s.big  || 0),
                rb:    parseInt(s.rb_count   || s.rb    || s.reg  || 0),
                diff:  parseInt(s.diff       || s.sa_mai || 0)
              }));
            }
          } catch(e) {}
        }
      }

      result.machines.push({ machine_name: decodeURIComponent(mname_enc), count: stands.length, stands });
      await new Promise(r => setTimeout(r, 500));
    }

    // GitHub にアップロード
    var total = result.machines.reduce((a, m) => a + m.stands.length, 0);
    bar.textContent = '📡 GitHubへ送信中... (' + total + '台)';
    var sha = null, cur = {};
    try {
      var er = await fetch('https://api.github.com/repos/' + repo + '/contents/data/stores.json',
        { headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' } });
      if (er.ok) { var ej = await er.json(); sha = ej.sha; cur = JSON.parse(atob(ej.content.replace(/\n/g, ''))); }
    } catch(e) {}

    if (!cur.stores) cur = { fetched_at: null, stores: {} };
    cur.fetched_at = new Date().toISOString();
    cur.stores[sid] = result;

    var js   = JSON.stringify(cur, null, 2);
    var body = { message: 'データ更新 ' + new Date().toLocaleString('ja'), content: btoa(unescape(encodeURIComponent(js))), branch: 'main' };
    if (sha) body.sha = sha;

    var pr = await fetch('https://api.github.com/repos/' + repo + '/contents/data/stores.json',
      { method: 'PUT', headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    if (pr.ok) { bar.style.background = '#2d6a4f'; bar.textContent = '✅ ' + sname + ' ' + total + '台 送信完了！'; }
    else        { bar.style.background = '#888';    bar.textContent = '⚠️ GitHub送信失敗: ' + (await pr.text()).slice(0, 100); }

  } catch(e) {
    bar.style.background = '#888';
    bar.textContent = '❌ ' + e.message;
  }
  setTimeout(() => bar.remove(), 8000);

  // ===== DOMからスタンドデータをパース =====
  function parseStandsFromDom(doc, machineName) {
    var stands = [];
    // テーブルの行を探す（rack_no, games, bb, rb が入った行）
    var rows = doc.querySelectorAll('tr, .stand-row, .rack-row, [data-rack], [data-no]');
    for (var row of rows) {
      var cells = row.querySelectorAll('td, .cell, span');
      if (cells.length < 3) continue;
      var texts = [...cells].map(c => c.textContent.trim()).filter(t => t);
      // 最初のセルが台番号っぽい数字かチェック
      if (!texts[0] || !/^\d+$/.test(texts[0])) continue;
      var rack = texts[0];
      // 数値を探す
      var nums = texts.filter(t => /^-?\d+$/.test(t)).map(Number);
      if (nums.length >= 3) {
        stands.push({ rack_no: rack, machine_name: machineName,
          games: nums[1] || 0, bb: nums[2] || 0, rb: nums[3] || 0, diff: nums[4] || 0 });
      }
    }
    return stands;
  }
})();
