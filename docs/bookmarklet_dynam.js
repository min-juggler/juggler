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

  // STEP2: 機種ごとに台データ取得
  var allStands=[];
  var dbgFirst=null;
  for(var i=0;i<jugglers.length;i++){
    var ki1=jugglers[i];
    var cdKisyu=(ki1.cd_kisyu&&ki1.cd_kisyu[0])||'';
    if(!cdKisyu)continue;
    bar.textContent='['+(i+1)+'/'+jugglers.length+'] '+ki1.nmk_kisyu.slice(0,14)+'...';
    try{
      // nc-m04-001（台別データ）とnc-m03-001を両方試す
      var raw=null,d2=null;
      for(var ep of ['nc-m04-001','nc-m03-001']){
        try{
          var r2=await fetch('/h/'+storeCode+'/cgi-bin/'+ep+'.php?cd_ps=2&cd_kisyu='+cdKisyu+'&dt='+today,{credentials:'include'});
          if(!r2.ok)continue;
          var t=await r2.text();
          if(t.includes('redirect_captcha')){bar.textContent='❌ captcha必要';setTimeout(()=>bar.remove(),8000);return;}
          var j=JSON.parse(t);
          if(!dbgFirst){
            var ki0=j.Ki&&j.Ki[0]?j.Ki[0]:j.Dai&&j.Dai[0]?j.Dai[0]:null;
            dbgFirst={ep:ep,topKeys:Object.keys(j).join(','),ki0Keys:ki0?Object.keys(ki0).join(','):'none',raw:t.slice(0,300)};
          }
          raw=t;d2=j;break;
        }catch(e2){}
      }
      if(!d2)continue;
      // 台データの配列を探す
      var stands=null;
      if(Array.isArray(d2))stands=d2;
      else if(d2.Dai&&Array.isArray(d2.Dai))stands=d2.Dai;
      else if(d2.dai&&Array.isArray(d2.dai))stands=d2.dai;
      else if(d2.Ki&&Array.isArray(d2.Ki)){
        // Ki items が台データの場合（no_dai/cd_dai/game_suフィールドを持つ）
        var k0=d2.Ki[0]||{};
        if(k0.no_dai||k0.cd_dai||k0.game_su||k0.ct_game){
          stands=d2.Ki; // Ki items ARE stands
        } else {
          // Ki items の中にネストされた台データを探す
          for(var kx of d2.Ki){
            var nested=kx.Dai||kx.dai||kx.Data||kx.data||null;
            if(Array.isArray(nested)&&nested.length>0)stands=(stands||[]).concat(nested);
          }
        }
      }
      if(!stands){
        // 最後の手段：配列を含むフィールドを探す
        for(var val of Object.values(d2)){
          if(Array.isArray(val)&&val.length>0&&typeof val[0]==='object'){stands=val;break;}
        }
      }
      if(!Array.isArray(stands))continue;
      stands.forEach(function(s){
        if(!s||typeof s!=='object')return;
        // 各種フィールド名のフォールバック
        var games=parseInt(s.ct_game||s.ct_gyaku||s.game_count||s.games||s.play||0);
        var bb=parseInt(s.ct_bb||s.bb||s.big||0);
        var rb=parseInt(s.ct_reg||s.ct_rb||s.rb||s.reg||0);
        var diff=parseInt(s.sa_mai||s.diff||s.sa||0);
        var rack=String(s.cd_dai||s.rack_no||s.dai_no||s.no||'?');
        allStands.push({rack_no:rack,machine_name:ki1.nmk_kisyu,games:games,bb:bb,rb:rb,diff:diff});
      });
    }catch(e){}
  }

  if(allStands.length===0){
    bar.textContent='❌ 台データ取得失敗';
    if(dbgFirst){
      setTimeout(()=>{bar.textContent='🔍 ep='+dbgFirst.ep+' top='+dbgFirst.topKeys+' ki0='+dbgFirst.ki0Keys;},2000);
      setTimeout(()=>{bar.textContent='🔍 raw='+dbgFirst.raw;},6000);
    }
    setTimeout(()=>bar.remove(),20000);return;
  }

  // デバッグ: 最初の台データのキーを表示
  if(allStands.length>0){
    var fs=allStands[0];
    setTimeout(()=>{bar.textContent='🔍 stand例: '+JSON.stringify(fs).slice(0,120);},3000);
  }

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
