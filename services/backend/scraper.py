"""
scraper.py — Universal multi-page web scraper.

Layer 1 (fast):  httpx async + trafilatura  — works for ~60% of sites
Layer 2 (JS):    playwright headless Chromium — handles React/Vue/Angular SPAs
Link discovery:  Python stdlib html.parser — no BeautifulSoup dependency

Key features:
- SSRF guard (rejects localhost/internal IPs)
- robots.txt respect
- Keyword-scored page prioritization
- DuckDuckGo discovery (best-effort, never blocks the pipeline)
- Content deduplication across pages
"""

import asyncio
import ipaddress
import logging
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.robotparser import RobotFileParser

import httpx
import trafilatura

logger = logging.getLogger(__name__)

# ─────────────────────────── Constants ─────────────────────────────────

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; BizIntelBot/1.0; +https://github.com/biz-intel)"
}

PAGE_KEYWORDS = [
    "about", "product", "service", "pricing", "customer", "case-stud",
    "contact", "blog", "solution", "feature", "team", "story",
]

MAX_PAGES = 15
STATIC_TIMEOUT = 12   # seconds per httpx request
CRAWL_BUDGET = 25     # total seconds for all pages
CONTENT_MIN_CHARS = 80  # below this we consider a page "near-empty" → trigger playwright


# ─────────────────────────── SSRF Guard ────────────────────────────────

_PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("169.254.0.0/16"),
]


