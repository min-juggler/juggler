# tools/check_branches.js

ブックマークレットを「店舗ページを開いた状態」に近い環境で実際に実行し、
最初の await に入るまでの同期部分が壊れていないかを確かめる。

```sh
osascript -l JavaScript tools/check_branches.js "ラベル" docs/bookmarklet_code.js "https://www.pscube.jp/x/c721220/cgi-bin/nc-v03-001.php"
osascript -l JavaScript tools/check_branches.js "ラベル" docs/bookmarklet_code.js "https://www.dynam-data.jp/h/a736724/cgi-bin/nc-v13-001.php"
osascript -l JavaScript tools/check_branches.js "ラベル" docs/bookmarklet_dynam.js "https://www.dynam-data.jp/h/a725254/cgi-bin/nc-v13-001.php"
```

## なぜ必要か（2026-10-08）

bookmarklet_code.js は URL で3つの分岐に割れ、ダイナム / P'sCUBE / p-town の各分岐は
処理の終わりで `return` する。ファイル中ほどに `var` の初期化を置くと、
これらの分岐はそこへ到達しないまま return するため変数が undefined のままになる。

実際に `var __ghSha=...` を ghGet の直前に置いてしまい、ベガス成沢とダイナムが
ghGet の1行目で TypeError になって全く動かなくなった。構文チェック（new Function）は
通ってしまうので、この種の事故は検出できない。

**ファイル全体で使う変数は、必ず最初の分岐より前で初期化すること。**

Node が入っていない環境なので osascript (JavaScriptCore) で動かしている。
JXA は Promise の microtask を回さないため、確認できるのは最初の await までの同期部分だけ。
