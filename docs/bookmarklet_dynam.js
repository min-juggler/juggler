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
  // 各Ki itemの"php"フィールド = nc-v05-011.php?cd_ps=2&bai=..&nmk_kisyu=.. (機種ごとのクエリ)
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

  // STEP2: 機種ごとに nc-m05-003.php で台データ取得（合算データ）
  // 【調査モード】個別台ページ nc-v06-001.php が呼ぶBB/RBデータAPIを探す
  var allStands=[];
  var v05debug='';
  // 最初の機種から最初の台のcd_daiを取得
  var jug0=jugglers[0];
  var qs0=jug0.php&&jug0.php.indexOf('?')>=0?jug0.php.slice(jug0.php.indexOf('?')):'?cd_ps=2';
  var firstCd='0091';
  try{
    var r3=await fetch('/h/'+storeCode+'/cgi-bin/nc-m05-003.php'+qs0,{credentials:'include'});
    var j3=await r3.json();
    if(j3.Dai&&j3.Dai[0]&&j3.Dai[0].D0&&j3.Dai[0].D0.cd_dai)firstCd=j3.Dai[0].D0.cd_dai;
  }catch(e){}

  try{
    // 個別台ページHTMLを取得
    var rv=await fetch('/h/'+storeCode+'/cgi-bin/nc-v06-001.php?cd_ps=2&cd_dai='+firstCd,{credentials:'include'});
    var html=await rv.text();
    // HTML内の nc-*.php 参照を抽出
    var refs=[];var re=/(nc-[\w\-]+\.php[^'"\)\s<>]*)/g,mm;
    while((mm=re.exec(html))!==null){if(refs.indexOf(mm[1])===-1)refs.push(mm[1]);}
    // data-page や JSON っぽい埋め込みを探す
    var hasDataPage=html.indexOf('data-page')>=0;
    v05debug='cd_dai='+firstCd+' len='+html.length+' data-page='+hasDataPage+' refs='+refs.length+' || '+refs.slice(0,10).join(' ## ');
  }catch(eX){v05debug='catch: '+eX.message;}

  // ── 調査結果表示 ──
  bar.textContent='🔍 v06調査（6枚撮って）...';
  var dk=v05debug;
  setTimeout(function(){bar.textContent='📋①'+dk.slice(0,250);},500);
  setTimeout(function(){bar.textContent='📋②'+dk.slice(250,500);},4500);
  setTimeout(function(){bar.textContent='📋③'+dk.slice(500,750);},9000);
  setTimeout(function(){bar.textContent='📋④'+dk.slice(750,1000);},13500);
  setTimeout(function(){bar.textContent='📋⑤'+dk.slice(1000,1250);},18000);
  setTimeout(function(){bar.textContent='📋⑥'+dk.slice(1250,1500);},22500);
  setTimeout(function(){bar.remove();},27000);
  if(typeof completion==='function')completion('done');
  return;

  // ── completion()を早めに呼ぶ（iOSタイムアウト回避）──
  if(typeof completion==='function')completion('done');

  // ── STEP3: GitHubに送信 ──
  var realStands=allStands.filter(function(s){return s.games>0;}).length;
  bar.textContent='📡 '+allStands.length+'台('+realStands+'稼働) GitHub送信中...';
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
