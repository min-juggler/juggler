#!/bin/bash
# このファイルをダブルクリックするとデータ取得が始まります

cd "$(dirname "$0")"
echo "🎰 ジャグラー台データ取得を開始します..."
python3 scraper.py
echo ""
echo "完了。このウィンドウを閉じてください。"
read -p "Enterで閉じる..."
