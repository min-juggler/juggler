ObjC.import('Foundation');
function rd(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
function wr(s){$.NSFileHandle.fileHandleWithStandardOutput.writeData($.NSString.alloc.initWithUTF8String(s+'\n').dataUsingEncoding($.NSUTF8StringEncoding));}
var args=$.NSProcessInfo.processInfo.arguments.js.slice(4).map(function(a){return a.js;});
var label=args[0], file=args[1], url=args[2];

var sandbox = [
  'var window={__JUG_DAYOFF__:0};',
  'var location={href:"'+url+'",search:"?kind_code=Z"};',
  'var _appended=0;',
  'var document={createElement:function(){return{style:{},set textContent(v){},appendChild:function(){}};},',
  '  body:{appendChild:function(){_appended++;}}};',
  'var fetch=function(){return new Promise(function(){});};',  // 永久pending=最初のawaitで止まる
  'var alert=function(){};',
  'function setTimeout(){return 0;}',
  'var URLSearchParams=function(){return{get:function(){return "Z";}};};'
].join('\n');

var code = rd(file);
var verdict;
try{
  var fn = new Function(sandbox + '\n' + code + '\nreturn {sha:window.__JUG_SHA, bars:_appended};');
  var r = fn();
  if(r.sha===undefined) verdict='❌ __JUG_SHA が undefined → ghGetの1行目でTypeErrorになる';
  else if(typeof r.sha==='object') verdict='✅ __JUG_SHA は正常なオブジェクト（バー表示 '+r.bars+'回）';
  else verdict='? 予期しない値: '+typeof r.sha;
}catch(e){ verdict='❌ 実行時エラー: '+e.message; }
wr(label+' : '+verdict);
