"""
main.py — FastAPI application entry point.

Endpoints:
  POST /api/reports          — Multipart submit with files, URLs, business context
  GET  /api/reports/{id}     — Poll status + get structured multi-source analysis
  GET  /api/reports          — List recent reports
  GET  /health               — Health check
"""

import json
import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

import database as db
import doc_processor
import groq_client
import normalizer
import scraper
import data_engine
import voice_router

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


# ─────────────────────────── Lifespan ──────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    yield


# ─────────────────────────── App Setup ─────────────────────────────────

app = FastAPI(
    title="BizIntel Enterprise — AI Sales Intelligence & Commercial Due-Diligence",
    description="Multi-source automated discovery: documents (PDF, CSV, Excel, Images) + web scraping + Groq Llama 3 intelligence engine.",
    version="2.0.0",
    lifespan=lifespan,
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:3001", "http://localhost:8080", "http://localhost:8081", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Voice Fleet Router
app.include_router(voice_router.router, prefix="/api/voice", tags=["Voice Fleet"])

# ─────────────────────────── Supabase Auth Provisioning ─────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = ""
    company_name: Optional[str] = ""
    industry: Optional[str] = "SaaS / Technology"
    auto_confirm: Optional[bool] = True

@app.post("/api/auth/register")
async def register_user(payload: RegisterRequest):
    """
    Registers a new user in Supabase Auth via Admin API.
    Bypasses Supabase free tier email rate limits (4 emails/hr) by directly
    provisioning the user with email_confirm=True, allowing instant login.
    """
    import asyncio
    client = db.get_supabase()
    email_clean = payload.email.strip().lower()

    try:
        # Check if user already exists
        users = await asyncio.to_thread(client.auth.admin.list_users)
        existing = next((u for u in users if u.email and u.email.lower() == email_clean), None)

        if existing:
            await asyncio.to_thread(
                client.auth.admin.update_user_by_id,
                existing.id,
                {
                    "password": payload.password,
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": payload.full_name or existing.user_metadata.get("full_name", ""),
                        "company_name": payload.company_name or existing.user_metadata.get("company_name", ""),
                        "industry": payload.industry or existing.user_metadata.get("industry", ""),
                        "onboarding_completed": False,
                    }
                }
            )
            user_id = existing.id
        else:
            res = await asyncio.to_thread(
                client.auth.admin.create_user,
                {
                    "email": email_clean,
                    "password": payload.password,
                    "email_confirm": payload.auto_confirm,
                    "user_metadata": {
                        "full_name": payload.full_name or "",
                        "company_name": payload.company_name or "My Enterprise",
                        "industry": payload.industry or "SaaS / Technology",
                        "onboarding_completed": False,
                    }
                }
            )
            user_id = res.user.id

        return {
            "success": True,
            "user_id": user_id,
            "email": email_clean,
            "confirmed": True,
            "message": "User provisioned and confirmed successfully in Supabase."
        }
    except Exception as e:
        logger.error(f"Error provisioning user in Supabase: {e}")
        raise HTTPException(status_code=400, detail=str(e))



# ─────────────────────────── Request Schemas ────────────────────────────

