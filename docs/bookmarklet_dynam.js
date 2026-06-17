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
  // 【調査モード】toku パラメータでBIG/REGが取れるか試す
  var allStands=[];
  var v05debug='';
  var jug0=jugglers[0];
  var qs0=jug0.php&&jug0.php.indexOf('?')>=0?jug0.php.slice(jug0.php.indexOf('?')):'?cd_ps=2';
  try{
    // nc-switch要素の全文を取得（パラメータ名特定用）
    var rv=await fetch('/h/'+storeCode+'/cgi-bin/nc-v05-011.php'+qs0,{credentials:'include'});
    var html=await rv.text();
    var sw='';
    var swm=html.match(/<[^>]*nc-switch[^>]*>/g);
    if(swm)sw=swm.slice(0,4).join(' ').replace(/"/g,"'");

    // nc-m05-003 を toku/cd_toku 違いで叩き、Dai[0].D0.toku0.count を比較
    // (BONUS=21なので、BIG=13 / REG=8 が出るパラメータを探す)
    var tests=['','&toku=1','&toku=2','&cd_toku=1','&cd_toku=2','&tok=1','&tok=2','&kind=1','&kind=2'];
    var res=[];
    for(var ti=0;ti<tests.length;ti++){
      try{
        var rt=await fetch('/h/'+storeCode+'/cgi-bin/nc-m05-003.php'+qs0+tests[ti],{credentials:'include'});
        var jt=await rt.json();
        var c=jt.Dai&&jt.Dai[0]&&jt.Dai[0].D0&&jt.Dai[0].D0.toku0?jt.Dai[0].D0.toku0.count:'?';
        res.push((tests[ti]||'(なし)')+'=count'+c);
      }catch(e){res.push((tests[ti]||'(なし)')+'=err');}
    }
    v05debug='switch:'+sw.slice(0,200)+' ||| count比較: '+res.join(' / ');
  }catch(eX){v05debug='catch: '+eX.message;}

  bar.textContent='🔍 toku調査（7枚撮って）...';
  var dk=v05debug;
  for(var pi=0;pi<7;pi++){(function(p){setTimeout(function(){bar.textContent='📋'+(p+1)+' '+dk.slice(p*230,p*230+230);},500+p*4000);})(pi);}
  setTimeout(function(){bar.remove();},31000);
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
