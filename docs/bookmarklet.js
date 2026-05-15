// ジャグラーデータ取得ブックマークレット本体
// ローダーから new Function('token', code)(token) で呼ばれる
(async function() {
  var sid = location.href.includes('yonezawa') ? 'yonezawa'
          : location.href.includes('kaminoyama') ? 'kaminoyama' : null;
  if (!sid) { alert('店舗サイト（yonezawa / kaminoyama）で実行してください'); return; }
  var sname = { yonezawa: 'アイランド米沢店', kaminoyama: '1円劇場上山店' }[sid];
  var repo  = 'min-juggler/juggler';

  var bar = document.createElement('div');
  bar.style = 'position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:14px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:80vw;word-break:break-all';
  bar.textContent = '🎰 機種一覧取得中...';
  document.body.appendChild(bar);

  function unescape_html(s) {
    return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
  }

  try {
    // ジャグラー一覧ページを生HTMLで取得
    var listResp = await fetch('/' + sid + '/standlist_slot?kind_code=21');
    var listHtml  = await listResp.text();
    var listMatch = listHtml.match(/data-page="([^"]+)"/);

    if (!listMatch) {
      bar.textContent = '❌ data-page なし (status:' + listResp.status + ')';
      await new Promise(r => setTimeout(r, 10000));
      bar.remove(); return;
    }

    var listProps = JSON.parse(unescape_html(listMatch[1])).props || {};
    // デバッグ：propsのキーを表示
    bar.textContent = '一覧props: ' + Object.keys(listProps).join(', ');
    await new Promise(r => setTimeout(r, 8000));

    // list_kind と data の構造確認
    var listKind = listProps.list_kind;
    var rawData  = listProps.data;
    var lkLen = Array.isArray(listKind) ? listKind.length : typeof listKind;
    var dataInfo = Array.isArray(rawData) ? 'array(' + rawData.length + ')先頭:' + JSON.stringify(rawData[0] || {}).slice(0, 100)
                 : typeof rawData === 'object' && rawData ? 'obj keys:' + Object.keys(rawData).join(',')
                 : String(rawData).slice(0, 80);
    bar.style.fontSize = '11px';
    bar.textContent = 'list_kind:' + lkLen + ' | data:' + dataInfo;
    await new Promise(r => setTimeout(r, 15000));

    // list_kind から機種リストを取得して個別ページをfetch
    var machines = Array.isArray(listKind) ? listKind : [];
    if (!machines.length) {
      bar.textContent = '❌ list_kindなし / data=' + JSON.stringify(rawData).slice(0,200);
      await new Promise(r => setTimeout(r, 12000)); bar.remove(); return;
    }
    bar.textContent = '機種数: ' + machines.length + ' / 先頭:' + JSON.stringify(machines[0]).slice(0, 150);
    await new Promise(r => setTimeout(r, 12000));

    // 各機種のページをfetchしてstand_listを取得
    var result = { name: sname, machines: [] };
    for (var m of machines) {
      var mname = m.machine_name || m.name || m.kind_name || '不明';
      var menc  = m.machine_name_enc || m.name_enc || encodeURIComponent(mname);
      var mkc   = m.kind_code || m.kc || 21;
      bar.textContent = '🎰 ' + mname + ' 取得中...';
      var mresp = await fetch('/' + sid + '/standlist_slot?kind_code=' + mkc + '&machine_name=' + menc);
      var mhtml = await mresp.text();
      var mmatch = mhtml.match(/data-page="([^"]+)"/);
      var stands = [];
      if (mmatch) {
        try {
          var mp = JSON.parse(unescape_html(mmatch[1])).props || {};
          var rl = mp.stand_list || mp.stands || mp.rack_list || mp.dai_data_list || mp.data || [];
          if (Array.isArray(rl)) {
            stands = rl.map(s => ({
              rack_no: String(s.rack_no || s.dai_no || s.no || '?'),
              machine_name: mname,
              games: parseInt(s.total_games || s.games || s.gk || 0),
              bb:    parseInt(s.bb_count   || s.bb    || s.big  || 0),
              rb:    parseInt(s.rb_count   || s.rb    || s.reg  || 0),
              diff:  parseInt(s.diff       || s.sa_mai || 0)
            }));
          }
        } catch(e) {}
      }
      result.machines.push({ machine_name: mname, count: m.cnt || stands.length, stands });
      await new Promise(r => setTimeout(r, 600));
    }

    // GitHub にアップロード
    bar.textContent = '📡 GitHubへ送信中...';
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

    var total = result.machines.reduce((a, m) => a + m.stands.length, 0);
    if (pr.ok) { bar.style.background = '#2d6a4f'; bar.textContent = '✅ ' + sname + ' ' + total + '台 送信完了！'; }
    else        { bar.style.background = '#888';    bar.textContent = '⚠️ GitHub送信失敗: ' + (await pr.text()).slice(0, 100); }

  } catch(e) {
    bar.style.background = '#888';
    bar.textContent = '❌ ' + e.message;
  }
  setTimeout(() => bar.remove(), 8000);
})();
