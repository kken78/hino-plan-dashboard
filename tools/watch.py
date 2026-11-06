#!/usr/bin/env python3
"""町のページを巡回し、新しい資料(PDF)と、ページの更新を見つける。

設定は data/watch.json(見るページの一覧)、台帳は data/watch.tsv(知っている PDF と、ページの更新日)。
見つけるもの(種類):
  new       新しい PDF。見るページに、台帳に無い PDF のリンクがある
  gone      無くなった PDF。台帳で status が「使用」の PDF が、ページからリンクされなくなったか、404 などで取れない
  updated   ページの更新。ページの「更新日」(町のサイトの [更新日： ○年○月○日])が、台帳の updated と違う

取得は1秒に1件以内。PDF の中身は読まない(ページのリンクと HEAD だけ)。台帳は変えない(見つけるだけ)。

台帳 data/watch.tsv の列:
  kind    page か pdf
  url     ページか PDF の URL
  label   ページの題か、リンクの文字
  status  pdf のとき: 使用(このリポジトリが転記に使っている)・対象外(使わないと決めた)・未使用(まだ決めていない)。page のときは空
  updated page のとき: 町のサイトに出ている更新日(YYYY-MM-DD)。pdf のときは空
  date    台帳に書いた日
  note    備考

用法:
  python3 tools/watch.py                  # 巡回し、結果を標準出力に Markdown で出す
  python3 tools/watch.py --json out.json  # 結果を JSON にも書く
  python3 tools/watch.py --ledger 別の台帳.tsv --config 別の設定.json   # 差し替えて試す(自己検査)

終了コード: 0 巡回できた / 2 巡回に失敗した(見るページが取れない、通信の失敗)
"""
import argparse
import csv
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "data", "watch.json")
LEDGER = os.path.join(ROOT, "data", "watch.tsv")
HOST = "www.town.shiga-hino.lg.jp"
TIMEOUT = 30
INTERVAL = 1.0
JST = timezone(timedelta(hours=9))
HREF_RE = re.compile(r"""<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>(.*?)</a>""", re.I | re.S)
# 町のサイトの <time itemprop="dateModified" datetime="2026-09-02">。無ければ本文の「更新日：2026年9月2日」
UPDATED_RE = re.compile(r'itemprop="dateModified"[^>]*datetime="(\d{4}-\d{2}-\d{2})"|更新日\s*[：:]\s*(?:<[^>]+>)?\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日')
POSTED_RE = re.compile(r'itemprop="datePublished"[^>]*datetime="(\d{4}-\d{2}-\d{2})"|公開日\s*[：:]\s*(?:<[^>]+>)?\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日')

_last = [0.0]


def _wait():
    rest = INTERVAL - (time.monotonic() - _last[0])
    if rest > 0:
        time.sleep(rest)
    _last[0] = time.monotonic()


def _request(url, ua, method="GET"):
    _wait()
    req = urllib.request.Request(url, method=method, headers={"User-Agent": ua})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, dict(r.headers), (b"" if method == "HEAD" else r.read())
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), b""


def norm(u):
    pu = urllib.parse.urlsplit(u.strip())
    return urllib.parse.urlunsplit((pu.scheme, pu.netloc, pu.path, "", ""))


def pdf_links(base, body):
    text = body.decode("utf-8", errors="replace")
    out, seen = [], set()
    for href, inner in HREF_RE.findall(text):
        absu = urllib.parse.urljoin(base, html.unescape(href.strip()))
        pu = urllib.parse.urlsplit(absu)
        if pu.netloc != HOST or not pu.path.lower().endswith(".pdf"):
            continue
        absu = norm(absu)
        if absu in seen:
            continue
        seen.add(absu)
        label = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", inner))).strip()
        label = re.sub(r"\s*(サイズ|ファイルサイズ)[：:]?\s*[\d.,]+\s*[KMG]?B.*$", "", label).strip()
        label = re.sub(r"\s*[（(]PDF形式[、,][^）)]*[）)]\s*$", "", label).strip()
        label = re.sub(r"\s*[（(]\.pdf\s*$", "", label).strip()
        out.append((absu, label))
    return out


def page_dates(body):
    text = body.decode("utf-8", errors="replace")

    def f(m):
        if not m:
            return ""
        if m.group(1):
            return m.group(1)
        return f"{int(m.group(2)):04d}-{int(m.group(3)):02d}-{int(m.group(4)):02d}"
    return f(UPDATED_RE.search(text)), f(POSTED_RE.search(text))


