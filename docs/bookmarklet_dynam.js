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
  // STEP1: 機種一覧取得（captcha不要）
  bar.textContent='機種一覧取得中...';
  var r1=await fetch('/h/'+storeCode+'/cgi-bin/nc-m03-002.php?cd_ps=2&pg=0&dt='+today,{credentials:'include'});
  if(!r1.ok)throw new Error('機種一覧取得失敗 '+r1.status);
  var machineList=await r1.json();
  var ki=machineList.Ki||[];
  // ジャグラー系のみ絞り込み
  var jugglers=ki.filter(function(k){return k.nmk_kisyu&&(k.nmk_kisyu.includes('ジャグラー')||k.nmk_kisyu.includes('ＪａｇＧｌａＲ'));});
  bar.textContent='ジャグラー '+jugglers.length+'機種発見 台データ取得中...';
  if(jugglers.length===0)throw new Error('ジャグラーが見つかりません ki='+ki.length+'機種');

  // STEP2: 台データ一括取得（cd_kisyuなし→全台1回で取得してタイムアウト回避）
  var allStands=[];
  var dbgKi0='';
  bar.textContent='台データ一括取得中...';
  try{
    var ab=new AbortController();setTimeout(()=>ab.abort(),12000);
    var rb=await fetch('/h/'+storeCode+'/cgi-bin/nc-m03-001.php?cd_ps=2&dt='+today,{credentials:'include',signal:ab.signal});
    if(!rb.ok)throw new Error('status='+rb.status);
    var tb=await rb.text();
    if(tb.includes('redirect_captcha')){bar.textContent='❌ captcha必要';setTimeout(()=>bar.remove(),8000);return;}
    var db=JSON.parse(tb);
    var kiAll=db.Ki||db.Dai||db.dai||[];
    // Ki[0]の全フィールドをデバッグ用に保存（全長表示）
    if(kiAll[0]){
      dbgKi0='count='+kiAll.length+' keys='+Object.keys(kiAll[0]).join(',')+' | '+JSON.stringify(kiAll[0]);
    }
    // ジャグラーのみ抽出
    var jugKis=kiAll.filter(function(k){var mn=k.nmk_kisyu||k.name||'';return mn.includes('ジャグラー')||mn.includes('ＪａｇＧｌａＲ');});
    bar.textContent='ジャグラー '+jugKis.length+'台 発見';
    jugKis.forEach(function(s){
      var games=parseInt(s.game_su||s.total_game||s.ct_game||s.ct_gyaku||s.games||0);
      var bb=parseInt(s.bb_cnt||s.ct_bonus_1||s.bonus_1||s.ct_bb||s.bb||0);
      var rb=parseInt(s.reg_cnt||s.ct_bonus_2||s.bonus_2||s.ct_rb||s.ct_reg||s.rb||0);
      var diff=parseInt(s.sa_mai||s.diff||s.substraction||0);
      var rack=String(s.no_dai||s.dai_no||s.cd_dai||s.no||s.ct_dai||'?');
      allStands.push({rack_no:rack,machine_name:s.nmk_kisyu||s.name||'不明',games,bb,rb,diff});
    });
  }catch(e2){bar.textContent='❌ 一括取得失敗: '+e2.message;setTimeout(()=>bar.remove(),8000);return;}

  if(allStands.length===0||allStands.every(s=>s.games===0)){
    bar.textContent='⚠️ データ0 フィールド名調査中...';
    // Ki[0]を3段階に分けて全表示
    var dk=dbgKi0||'なし';
    setTimeout(()=>{bar.textContent='📋①'+dk.slice(0,250);},1000);
    setTimeout(()=>{bar.textContent='📋②'+dk.slice(250,500);},6000);
    setTimeout(()=>{bar.textContent='📋③'+dk.slice(500,750);},11000);
    setTimeout(()=>bar.remove(),25000);
    if(allStands.length===0)return;
  }
  // デバッグ: 最初の台データを表示
  setTimeout(()=>{bar.textContent='🔍 stand[0]='+JSON.stringify(allStands[0]);},3000);

  // STEP3: 機種ごとにまとめる
  var mmap={};
  allStands.forEach(function(s){
    var mn=s.machine_name;
    if(!mmap[mn])mmap[mn]=[];
    mmap[mn].push(s);
  });
  var result={name:sname,machines:[]};
  for(var mn in mmap)result.machines.push({machine_name:mn,count:mmap[mn].length,stands:mmap[mn]});

  // STEP4: GitHubに送信
  bar.textContent='📡 GitHub送信中 ('+allStands.length+'台)...';
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

  // stores.json更新
  var s1=await ghGet('docs/data/stores.json');
  var cur=s1.data||{fetched_at:null,stores:{}};
  if(!cur.stores)cur.stores={};
  cur.fetched_at=new Date().toISOString();cur.stores[sid]=result;
  var ok1=await ghPut('docs/data/stores.json',s1.sha,cur,msg);

  // history.json追記
  var s2=await ghGet('docs/data/history.json');
  var hist=s2.data||{};
  var realStands=allStands.filter(s=>s.games>0).length;
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
setTimeout(()=>bar.remove(),10000);
})();
