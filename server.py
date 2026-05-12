"""
ジャグラー狙い目チェッカー ローカルサーバー
使い方: python3 server.py
"""

import http.server
import webbrowser
import threading
import socket
from pathlib import Path

PORT = 8080
BASE_DIR = Path(__file__).parent


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, format, *args):
        pass


def open_browser(ip):
    import time
    time.sleep(0.8)
    webbrowser.open(f'http://localhost:{PORT}/app/index.html')


if __name__ == '__main__':
    ip = get_local_ip()
    print(f"🎰 ジャグラー狙い目チェッカー起動中")
    print(f"")
    print(f"  💻 Mac:    http://localhost:{PORT}/app/index.html")
    print(f"  📱 スマホ: http://{ip}:{PORT}/app/index.html")
    print(f"")
    print(f"  ※ スマホは同じWiFiに繋いでから上のURLを開いてください")
    print(f"  終了するには Ctrl+C を押してください\n")

    threading.Thread(target=open_browser, args=(ip,), daemon=True).start()

    # 0.0.0.0 でバインドすることで同一LAN内のスマホからもアクセス可能
    with http.server.HTTPServer(('0.0.0.0', PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n停止しました")
