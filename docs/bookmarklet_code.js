(async function(){
var T='__TOKEN__',R='__REPO__';
// 取得対象日のオフセット（0=今日, -1=昨日）。ローダーが window.__JUG_DAYOFF__ をセットする。
var __OFF=(typeof window!=='undefined'&&typeof window.__JUG_DAYOFF__==='number')?window.__JUG_DAYOFF__:0;
function __baseDate(){var d=new Date();if(__OFF)d.setDate(d.getDate()+__OFF);return d;}

// ===== ダイナム（dynam-data.jp）専用処理 =====
// ※ 個別台のBIG/REGはapikeyが使い捨てトークンのため取得不可。
//   合算データ（大当り合計 count + 合成確率 ratio）のみ取得する。
if(location.href.includes('dynam-data.jp')){
  var dm=location.href.match(/dynam-data\.jp\/h\/([a-z0-9]+)\//);
  if(!dm){alert('ダイナムのページで実行してください');return;}
  var storeCode=dm[1];
  var DSTORES={'a725254':{sid:'dynam_yonezawa',name:'ダイナム米沢店'},'a736724':{sid:'dynam_tendo',name:'ダイナム天童店'}};
  var dinfo=DSTORES[storeCode]||{sid:'dynam_'+storeCode,name:'ダイナム'+storeCode};
  var dsid=dinfo.sid, dsname=dinfo.name;
  var bar=document.createElement('div');
  bar.style='position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:85vw;word-break:break-all';
  bar.textContent='🎰 ダイナム取得中...';document.body.appendChild(bar);
  var dToday=__baseDate().toISOString().slice(0,10).replace(/-/g,'');
  try{
    // STEP1: 機種一覧取得 (nc-m03-001.php)
    bar.textContent='機種一覧取得中...';
    var r1=await fetch('/h/'+storeCode+'/cgi-bin/nc-m03-001.php?cd_ps=2&dt='+dToday,{credentials:'include'});
    if(!r1.ok)throw new Error('機種一覧失敗 '+r1.status);
    var d1=await r1.json();
    var ki=d1.Ki||[];
    // ジャグラー系のみ絞り込み
    var jugglers=ki.filter(function(k){var mn=k.nmk_kisyu||'';return mn.includes('ジャグラー')||mn.includes('ＪａｇＧｌａＲ');});
    if(jugglers.length===0)throw new Error('ジャグラーなし ki='+ki.length+'機種');
    // STEP2: 機種ごとに nc-m05-003.php で台データ取得（合算データ）
    var dAllStands=[];
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
          var games=(bonus>0&&prob>0)?Math.round(bonus*prob):0;
          dAllStands.push({rack_no:rack,machine_name:jug.nmk_kisyu||'不明',games:games,bb:0,rb:0,diff:0,total_bonus:bonus,combined_prob:prob,combined_only:true});
        });
      }catch(e2){}
    }
    if(dAllStands.length===0)throw new Error('台データ0');
    // 機種ごとにまとめる
    var dMap={};
    dAllStands.forEach(function(s){var mn=s.machine_name;if(!dMap[mn])dMap[mn]=[];dMap[mn].push(s);});
    var dResult={name:dsname,machines:[]};
    for(var dmn in dMap)dResult.machines.push({machine_name:dmn,count:dMap[dmn].length,stands:dMap[dmn]});
    bar.textContent='✅ '+dAllStands.length+'台 GitHub送信中...';
    if(typeof completion==='function')completion('done');
    await push(dResult,dsid,dsname);
  }catch(e){bar.style.background='#888';bar.textContent='❌ '+e.message;}
  setTimeout(()=>bar.remove(),12000);
  return;
}