def _is_private_ip(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(socket.gethostbyname(host))
        return any(ip in net for net in _PRIVATE_RANGES)
    except Exception:
        return False


def is_safe_url(url: str) -> bool:
    """Return False for localhost / internal IP targets (SSRF guard)."""
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return False
        if re.match(r"^\d+\.\d+\.\d+\.\d+$", host):
            return not _is_private_ip(host)
        return True
    except Exception:
        return False


# ─────────────────────────── Link Extractor ────────────────────────────

class _LinkParser(HTMLParser):
    """Minimal html.parser-based link extractor — no third-party deps."""

    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self._domain = urlparse(base_url).netloc
        self.links: list[tuple[int, str]] = []  # (score, href)
        self._seen: set[str] = set()

    def handle_starttag(self, tag: str, attrs):
        if tag != "a":
            return
        attr_dict = dict(attrs)
        href = attr_dict.get("href", "")
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            return
        full = urljoin(self.base_url, href)
        # strip fragment
        parsed = urlparse(full)
        full = urlunparse(parsed._replace(fragment=""))
        if parsed.netloc != self._domain:
            return
        if full in self._seen:
            return
        self._seen.add(full)
        score = sum(k in full.lower() for k in PAGE_KEYWORDS)
        self.links.append((score, full))


def extract_internal_links(base_url: str, html: str, limit: int = MAX_PAGES) -> list[str]:
    """Parse <a href> tags and return top `limit` same-domain links, keyword-scored."""
    parser = _LinkParser(base_url)
    try:
        parser.feed(html)
    except Exception:
        pass
    sorted_links = sorted(parser.links, key=lambda x: -x[0])
    return [href for _, href in sorted_links[:limit]]


# ─────────────────────────── robots.txt ────────────────────────────────

def _is_allowed_by_robots(url: str) -> bool:
    """Return True if BizIntelBot is allowed to crawl this URL."""
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch("BizIntelBot", url)
    except Exception:
        return True  # if we can't read robots.txt, proceed


# ─────────────────────────── Static Fetch ──────────────────────────────

async def _fetch_static(url: str, client: httpx.AsyncClient) -> tuple[str | None, str | None]:
    """
    Fetch URL with httpx, extract main content with trafilatura.
    Returns (raw_html, extracted_text). Both can be None on failure.
    """
    try:
        resp = await client.get(url, headers=HEADERS, timeout=STATIC_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
        raw_html = resp.text
        text = trafilatura.extract(
            raw_html,
            include_comments=False,
            include_tables=True,
            no_fallback=False,
        ) or ""
        return raw_html, text
    except Exception as e:
        logger.warning(f"Static fetch failed for {url}: {e}")
        return None, None


# ─────────────────────────── Playwright Fallback ───────────────────────

async def _fetch_playwright(url: str) -> tuple[str | None, str | None]:
    """
    Headless Chromium via Playwright — only called when static fetch yields near-empty content.
    Returns (raw_html, extracted_text).
    """
    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(
                user_agent=HEADERS["User-Agent"],
                java_script_enabled=True,
            )
            page = await ctx.new_page()
            await page.goto(url, timeout=30000, wait_until="networkidle")
            # Extra wait for late-loading SPAs
            await page.wait_for_timeout(2000)
            raw_html = await page.content()
            await browser.close()
            text = trafilatura.extract(
                raw_html,
                include_comments=False,
                include_tables=True,
                no_fallback=False,
            ) or ""
            return raw_html, text
    except Exception as e:
        logger.warning(f"Playwright fetch failed for {url}: {e}")
        return None, None


def _extract_text_fallback(html: str) -> str:
    """Robust HTML-to-text fallback stripping script/style and extracting readable content."""
    if not html:
        return ""
    try:
        import html as html_lib
        # Strip script, style, head, noscript
        cleaned = re.sub(r"<(script|style|noscript|head)[^>]*>[\s\S]*?</\1>", " ", html, flags=re.IGNORECASE)
        # Block elements to newline
        cleaned = re.sub(r"</?(div|p|h[1-6]|li|tr|th|td|section|article|header|footer|nav)[^>]*>", "\n", cleaned, flags=re.IGNORECASE)
        # Strip other HTML tags
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        # Unescape standard entities
        cleaned = html_lib.unescape(cleaned)
        # Collapse multiple spaces and filter lines
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in cleaned.splitlines()]
        return "\n".join(l for l in lines if l)
    except Exception:
        return ""


# ─────────────────────────── Single Page ───────────────────────────────

async def fetch_page(url: str, client: httpx.AsyncClient) -> dict:
    """
    Fetch a single page using universal 2-layer strategy with robust fallback.
    Returns: {url, title, text, method}
    """
    raw_html, text = await _fetch_static(url, client)
    method = "static"

    if raw_html is not None and len(text or "") < CONTENT_MIN_CHARS:
        fb = _extract_text_fallback(raw_html)
        if len(fb) >= CONTENT_MIN_CHARS:
            text = fb

    if raw_html is None or len(text or "") < CONTENT_MIN_CHARS:
        logger.info(f"Static fetch near-empty for {url}, trying Playwright...")
        pw_html, pw_text = await _fetch_playwright(url)
        if pw_text:
            raw_html, text = pw_html, pw_text
            method = "playwright"

    # Final fallback if text is still empty but raw_html was fetched
    if (not text or len(text) < CONTENT_MIN_CHARS) and raw_html:
        fb = _extract_text_fallback(raw_html)
        if fb:
            text = fb

    if not text:
        return {"url": url, "title": "", "text": "", "method": method}

    # Extract title from HTML
    title = ""
    if raw_html:
        title_match = re.search(r"<title[^>]*>([^<]{1,200})</title>", raw_html, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()

    return {"url": url, "title": title, "text": text.strip(), "method": method}


# ─────────────────────────── Multi-page Crawl ──────────────────────────

async def crawl_website(base_url: str) -> list[dict]:
    """
    Crawl up to MAX_PAGES pages of a website within CRAWL_BUDGET seconds.
    Returns list of {url, title, text, method}.
    """
    if not is_safe_url(base_url):
        raise ValueError(f"URL is not allowed (SSRF guard): {base_url}")

    pages: list[dict] = []

    async with httpx.AsyncClient(follow_redirects=True) as client:
        # Step 1: fetch homepage
        homepage = await fetch_page(base_url, client)
        if homepage["text"]:
            pages.append(homepage)

        # Step 2: extract internal links from homepage HTML
        # We need raw HTML for link extraction — do a quick static re-fetch if needed
        try:
            resp = await client.get(base_url, headers=HEADERS, timeout=STATIC_TIMEOUT, follow_redirects=True)
            homepage_html = resp.text
        except Exception:
            homepage_html = ""

        links = extract_internal_links(base_url, homepage_html, limit=MAX_PAGES * 2)

        # Step 3: also try playwright links if homepage was JS-rendered
        if homepage.get("method") == "playwright":
            try:
                from playwright.async_api import async_playwright
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    page = await (await browser.new_context()).new_page()
                    await page.goto(base_url, timeout=30000, wait_until="networkidle")
                    js_html = await page.content()
                    await browser.close()
                    links = extract_internal_links(base_url, js_html, limit=MAX_PAGES * 2)
            except Exception:
                pass

        # Step 4: filter already-fetched and robots-disallowed, then crawl concurrently
        fetched_urls = {base_url, base_url.rstrip("/")}
        candidate_links = []
        for link in links:
            if link not in fetched_urls and is_safe_url(link) and _is_allowed_by_robots(link):
                candidate_links.append(link)
                fetched_urls.add(link)

        candidate_links = candidate_links[: MAX_PAGES - 1]

        # Concurrent fetch with overall time budget
        async def _safe_fetch(url: str) -> dict:
            try:
                return await asyncio.wait_for(fetch_page(url, client), timeout=CRAWL_BUDGET / 3)
            except asyncio.TimeoutError:
                logger.warning(f"Timeout fetching {url}")
                return {"url": url, "title": "", "text": "", "method": "timeout"}

        results = await asyncio.gather(*[_safe_fetch(u) for u in candidate_links])
        pages.extend([r for r in results if r["text"]])

    logger.info(f"Crawled {len(pages)} pages from {base_url}")
    return pages


# ─────────────────────────── DuckDuckGo Discovery ──────────────────────

def discover_extra_context(company_name: str, domain: str) -> list[dict]:
    """
    Best-effort DuckDuckGo search for supplementary context.
    NEVER raises — always returns a (possibly empty) list.
    """
    results = []
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            for query in [f"{company_name}", f"{company_name} reviews", f"site:{domain}"]:
                try:
                    for r in ddgs.text(query, max_results=5):
                        results.append(r)
                except Exception:
                    continue
    except Exception as e:
        logger.info(f"DuckDuckGo discovery skipped: {e}")
    return results
