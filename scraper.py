"""
ジャグラー台データ取得スクリプト
使い方: python3 scraper.py
※ 開店後（10時以降）に実行してください
"""

import json
import time
import html as html_module
import base64
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ===== GitHub自動アップロード設定（config.jsonから読み込み）=====
_CONFIG_PATH = Path(__file__).parent / "config.json"
try:
    _cfg = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
    GITHUB_TOKEN  = _cfg.get("github_token", "")
    GITHUB_REPO   = _cfg.get("github_repo", "min-juggler/juggler")
    GITHUB_BRANCH = _cfg.get("github_branch", "main")
except Exception:
    GITHUB_TOKEN = ""
    GITHUB_REPO  = "min-juggler/juggler"
    GITHUB_BRANCH = "main"
GITHUB_PATH = "data/stores.json"

# ===== 店舗設定 =====
STORES = [
    {
        "id": "yonezawa",
        "name": "アイランド米沢店",
        "base_url": "https://island.pt.teramoba2.com/yonezawa",
        "hall_id": 292,
        "kind_code": 21,
    },
    {
        "id": "kaminoyama",
        "name": "1円劇場上山店",
        "base_url": "https://island.pt.teramoba2.com/kaminoyama",
        "hall_id": 1303,
        "kind_code": 21,
    },
]

OUTPUT_PATH  = Path(__file__).parent / "data" / "stores.json"
PROFILE_DIR  = Path(__file__).parent / "data" / "browser_profile"  # Cookie保持フォルダ


# ===== ユーティリティ =====
def pause(msg: str):
    print(f"\n{'─'*50}")
    print(f"  ⚠️  {msg}")
    print(f"{'─'*50}")
    input("     完了したらEnterを押してください... ")
    print()


def get_props(page) -> dict:
    """Inertia.jsのdata-pageからpropsを取得"""
    try:
        raw = page.locator("[data-page]").get_attribute("data-page", timeout=5000)
        if raw:
            return json.loads(html_module.unescape(raw)).get("props", {})
    except Exception:
        pass
    return {}


def is_protected(page) -> bool:
    return "protection" in page.url


def wait_past_protection(page, url: str, store_name: str, retry: int = 2) -> bool:
    """
    保護ページを検出したらユーザーに手動操作を促す。
    Turnstile（Cloudflare）が自動通過できる場合もある。
    """
    for i in range(retry):
        if not is_protected(page):
            return True  # 通過済み

        if i == 0:
            # まず少し待って自動通過を試みる（Turnstileは本物ブラウザなら通ることがある）
            print(f"    🔄 認証待機中...", end="", flush=True)
            for _ in range(8):
                time.sleep(1)
                print(".", end="", flush=True)
                if not is_protected(page):
                    print(" 通過！")
                    return True
            print()

        # 自動通過できなかった → 手動操作
        pause(
            f"[{store_name}] 認証/同意画面が表示されています。\n"
            f"     ブラウザで「同意する」や「チェックボックス」をクリックしてください。\n"
            f"     ページが切り替わったらEnterを押してください。"
        )
        page.goto(url, wait_until="networkidle", timeout=30000)
        time.sleep(1.5)

    if is_protected(page):
        print(f"    ❌ アクセスできません。スキップします。")
        return False
    return True


# ===== データ取得 =====
def get_machine_list(page, store: dict) -> list:
    """機種一覧API"""
    try:
        r = page.request.get(
            f"https://island.pt.teramoba2.com/n-api/rack_info/search_kind"
            f"?hall_id={store['hall_id']}&kind_code={store['kind_code']}"
        )
        if r.status == 200:
            return r.json()
    except Exception as e:
        print(f"  機種取得エラー: {e}")
    return []


def fetch_stands(page, store: dict, machine_name_enc: str, machine_name: str) -> list:
    """standlist_slotから台データを取得"""
    url = (
        f"{store['base_url']}/standlist_slot"
        f"?kind_code={store['kind_code']}&machine_name={machine_name_enc}"
    )
    try:
        page.goto(url, wait_until="networkidle", timeout=30000)
        time.sleep(1.5)
    except PWTimeout:
        print(f"    ⏱️  タイムアウト")
        return []

    if not wait_past_protection(page, url, store["name"]):
        return []

    # --- 1. Inertia.js props ---
    props = get_props(page)
    raw_list = (
        props.get("stand_list") or props.get("stands") or
        props.get("rack_list") or props.get("dai_data_list") or []
    )
    if raw_list:
        return normalize_stands(raw_list, machine_name)

    # --- 2. DOMのテーブル ---
    dom = scrape_table(page, machine_name)
    if dom:
        return dom

    # --- 3. データなし（朝イチ・未登録） ---
    # ページタイトルやテキストで「データなし」を判定
    body_text = page.inner_text("body")
    if "データがありません" in body_text or "準備中" in body_text or len(raw_list) == 0:
        print(f"    📭 本日データ未登録（開店前/集計前の可能性）")
    return []


def normalize_stands(raw: list, machine_name: str) -> list:
    result = []
    for s in raw:
        try:
            rack  = str(s.get("rack_no") or s.get("dai_no") or s.get("no") or "?")
            games = int(s.get("total_games") or s.get("games") or s.get("gk") or 0)
            bb    = int(s.get("bb_count")   or s.get("bb")    or s.get("big") or 0)
            rb    = int(s.get("rb_count")   or s.get("rb")    or s.get("reg") or 0)
            diff  = int(s.get("diff")       or s.get("sa_mai") or 0)
            result.append({"rack_no": rack, "machine_name": machine_name,
                           "games": games, "bb": bb, "rb": rb, "diff": diff})
        except (ValueError, TypeError):
            continue
    return result


