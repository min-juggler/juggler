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

  // STEP2: 各機種のnc-v05-011.phpで台ごとデータ取得
  // nc-m03-001.phpのKi[n].phpフィールド = "nc-v05-011.php?cd_ps=2&bai=...&nmk_kisyu=..."
  var allStands=[];
  var v05debug='';

  for(var ji=0;ji<jugglers.length;ji++){
    var jug=jugglers[ji];
    var phpPath=jug.php||'';
    if(!phpPath)continue;
    bar.textContent='台データ取得中 '+(ji+1)+'/'+jugglers.length+' '+jug.nmk_kisyu;
    try{
      var ab=new AbortController();setTimeout(()=>ab.abort(),8000);
      var r2=await fetch('/h/'+storeCode+'/cgi-bin/'+phpPath,{credentials:'include',signal:ab.signal});
      var statusCode=r2.status;
      var t2=await r2.text();

      // 最初の機種のレスポンスをデバッグ用に保存（成否問わず）
      if(ji===0){
        v05debug='status='+statusCode+' len='+t2.length+' head='+t2.slice(0,200);
      }

      if(!r2.ok)continue;
      if(t2.includes('redirect_captcha'))continue;
      var d2=JSON.parse(t2);
      var topKeys=Object.keys(d2).join(',');
      var stands=d2.Ki||d2.Dai||d2.dai||d2.Data||d2.data||d2.Stand||d2.stand||[];

      // JSONのトップレベルキーも記録
      if(ji===0){
        v05debug='status='+statusCode+' topKeys='+topKeys+' stands='+stands.length+' | '+JSON.stringify(d2).slice(0,200);
      }

      // standsが空の場合: トップレベルの配列を全キーで探す
      if(stands.length===0){
        for(var k in d2){if(Array.isArray(d2[k])&&d2[k].length>0){stands=d2[k];break;}}
      }

      if(ji===0&&stands[0]){
        v05debug='count='+stands.length+' keys='+Object.keys(stands[0]).join(',')+' | '+JSON.stringify(stands[0]).slice(0,300);
      }

      stands.forEach(function(s){
        // cd_dai: "0101"形式 → parseInt で "101" に変換
        var rack=String(s.cd_dai||s.no_dai||s.dai_no||s.no||'?');
        if(/^0\d{3,4}$/.test(rack))rack=String(parseInt(rack));

        var games=parseInt(s.game_su||s.total_game||s.ct_game||s.games||0);
        var bb=parseInt(s.bb_cnt||s.ct_bb||s.bb||s.ct_bonus_1||s.bonus1||s.big||0);
        var rb=parseInt(s.reg_cnt||s.ct_rb||s.rb||s.ct_bonus_2||s.ct_reg||s.bonus2||s.reg||0);
        var diff=parseInt(s.sa_mai||s.diff||s.substraction||0);
        allStands.push({rack_no:rack,machine_name:jug.nmk_kisyu||'不明',games,bb,rb,diff});
      });
    }catch(e2){if(ji===0)v05debug='catch: '+e2.message;}
  }

  // ── データが全0の場合: nc-v05-011.phpのフィールド名をデバッグ表示 ──
  var hasData=allStands.some(function(s){return s.games>0;});
  if(!hasData&&v05debug){
    bar.textContent='⚠️ データ0 フィールド名確認中...';
    var dk=v05debug;
    setTimeout(function(){bar.textContent='📋①'+dk.slice(0,250);},500);
    setTimeout(function(){bar.textContent='📋②'+dk.slice(250,500);},5000);
    setTimeout(function(){bar.textContent='📋③'+dk.slice(500,750);},10000);
    setTimeout(function(){bar.remove();},20000);
    return; // GitHubへは送らない
  }

  if(allStands.length===0){
    // nc-v05-011.phpのレスポンスを3段階で表示
    var dk=v05debug||'(デバッグ情報なし) phpPath='+jugglers[0]?.php;
    bar.textContent='❌ 台データ0 調査中...';
    setTimeout(function(){bar.textContent='📋①'+dk.slice(0,250);},500);
    setTimeout(function(){bar.textContent='📋②'+dk.slice(250,500);},6000);
    setTimeout(function(){bar.textContent='📋③'+dk.slice(500,750);},11000);
    setTimeout(function(){bar.remove();},20000);
    return;
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
