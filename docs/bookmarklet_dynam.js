(async function(){
var T='__TOKEN__',R='__REPO__';
// 取得対象日のオフセット（0=今日, -1=昨日）。ショートカットのループが window.__JUG_DAYOFF__ をセットする。
var __OFF=(typeof window!=='undefined'&&typeof window.__JUG_DAYOFF__==='number')?window.__JUG_DAYOFF__:0;

// ダイナム(dynam-data.jp)のURLからstore IDを取得。
// ※ ニラク吉原(pscube.jp/h/a720930/)は同じCGI体系だったが、Cloudflareのボット認証を
//   突破できず3ヶ月で一度も取得に成功しなかったため、2026-08-25に対応を打ち切った。
var m=location.href.match(/\/h\/([a-z0-9]+)\//);
if(!m){alert('店舗のページで実行してください');return;}
var storeCode=m[1]; // 例: a725254

var STORES={'a725254':{sid:'dynam_yonezawa',name:'ダイナム米沢店'},'a736724':{sid:'dynam_tendo',name:'ダイナム天童店'}};
var storeInfo=STORES[storeCode]||{sid:'dynam_'+storeCode,name:'ダイナム'+storeCode};
var sid=storeInfo.sid, sname=storeInfo.name;

var bar=document.createElement('div');
bar.style='position:fixed;top:10px;right:10px;background:#e63946;color:#fff;padding:10px 16px;border-radius:8px;z-index:99999;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:85vw;word-break:break-all';
bar.textContent='🎰 ダイナム取得中...';document.body.appendChild(bar);

var __baseDate=function(){var d=new Date();if(__OFF)d.setDate(d.getDate()+__OFF);return d;};
var today=__baseDate().toISOString().slice(0,10).replace(/-/g,'');
// Dai[]はD0(当日)〜D6(6日前)の7日分を持つ。__OFFに応じてD{n}を選ぶ。
var __Dn=Math.min(6,Math.max(0,-__OFF));
var __Dkey='D'+__Dn;

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
  // ※ BIG/REG内訳は個別台API(nc-m06)で取れるがapikeyが使い捨てトークンのため不可。
  //   合算データ(大当り合計 count + 合成確率 ratio)のみ取得する。
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
        var d0=dai[__Dkey];
        if(!d0||!d0.YMD_biz)return;
        var rack=String(d0.cd_dai||'?');
        if(/^0\d{3,4}$/.test(rack))rack=String(parseInt(rack));
        var bonus=parseInt((d0.toku0&&d0.toku0.count)||0);
        var prob=parseFloat((d0.toku0&&d0.toku0.ratio)||0); // 合成確率(1/X)
        var games=(bonus>0&&prob>0)?Math.round(bonus*prob):0;
        allStands.push({
          rack_no:rack,
          machine_name:jug.nmk_kisyu||'不明',
          games:games,
          bb:0,rb:0,diff:0,
          total_bonus:bonus,
          combined_prob:prob,
          combined_only:true,
          _ymd:String(d0.YMD_biz)
        });
      });
    }catch(e2){}
  }

  if(allStands.length===0)throw new Error('台データ0');

  // ── STEP3: GitHubに送信 ──
  var realStands=allStands.filter(function(s){return s.games>0;}).length;
  // データ自身の営業日(YMD_biz)を保存日付にする。ローカル日付だと深夜・早朝でズレる。
  var ymdCount={};
  allStands.forEach(function(s){if(s._ymd)ymdCount[s._ymd]=(ymdCount[s._ymd]||0)+1;});
  var ymdRaw=Object.keys(ymdCount).sort(function(a,b){return ymdCount[b]-ymdCount[a];})[0];
  var today2=ymdRaw?(ymdRaw.slice(0,4)+'-'+ymdRaw.slice(4,6)+'-'+ymdRaw.slice(6,8))
                  :__baseDate().toISOString().slice(0,10);
  allStands.forEach(function(s){delete s._ymd;});
  bar.textContent='📡 '+allStands.length+'台('+realStands+'稼働) '+today2+' GitHub送信中...';
  var msg='データ更新 '+new Date().toLocaleString('ja')+' (対象日:'+today2+')';

  // ※ Contents APIは1MB超でcontentが空になるため、その場合はraw URLから取得
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
    // git blobs APIでshaから本体を取得（rawはCDNキャッシュで古く、連続実行時に上書き事故を起こす）
    if(data===null&&sha){
      try{
        var br=await fetch('https://api.github.com/repos/'+R+'/git/blobs/'+sha,{headers:{'Authorization':'token '+T,'Accept':'application/vnd.github.v3+json'}});
        if(br.ok){
          var bj=await br.json();
          if(bj.content){
            var bb=bj.content.replace(/\n/g,'');
            var by=Uint8Array.from(atob(bb),c=>c.charCodeAt(0));
            data=JSON.parse(new TextDecoder('utf-8').decode(by));
          }
        }
      }catch(e){}
    }
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

  if(ok1){bar.style.background='#2d6a4f';bar.textContent='✅ '+sname+' '+allStands.length+'台 ('+today2+') 送信完了！';}
  else{bar.style.background='#888';bar.textContent='⚠️ GitHub送信失敗';}
  // 送信完了を確認してからcompletion()を呼ぶ。以前は送信前に呼んでいたため、
  // iOSショートカットの連続実行だとページ破棄で送信が途中で殺されていた。
  if(typeof completion==='function')completion('done');
}catch(e){
  bar.style.background='#888';bar.textContent='❌ '+e.message;
  if(typeof completion==='function')completion('error');
}
setTimeout(function(){bar.remove();},10000);
})();