def scrape_table(page, machine_name: str) -> list:
    result = []
    try:
        rows = page.locator("table tbody tr").all()
        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 4:
                continue
            texts = [c.inner_text().strip().replace(",", "").replace("+", "") for c in cells]
            try:
                result.append({
                    "rack_no":      texts[0],
                    "machine_name": machine_name,
                    "games": int(texts[2]) if texts[2].lstrip("-").isdigit() else 0,
                    "bb":    int(texts[3]) if texts[3].lstrip("-").isdigit() else 0,
                    "rb":    int(texts[4]) if len(texts) > 4 and texts[4].lstrip("-").isdigit() else 0,
                    "diff":  int(texts[5]) if len(texts) > 5 and texts[5].lstrip("-").isdigit() else 0,
                })
            except (ValueError, IndexError):
                continue
    except Exception:
        pass
    return result


# ===== メイン =====
def scrape_all():
    now = datetime.now()
    print("=" * 52)
    print("  🎰 ジャグラー台データ取得")
    print(f"  実行日時: {now.strftime('%Y-%m-%d %H:%M')}")
    print("=" * 52)

    # 開店前チェック
    if now.hour < 10:
        print(f"\n  ⏰ 現在 {now.strftime('%H:%M')} です。")
        print("  多くの店舗は10時以降にデータが更新されます。")
        print("  このまま実行することもできます（データが0件になる場合があります）")
        ans = input("  続けますか？ [y/N]: ").strip().lower()
        if ans != "y":
            print("  終了します。10時以降に再実行してください。")
            return

    print("\n  ブラウザが起動します。")
    print("  認証画面が出たら手動でクリックしてください。\n")

    result = {"fetched_at": now.isoformat(), "stores": {}}
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        # persistent_context でCookieを保持（2回目以降は認証スキップ）
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            args=["--no-sandbox"],
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = ctx.new_page()

        for store in STORES:
            print(f"\n{'─'*40}")
            print(f"📍 {store['name']}")
            print(f"{'─'*40}")
            store_result = {"name": store["name"], "machines": []}

            # 機種一覧
            page.goto(f"{store['base_url']}/", wait_until="networkidle", timeout=20000)
            machines = get_machine_list(page, store)

            if not machines:
                print(f"  📭 機種リスト未取得（開店前/本日データなし）")
                result["stores"][store["id"]] = store_result
                continue

            print(f"  {len(machines)}機種を確認:")
            for m in machines:
                print(f"    • {m['machine_name']} ({m.get('cnt', '?')}台)")

            # 各機種の台データ
            for machine in machines:
                mname     = machine.get("machine_name", "不明")
                mname_enc = machine.get("machine_name_enc", "")
                cnt       = machine.get("cnt", 0)
                print(f"\n  🎰 {mname} ({cnt}台) 取得中...")

                stands = fetch_stands(page, store, mname_enc, mname)

                if stands:
                    print(f"     ✅ {len(stands)}台取得完了")
                    for s in stands[:3]:
                        bb_r = f"1/{round(s['games']/s['bb'])}" if s["bb"] else "-"
                        rb_r = f"1/{round(s['games']/s['rb'])}" if s["rb"] else "-"
                        print(f"       {s['rack_no']}番台  {s['games']}G  BB:{bb_r}  RB:{rb_r}  差:{s['diff']:+}")
                    if len(stands) > 3:
                        print(f"       … 他{len(stands)-3}台")

                store_result["machines"].append({
                    "machine_name": mname,
                    "count": cnt,
                    "stands": stands,
                })
                time.sleep(1.0)

            result["stores"][store["id"]] = store_result

        ctx.close()

    # ローカル保存
    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    json_str = json.dumps(result, ensure_ascii=False, indent=2)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(json_str)

    total = sum(
        len(m["stands"])
        for s in result["stores"].values()
        for m in s["machines"]
    )
    print(f"\n{'='*52}")
    if total > 0:
        print(f"  ✅ 完了！ {total}台分のデータを保存しました")
    else:
        print(f"  ⚠️  データが0件でした。開店後(10時以降)に再実行してください。")
    print(f"  📁 {OUTPUT_PATH}")

    # GitHubへ自動アップロード
    print(f"\n  📡 GitHubへアップロード中...")
    if push_to_github(json_str):
        print(f"  🌐 スマホからはこのURLで見られます:")
        print(f"     https://min-juggler.github.io/juggler/")
    else:
        print(f"  ⚠️  GitHubアップロード失敗。ローカルのみ保存されました。")
    print(f"{'='*52}")
    print("\n  ブラウザで http://localhost:8080 をリロードしてください\n")


def push_to_github(json_str: str) -> bool:
    """stores.jsonをGitHub APIでアップロード"""
    try:
        api_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_PATH}"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        }

        # 既存ファイルのSHAを取得（更新時に必要）
        sha = None
        try:
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req) as resp:
                existing = json.loads(resp.read())
                sha = existing.get("sha")
        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"    SHA取得エラー: {e}")

        # ファイルをBase64エンコードしてPUT
        content_b64 = base64.b64encode(json_str.encode("utf-8")).decode("ascii")
        body = {
            "message": f"データ更新 {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "content": content_b64,
            "branch": GITHUB_BRANCH,
        }
        if sha:
            body["sha"] = sha

        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(api_url, data=data, headers=headers, method="PUT")
        with urllib.request.urlopen(req) as resp:
            resp.read()
        return True
    except Exception as e:
        print(f"    エラー: {e}")
        return False


if __name__ == "__main__":
    scrape_all()