def load(config_path, ledger_path):
    with open(config_path, encoding="utf-8") as f:
        cfg = json.load(f)
    with open(ledger_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    need = {"kind", "url", "label", "status", "updated", "date", "note"}
    if not rows or not need <= set(rows[0]):
        raise SystemExit(f"台帳 {ledger_path} の列が足りない")
    if not cfg.get("pages"):
        raise SystemExit(f"{config_path} に pages が無い")
    return cfg, rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=CONFIG)
    ap.add_argument("--ledger", default=LEDGER)
    ap.add_argument("--json")
    a = ap.parse_args()
    cfg, rows = load(a.config, a.ledger)
    ua = cfg.get("user_agent", f"{cfg.get('repo', 'hino-portal')}-watch/1.0 (+https://github.com/kken78/{cfg.get('repo', 'hino-portal')})")
    known_pdf = {norm(r["url"]): r for r in rows if r["kind"] == "pdf"}
    page_rows = {norm(r["url"]): r for r in rows if r["kind"] == "page"}
    rep = {"date": datetime.now(JST).strftime("%Y-%m-%d %H:%M JST"), "repo": cfg.get("repo", ""),
           "checked_pages": 0, "checked_pdfs": 0,
           "findings": {"new": [], "gone": [], "updated": []}, "errors": [], "failed": False, "fail_reason": ""}
    fail = []
    on_page = set()
    for p in cfg["pages"]:
        url = norm(p["url"])
        rep["checked_pages"] += 1
        try:
            st, _, body = _request(url, ua)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            fail.append(f"ページが取れない: {url} {e}")
            continue
        if st != 200:
            fail.append(f"ページが取れない: {url} HTTP {st}")
            continue
        updated, posted = page_dates(body)
        pr = page_rows.get(url)
        if pr is not None and updated and updated != pr["updated"]:
            rep["findings"]["updated"].append({"url": url, "label": p.get("label") or pr["label"], "was": pr["updated"], "now": updated, "posted": posted})
        for pu, label in pdf_links(url, body):
            on_page.add(pu)
            if pu not in known_pdf:
                rep["findings"]["new"].append({"url": pu, "label": label, "page": url, "page_label": p.get("label", "")})
    # 台帳で「使用」の PDF が、ページから消えたか取れないか
    for pu, r in known_pdf.items():
        if r["status"] != "使用":
            continue
        rep["checked_pdfs"] += 1
        reasons = []
        if on_page and pu not in on_page:
            reasons.append("見るページにリンクが無い")
        try:
            st, _, _ = _request(r["url"], ua, "HEAD")
            if st in (404, 410):
                reasons.append(f"HTTP {st}")
            elif st != 200:
                rep["errors"].append({"url": r["url"], "reason": f"HTTP {st}"})
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            rep["errors"].append({"url": r["url"], "reason": f"通信の失敗: {e}"})
        if reasons:
            rep["findings"]["gone"].append({"url": r["url"], "label": r["label"], "reason": "。".join(reasons)})
    if rep["checked_pdfs"] and len(rep["errors"]) * 5 >= rep["checked_pdfs"]:
        fail.append(f"使用の PDF {rep['checked_pdfs']} 件のうち {len(rep['errors'])} 件が通信の失敗")
    if fail:
        rep["failed"], rep["fail_reason"] = True, "。".join(fail)

    f = rep["findings"]
    L = [f"町のページを {rep['date']} に巡回した結果。見るページ {rep['checked_pages']} 件、使用の PDF {rep['checked_pdfs']} 件。", ""]
    L.append(f"## 新しい PDF({len(f['new'])}件)")
    L += [f"- {x['label'] or '(リンクの文字なし)'}: {x['url']}(ページ {x['page_label'] or x['page']})" for x in f["new"]] or ["- なし"]
    L.append(""); L.append(f"## 無くなった PDF({len(f['gone'])}件)")
    L += [f"- {x['label']}: {x['reason']}。{x['url']}" for x in f["gone"]] or ["- なし"]
    L.append(""); L.append(f"## ページの更新({len(f['updated'])}件)")
    L += [f"- {x['label']}: 更新日 {x['was'] or '(台帳に無い)'} → {x['now']}。{x['url']}" for x in f["updated"]] or ["- なし"]
    if rep["errors"]:
        L.append(""); L.append(f"## 確かめられなかったもの({len(rep['errors'])}件)")
        L += [f"- {x['url']}: {x['reason']}" for x in rep["errors"]]
    if a.json:
        with open(a.json, "w", encoding="utf-8") as fo:
            json.dump(rep, fo, ensure_ascii=False, indent=1)
    print("\n".join(L))
    if rep["failed"]:
        print(f"\n巡回に失敗した: {rep['fail_reason']}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