class ReportRequest(BaseModel):
    website_url: Optional[str] = None
    business_description: Optional[str] = None
    linkedin_url: Optional[str] = None
    other_links: list[str] = []

    @field_validator("website_url")
    @classmethod
    def validate_website(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            v = "https://" + v
        parsed = urlparse(v)
        if not parsed.netloc:
            raise ValueError("Invalid website URL")
        if not scraper.is_safe_url(v):
            raise ValueError("URL targets a private/internal address (not allowed)")
        return v

    @field_validator("business_description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return v.strip()


# ─────────────────────────── Pipeline Worker ────────────────────────────

async def run_pipeline(
    report_id: str,
    website_url: Optional[str],
    business_description: Optional[str],
    linkedin_url: Optional[str],
    other_links: list[str],
    raw_files: list[tuple[str, bytes]],
):
    """
    Two-tier intelligence pipeline:
    1. Parse uploaded documents
    2. Scrape website (if website URL supplied)
    3. Run dedicated individual deep-dive on EVERY document (guaranteeing 100% extraction)
    4. Run global commercial synthesis for ICPs, Products, Channels, SWOT, and Recommendations
    5. Persist to SQLite
    """
    try:
        # ── Phase 1: Parse Uploaded Documents ─────────────────────────
        processed_docs = []
        if raw_files:
            await db.update_status(report_id, "parsing_docs")
            logger.info(f"[{report_id}] Parsing {len(raw_files)} attached documents...")
            groq_key = os.getenv("GROQ_API_KEY", "")
            processed_docs = doc_processor.process_documents(raw_files, groq_api_key=groq_key)

        # ── Phase 2: Web Scraping ─────────────────────────────────────
        pages = []
        domain = ""
        if website_url:
            await db.update_status(report_id, "scraping")
            logger.info(f"[{report_id}] Scraping web assets: {website_url}")
            pages = await scraper.crawl_website(website_url)

            if not pages and not business_description and not processed_docs:
                await db.update_status(report_id, "failed", "No content could be extracted from the website and no documents/notes provided.")
                return
            domain = urlparse(website_url).netloc
        else:
            logger.info(f"[{report_id}] Direct documents/context mode (skipping website scraping)")

        # ── Phase 3: External Mentions & Normalization ─────────────────
        initial_profile = normalizer.build_profile(
            source_url=website_url,
            pages=pages,
            linkedin_url=linkedin_url,
            extra_links=other_links,
            business_description=business_description,
            processed_docs=processed_docs,
        )
        company_name = initial_profile.get("company_name", domain or "Business Entity")

        ddg_snippets = []
        if website_url or business_description:
            try:
                ddg_snippets = scraper.discover_extra_context(company_name, domain)
            except Exception as e:
                logger.warning(f"[{report_id}] DuckDuckGo search skipped: {e}")

        full_profile = normalizer.build_profile(
            source_url=website_url,
            pages=pages,
            linkedin_url=linkedin_url,
            extra_links=other_links,
            ddg_snippets=ddg_snippets,
            business_description=business_description,
            processed_docs=processed_docs,
        )

        await db.update_raw_profile(report_id, full_profile)

        # ── Phase 4: Tier 1 Individual Document Deep-Dives ────────────
        await db.update_status(report_id, "analyzing")
        logger.info(f"[{report_id}] Running dedicated extraction on {len(processed_docs)} documents...")

        individual_insights = []
        for doc in processed_docs:
            fname = doc.get("filename", "Document")
            ftype = doc.get("doc_type", "document")
            content = doc.get("content_text") or doc.get("content", "")
            if content and not doc.get("error"):
                insight = groq_client.analyze_single_document(fname, ftype, content)
                individual_insights.append(insight)

        # If website scraped, also add a website deep-dive entry
        if pages:
            web_summary_text = "\n\n".join([f"Page: {p.get('title')}\n{p.get('text')[:1000]}" for p in pages[:4]])
            web_insight = groq_client.analyze_single_document(
                doc_name=website_url or "Public Website",
                doc_type="website",
                content_text=web_summary_text,
            )
            individual_insights.append(web_insight)

        # ── Phase 4.5: Deterministic Numerical Extraction & Diagram Generation ──
        data_engine_figures = None
        tabular_file_found = False

        for fname, cbytes in raw_files:
            ext = os.path.splitext(fname.lower())[1]
            if ext in (".csv", ".xlsx", ".xls", ".tsv", ".json"):
                rows = data_engine.extract_rows_from_file(fname, cbytes)
                if rows:
                    data_engine_figures = data_engine.analyze_uploaded_data(rows, fname)
                    if data_engine_figures.get("has_file_data"):
                        tabular_file_found = True
                        logger.info(f"[{report_id}] Direct data file extracted: {data_engine_figures.get('data_source_summary')}")
                        break

        if not tabular_file_found:
            logger.info(f"[{report_id}] No tabular sales file uploaded — synthesizing figures from website & market intelligence")
            data_engine_figures = data_engine.synthesize_website_figures(
                company_name=company_name,
                industry=initial_profile.get("industry", "B2B Enterprise"),
                opportunity_score=86,
            )

        # ── Phase 5: Tier 2 Global Commercial Synthesis ───────────────
        logger.info(f"[{report_id}] Running global commercial synthesis...")
        profile_md = normalizer.profile_to_markdown(full_profile)
        analysis = groq_client.analyze_business(
            profile_markdown=profile_md,
            linkedin_url=linkedin_url,
            extra_links=other_links,
            doc_count=len(processed_docs),
            individual_doc_insights=individual_insights,
            data_engine_figures=data_engine_figures,
        )

        # ── Phase 6: Persist ──────────────────────────────────────────
        await db.update_analysis(report_id, analysis.model_dump())
        logger.info(f"[{report_id}] Enterprise Intelligence Report Completed Successfully ✓")

    except Exception as e:
        logger.exception(f"[{report_id}] Pipeline failed: {e}")
        await db.update_status(report_id, "failed", str(e))


# ─────────────────────────── Endpoints ─────────────────────────────────

@app.post("/api/reports", status_code=202)
async def create_report(
    background_tasks: BackgroundTasks,
    website_url: Optional[str] = Form(None),
    business_description: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    other_links: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
):
    clean_other_links: list[str] = []
    if other_links:
        try:
            parsed = json.loads(other_links)
            if isinstance(parsed, list):
                clean_other_links = [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            clean_other_links = [x.strip() for x in other_links.split(",") if x.strip()]

    validated_website = None
    if website_url and website_url.strip():
        w = website_url.strip()
        if not w.startswith(("http://", "https://")):
            w = "https://" + w
        parsed = urlparse(w)
        if not parsed.netloc:
            raise HTTPException(status_code=422, detail="Invalid website URL format")
        if not scraper.is_safe_url(w):
            raise HTTPException(status_code=422, detail="Website URL targets a private/internal address")
        validated_website = w

    raw_files: list[tuple[str, bytes]] = []
    if files:
        if len(files) > doc_processor.MAX_FILES_PER_REQUEST:
            raise HTTPException(
                status_code=422,
                detail=f"Too many files. Maximum {doc_processor.MAX_FILES_PER_REQUEST} files allowed.",
            )
        for f in files:
            if not f.filename:
                continue
            content = await f.read()
            if len(content) > 0:
                raw_files.append((f.filename, content))

    has_website = bool(validated_website)
    has_desc = bool(business_description and business_description.strip())
    has_files = len(raw_files) > 0

    if not (has_website or has_desc or has_files):
        raise HTTPException(
            status_code=422,
            detail="Please provide at least one source: Website URL, Business Description, or Uploaded Document.",
        )

    report_id = await db.create_report({
        "website": validated_website or "",
        "business_description": business_description or "",
        "linkedin": linkedin_url or "",
        "other": clean_other_links,
        "files": [fname for fname, _ in raw_files],
    })

    background_tasks.add_task(
        run_pipeline,
        report_id=report_id,
        website_url=validated_website,
        business_description=business_description,
        linkedin_url=linkedin_url,
        other_links=clean_other_links,
        raw_files=raw_files,
    )

    return {"report_id": report_id, "status": "pending", "attached_files": len(raw_files)}


@app.get("/api/reports/{report_id}")
async def get_report(report_id: str):
    report = await db.get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.get("/api/reports")
async def list_reports():
    return await db.list_reports(limit=20)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "BizIntel AI Intelligence Platform",
        "supported_extensions": list(doc_processor.ALLOWED_EXTENSIONS),
        "max_file_size_mb": 15,
        "max_files": doc_processor.MAX_FILES_PER_REQUEST,
    }
