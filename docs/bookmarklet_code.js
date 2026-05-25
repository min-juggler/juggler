(async function(){
var T='__TOKEN__',R='__REPO__';
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

async function push(result){
  var total=result.machines.reduce((a,m)=>a+m.stands.length,0);
  bar.textContent='📡 GitHubへ送信中...('+total+'台)';
  var sha=null,cur={};
  // docs/data/stores.json に書き込む（GitHub Pagesが配信するパス）
  var apiPath='https://api.github.com/repos/'+R+'/contents/docs/data/stores.json';
  try{var er=await fetch(apiPath,{headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json'}});
  if(er.ok){var ej=await er.json();sha=ej.sha;cur=JSON.parse(atob(ej.content.replace(/\n/g,'')));}}catch(e){}
  if(!cur.stores)cur={fetched_at:null,stores:{}};
  cur.fetched_at=new Date().toISOString();cur.stores[sid]=result;
  var js=JSON.stringify(cur,null,2);
  var body={message:'データ更新 '+new Date().toLocaleString('ja'),content:btoa(unescape(encodeURIComponent(js))),branch:'main'};
  if(sha)body.sha=sha;
  var pr=await fetch(apiPath,{method:'PUT',headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(body)});
  if(pr.ok){bar.style.background='#2d6a4f';bar.textContent='✅ '+sname+' '+total+'台 送信完了！';}
  else{bar.style.background='#888';bar.textContent='⚠️ 送信失敗: '+(await pr.text()).slice(0,80);}
}

try{
  var today=new Date().toISOString().slice(0,10);
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
  }

  var encKey=null,encIv=null;

  // ===== STEP1: 現在ページのpropsから機種名取得 =====
  bar.textContent='機種名取得中...';
  var dpEl=document.querySelector('[data-page]');
  if(dpEl){
    try{
      var decoded=decodeDP(dpEl.getAttribute('data-page'));
      var props=JSON.parse(decoded).props||{};
      var data=props.data||{};
      var propsHid=props.hall_id||props.hallId||data.hall_id;
      if(propsHid)hid=parseInt(propsHid);
      // dataの全配列フィールドをスキャン
      for(var dk of Object.keys(data)){
        var dv=data[dk];
        if(Array.isArray(dv))dv.forEach(function(item){
          if(typeof item==='object'&&item)addMn(item.machine_name||item.ki_name||item.ki_mei||item.name||item.kind_name||item.kaki_name);
        });
      }
      // props直下の配列もスキャン
      for(var pk of Object.keys(props)){
        var pv=props[pk];
        if(Array.isArray(pv))pv.forEach(function(item){
          if(typeof item==='object'&&item)addMn(item.machine_name||item.ki_name||item.ki_mei||item.name);
        });
      }
    }catch(e){}
  }

  // ===== STEP2: 機種別ページからAES鍵取得（半角機種名を使用） =====
  // DOM抽出は不正な機種名を混入させるため廃止。seedsのみ使用。
  var seeds=['ﾏｲｼﾞｬｸﾞﾗｰV','ｺﾞｰｺﾞｰｼﾞｬｸﾞﾗｰ3','ﾈｵｱｲﾑｼﾞｬｸﾞﾗｰEX','ｱｲﾑｼﾞｬｸﾞﾗｰEX','ﾌｧﾝｷｰｼﾞｬｸﾞﾗｰEX','ﾏｲｼﾞｬｸﾞﾗｰIII','ﾊｯﾋﾟｰｼﾞｬｸﾞﾗｰ3','ｺﾞｰｺﾞｰｼﾞｬｸﾞﾗｰ2','ｳﾙﾄﾗﾐﾗｸﾙｼﾞｬｸﾞﾗｰV'];
  seeds.forEach(function(s){if(!machineNames.includes(s))machineNames.push(s);});

  var tryForKey=machineNames.slice();
  bar.textContent='鍵取得中... ('+tryForKey.length+'機種試行)';
  for(var si=0;si<tryForKey.length;si++){
    try{
      var sr=await fetch('/'+sid+'/standlist_slot?kind_code='+urlKindCode+'&machine_name='+encodeURIComponent(tryForKey[si]),{credentials:'include'});
      if(!sr.ok)continue;
      var sh=await sr.text();
      var sm2=sh.match(/data-page="([^"]+)"/);
      if(sm2){
        var sp=JSON.parse(decodeDP(sm2[1])).props||{};
        if(sp.data&&sp.data.key){
          encKey=sp.data.key;encIv=sp.data.iv;
          var propsHid2=sp.hall_id||sp.hallId||(sp.data&&sp.data.hall_id);
          if(propsHid2)hid=parseInt(propsHid2);
          break;
        }
      }
    }catch(e){}
  }

  bar.textContent='key='+(encKey?encKey.slice(0,12)+'...':'none')+' hid='+hid+' 機種:'+machineNames.length;
  await new Promise(r=>setTimeout(r,3000));
  if(!encKey){bar.textContent='❌ AES鍵取得失敗';setTimeout(()=>bar.remove(),8000);return;}

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

  // ===== machine_list API URL（/n-api/rack_info/machine_list と判明） =====
  // performanceエントリに実際のURLがあれば優先使用
  var workingUrlBase=null;
  var mlPerfEntry=performance.getEntriesByType('resource').map(function(e){return e.name;}).find(function(u){return u.includes('machine_list');});
  if(mlPerfEntry){
    try{
      var mlU=new URL(mlPerfEntry);
      var bp=new URLSearchParams(mlU.search);
      bp.set('machine_name','__MN__');bp.set('target_date','__DATE__');
      workingUrlBase=mlU.pathname+'?'+bp.toString();
    }catch(e){}
  }
  // デフォルト: 判明済みのURLパスを使用
  if(!workingUrlBase){
    workingUrlBase='/n-api/rack_info/machine_list?hall_id='+hid+'&kind_code='+urlKindCode+'&machine_name=__MN__&target_date=__DATE__&disp=2&place=&history_day=3';
  }

  // ===== 機種ごとにループして全台取得（404はスキップ＝その機種なし） =====
  var allStands=[];
  for(var i=0;i<machineNames.length;i++){
    var mname=machineNames[i];
    bar.textContent='['+(i+1)+'/'+machineNames.length+'] '+mname.slice(0,14)+'...';
    try{
      var mlUrl=workingUrlBase.replace('__MN__',encodeURIComponent(mname)).replace('__DATE__',today);
      var mlR=await fetch(mlUrl,{credentials:'include',headers:{'X-Requested-With':'XMLHttpRequest','Accept':'application/json, text/plain, */*'}});
      if(!mlR.ok)continue;
      var dec=await decryptMl(await mlR.text());
      if(dec){var ss=Array.isArray(dec)?dec:(dec.data||dec.items||Object.values(dec));if(Array.isArray(ss))ss.forEach(s=>allStands.push(s));}
    }catch(e){}
  }

  if(allStands.length===0){bar.textContent='❌ 全台データ取得失敗';setTimeout(()=>bar.remove(),10000);return;}
  var mmap={};
  allStands.forEach(s=>{
    var mn=s.machine_name||s.ki_name||'不明';
    if(!mmap[mn])mmap[mn]=[];
    mmap[mn].push({
      rack_no:String(s.rack_no||s.dai_no||'?'),
      machine_name:mn,
      games:parseInt(s.all_game_count||s.total_games||s.games||0),
      bb:parseInt(s.bonus_1||s.bb_count||s.bb||0),
      rb:parseInt(s.bonus_2||s.rb_count||s.rb||0),
      diff:parseInt(s.substraction||s.diff||s.sa_mai||0)
    });
  });
  var result={name:sname,machines:[]};
  for(var[mn2,sts2]of Object.entries(mmap))result.machines.push({machine_name:mn2,count:sts2.length,stands:sts2});
  bar.textContent='✅ '+allStands.length+'台 機種:'+result.machines.length+' GitHub送信中...';
  await push(result);
}catch(e){bar.style.background='#888';bar.textContent='❌ '+e.message;}
setTimeout(()=>bar.remove(),10000);
})();
