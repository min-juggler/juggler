(async function(){
var T='__TOKEN__',R='__REPO__';
var sid=location.href.includes('yonezawa')?'yonezawa':location.href.includes('kaminoyama')?'kaminoyama':null;
if(!sid){alert('店舗サイトで実行してください');return;}
var sname={yonezawa:'アイランド米沢店',kaminoyama:'1円劇場上山店'}[sid];
var hid={yonezawa:292,kaminoyama:1303}[sid];
var bar=document.createElement('div');
bar.style='position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:85vw;word-break:break-all';
bar.textContent='🎰 v7 データ取得中...';document.body.appendChild(bar);
async function push(result){
  var total=result.machines.reduce((a,m)=>a+m.stands.length,0);
  bar.textContent='📡 GitHubへ送信中...('+total+'台)';
  var sha=null,cur={};
  try{var er=await fetch('https://api.github.com/repos/'+R+'/contents/data/stores.json',{headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json'}});
  if(er.ok){var ej=await er.json();sha=ej.sha;cur=JSON.parse(atob(ej.content.replace(/\n/g,'')));}}catch(e){}
  if(!cur.stores)cur={fetched_at:null,stores:{}};
  cur.fetched_at=new Date().toISOString();cur.stores[sid]=result;
  var js=JSON.stringify(cur,null,2);
  var body={message:'データ更新 '+new Date().toLocaleString('ja'),content:btoa(unescape(encodeURIComponent(js))),branch:'main'};
  if(sha)body.sha=sha;
  var pr=await fetch('https://api.github.com/repos/'+R+'/contents/data/stores.json',{method:'PUT',headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(body)});
  if(pr.ok){bar.style.background='#2d6a4f';bar.textContent='✅ '+sname+' '+total+'台 送信完了！';}
  else{bar.style.background='#888';bar.textContent='⚠️ 送信失敗: '+(await pr.text()).slice(0,80);}
}
try{
  var today=new Date().toISOString().slice(0,10);
  var urlKindCode=new URLSearchParams(location.search).get('kind_code')||'Z';

  function h2b(h){var b=new Uint8Array(h.length/2);for(var i=0;i<h.length;i+=2)b[i/2]=parseInt(h.substr(i,2),16);return b;}
  function decodeDP(raw){return raw.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n));}

  // STEP1: 種別一覧ページを取得して機種名をリンクから全抽出
  bar.textContent='機種一覧取得中...';
  var machineNames=[];
  var encKey=null,encIv=null,rawDP='';

  var kindHtml='';
  try{
    var kr=await fetch('/'+sid+'/standlist_slot?kind_code='+urlKindCode,{credentials:'include'});
    kindHtml=await kr.text();
  }catch(e){}

  // リンク href から machine_name= を全抽出
  var addMn=function(mn){if(mn&&mn.trim()&&!machineNames.includes(mn))machineNames.push(mn);};
  var linkRe=/[?&]machine_name=([^"&\s<>#]+)/g,lm;
  while((lm=linkRe.exec(kindHtml))!==null)addMn(decodeURIComponent(lm[1]));

  // data-page propsからも試みる
  var dpM=kindHtml.match(/data-page="([^"]+)"/);
  if(dpM){
    try{
      var klProps=JSON.parse(decodeDP(dpM[1])).props||{};
      var propsHid=klProps.hall_id||klProps.hallId||(klProps.data&&klProps.data.hall_id);
      if(propsHid)hid=parseInt(propsHid);
      // propsのdata.keyがあれば鍵も取得
      if(klProps.data&&klProps.data.key){encKey=klProps.data.key;encIv=klProps.data.iv;rawDP=decodeDP(dpM[1]);}
      // 機種名リスト候補
      var klList=klProps.kind_list||klProps.machine_list||(klProps.data&&(klProps.data.kind_list||klProps.data.machines||klProps.data.machine_list))||[];
      if(Array.isArray(klList))klList.forEach(m=>{addMn(m.machine_name||m.ki_name||m.name||m.ki_mei);});
    }catch(e){}
  }

  bar.textContent='機種名候補: '+machineNames.length+'件 | 鍵取得中...';
  await new Promise(r=>setTimeout(r,1500));

  // STEP2: 鍵がまだなければ最初の機種のページから取得
  if(!encKey&&machineNames.length>0){
    for(var si=0;si<Math.min(machineNames.length,5);si++){
      try{
        var sr=await fetch('/'+sid+'/standlist_slot?kind_code='+urlKindCode+'&machine_name='+encodeURIComponent(machineNames[si]),{credentials:'include'});
        var sh=await sr.text();
        var sm2=sh.match(/data-page="([^"]+)"/);
        if(sm2){
          var sp=JSON.parse(decodeDP(sm2[1])).props||{};
          if(sp.data&&sp.data.key){encKey=sp.data.key;encIv=sp.data.iv;rawDP=decodeDP(sm2[1]);break;}
        }
      }catch(e){}
    }
  }

  // rawDPから追加の機種名抽出
  if(rawDP){
    [...rawDP.matchAll(/"machine_name"\s*:\s*"([^"]+)"/g)].forEach(m=>addMn(m[1]));
    [...rawDP.matchAll(/"ki_name"\s*:\s*"([^"]+)"/g)].forEach(m=>addMn(m[1]));
  }

  // performance API からも取得
  performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('machine_list')).forEach(u=>{
    try{addMn(new URL(u).searchParams.get('machine_name'));}catch(e){}
  });
  // 現ページのリンクからも
  document.querySelectorAll('a[href*="machine_name"]').forEach(a=>{
    try{addMn(new URL(a.href).searchParams.get('machine_name'));}catch(e){}
  });

  bar.textContent='key='+(encKey?encKey.slice(0,16)+'...':'none')+' iv='+(encIv!=null?String(encIv).slice(0,24):'null')+' hid='+hid+' 機種:'+machineNames.length;
  await new Promise(r=>setTimeout(r,3000));

  if(!encKey){bar.textContent='❌ AES鍵取得失敗';setTimeout(()=>bar.remove(),8000);return;}
  if(machineNames.length===0){bar.textContent='❌ 機種名取得失敗';setTimeout(()=>bar.remove(),8000);return;}

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
    bar.textContent='['+(i+1)+'/'+machineNames.length+'] '+mname.slice(0,14)+'...';
    try{
      var mlR=await fetch('/'+sid+'/rack_info/machine_list?hall_id='+hid+'&kind_code='+urlKindCode+'&machine_name='+encodeURIComponent(mname)+'&target_date='+today+'&disp=2&place=&history_day=3',{credentials:'include'});
      if(!mlR.ok)continue;
      var dec=await decryptMl(await mlR.text());
      if(dec){var ss=Array.isArray(dec)?dec:(dec.data||dec.items||Object.values(dec));if(Array.isArray(ss))ss.forEach(s=>allStands.push(s));}
    }catch(e){}
  }

  if(allStands.length===0){bar.textContent='❌ 全台データ取得失敗';setTimeout(()=>bar.remove(),8000);return;}
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
setTimeout(()=>bar.remove(),8000);
})();
