#!/usr/bin/env python3
"""report-link-check.py — 报告站首页与日报页站内链接可达检查（只读）

用法:
  report-link-check.py [--reports-root DIR] [--base URL] [--index FILE]
                       [--page FILE ...] [--include-today-daily] [--no-today-daily]
                       [--offline] [--json OUT]

默认在提供 --index（或使用默认 index.html）时，同时检查当日（Asia/Singapore）日报页
的全部站内链，而不只查首页/侧栏。

断言（任一不满足 → exit 1，并逐条点名）：
  1. --offline 时：站内链在 reports 根下有对应正式文件
     在线时再要求 HTTPS 最终 200
  2. 零「仅 .FAIL 的链接」：href 不含 .FAIL
  3. 零「红条链接」：被链页正文不含 class="fail-banner" / 「内容核查未通过（FAIL）」
  4. 零「缺正式名的链接」：本地 reports/ 下对应文件必须存在

不发送任何推送；不读 .env；在线模式不走代理。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.parse import urldefrag, urljoin, urlparse

SITE_HOSTS = ("report.wenspock.site", "report.wenspock.com")
SGT = timezone(timedelta(hours=8), name="Asia/Singapore")
FAIL_BANNER_RE = re.compile(r'class="fail-banner"|内容核查未通过（FAIL）')


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag in ("a", "link"):
            attrs_d = dict(attrs)
            href = attrs_d.get("href")
            if href and not (tag == "link" and attrs_d.get("rel") in ("stylesheet", "icon", "preload")):
                self.hrefs.append(href)


def collect(path: str) -> list[str]:
    parser = Links()
    parser.feed(open(path, encoding="utf-8", errors="replace").read())
    return parser.hrefs


def today_sgt(now: datetime | None = None) -> str:
    stamp = now or datetime.now(tz=SGT)
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=SGT)
    return stamp.astimezone(SGT).strftime("%Y-%m-%d")


def official_rel_from_url(path: str) -> str:
    rel = path.lstrip("/") or "index.html"
    if rel.endswith("/"):
        rel += "index.html"
    return rel


def fetch(url: str):
    import urllib.error
    import urllib.request

    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req = urllib.request.Request(url, headers={"User-Agent": "report-morning-check/2"})
    try:
        resp = opener.open(req, timeout=20)
        body = ""
        if resp.headers.get_content_type() == "text/html":
            body = resp.read(2_000_000).decode("utf-8", "replace")
        return resp.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, ""
    except Exception:
        return 0, ""


def default_reports_root() -> str:
    env = os.environ.get("REPORT_OUT_DIR") or os.environ.get("REPORTS_ROOT")
    if env:
        return os.path.abspath(env)
    here = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "reports"))
    if os.path.isdir(here):
        return here
    if os.path.isdir("/srv/www/daily-report/reports"):
        return "/srv/www/daily-report/reports"
    return here


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reports-root", default=default_reports_root())
    parser.add_argument("--base", default="https://report.wenspock.site/")
    parser.add_argument("--index", default=None)
    parser.add_argument("--page", action="append", default=[])
    parser.add_argument("--include-today-daily", action="store_true", default=None)
    parser.add_argument("--no-today-daily", action="store_true")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--today", help="覆盖 Asia/Singapore 当日（YYYY-MM-DD），仅供夹具")
    parser.add_argument("--json")
    args = parser.parse_args(argv)

    reports_root = os.path.abspath(args.reports_root)
    index_path = args.index or os.path.join(reports_root, "index.html")
    include_today = (True if args.include_today_daily else False) if args.include_today_daily is not None else (not args.no_today_daily)

    sources = []
    if os.path.isfile(index_path):
        sources.append((index_path, urljoin(args.base, "index.html")))
    elif args.index:
        print(f"FAIL source_missing {index_path}")
        return 1

    pages = list(args.page)
    if include_today:
        today = args.today or today_sgt()
        daily = os.path.join(reports_root, "daily", f"github-ai-trending-{today}.html")
        if os.path.isfile(daily) and daily not in pages:
            pages.append(daily)

    for page in pages:
        if not os.path.isfile(page):
            print(f"FAIL source_missing {page}")
            return 1
        rel = os.path.relpath(os.path.abspath(page), reports_root)
        sources.append((page, urljoin(args.base, rel.replace(os.sep, "/"))))

    if not sources:
        print("BAD_LINK 未提供可检查的页面")
        return 1

    seen: dict[str, str] = {}
    for path, page_url in sources:
        for href in collect(path):
            url, _ = urldefrag(urljoin(page_url, href.strip()))
            if not url:
                continue
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or parsed.hostname not in SITE_HOSTS:
                continue
            seen.setdefault(url, os.path.basename(path))

    bad = []
    rows = []
    for url, src in sorted(seen.items()):
        parsed = urlparse(url)
        reasons = []
        if ".FAIL" in url:
            reasons.append("仅FAIL链")
        rel = official_rel_from_url(parsed.path)
        local = os.path.join(reports_root, rel)
        local_body = ""
        if rel.endswith(".html") and not os.path.isfile(local):
            reasons.append("缺正式名")
        elif os.path.isfile(local):
            local_body = open(local, encoding="utf-8", errors="replace").read()
            if FAIL_BANNER_RE.search(local_body):
                reasons.append("红条")
        code = 200 if args.offline else None
        if not args.offline:
            code, body = fetch(url.replace("http://", "https://", 1))
            if code != 200:
                reasons.append(f"HTTP{code}")
            elif FAIL_BANNER_RE.search(body) and "红条" not in reasons:
                reasons.append("红条")
        rows.append({"url": url, "from": src, "code": code, "bad": reasons})
        if reasons:
            bad.append(f"{url} [{','.join(reasons)}] (来自 {src})")

    print(f"links_checked={len(rows)} bad={len(bad)}")
    for item in bad:
        print("BAD_LINK " + item)
    if args.json:
        json.dump(rows, open(args.json, "w"), ensure_ascii=False, indent=1)
    if not rows:
        print("BAD_LINK 未解析到任何站内链接")
        return 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