var sid=location.href.includes('yonezawa')?'yonezawa':location.href.includes('kaminoyama')?'kaminoyama':null;
if(!sid){alert('店舗サイトで実行してください');return;}
var sname={yonezawa:'アイランド米沢店',kaminoyama:'1円劇場上山店'}[sid];
var hid={yonezawa:292,kaminoyama:1303}[sid];
var bar=document.createElement('div');
bar.style='position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:85vw;word-break:break-all';
bar.textContent='🎰 v10 起動中...';document.body.appendChild(bar);

// 全角カタカナ→半角カタカナ変換（APIが半角を要求するため必須）
function fw2hw(s){
  var m={'ア':'ｱ','イ':'ｲ','ウ':'ｳ','エ':'ｴ','オ':'ｵ','カ':'ｶ','キ':'ｷ','ク':'ｸ','ケ':'ｹ','コ':'ｺ',
    'サ':'ｻ','シ':'ｼ','ス':'ｽ','セ':'ｾ','ソ':'ｿ','タ':'ﾀ','チ':'ﾁ','ツ':'ﾂ','テ':'ﾃ','ト':'ﾄ',
    'ナ':'ﾅ','ニ':'ﾆ','ヌ':'ﾇ','ネ':'ﾈ','ノ':'ﾉ','ハ':'ﾊ','ヒ':'ﾋ','フ':'ﾌ','ヘ':'ﾍ','ホ':'ﾎ',
    'マ':'ﾏ','ミ':'ﾐ','ム':'ﾑ','メ':'ﾒ','モ':'ﾓ','ヤ':'ﾔ','ユ':'ﾕ','ヨ':'ﾖ',
    'ラ':'ﾗ','リ':'ﾘ','ル':'ﾙ','レ':'ﾚ','ロ':'ﾛ','ワ':'ﾜ','ヲ':'ｦ','ン':'ﾝ',
    'ァ':'ｧ','ィ':'ｨ','ゥ':'ｩ','ェ':'ｪ','ォ':'ｫ','ッ':'ｯ','ャ':'ｬ','ュ':'ｭ','ョ':'ｮ','ー':'ｰ',
    'ガ':'ｶﾞ','ギ':'ｷﾞ','グ':'ｸﾞ','ゲ':'ｹﾞ','ゴ':'ｺﾞ','ザ':'ｻﾞ','ジ':'ｼﾞ','ズ':'ｽﾞ','ゼ':'ｾﾞ','ゾ':'ｿﾞ',
    'ダ':'ﾀﾞ','ヂ':'ﾁﾞ','ヅ':'ﾂﾞ','デ':'ﾃﾞ','ド':'ﾄﾞ','バ':'ﾊﾞ','ビ':'ﾋﾞ','ブ':'ﾌﾞ','ベ':'ﾍﾞ','ボ':'ﾎﾞ',
    'パ':'ﾊﾟ','ピ':'ﾋﾟ','プ':'ﾌﾟ','ペ':'ﾍﾟ','ポ':'ﾎﾟ','ヴ':'ｳﾞ','　':' '};
  return s.split('').map(c=>m[c]||c).join('');
}

