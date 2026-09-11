"""
normalizer.py — Combines scraped pages, uploaded documents, and business context into a normalized intelligence profile.

Features:
- Proportional token budgeting so ALL uploaded documents (PDF, CSV, XLSX, etc.) are guaranteed inclusion
- Formats clear document demarcation headers: [DOCUMENT 1 OF N], [DOCUMENT 2 OF N]
- Extracts company name from domain, page titles, or document headers
"""

import re
from datetime import datetime, timezone
from urllib.parse import urlparse

# Global budget for Groq request
MAX_TOTAL_DOC_CHARS = 12000
MAX_PAGE_CHARS = 2000


def _guess_company_name(
    source_url: str | None,
    pages: list[dict],
    business_description: str | None = None,
    processed_docs: list[dict] | None = None,
) -> str:
    """Best-effort company name."""
    for page in pages:
        title = page.get("title", "")
        if title and len(title) < 80:
            name = re.split(r"[|\-–—]", title)[0].strip()
            if name and not name.lower().startswith(("home", "welcome", "index", "about us", "http")):
                return name

    if processed_docs:
        for doc in processed_docs:
            fname = doc.get("filename", "")
            base = re.sub(r"\.[^.]+$", "", fname)
            clean = re.sub(r"[_\-]+", " ", base).strip().title()
            # Extract first distinct brand word if possible
            words = clean.split()
            if words and len(words[0]) > 2 and words[0].lower() not in ["business", "analytics", "sales", "profile", "report", "deck"]:
                return words[0]

    if source_url:
        domain = urlparse(source_url).netloc
        domain = re.sub(r"^www\.", "", domain)
        if domain:
            base = domain.split(".")[0].title()
            if base.lower() not in ["netlify", "vercel", "github", "render", "app"]:
                return base

    if business_description:
        first_line = business_description.strip().split("\n")[0].strip()
        match = re.search(r"^(?:Company|Business|Name|Brand|Portfolio)?[:\-]?\s*([A-Za-z0-9\s&'.-]{2,30})", first_line, re.IGNORECASE)
        if match:
            extracted = match.group(1).strip()
            if len(extracted) > 1 and not extracted.lower().startswith(("i want", "we are", "i am", "a ", "the ")):
                return extracted

    return "Business Entity"


def _truncate_text(text: str, max_chars: int) -> str:
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    last_nl = cut.rfind("\n")
    if last_nl > int(max_chars * 0.75):
        cut = cut[:last_nl]
    return cut + "\n[...content truncated for token budget...]"


def build_profile(
    source_url: str | None = None,
    pages: list[dict] | None = None,
    linkedin_url: str | None = None,
    extra_links: list[str] | None = None,
    ddg_snippets: list[dict] | None = None,
    business_description: str | None = None,
    processed_docs: list[dict] | None = None,
) -> dict:
    pages = pages or []
    processed_docs = processed_docs or []

    company_name = _guess_company_name(source_url, pages, business_description, processed_docs)

    # Calculate per-document character quota so every document is guaranteed inclusion
    num_docs = max(len(processed_docs), 1)
    per_doc_quota = max(int(MAX_TOTAL_DOC_CHARS / num_docs), 2500)

    formatted_docs = []
    for doc in processed_docs:
        fname = doc.get("filename", "Uploaded File")
        ftype = doc.get("doc_type", "document")
        fsize_kb = round(doc.get("size_bytes", 0) / 1024, 1)
        content = doc.get("content_text") or doc.get("content", "")
        err = doc.get("error")

        doc_entry = {
            "filename": fname,
            "doc_type": ftype,
            "size_kb": fsize_kb,
            "error": err,
            "content": _truncate_text(content, per_doc_quota) if not err else f"(Error: {err})",
        }
        formatted_docs.append(doc_entry)

    clean_pages = []
    for p in pages:
        t = p.get("text", "").strip()
        if t:
            clean_pages.append({
                "url": p.get("url", ""),
                "title": p.get("title", ""),
                "text": _truncate_text(t, MAX_PAGE_CHARS),
            })

    return {
        "source_url": source_url or "",
        "company_name": company_name,
        "business_description": business_description or "",
        "documents": formatted_docs,
        "pages": clean_pages,
        "linkedin_url": linkedin_url,
        "extra_links": extra_links or [],
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "page_count": len(clean_pages),
        "doc_count": len(formatted_docs),
    }


def profile_to_markdown(profile: dict) -> str:
    """
    Format a multi-source intelligence dossier guaranteeing every attached document is distinctly highlighted.
    """
    lines = []
    company = profile.get("company_name", "Target Company")
    lines.append(f"# INTELLIGENCE DOSSIER: {company}")

    if profile.get("source_url"):
        lines.append(f"**Primary Website:** {profile.get('source_url')}")
    if profile.get("business_description"):
        lines.append(f"\n### User-Provided Context & Objectives:\n{profile['business_description'].strip()}")

    docs = profile.get("documents", [])
    if docs:
        lines.append(f"\n=======================================================")
        lines.append(f"## ATTACHED DOCUMENTS ({len(docs)} TOTAL FILES ATTACHED)")
        lines.append(f"=======================================================")
        for i, doc in enumerate(docs, 1):
            fname = doc.get("filename", f"Doc_{i}")
            ftype = doc.get("doc_type", "doc").upper()
            content = doc.get("content", "")
            lines.append(f"\n### >>> [DOCUMENT {i} OF {len(docs)}]: {fname} (Type: {ftype})")
            lines.append(content)
            lines.append(f"--- END OF DOCUMENT {i} ({fname}) ---\n")

    pages = profile.get("pages", [])
    if pages:
        lines.append(f"\n=======================================================")
        lines.append(f"## PUBLIC WEB ASSETS ({len(pages)} PAGES)")
        lines.append(f"=======================================================")
        for i, page in enumerate(pages[:4], 1):
            title = page.get("title", "Page")
            url = page.get("url", "")
            lines.append(f"\n### [WEB PAGE {i}]: {title} ({url})")
            lines.append(page.get("text", "")[:1500])

    return "\n".join(lines)
