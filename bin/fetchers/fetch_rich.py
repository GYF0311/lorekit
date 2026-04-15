#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx>=0.27",
#   "beautifulsoup4>=4.12",
#   "lxml>=5.0",
#   "markdownify>=0.11",
# ]
# ///
"""fetch-rich: URL → local article.md + images/ for visual Claude Read.

Complement to qiaomu-markdown-proxy. Downloads images to local disk and
rewrites markdown img refs to relative paths so Claude can Read each file.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from markdownify import markdownify as md

SCRIPT_DIR = Path(__file__).resolve().parent
L2_SCRIPT = SCRIPT_DIR / "fetch_rich_l2.py"
OUT_ROOT = Path("/tmp/fetch-rich")

UA_IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)
UA_DESKTOP = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

MAX_IMG_BYTES = 5 * 1024 * 1024
IMG_CONCURRENCY = 5
HTTP_TIMEOUT = 20


# --- dataclasses --------------------------------------------------------------

@dataclass
class ImgRef:
    idx: int
    original_url: str
    alt: str = ""
    local_rel: Optional[str] = None
    status: str = "pending"  # ok | too_large | failed | skipped
    bytes: int = 0


@dataclass
class ParsedDoc:
    title: str = ""
    author: str = ""
    publish_time: str = ""
    body_html: str = ""  # inner HTML of main container, with rewritten <img src>
    images: list[ImgRef] = field(default_factory=list)


# --- site detection & headers -------------------------------------------------

def detect_site(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "mp.weixin.qq.com" in host:
        return "weixin"
    return "generic"


def build_headers(site: str) -> dict:
    if site == "weixin":
        return {
            "User-Agent": UA_IPHONE,
            "Referer": "https://mp.weixin.qq.com/",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    return {
        "User-Agent": UA_DESKTOP,
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }


# --- fetch layer --------------------------------------------------------------

def fetch_html_httpx(url: str, headers: dict) -> str:
    with httpx.Client(headers=headers, follow_redirects=True, timeout=HTTP_TIMEOUT) as c:
        r = c.get(url)
        r.raise_for_status()
        return r.text


def detect_antibot(html: str, site: str) -> bool:
    triggers = [
        "环境异常", "请在微信客户端打开", "完成验证后即可继续",
        "Just a moment", "cf-browser-verification",
    ]
    if any(t in html for t in triggers):
        return True
    if site == "weixin" and "js_content" not in html:
        return True
    return False


def fetch_html_via_l2(url: str) -> str:
    if not L2_SCRIPT.exists():
        raise FileNotFoundError(f"L2 script missing: {L2_SCRIPT}")
    proc = subprocess.run(
        ["python3", str(L2_SCRIPT), url],
        capture_output=True, text=True, timeout=90,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "L2 failed with no stderr")
    if not proc.stdout:
        raise RuntimeError("L2 returned empty HTML")
    return proc.stdout


# --- parsing ------------------------------------------------------------------

def normalize_imgs_in_soup(root, base_url: str) -> list[ImgRef]:
    """Rewrite data-src → src, absolute-ize, return ImgRef list in doc order."""
    refs: list[ImgRef] = []
    for i, img in enumerate(root.find_all("img"), start=1):
        real = (img.get("data-src") or img.get("data-original")
                or img.get("data-url") or img.get("src") or "").strip()
        if not real or real.startswith("data:"):
            img.decompose()
            continue
        real = urljoin(base_url, real)
        img["src"] = real
        for k in ("data-src", "data-original", "data-url", "data-w",
                  "data-ratio", "data-type", "data-s", "srcset"):
            img.attrs.pop(k, None)
        alt = (img.get("alt") or "").strip()
        refs.append(ImgRef(idx=i, original_url=real, alt=alt))
    return refs


def parse_weixin(html: str, base_url: str) -> ParsedDoc:
    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("h1#activity-name") or soup.select_one("h1.rich_media_title")
    title = title_el.get_text(strip=True) if title_el else ""
    if not title:
        meta = soup.find("meta", {"property": "og:title"})
        if meta and meta.get("content"):
            title = meta["content"].strip()

    author_el = soup.select_one("a#js_name") or soup.select_one("#js_author_name")
    author = author_el.get_text(strip=True) if author_el else ""

    pub_el = soup.select_one("em#publish_time") or soup.select_one("#publish_time")
    pub = pub_el.get_text(strip=True) if pub_el else ""

    body = soup.select_one("div#js_content")
    if body is None:
        return ParsedDoc(title=title, author=author, publish_time=pub)

    for tag in body.find_all(["script", "style"]):
        tag.decompose()

    imgs = normalize_imgs_in_soup(body, base_url)
    return ParsedDoc(title=title, author=author, publish_time=pub,
                     body_html=str(body), images=imgs)


def parse_generic(html: str, base_url: str) -> ParsedDoc:
    soup = BeautifulSoup(html, "lxml")
    title = ""
    t = soup.find("title")
    if t:
        title = t.get_text(strip=True)
    og = soup.find("meta", {"property": "og:title"})
    if og and og.get("content"):
        title = og["content"].strip() or title

    body = (soup.find("article") or soup.find("main")
            or soup.find("div", attrs={"id": re.compile("content|article", re.I)})
            or soup.body)
    if body is None:
        return ParsedDoc(title=title)

    for tag in body.find_all(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    imgs = normalize_imgs_in_soup(body, base_url)
    return ParsedDoc(title=title, body_html=str(body), images=imgs)


# --- image download -----------------------------------------------------------

MAGIC = [
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
]


def sniff_ext(head: bytes, content_type: str = "") -> Optional[str]:
    for sig, ext in MAGIC:
        if head.startswith(sig):
            return ext
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ".webp"
    ct = content_type.lower()
    if "image/jpeg" in ct or "image/jpg" in ct:
        return ".jpg"
    if "image/png" in ct:
        return ".png"
    if "image/gif" in ct:
        return ".gif"
    if "image/webp" in ct:
        return ".webp"
    return None


async def download_one(client: httpx.AsyncClient, ref: ImgRef, images_dir: Path,
                       sem: asyncio.Semaphore) -> None:
    async with sem:
        for attempt in (1, 2):
            try:
                r = await client.get(ref.original_url)
                if r.status_code != 200:
                    if attempt == 2:
                        ref.status = "failed"
                    continue
                cl = int(r.headers.get("content-length") or 0)
                if cl and cl > MAX_IMG_BYTES:
                    ref.status = "too_large"
                    return
                data = r.content
                if len(data) > MAX_IMG_BYTES:
                    ref.status = "too_large"
                    return
                ext = sniff_ext(data[:16], r.headers.get("content-type", ""))
                if ext is None:
                    if attempt == 2:
                        ref.status = "failed"
                    continue
                fname = f"img_{ref.idx:02d}{ext}"
                (images_dir / fname).write_bytes(data)
                ref.local_rel = f"./images/{fname}"
                ref.status = "ok"
                ref.bytes = len(data)
                return
            except Exception:
                if attempt == 2:
                    ref.status = "failed"


async def download_images(imgs: list[ImgRef], images_dir: Path, headers: dict) -> None:
    if not imgs:
        return
    images_dir.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(IMG_CONCURRENCY)
    async with httpx.AsyncClient(headers=headers, follow_redirects=True,
                                 timeout=HTTP_TIMEOUT) as client:
        await asyncio.gather(*(download_one(client, r, images_dir, sem) for r in imgs))


# --- output -------------------------------------------------------------------

def rewrite_body_img_srcs(body_html: str, imgs: list[ImgRef]) -> str:
    soup = BeautifulSoup(body_html, "lxml")
    url_to_ref = {r.original_url: r for r in imgs}
    for img in soup.find_all("img"):
        src = img.get("src", "")
        ref = url_to_ref.get(src)
        if ref and ref.local_rel:
            img["src"] = ref.local_rel
    return str(soup)


def body_to_markdown(body_html: str) -> str:
    return md(body_html, heading_style="ATX", strip=["script", "style"]).strip()


def slugify(s: str) -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff\-]+", "-", s, flags=re.UNICODE).strip("-")
    return s[:60] or "untitled"


def target_dir(url: str, title: str, out_root: Path = OUT_ROOT) -> Path:
    base = slugify(title) if title else hashlib.sha1(url.encode()).hexdigest()[:12]
    d = out_root / base
    n = 2
    while d.exists():
        d = out_root / f"{base}-{n}"
        n += 1
    return d


def write_outputs(out_dir: Path, doc: ParsedDoc, url: str,
                  md_text: str, fetched_at: float) -> tuple[Path, dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    md_path = out_dir / "article.md"
    frontmatter_parts = ["---"]
    if doc.title:
        frontmatter_parts.append(f'title: "{doc.title}"')
    if doc.author:
        frontmatter_parts.append(f'author: "{doc.author}"')
    if doc.publish_time:
        frontmatter_parts.append(f'date: "{doc.publish_time}"')
    frontmatter_parts.append(f'url: "{url}"')
    frontmatter_parts.append("---\n")
    body_md = ""
    if doc.title:
        body_md += f"# {doc.title}\n\n"
    body_md += md_text + "\n"
    md_path.write_text("\n".join(frontmatter_parts) + body_md, encoding="utf-8")

    counts = {"ok": 0, "too_large": 0, "failed": 0, "skipped": 0}
    failed = []
    for r in doc.images:
        counts[r.status] = counts.get(r.status, 0) + 1
        if r.status != "ok":
            failed.append({"idx": r.idx, "url": r.original_url, "status": r.status})

    meta = {
        "title": doc.title,
        "author": doc.author,
        "publish_time": doc.publish_time,
        "url": url,
        "fetched_at": fetched_at,
        "image_total": len(doc.images),
        "image_counts": counts,
        "failed_images": failed,
    }
    (out_dir / "metadata.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return md_path, meta


# --- main orchestration -------------------------------------------------------

def run(url: str, no_images: bool = False, force_l2: bool = False,
        out_root: Path = OUT_ROOT) -> int:
    site = detect_site(url)
    headers = build_headers(site)

    html = ""
    source = "L1"
    try:
        if force_l2:
            raise RuntimeError("forced L2")
        html = fetch_html_httpx(url, headers)
        if detect_antibot(html, site):
            print("L1 hit antibot, falling back to L2", file=sys.stderr)
            raise RuntimeError("antibot")
    except httpx.HTTPStatusError as e:
        code = e.response.status_code if e.response is not None else "?"
        print(f"ERROR http {code}", flush=True)
        return 3
    except (httpx.HTTPError,) as e:
        print(f"L1 network error: {e}; trying L2", file=sys.stderr)
        html = ""
    except Exception:
        html = ""

    if not html or detect_antibot(html, site):
        try:
            html = fetch_html_via_l2(url)
            source = "L2"
        except Exception as e:
            print(f"ERROR network L2 failed: {e}", flush=True)
            print("ANTIBOT_BLOCKED", flush=True)
            return 4

    # parse
    if site == "weixin":
        doc = parse_weixin(html, url)
    else:
        doc = parse_generic(html, url)

    if not doc.body_html or len(BeautifulSoup(doc.body_html, "lxml").get_text(strip=True)) < 50:
        print("ERROR empty_body", flush=True)
        return 5

    # download images
    if not no_images and doc.images:
        asyncio.run(download_images(doc.images, Path("/tmp/_fr_tmp_images"),
                                    build_headers(site)))
        # move to real target dir later
    # we delayed target_dir until we know title; if we downloaded to tmp we need to move.
    # Simpler: compute target first.
    out_dir = target_dir(url, doc.title, out_root=out_root)
    images_dir = out_dir / "images"
    if not no_images and doc.images:
        images_dir.mkdir(parents=True, exist_ok=True)
        tmp_dir = Path("/tmp/_fr_tmp_images")
        if tmp_dir.exists():
            for f in tmp_dir.iterdir():
                shutil.move(str(f), str(images_dir / f.name))
            shutil.rmtree(tmp_dir, ignore_errors=True)

    rewritten = rewrite_body_img_srcs(doc.body_html, doc.images)
    md_text = body_to_markdown(rewritten)

    md_path, meta = write_outputs(out_dir, doc, url, md_text, time.time())

    # stdout contract
    counts = meta["image_counts"]
    print(f"title: {doc.title or '(none)'}")
    print(f"author: {doc.author or '(none)'}")
    print(f"source: {source}")
    print(f"images: {counts.get('ok',0)} ok, "
          f"{counts.get('too_large',0)} too_large, "
          f"{counts.get('failed',0)} failed")
    print(f"markdown: {md_path}")
    print(f"images_dir: {images_dir}")
    print("OK fetch-rich")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="fetch-rich: URL → local md + images")
    ap.add_argument("url")
    ap.add_argument("--no-images", action="store_true", help="skip image download")
    ap.add_argument("--l2-only", action="store_true", help="skip L1, go straight to L2")
    ap.add_argument("--out", metavar="DIR", default=None,
                    help="parent directory for the produced slug subdir (default: /tmp/fetch-rich)")
    args = ap.parse_args(argv)
    out_root = Path(args.out).expanduser().resolve() if args.out else OUT_ROOT
    try:
        return run(args.url, no_images=args.no_images, force_l2=args.l2_only,
                   out_root=out_root)
    except KeyboardInterrupt:
        print("ERROR interrupted", flush=True)
        return 130


if __name__ == "__main__":
    sys.exit(main())