// JSON unicode escapeをデコード（ﾏ→ﾏ）
function jsonUnescape(s){
  if(!s.includes('\\u'))return s;
  try{return JSON.parse('"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\\\\u/g,'\\u')+'"');}catch(e){return s;}
}

// GitHub APIでファイルを読み書きするヘルパー
// ※ Contents APIは1MB超のファイルでcontentが空になるため、その場合はraw URLから取得
async function ghGet(path){
  var sha=null,data=null;
  var r=await fetch('https://api.github.com/repos/'+R+'/contents/'+path,{headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json'}});
  if(r.ok){
    var j=await r.json();
    sha=j.sha;
    try{
      if(j.content){
        var b64=j.content.replace(/\n/g,'');
        var bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
        data=JSON.parse(new TextDecoder('utf-8').decode(bytes));
      }
    }catch(e){data=null;}
  }
  // 1MB超だとContents APIは403でsha未取得 → ディレクトリ一覧からshaを取得
  if(sha===null){
    try{
      var parts=path.split('/'),fname=parts.pop(),dir=parts.join('/');
      var dr=await fetch('https://api.github.com/repos/'+R+'/contents/'+dir,{headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json'}});
      if(dr.ok){var arr=await dr.json();if(Array.isArray(arr)){var f=arr.find(function(x){return x.name===fname;});if(f)sha=f.sha;}}
    }catch(e){}
  }
  // contentが空(1MB超) → raw URLから本体を取得
  if(data===null){
    try{
      var rr=await fetch('https://raw.githubusercontent.com/'+R+'/main/'+path+'?_='+Date.now(),{cache:'no-store'});
      if(rr.ok){var tx=await rr.text();if(tx)data=JSON.parse(tx);}
    }catch(e){}
  }
  return{sha:sha,data:data};
}
async function ghPut(path,sha,data,msg){
  var js=path.indexOf('history')>=0?JSON.stringify(data):JSON.stringify(data,null,2); // historyは圧縮
  var body={message:msg,content:btoa(unescape(encodeURIComponent(js))),branch:'main'};
  if(sha)body.sha=sha;
  var r=await fetch('https://api.github.com/repos/'+R+'/contents/'+path,{method:'PUT',headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(body)});
  return r.ok;
}

async function push(result,_sid,_sname){
  // 引数なしの場合はクロージャの sid/sname を使う（テラモバ用後方互換）
  var _s=_sid||sid, _n=_sname||sname;
  var total=result.machines.reduce((a,m)=>a+m.stands.length,0);
  var today=__baseDate().toISOString().slice(0,10);
  var msg='データ更新 '+new Date().toLocaleString('ja')+(__OFF?' (対象日:'+today+')':'');

  // ① stores.json（当日データ）を更新
  // ※過去日(__OFF!==0)の取得では「今日のスナップショット」を汚さないよう更新しない
  var ok1=true;
  if(!__OFF){
    bar.textContent='📡 stores.json 送信中...('+total+'台)';
    var s1=await ghGet('docs/data/stores.json');
    var cur=s1.data||{fetched_at:null,stores:{}};
    if(!cur.stores)cur.stores={};
    cur.fetched_at=new Date().toISOString();
    cur.stores[_s]=result;
    ok1=await ghPut('docs/data/stores.json',s1.sha,cur,msg);
  }

  // ② history.json（日別蓄積）に当日分を追記
  bar.textContent='📡 history.json 追記中...';
  var s2=await ghGet('docs/data/history.json');
  var hist=s2.data||{};
  var realStands=result.machines.reduce((a,m)=>a+m.stands.filter(s=>s.games>0).length,0);
  if(realStands>0){
    if(!hist[today])hist[today]={stores:{}};
    if(!hist[today].stores)hist[today].stores={};
    hist[today].stores[_s]=result;
    hist[today].fetched_at=new Date().toISOString();
  }
  var ok2=realStands>0?await ghPut('docs/data/history.json',s2.sha,hist,msg):true;

  var dlabel=__OFF?('['+today+'] '):'';
  if(ok1&&ok2){bar.style.background='#2d6a4f';bar.textContent='✅ '+dlabel+_n+' '+total+'台 送信完了！(履歴も保存)';}
  else if(ok1){bar.style.background='#2d6a4f';bar.textContent='✅ '+dlabel+_n+' '+total+'台 送信完了 (履歴保存失敗)';}
  else{bar.style.background='#888';bar.textContent='⚠️ '+dlabel+'送信失敗';}
}

try{
  var today=__baseDate().toISOString().slice(0,10);
  var urlKindCode=new URLSearchParams(location.search).get('kind_code')||'Z';

  function h2b(h){var b=new Uint8Array(h.length/2);for(var i=0;i<h.length;i+=2)b[i/2]=parseInt(h.substr(i,2),16);return b;}
  function decodeDP(raw){return raw.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n));}

  // 機種名リスト（半角カタカナ正規化済みのみ保持）
  var machineNames=[];
  function addMn(mn){
    if(!mn)return;
    mn=String(mn).trim();
    if(!mn)return;
    // JSON unicodeエスケープを解除
    mn=jsonUnescape(mn);
    // 全角→半角変換
    mn=fw2hw(mn);
    // 半角カタカナか英数字を含むもののみ（ゴミ除外）
    if(!/[ｦ-ﾟA-Za-z0-9]/.test(mn))return;
    if(!machineNames.includes(mn))machineNames.push(mn);
    // 「S ﾈｵｱｲﾑｼﾞｬｸﾞﾗｰEX KK⑱」→「ﾈｵｱｲﾑｼﾞｬｸﾞﾗｰEX」のように
    // 先頭の1文字+スペース と 末尾のKK/KT/KA等サフィックスを除いた短縮名も追加
    var s=mn.replace(/^[A-Za-z]\s+/,'').replace(/\s+[A-Z]{2,3}\S*$/,'').trim();
    if(s&&s!==mn&&/[ｦ-ﾟA-Za-z0-9]/.test(s)&&!machineNames.includes(s))machineNames.push(s);
  }

  var encKey=null,encIv=null;

  // ===== STEP1: 現在ページのpropsとDOMから機種名取得 =====
  bar.textContent='機種名取得中...';
  var dpEl=document.querySelector('[data-page]');
  if(dpEl){
    try{
      var decoded=decodeDP(dpEl.getAttribute('data-page'));
      var props=JSON.parse(decoded).props||{};
      var data=props.data||{};
      var propsHid=props.hall_id||props.hallId||data.hall_id;
      if(propsHid)hid=parseInt(propsHid);
      // dataの全配列フィールドをスキャン（ネスト含む）
      function scanForMachineNames(obj,depth){
        if(!obj||depth>3)return;
        if(Array.isArray(obj)){
          obj.forEach(function(item){
            if(typeof item==='object'&&item)addMn(item.machine_name||item.ki_name||item.ki_mei||item.name||item.kind_name||item.kaki_name||item.title);
            if(typeof item==='object'&&item)scanForMachineNames(item,depth+1);
          });
        } else if(typeof obj==='object'){
          Object.values(obj).forEach(function(v){if(Array.isArray(v))scanForMachineNames(v,depth+1);});
        }
      }
      scanForMachineNames(data,0);
      scanForMachineNames(props,0);
    }catch(e){}
  }
  // DOMから直接「ジャグラー」含む機種名を抽出（機種名検索ページ対応）
  try{
    // テーブルセルやリンクから機種名テキストを取得
    var domTexts=new Set();
    document.querySelectorAll('td,th,a,li,.kind-name,[class*="kind"],[class*="machine"],[class*="kika"]').forEach(function(el){
      var t=el.firstChild&&el.firstChild.nodeType===3?el.firstChild.textContent.trim():el.textContent.trim();
      if(t)domTexts.add(t);
    });
    domTexts.forEach(function(t){
      if(t.includes('ジャグラー')||t.includes('ｼﾞｬｸﾞﾗｰ'))addMn(t);
    });
  }catch(e){}

  // ===== STEP2: 機種別ページからAES鍵取得（半角機種名を使用） =====
  // DOM抽出は不正な機種名を混入させるため廃止。seedsのみ使用。
  var seeds=[
    // よく設置される機種（米沢・上山共通）
    'ﾏｲｼﾞｬｸﾞﾗｰV','ﾏｲｼﾞｬｸﾞﾗｰIII','ﾏｲｼﾞｬｸﾞﾗｰIV',
    'ｺﾞｰｺﾞｰｼﾞｬｸﾞﾗｰ3','ｺﾞｰｺﾞｰｼﾞｬｸﾞﾗｰ2',
    'ﾈｵｱｲﾑｼﾞｬｸﾞﾗｰEX','ｱｲﾑｼﾞｬｸﾞﾗｰEX',
    'ﾌｧﾝｷｰｼﾞｬｸﾞﾗｰEX','ﾌｧﾝｷｰｼﾞｬｸﾞﾗｰ2',  // ←追加
    'ﾊｯﾋﾟｰｼﾞｬｸﾞﾗｰ3','ﾊｯﾋﾟｰｼﾞｬｸﾞﾗｰV','ﾊｯﾋﾟｰｼﾞｬｸﾞﾗｰII',
    'ｳﾙﾄﾗﾐﾗｸﾙｼﾞｬｸﾞﾗｰV','ｳﾙﾄﾗﾐﾗｸﾙｼﾞｬｸﾞﾗｰ',  // ←Vなしも追加
    'ﾐｽﾀｰｼﾞｬｸﾞﾗｰ','ﾐｽﾀｰｼﾞｬｸﾞﾗｰ2',  // ←追加
  ];
  seeds.forEach(function(s){if(!machineNames.includes(s))machineNames.push(s);});

  var tryForKey=machineNames.slice();
  bar.textContent='鍵取得中... ('+tryForKey.length+'機種試行)';
  var dbgStep2={ok:0,nodp:0,nokey:0,lastUrl:'',lastKeys:''};
  for(var si=0;si<tryForKey.length;si++){
    try{
      var slUrl2='/'+sid+'/standlist_slot?kind_code='+urlKindCode+'&machine_name='+encodeURIComponent(tryForKey[si]);
      var sr=await fetch(slUrl2,{credentials:'include'});
      if(!sr.ok)continue;
      dbgStep2.ok++;dbgStep2.lastUrl=tryForKey[si].slice(0,12);
      var sh=await sr.text();
      var sm2=sh.match(/data-page="([^"]+)"/);
      if(!sm2){dbgStep2.nodp++;continue;}
      var sp=JSON.parse(decodeDP(sm2[1])).props||{};
      if(sp.data&&sp.data.key){
        encKey=sp.data.key;encIv=sp.data.iv;
        var propsHid2=sp.hall_id||sp.hallId||(sp.data&&sp.data.hall_id);
        if(propsHid2)hid=parseInt(propsHid2);
        break;
      } else {
        dbgStep2.nokey++;
        if(dbgStep2.nokey===1)dbgStep2.lastKeys=Object.keys(sp.data||{}).join(',').slice(0,40);
      }
    }catch(e){}
  }

  bar.textContent='key='+(encKey?encKey.slice(0,12)+'...':'none')+' hid='+hid+' 試行:'+tryForKey.length;
  await new Promise(r=>setTimeout(r,2000));
  if(!encKey){
    bar.textContent='❌ AES鍵取得失敗 ok='+dbgStep2.ok+' nodp='+dbgStep2.nodp+' nokey='+dbgStep2.nokey;
    setTimeout(()=>{bar.textContent='🔍 最後の200URL機種:'+dbgStep2.lastUrl+' sp.data.keys='+dbgStep2.lastKeys;},4000);
    setTimeout(()=>bar.remove(),15000);return;
  }

  // ===== 復号ヘルパー =====
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

  // ===== machine_list API URL（フォールバック用） =====
  var mlUrlBases=[
    '/n-api/rack_info/machine_list?hall_id='+hid+'&kind_code='+urlKindCode+'&machine_name=__MN__&target_date=__DATE__&disp=1',
    '/n-api/rack_info/machine_list?hall_id='+hid+'&kind_code='+urlKindCode+'&machine_name=__MN__&target_date=__DATE__&disp=2&place=&history_day=3',
  ];
  // performanceエントリに実際のURLがあれば先頭に追加
  var mlPerfEntry=performance.getEntriesByType('resource').map(function(e){return e.name;}).find(function(u){return u.includes('machine_list');});
  if(mlPerfEntry){try{var mlU=new URL(mlPerfEntry);var bp=new URLSearchParams(mlU.search);bp.set('machine_name','__MN__');bp.set('target_date','__DATE__');mlUrlBases.unshift(mlU.pathname+'?'+bp.toString());}catch(e){}}

  // standlistページから直接台データを取る関数
  async function fetchStandsFromPage(mn){
    var slUrl='/'+sid+'/standlist_slot?kind_code='+urlKindCode+'&machine_name='+encodeURIComponent(mn);
    var slR=await fetch(slUrl,{credentials:'include'});
    if(!slR.ok)return null;
    var slTxt=await slR.text();
    var slM=slTxt.match(/data-page="([^"]+)"/);
    if(!slM)return null;
    var slPr=JSON.parse(decodeDP(slM[1])).props||{};
    var slDat=slPr.data||{};
    // 直接配列フィールド（machine_name_encを持つ機種リストは除外）
    for(var af of ['stand_list','stands','list','items','slot_list','dai_list']){
      if(Array.isArray(slDat[af])&&slDat[af].length>0){
        var f0=slDat[af][0];
        // machine_name_encがある = 機種リスト → スキップ
        if(typeof f0==='object'&&f0!==null&&f0.machine_name_enc)continue;
        return{src:'page.'+af,data:slDat[af]};
      }
    }
    // 暗号化フィールド → 復号
    for(var cf of ['cipher','content','encrypted','stand_data','list_data']){
      if(slDat[cf]){var d=await decryptMl(String(slDat[cf]));if(d)return{src:'page.dec.'+cf,data:d};}
    }
    // slDat全体を復号試み（key/iv以外のフィールドを暗号文として）
    var keys2=Object.keys(slDat).filter(k=>k!=='key'&&k!=='iv'&&k!=='hall_id');
    for(var k2 of keys2){
      if(typeof slDat[k2]==='string'&&slDat[k2].length>30){
        var d2=await decryptMl(slDat[k2]);
        if(d2)return{src:'page.dec.'+k2,data:d2,slKeys:Object.keys(slDat).join(',')};
      }
    }
    // 機種リスト配列（machine_name_enc持つ）から機種名を補充してmachineNamesに追加
    for(var xk of Object.keys(slDat)){
      if(Array.isArray(slDat[xk])&&slDat[xk].length>0&&slDat[xk][0]&&slDat[xk][0].machine_name_enc){
        slDat[xk].forEach(function(item){
          // machine_name_enc からURLデコードして機種名取得
          try{addMn(decodeURIComponent(item.machine_name_enc.replace(/\+/g,' ')));}catch(e){}
          if(item.machine_name)addMn(item.machine_name);
        });
      }
    }
    return{src:'page.nodata',data:null,slKeys:Object.keys(slDat).join(',')};
  }

  // machine_name_encを含む配列（機種リスト）かどうか判定 + 機種名補充
  function extractMachineList(arr){
    if(!Array.isArray(arr)||arr.length===0)return false;
    var f=arr[0];
    if(typeof f!=='object'||f===null||!f.machine_name_enc)return false;
    arr.forEach(function(item){
      try{addMn(decodeURIComponent((item.machine_name_enc||'').replace(/\+/g,' ')));}catch(e){}
      if(item.machine_name)addMn(item.machine_name);
    });
    return true;
  }

  // ===== 事前に「全機種一括」URLを試みる（machine_name省略で全台取得できる場合がある） =====
  var allStands=[];
  var dbgOk=0,dbgDec=0,dbgSample='';
  var bulkDone=false;
  for(var kc of [urlKindCode,'S','Z','P']){
    if(bulkDone)break;
    for(var dp of [1,2,3]){
      var bUrl='/n-api/rack_info/machine_list?hall_id='+hid+'&kind_code='+kc+'&machine_name=&target_date='+today+'&disp='+dp;
      try{
        var bR=await fetch(bUrl,{credentials:'include',headers:{'X-Requested-With':'XMLHttpRequest','Accept':'application/json, text/plain, */*'}});
        if(!bR.ok)continue;
        var bTxt=await bR.text();
        var bDec=await decryptMl(bTxt);
        if(!bDec)continue;
        if(Array.isArray(bDec)&&bDec.length===0)continue;
        if(extractMachineList(Array.isArray(bDec)?bDec:null))continue;
        if(!Array.isArray(bDec)&&typeof bDec==='object'){
          var isBulkMl=false;
          for(var _bv of Object.values(bDec)){if(extractMachineList(_bv)){isBulkMl=true;break;}}
          if(isBulkMl)continue;
          if(Object.keys(bDec).length===1&&bDec.sum!==undefined)continue;
        }
        // 有効データあり→一括処理
        bar.textContent='✅ 一括取得成功 kc='+kc+' disp='+dp;
        var bArr=Array.isArray(bDec)?bDec:null;
        if(!bArr){
          for(var _bv2 of Object.values(bDec)){if(Array.isArray(_bv2)&&_bv2.length>0){bArr=_bv2;break;}}
        }
        if(!bArr){var nk=Object.keys(bDec).filter(k=>!isNaN(parseInt(k)));if(nk.length>0){bArr=nk.sort((a,b)=>parseInt(a)-parseInt(b)).map(k=>bDec[k]).filter(v=>typeof v==='object'&&v!==null);}}
        if(bArr&&!extractMachineList(bArr)){
          bArr.forEach(s=>{if(typeof s==='object'&&s!==null&&!s.machine_name_enc){allStands.push(s);}});
          dbgDec++;dbgOk++;
          dbgSample='bulk kc='+kc+' disp='+dp+' n='+allStands.length;
          bulkDone=true;break;
        }
      }catch(e){}
    }
  }
  if(!bulkDone)bar.textContent='一括取得なし→機種別ループへ hid='+hid;
  await new Promise(r=>setTimeout(r,500));

  // ===== 機種ごとにループして全台取得 =====
  if(!bulkDone)for(var i=0;i<machineNames.length;i++){
    var mname=machineNames[i];
    bar.textContent='['+(i+1)+'/'+machineNames.length+'] '+mname.slice(0,14)+'...';
    try{
      var dec=null,decSrc='';
      // ① machine_list API を優先（米沢で実績あり）
      for(var mlBase of mlUrlBases){
        var mlUrl=mlBase.replace('__MN__',encodeURIComponent(mname)).replace('__DATE__',today);
        var mlR=await fetch(mlUrl,{credentials:'include',headers:{'X-Requested-With':'XMLHttpRequest','Accept':'application/json, text/plain, */*'}});
        if(!mlR.ok)continue;
        dbgOk++;
        var rawTxt=await mlR.text();
        var dTmp=await decryptMl(rawTxt);
        if(!dTmp)continue;
        // 空配列はスキップ（disp=1が空を返す場合→disp=2を試す）
        if(Array.isArray(dTmp)&&dTmp.length===0)continue;
        // 配列 or オブジェクト内の配列が機種リストなら補充してスキップ
        var isMl=extractMachineList(Array.isArray(dTmp)?dTmp:null);
        if(!isMl&&!Array.isArray(dTmp)){
          for(var _vv of Object.values(dTmp)){isMl=extractMachineList(_vv);if(isMl)break;}
        }
        if(isMl)continue;
        // {"sum":...}のみ → デバッグ記録してスキップ
        if(!Array.isArray(dTmp)&&Object.keys(dTmp).length===1&&dTmp.sum!==undefined){
          if(dbgSample==='')dbgSample='sumOnly url='+mlUrl.slice(0,80)+' raw='+rawTxt.slice(0,60);
          continue;
        }
        dec=dTmp;decSrc='api';break;
      }
      // ② APIで取れなければ standlist_slot ページから試みる
      if(!dec){
        var pgRes=await fetchStandsFromPage(mname);
        if(pgRes&&pgRes.data){dec=pgRes.data;decSrc=pgRes.src;}
        else if(pgRes&&pgRes.slKeys&&dbgSample==='')dbgSample='slDat.keys='+pgRes.slKeys;
      }
      if(dec){
        dbgDec++;
        var ss=Array.isArray(dec)?dec:(dec.data||dec.items||null);
        if(!ss){
          for(var _v of Object.values(dec)){
            if(extractMachineList(_v))continue;
            if(Array.isArray(_v)&&_v.length>0){ss=_v;break;}
          }
        }
        // {"0":{台},"1":{台},...,"sum":{}} 形式（数値キーオブジェクト）を配列に変換
        if(!ss&&!Array.isArray(dec)&&typeof dec==='object'){
          var numKeys=Object.keys(dec).filter(k=>!isNaN(parseInt(k)));
          if(numKeys.length>0){
            ss=numKeys.sort(function(a,b){return parseInt(a)-parseInt(b);}).map(function(k){return dec[k];}).filter(function(v){return typeof v==='object'&&v!==null;});
          }
        }
        // ssが機種リストなら除外
        if(ss&&extractMachineList(ss)){ss=null;}
        if(dbgDec===1){
          var kinfo=Array.isArray(dec)?'array['+dec.length+']':Object.keys(dec).map(k=>{var v=dec[k];return k+':'+(Array.isArray(v)?'arr['+v.length+']':typeof v);}).join(',');
          dbgSample='src='+decSrc+' '+kinfo;
        }
        if(Array.isArray(ss))ss.forEach(s=>{
          if(typeof s==='object'&&s!==null&&!s.machine_name_enc){
            if(!s.machine_name&&!s.ki_name&&!s.ki_mei)s.machine_name=mname;
            allStands.push(s);
          }
        });
      }
    }catch(e){}
  }

  if(allStands.length===0){
    bar.textContent='❌ 全台データ取得失敗 ok='+dbgOk+' dec='+dbgDec;
    if(dbgSample)setTimeout(()=>{bar.textContent='🔍 dec例: '+dbgSample;},4000);
    setTimeout(()=>bar.remove(),15000);return;
  }
  var mmap={};
  allStands.forEach(s=>{
    var mn=s.machine_name||s.ki_name||s.ki_mei||s.name||s.kind_name||s.kaki_name||'不明';
    if(!mmap[mn])mmap[mn]=[];
    mmap[mn].push({
      rack_no:String(s.rack_no||s.dai_no||s.slot_no||s.stand_no||s.dai_bangou||s.no||s.id||'?'),
      machine_name:mn,
      games:parseInt(s.all_game_count||s.total_games||s.games||s.game_count||s.play_count||s.game_su||0),
      bb:parseInt(s.bonus_1||s.bb_count||s.bb||0),
      rb:parseInt(s.bonus_2||s.rb_count||s.rb||0),
      diff:parseInt(s.substraction||s.diff||s.sa_mai||0)
    });
  });
  var result={name:sname,machines:[]};
  for(var[mn2,sts2]of Object.entries(mmap))result.machines.push({machine_name:mn2,count:sts2.length,stands:sts2});
  bar.textContent='✅ '+allStands.length+'台(試行'+machineNames.length+'機種) GitHub送信中...';
  // iOSショートカットのタイムアウト回避: 送信前にcompletion()を呼ぶ
  // (ページは生きたままなので送信は裏で完走する)
  if(typeof completion==='function')completion('done');
  await push(result);
}catch(e){bar.style.background='#888';bar.textContent='❌ '+e.message;}
setTimeout(()=>bar.remove(),10000);
})();
