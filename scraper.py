"""
ジャグラー台データ取得スクリプト
使い方: python3 scraper.py
"""

import json
import re
import html as html_module
import base64
import urllib.request
import urllib.error
import shutil
from datetime import datetime
from pathlib import Path

# ===== GitHub設定 =====
GITHUB_TOKEN  = ""  # ← ここにGitHubトークンを入力（ghp_xxxxx）
GITHUB_REPO   = "min-juggler/juggler"
GITHUB_BRANCH = "main"

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

OUTPUT_PATH = Path(__file__).parent / "data" / "stores.json"
PREV_PATH   = Path(__file__).parent / "data" / "stores_prev.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
}


# ===== Chromeからセッションを取得 =====
def make_session():
    """ChromeのCookieを使ったrequestsセッションを作成"""
    try:
        import requests
        import browser_cookie3
        session = requests.Session()
        session.headers.update(HEADERS)
        cookies = list(browser_cookie3.chrome(domain_name='teramoba2.com'))
        for c in cookies:
            session.cookies.set(c.name, c.value, domain=c.domain or '.teramoba2.com')
        print(f"  🍪 Chrome Cookieを注入しました（{len(cookies)}個）")
        return session
    except ImportError:
        print("  ⚠️  requestsまたはbrowser-cookie3が未インストールです")
        print("     pip3 install requests browser-cookie3")
        return None
    except Exception as e:
        print(f"  ⚠️  Cookie取得エラー: {e}")
        return None


# ===== 機種リスト取得 =====
def get_machine_list(session, store: dict) -> list:
    try:
        url = (
            f"https://island.pt.teramoba2.com/n-api/rack_info/search_kind"
            f"?hall_id={store['hall_id']}&kind_code={store['kind_code']}"
        )
        r = session.get(url, timeout=15)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                return data
    except Exception as e:
        print(f"  機種取得エラー: {e}")
    return []


# ===== 台データ取得 =====
def fetch_stands(session, store: dict, machine_name_enc: str, machine_name: str) -> list:
    url = (
        f"{store['base_url']}/standlist_slot"
        f"?kind_code={store['kind_code']}&machine_name={machine_name_enc}"
    )
    try:
        r = session.get(url, timeout=20)
        if r.status_code != 200:
            print(f"    ❌ HTTPエラー: {r.status_code}")
            return []

        # protection_redirectに飛ばされたか確認
        if "protection_redirect" in r.url or "protection" in r.url:
            print(f"    ❌ Cloudflareブロック")
            return []

        html = r.text

        # Inertia.jsのdata-page属性からデータ取得
        match = re.search(r'data-page="([^"]+)"', html)
        if match:
            raw = html_module.unescape(match.group(1))
            props = json.loads(raw).get("props", {})
            raw_list = (
                props.get("stand_list") or props.get("stands") or
                props.get("rack_list") or props.get("dai_data_list") or []
            )
            if raw_list:
                return normalize_stands(raw_list, machine_name)

    except Exception as e:
        print(f"    エラー: {e}")
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


# ===== GitHubアップロード =====
def push_to_github(json_str: str, path: str = "data/stores.json") -> bool:
    try:
        api_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        }
        sha = None
        try:
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req) as resp:
                sha = json.loads(resp.read()).get("sha")
        except urllib.error.HTTPError as e:
            if e.code != 404:
                pass

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


# ===== メイン =====
def scrape_all():
    now = datetime.now()
    print("=" * 52)
    print("  🎰 ジャグラー台データ取得")
    print(f"  実行日時: {now.strftime('%Y-%m-%d %H:%M')}")
    print("=" * 52)

    if now.hour < 10:
        print(f"\n  ⏰ 現在 {now.strftime('%H:%M')} です。")
        print("  多くの店舗は10時以降にデータが更新されます。")
        print("  （前日データが表示される場合は取得できます）")
        ans = input("  続けますか？ [y/N]: ").strip().lower()
        if ans != "y":
            print("  終了します。")
            return

    session = make_session()
    if not session:
        print("  ❌ セッション作成失敗。終了します。")
        return

    result = {"fetched_at": now.isoformat(), "stores": {}}

    for store in STORES:
        print(f"\n{'─'*40}")
        print(f"📍 {store['name']}")
        print(f"{'─'*40}")
        store_result = {"name": store["name"], "machines": []}

        machines = get_machine_list(session, store)
        if not machines:
            print(f"  📭 機種リスト未取得")
            result["stores"][store["id"]] = store_result
            continue

        print(f"  {len(machines)}機種を確認:")
        for m in machines:
            print(f"    • {m['machine_name']} ({m.get('cnt', '?')}台)")

        for machine in machines:
            mname     = machine.get("machine_name", "不明")
            mname_enc = machine.get("machine_name_enc", "")
            cnt       = machine.get("cnt", 0)
            print(f"\n  🎰 {mname} ({cnt}台) 取得中...")

            stands = fetch_stands(session, store, mname_enc, mname)

            if stands:
                print(f"     ✅ {len(stands)}台取得完了")
                for s in stands[:3]:
                    bb_r = f"1/{round(s['games']/s['bb'])}" if s["bb"] else "-"
                    rb_r = f"1/{round(s['games']/s['rb'])}" if s["rb"] else "-"
                    print(f"       {s['rack_no']}番台  {s['games']}G  BB:{bb_r}  RB:{rb_r}  差:{s['diff']:+}")
                if len(stands) > 3:
                    print(f"       … 他{len(stands)-3}台")
            else:
                print(f"     📭 データなし")

            store_result["machines"].append({
                "machine_name": mname,
                "count": cnt,
                "stands": stands,
            })

        result["stores"][store["id"]] = store_result

    # 保存
    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    json_str = json.dumps(result, ensure_ascii=False, indent=2)

    # 既存データを前日データとして保存
    if OUTPUT_PATH.exists():
        shutil.copy(OUTPUT_PATH, PREV_PATH)
    else:
        with open(PREV_PATH, "w", encoding="utf-8") as f:
            f.write(json_str)

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
        print(f"  ⚠️  データが0件でした")
    print(f"  📁 {OUTPUT_PATH}")

    print(f"\n  📡 GitHubへアップロード中...")
    ok1 = push_to_github(json_str, "data/stores.json")
    prev_str = open(PREV_PATH, encoding="utf-8").read() if PREV_PATH.exists() else None
    if prev_str:
        push_to_github(prev_str, "data/stores_prev.json")
    if ok1:
        print(f"  🌐 https://min-juggler.github.io/juggler/")
    print(f"{'='*52}\n")


if __name__ == "__main__":
    # requestsが入っていなければインストール
    try:
        import requests
    except ImportError:
        import subprocess, sys
        print("  📦 requestsをインストール中...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
        import requests

    scrape_all()
