(async function(){
var T='__TOKEN__',R='__REPO__';

// ダイナムP'sCUBEのURLからstore IDを取得
var m=location.href.match(/dynam-data\.jp\/h\/([a-z0-9]+)\//);
if(!m){alert('ダイナムのページで実行してください');return;}
var storeCode=m[1]; // 例: a725254

var STORES={'a725254':{sid:'dynam_yonezawa',name:'ダイナム米沢店'}};
var storeInfo=STORES[storeCode]||{sid:'dynam_'+storeCode,name:'ダイナム'+storeCode};
var sid=storeInfo.sid, sname=storeInfo.name;

var bar=document.createElement('div');
bar.style='position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:85vw;word-break:break-all';
bar.textContent='🎰 ダイナム取得中...';document.body.appendChild(bar);

var today=new Date().toISOString().slice(0,10).replace(/-/g,'');

try{
  // STEP1: 機種一覧取得 (nc-m03-001.php)
  // → 各Ki itemの"php"フィールドに nc-v05-011.php の台ごとデータURLが入っている
  bar.textContent='機種一覧取得中...';
  var r1=await fetch('/h/'+storeCode+'/cgi-bin/nc-m03-001.php?cd_ps=2&dt='+today,{credentials:'include'});
  if(!r1.ok)throw new Error('機種一覧失敗 '+r1.status);
  var d1=await r1.json();
  var ki=d1.Ki||[];

  // ジャグラー系のみ絞り込み
  var jugglers=ki.filter(function(k){
    var mn=k.nmk_kisyu||'';
    return mn.includes('ジャグラー')||mn.includes('ＪａｇＧｌａＲ');
  });
  if(jugglers.length===0)throw new Error('ジャグラーなし ki='+ki.length+'機種');
  bar.textContent='ジャグラー'+jugglers.length+'機種 台データ取得中...';

  // STEP2: 【調査モード】v05-011.php(HTML)が呼ぶデータAPIを発見する
  // nc-v05-011.php はHTML表示ページ。データは別のAPIから読み込まれている
  var allStands=[];
  var v05debug='';

  // 最初のジャグラー機種の詳細ページHTMLを取得
  var jug0=jugglers[0];
  var phpPath0=jug0.php||'';
  bar.textContent='詳細ページ調査中... '+jug0.nmk_kisyu;
  try{
    var ab=new AbortController();setTimeout(()=>ab.abort(),10000);
    var r2=await fetch('/h/'+storeCode+'/cgi-bin/'+phpPath0,{credentials:'include',signal:ab.signal});
    var html=await r2.text();

    // HTML内の全ての .php 参照を抽出（データAPIの候補）
    var phpRefs=[];
    var re=/['"\(]([\w\-\/]*nc-[\w\-]+\.php[^'"\)\s]*)/g, mm;
    while((mm=re.exec(html))!==null){
      var u=mm[1];
      if(phpRefs.indexOf(u)===-1)phpRefs.push(u);
    }
    // ajax/fetch/load などのキーワード周辺のURLも探す
    var re2=/(?:url|ajax|load|src)\s*[:=]\s*['"]([^'"]+\.php[^'"]*)/gi;
    while((mm=re2.exec(html))!==null){
      var u2=mm[1];
      if(phpRefs.indexOf(u2)===-1)phpRefs.push(u2);
    }

    v05debug='len='+html.length+' php参照数='+phpRefs.length+' || '+phpRefs.slice(0,8).join(' ## ');
  }catch(e2){v05debug='catch: '+e2.message;}

  // ── 調査結果を表示（必ず表示してreturn）──
  {
    bar.textContent='🔍 API調査結果...';
    var dk=v05debug;
    setTimeout(function(){bar.textContent='📋①'+dk.slice(0,250);},500);
    setTimeout(function(){bar.textContent='📋②'+dk.slice(250,500);},5000);
    setTimeout(function(){bar.textContent='📋③'+dk.slice(500,750);},10000);
    setTimeout(function(){bar.remove();},20000);
    return; // GitHubへは送らない（調査モード）
  }

  // ── STEP3: completion()を早めに呼ぶ（iOSタイムアウト回避） ──
  // GitHub送信はこの後も非同期で続く（ブラウザはページを保持している）
  if(typeof completion==='function')completion('done');

  // ── STEP4: GitHubに送信 ──
  bar.textContent='📡 '+allStands.length+'台 GitHub送信中...';
  var today2=new Date().toISOString().slice(0,10);
  var msg='データ更新 '+new Date().toLocaleString('ja');

  async function ghGet(path){
    var r=await fetch('https://api.github.com/repos/'+R+'/contents/'+path,{headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json'}});
    if(!r.ok)return{sha:null,data:null};
    var j=await r.json();
    var b64=j.content.replace(/\n/g,'');
    var bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    return{sha:j.sha,data:JSON.parse(new TextDecoder('utf-8').decode(bytes))};
  }
  async function ghPut(path,sha,data,msg){
    var js=JSON.stringify(data,null,2);
    var body={message:msg,content:btoa(unescape(encodeURIComponent(js))),branch:'main'};
    if(sha)body.sha=sha;
    var r=await fetch('https://api.github.com/repos/'+R+'/contents/'+path,{method:'PUT',headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(body)});
    return r.ok;
  }

  // 機種ごとにまとめる
  var mmap={};
  allStands.forEach(function(s){
    var mn=s.machine_name;
    if(!mmap[mn])mmap[mn]=[];
    mmap[mn].push(s);
  });
  var result={name:sname,machines:[]};
  for(var mn in mmap)result.machines.push({machine_name:mn,count:mmap[mn].length,stands:mmap[mn]});

  // stores.json更新
  var s1=await ghGet('docs/data/stores.json');
  var cur=s1.data||{fetched_at:null,stores:{}};
  if(!cur.stores)cur.stores={};
  cur.fetched_at=new Date().toISOString();cur.stores[sid]=result;
  var ok1=await ghPut('docs/data/stores.json',s1.sha,cur,msg);

  // history.json追記
  var s2=await ghGet('docs/data/history.json');
  var hist=s2.data||{};
  var realStands=allStands.filter(function(s){return s.games>0;}).length;
  if(realStands>0){
    if(!hist[today2])hist[today2]={stores:{}};
    if(!hist[today2].stores)hist[today2].stores={};
    hist[today2].stores[sid]=result;
    hist[today2].fetched_at=new Date().toISOString();
    await ghPut('docs/data/history.json',s2.sha,hist,msg);
  }

  if(ok1){bar.style.background='#2d6a4f';bar.textContent='✅ '+sname+' '+allStands.length+'台 送信完了！';}
  else{bar.style.background='#888';bar.textContent='⚠️ GitHub送信失敗';}
}catch(e){bar.style.background='#888';bar.textContent='❌ '+e.message;}
setTimeout(function(){bar.remove();},10000);
})();
