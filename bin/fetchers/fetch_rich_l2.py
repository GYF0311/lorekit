#!/usr/bin/env python3
"""L2 fallback: fetch rendered HTML via system-python Playwright.

Usage: fetch_rich_l2.py <url>
Prints raw HTML to stdout on success, error message to stderr on failure.
Exit 0 = success, 1 = failure.
"""
import asyncio
import sys


UA_MOBILE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)


async def fetch(url: str) -> str:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent=UA_MOBILE,
                locale="zh-CN",
                viewport={"width": 390, "height": 844},
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            if "mp.weixin.qq.com" in url:
                try:
                    await page.wait_for_selector("#js_content", timeout=15000)
                except Exception:
                    pass
            await page.wait_for_timeout(1500)
            return await page.content()
        finally:
            await browser.close()


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: fetch_rich_l2.py <url>", file=sys.stderr)
        return 1
    try:
        html = asyncio.run(fetch(sys.argv[1]))
    except Exception as e:
        print(f"L2 playwright failed: {e}", file=sys.stderr)
        return 1
    sys.stdout.write(html)
    return 0


if __name__ == "__main__":
    sys.exit(main())
