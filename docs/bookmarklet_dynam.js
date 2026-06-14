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
  // ダイナムはBB/RB内訳なし → 大当り合計(count)と合成確率(ratio)を取得
  // Dai[].D0 = 今日のデータ {cd_dai:台番号, toku0:{count:大当り合計, ratio:合成確率}}
  var allStands=[];
  for(var ji=0;ji<jugglers.length;ji++){
    var jug=jugglers[ji];
    var phpPath=jug.php||'';
    var qs=phpPath.indexOf('?')>=0?phpPath.slice(phpPath.indexOf('?')):'?cd_ps=2';
    bar.textContent='台データ取得中 '+(ji+1)+'/'+jugglers.length+' '+jug.nmk_kisyu;
    try{
      var ab=new AbortController();setTimeout(()=>ab.abort(),8000);
      var r3=await fetch('/h/'+storeCode+'/cgi-bin/nc-m05-003.php'+qs,{credentials:'include',signal:ab.signal});
      if(!r3.ok)continue;
      var t3=await r3.text();
      if(t3[0]!=='{')continue;
      var j3=JSON.parse(t3);
      var dais=j3.Dai||[];
      dais.forEach(function(dai){
        var d0=dai.D0;
        if(!d0)return;
        var rack=String(d0.cd_dai||'?');
        if(/^0\d{3,4}$/.test(rack))rack=String(parseInt(rack));
        var bonus=parseInt((d0.toku0&&d0.toku0.count)||0);
        var prob=parseFloat((d0.toku0&&d0.toku0.ratio)||0); // 合成確率(1/X)
        // ゲーム数 ≒ 大当り合計 × 合成確率
        var games=(bonus>0&&prob>0)?Math.round(bonus*prob):0;
        allStands.push({
          rack_no:rack,
          machine_name:jug.nmk_kisyu||'不明',
          games:games,
          bb:0,rb:0,diff:0,
          total_bonus:bonus,
          combined_prob:prob,   // 合成確率の分母（小さいほど良い）
          combined_only:true     // ダイナムはBB/RB内訳なしの目印
        });
      });
    }catch(e2){}
  }

  if(allStands.length===0)throw new Error('台データ0');

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
