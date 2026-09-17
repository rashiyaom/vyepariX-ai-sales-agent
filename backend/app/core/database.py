"""
database.py — Supabase PostgreSQL Database Adapter for Vyepari X.

Replaces SQLite with Supabase PostgREST & Auth client.
Interacts directly with Supabase tables:
  - public.profiles
  - public.workspaces
  - public.reports
  - public.voice_calls
  - public.voice_settings

Powered by official supabase-py client with service role administrative key.
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://adhgwqlulqeqpwycvmni.supabase.co")
SUPABASE_SECRET_KEY = os.getenv(
    "SUPABASE_SECRET_KEY",
    "sb_secret_pLhz37Ua40LtMqMpciDPvA_Pz7mOwhw"
)
SUPABASE_PUBLISHABLE_KEY = os.getenv(
    "SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_xLcJx_03aKm_jLKJKtzcBA_9R5lF0Hx"
)

def _get_clean_supabase_url() -> str:
    raw = os.getenv("SUPABASE_URL", SUPABASE_URL).strip().rstrip("/")
    if raw.endswith("/rest/v1"):
        raw = raw[:-len("/rest/v1")].rstrip("/")
    return raw

# Initialize Supabase client with administrative secret key
_client: Optional[Client] = None


def get_supabase() -> Client:
    """Return active Supabase client singleton."""
    global _client
    if _client is None:
        url = _get_clean_supabase_url()
        secret_key = os.getenv("SUPABASE_SECRET_KEY", SUPABASE_SECRET_KEY).strip()
        if not url or not secret_key:
            raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment.")
        _client = create_client(url, secret_key)
    return _client


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_in_memory_reports: Dict[str, dict] = {}
_in_memory_video_calls: Dict[str, dict] = {}


def _ensure_uuid(val: Optional[str]) -> Optional[str]:
    """Ensures string is a valid UUID string. Returns None if invalid or non-UUID."""
    if not val:
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    try:
        return str(uuid.UUID(val_str))
    except (ValueError, AttributeError):
        return None


async def init_db():
    """Verify Supabase database connectivity on application startup."""
    try:
        client = get_supabase()
        logger.info(f"Supabase Client successfully initialized for: {SUPABASE_URL}")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")


# ─────────────────────────── Profiles Operations ─────────────────────────

async def get_profile(user_id: str) -> Optional[dict]:
    """Fetch user profile from Supabase by user UUID."""
    client = get_supabase()
    clean_user_id = _ensure_uuid(user_id)
    if not clean_user_id:
        return None
    try:
        res = await asyncio.to_thread(
            client.table("profiles").select("*").eq("id", clean_user_id).maybe_single().execute
        )
        return res.data if res else None
    except Exception as e:
        logger.warning(f"Error fetching profile for {user_id}: {e}")
        return None


async def get_profile_by_email(email: str) -> Optional[dict]:
    """Fetch user profile from Supabase by user email."""
    client = get_supabase()
    clean_email = str(email).strip().lower()
    if not clean_email:
        return None
    try:
        res = await asyncio.to_thread(
            client.table("profiles").select("*").eq("email", clean_email).maybe_single().execute
        )
        return res.data if res else None
    except Exception as e:
        logger.warning(f"Error fetching profile for email {email}: {e}")
        return None


# ─────────────────────────── Reports Operations ─────────────────────────

async def create_report(input_urls: dict, user_id: Optional[str] = None) -> str:
    """Insert a new pending report in Supabase; returns generated UUID."""
    report_id = str(uuid.uuid4())
    now = _now()
    client = get_supabase()

    # Immediately cache in memory so polling get_report works instantaneously
    _in_memory_reports[report_id] = {
        "id": report_id,
        "input_urls": input_urls,
        "status": "pending",
        "raw_profile": None,
        "analysis": None,
        "error_message": None,
        "created_at": now,
        "updated_at": now,
        "user_id": user_id,
    }

    payload = {
        "id": report_id,
        "input_urls": input_urls,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    clean_user_id = _ensure_uuid(user_id)
    if clean_user_id:
        payload["user_id"] = clean_user_id

    try:
        await asyncio.to_thread(client.table("reports").insert(payload).execute)
    except Exception as e:
        logger.warning(f"Error writing report to Supabase with user_id={clean_user_id}: {e}")
        # Retry with user_id=None if foreign-key constraint or uuid format failed
        if "user_id" in payload:
            try:
                payload["user_id"] = None
                await asyncio.to_thread(client.table("reports").insert(payload).execute)
                logger.info(f"Report {report_id} persisted in Supabase with user_id=None fallback.")
            except Exception as e2:
                logger.error(f"Fallback insert for report {report_id} also failed: {e2}")

    return report_id


async def update_status(report_id: str, status: str, error_message: Optional[str] = None):
    """Update report status and error message in Supabase and memory."""
    client = get_supabase()
    updates = {"status": status, "updated_at": _now()}
    if error_message is not None:
        updates["error_message"] = error_message

    if report_id in _in_memory_reports:
        _in_memory_reports[report_id].update(updates)

    try:
        await asyncio.to_thread(
            client.table("reports").update(updates).eq("id", report_id).execute
        )
    except Exception as e:
        logger.warning(f"Error updating report status in Supabase: {e}")


async def update_raw_profile(report_id: str, raw_profile: dict):
    """Store scraped and normalized business profile in Supabase and memory."""
    client = get_supabase()
    updates = {"raw_profile": raw_profile, "updated_at": _now()}
    if report_id in _in_memory_reports:
        _in_memory_reports[report_id].update(updates)

    try:
        await asyncio.to_thread(
            client.table("reports")
            .update(updates)
            .eq("id", report_id)
            .execute
        )
    except Exception as e:
        logger.warning(f"Error updating raw profile in Supabase: {e}")


async def update_analysis(report_id: str, analysis: dict):
    """Store Groq intelligence analysis and mark report done in Supabase and memory."""
    client = get_supabase()
    updates = {"analysis": analysis, "status": "done", "updated_at": _now()}
    if report_id in _in_memory_reports:
        _in_memory_reports[report_id].update(updates)

    try:
        await asyncio.to_thread(
            client.table("reports")
            .update(updates)
            .eq("id", report_id)
            .execute
        )
    except Exception as e:
        logger.warning(f"Error updating analysis in Supabase: {e}")


def _ensure_visual_intelligence(report: dict) -> tuple[dict, bool]:
    """
    Ensures strict adherence to Option A Ground Truth Policy:
    - For website-inferred analyses, growth_forecast and conversion_funnel are strictly empty
      so the dashboard renders the Option A prompt & Option B interactive calibration card.
    - Only timeline_roadmap (tactical execution plan) and commercial catalog highlights are kept.
    """
    analysis = report.get("analysis")
    if not analysis or not isinstance(analysis, dict):
        return report, False

    needs_update = False
    is_website_mode = analysis.get("data_source_mode") != "uploaded_file"

    if is_website_mode:
        # Enforce Option A: strictly clear any simulated curves for website-only analyses
        if analysis.get("growth_forecast"):
            analysis["growth_forecast"] = []
            needs_update = True
        if analysis.get("conversion_funnel"):
            analysis["conversion_funnel"] = []
            needs_update = True

    if not analysis.get("timeline_roadmap"):
        try:
            from app.services.data_engine import synthesize_website_figures
            company = analysis.get("company_name") or "Target Company"
            ind = analysis.get("industry") or "B2B Commercial Enterprise"
            opp = analysis.get("opportunity_score") or 85
            prods = analysis.get("products_services") or []

            synth = synthesize_website_figures(
                company_name=company,
                industry=ind,
                opportunity_score=opp,
                products=prods,
            )
            if synth.get("timeline_roadmap"):
                analysis["timeline_roadmap"] = synth["timeline_roadmap"]
                needs_update = True
        except Exception as e:
            logger.warning(f"Error ensuring timeline for report {report.get('id')}: {e}")

    report["analysis"] = analysis
    return report, needs_update


async def get_report(report_id: str) -> Optional[dict]:
    """Fetch single intelligence report by ID from Supabase with in-memory fallback."""
    client = get_supabase()
    try:
        res = await asyncio.to_thread(
            client.table("reports").select("*").eq("id", report_id).maybe_single().execute
        )
        if res and res.data:
            report = res.data
            report, updated = _ensure_visual_intelligence(report)
            if updated:
                # Persist the enriched visual arrays back so future calls are instant
                asyncio.create_task(update_analysis(report_id, report["analysis"]))
            _in_memory_reports[report_id] = report
            return report
    except Exception as e:
        logger.warning(f"Error fetching report {report_id} from Supabase: {e}")

    # Fallback to in-memory report if PostgREST record is not yet visible or insert had failed
    if report_id in _in_memory_reports:
        rep = dict(_in_memory_reports[report_id])
        rep, _ = _ensure_visual_intelligence(rep)
        return rep

    return None


async def list_reports(user_id: Optional[str] = None, limit: int = 50) -> List[dict]:
    """List recent intelligence reports from Supabase with user association and in-memory fallback."""
    client = get_supabase()
    clean_user_id = _ensure_uuid(user_id)
    try:
        query = client.table("reports").select("id, status, input_urls, analysis, raw_profile, created_at, updated_at, user_id")
        if clean_user_id:
            query = query.or_(f"user_id.eq.{clean_user_id},user_id.is.null")
        res = await asyncio.to_thread(
            query.order("created_at", desc=True).limit(limit).execute
        )
        raw_list = res.data or []
        enriched_list = []
        seen_ids = set()
        for r in raw_list:
            enriched, updated = _ensure_visual_intelligence(r)
            if updated and r.get("id"):
                asyncio.create_task(update_analysis(r["id"], enriched["analysis"]))
            enriched_list.append(enriched)
            if r.get("id"):
                seen_ids.add(r["id"])

        # Also merge any active in-memory reports not yet in Supabase
        for mid, mrep in _in_memory_reports.items():
            if mid not in seen_ids:
                rep_copy = dict(mrep)
                rep_copy, _ = _ensure_visual_intelligence(rep_copy)
                enriched_list.insert(0, rep_copy)

        return enriched_list
    except Exception as e:
        logger.warning(f"Error listing reports from Supabase: {e}")
        return list(_in_memory_reports.values())


# ─────────────────────────── Voice Fleet Operations ───────────────────

async def create_voice_call(call_data: dict, user_id: Optional[str] = None) -> str:
    """Insert a new voice call record in Supabase."""
    call_id = call_data.get("id") or str(uuid.uuid4())
    now = _now()
    client = get_supabase()

    transcript = call_data.get("transcript", [])
    if isinstance(transcript, str):
        try:
            transcript = json.loads(transcript)
        except Exception:
            transcript = []

    analysis = call_data.get("analysis")
    if isinstance(analysis, str):
        try:
            analysis = json.loads(analysis)
        except Exception:
            pass

    row = {
        "id": call_id,
        "campaign_id": call_data.get("campaign_id"),
        "direction": call_data.get("direction", "outbound"),
        "customer_name": call_data.get("customer_name", "Customer"),
        "customer_phone": call_data.get("customer_phone", ""),
        "business_name": call_data.get("business_name", "Business"),
        "call_reason": call_data.get("call_reason", "Outbound Consultation"),
        "status": call_data.get("status", "queued"),
        "vapi_call_id": call_data.get("vapi_call_id"),
        "duration_seconds": call_data.get("duration_seconds", 0),
        "started_at": call_data.get("started_at", now),
        "ended_at": call_data.get("ended_at"),
        "transcript": transcript,
        "recording_url": call_data.get("recording_url"),
        "analysis": analysis,
        "error_message": call_data.get("error_message"),
        "created_at": now,
        "updated_at": now,
    }
    clean_user_id = _ensure_uuid(user_id)
    if clean_user_id:
        row["user_id"] = clean_user_id

    try:
        await asyncio.to_thread(client.table("voice_calls").insert(row).execute)
    except Exception as e:
        logger.warning(f"Error inserting voice call into Supabase with user_id={clean_user_id}: {e}")
        if "user_id" in row:
            try:
                row["user_id"] = None
                await asyncio.to_thread(client.table("voice_calls").insert(row).execute)
                logger.info(f"Voice call {call_id} persisted in Supabase with user_id=None fallback.")
            except Exception as e2:
                logger.error(f"Fallback insert for voice call {call_id} also failed: {e2}")
    return call_id


async def update_voice_call(call_id: str, updates: dict):
    """Update fields of an existing voice call record in Supabase."""
    client = get_supabase()
    clean_updates = dict(updates)
    clean_updates["updated_at"] = _now()

    # Ensure json serializable objects
    for k in ("transcript", "analysis"):
        if k in clean_updates and isinstance(clean_updates[k], str):
            try:
                clean_updates[k] = json.loads(clean_updates[k])
            except Exception:
                pass

    try:
        await asyncio.to_thread(
            client.table("voice_calls").update(clean_updates).eq("id", call_id).execute
        )
    except Exception as e:
        logger.warning(f"Error updating voice call in Supabase: {e}")


async def get_voice_call(call_id: str) -> Optional[dict]:
    """Fetch single voice call by ID from Supabase."""
    client = get_supabase()
    try:
        res = await asyncio.to_thread(
            client.table("voice_calls").select("*").eq("id", call_id).maybe_single().execute
        )
        return res.data if res else None
    except Exception as e:
        logger.warning(f"Error fetching voice call from Supabase: {e}")
        return None


async def list_voice_calls(
    user_id: Optional[str] = None,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    campaign_id: Optional[str] = None,
    limit: int = 100,
) -> List[dict]:
    """List recent voice calls with optional filtering and user scoping from Supabase."""
    client = get_supabase()
    clean_user_id = _ensure_uuid(user_id)
    try:
        query = client.table("voice_calls").select("*")
        if clean_user_id:
            query = query.or_(f"user_id.eq.{clean_user_id},user_id.is.null")
        if direction and direction != "all":
            query = query.eq("direction", direction)
        if status and status != "all":
            query = query.eq("status", status)
        if campaign_id:
            query = query.eq("campaign_id", campaign_id)

        query = query.order("created_at", desc=True).limit(limit)
        res = await asyncio.to_thread(query.execute)
        return res.data or []
    except Exception as e:
        logger.warning(f"Error listing voice calls from Supabase: {e}")
        return []


async def delete_voice_call(call_id: str) -> bool:
    """Delete a voice call record from Supabase."""
    client = get_supabase()
    try:
        res = await asyncio.to_thread(
            client.table("voice_calls").delete().eq("id", call_id).execute
        )
        return bool(res.data)
    except Exception as e:
        logger.warning(f"Error deleting voice call from Supabase: {e}")
        return False


async def get_voice_stats(user_id: Optional[str] = None) -> dict:
    """Compute aggregate call stats for dashboard KPI cards from Supabase."""
    client = get_supabase()
    stats = {
        "total_calls": 0,
        "outbound_calls": 0,
        "inbound_calls": 0,
        "completed_calls": 0,
        "in_progress_calls": 0,
        "failed_calls": 0,
        "avg_duration_seconds": 0,
        "hot_leads": 0,
        "positive_sentiment": 0,
    }

    try:
        query = client.table("voice_calls").select("direction, status, duration_seconds, analysis, user_id")
        clean_user_id = _ensure_uuid(user_id)
        if clean_user_id:
            query = query.or_(f"user_id.eq.{clean_user_id},user_id.is.null")
        res = await asyncio.to_thread(query.execute)
        rows = res.data or []
        stats["total_calls"] = len(rows)

        total_dur = 0
        dur_count = 0

        for r in rows:
            dir_val = (r.get("direction") or "outbound").lower()
            status_val = (r.get("status") or "").lower()
            dur = int(r.get("duration_seconds") or 0)

            if dir_val == "outbound":
                stats["outbound_calls"] += 1
            elif dir_val == "inbound":
                stats["inbound_calls"] += 1

            if status_val in ("completed", "ended"):
                stats["completed_calls"] += 1
            elif status_val in ("in-progress", "ringing", "queued"):
                stats["in_progress_calls"] += 1
            elif status_val in ("failed", "no-answer", "busy", "canceled"):
                stats["failed_calls"] += 1

            if dur > 0:
                total_dur += dur
                dur_count += 1

            # Analysis evaluation
            analysis = r.get("analysis")
            if analysis:
                if isinstance(analysis, str):
                    try:
                        analysis = json.loads(analysis)
                    except Exception:
                        analysis = {}
                if isinstance(analysis, dict):
                    if analysis.get("lead_temperature") == "Hot" or (analysis.get("intent_score") or 0) >= 75:
                        stats["hot_leads"] += 1
                    if analysis.get("sentiment") == "positive":
                        stats["positive_sentiment"] += 1

        if dur_count > 0:
            stats["avg_duration_seconds"] = int(total_dur / dur_count)

        return stats
    except Exception as e:
        logger.warning(f"Error computing voice stats from Supabase: {e}")
        return stats


async def get_voice_settings() -> dict:
    """Retrieve saved voice/telephony settings from Supabase."""
    client = get_supabase()
    try:
        res = await asyncio.to_thread(client.table("voice_settings").select("*").execute)
        rows = res.data or []
        return {r["key"]: r["value"] for r in rows if "key" in r and "value" in r}
    except Exception as e:
        logger.warning(f"Error fetching voice settings from Supabase: {e}")
        return {}


async def save_voice_settings(settings: dict) -> dict:
    """Upsert voice/telephony settings in Supabase."""
    client = get_supabase()
    now = _now()
    rows = []
    for k, v in settings.items():
        val_str = json.dumps(v) if not isinstance(v, str) else v
        rows.append({"key": k, "value": val_str, "updated_at": now})

    try:
        if rows:
            await asyncio.to_thread(client.table("voice_settings").upsert(rows).execute)
    except Exception as e:
        logger.warning(f"Error saving voice settings in Supabase: {e}")

    return await get_voice_settings()


# ─────────────────────────── Video Sales Agent Operations ──────────────

async def create_video_call(call_data: dict, user_id: Optional[str] = None) -> str:
    """Insert a new video call record in Supabase."""
    call_id = call_data.get("id") or str(uuid.uuid4())
    now = _now()
    client = get_supabase()

    briefing = call_data.get("briefing")
    if isinstance(briefing, str):
        try:
            briefing = json.loads(briefing)
        except Exception:
            briefing = None

    transcript = call_data.get("transcript", [])
    if isinstance(transcript, str):
        try:
            transcript = json.loads(transcript)
        except Exception:
            transcript = []

    analysis = call_data.get("analysis")
    if isinstance(analysis, str):
        try:
            analysis = json.loads(analysis)
        except Exception:
            analysis = None

    row = {
        "id": call_id,
        "report_id": call_data.get("report_id"),
        "customer_name": call_data.get("customer_name") or "Prospect",
        "customer_email": call_data.get("customer_email"),
        "customer_phone": call_data.get("customer_phone"),
        "business_name": call_data.get("business_name") or "Enterprise",
        "call_reason": call_data.get("call_reason"),
        "status": call_data.get("status", "active"),
        "tavus_conversation_id": call_data.get("tavus_conversation_id"),
        "tavus_persona_id": call_data.get("tavus_persona_id"),
        "conversational_context": call_data.get("conversational_context"),
        "custom_greeting": call_data.get("custom_greeting"),
        "conversation_url": call_data.get("conversation_url"),
        "duration_seconds": call_data.get("duration_seconds", 0),
        "briefing": briefing,
        "transcript": transcript,
        "recording_url": call_data.get("recording_url"),
        "analysis": analysis,
        "error_message": call_data.get("error_message"),
        "started_at": call_data.get("started_at", now),
        "ended_at": call_data.get("ended_at"),
        "created_at": now,
        "updated_at": now,
    }
    clean_user_id = _ensure_uuid(user_id) or _ensure_uuid(call_data.get("user_id"))
    if clean_user_id:
        row["user_id"] = clean_user_id

    # Cache in memory immediately so UI and webhook callbacks always find it
    _in_memory_video_calls[call_id] = dict(row)

    try:
        await asyncio.to_thread(client.table("video_calls").insert(row).execute)
    except Exception as e:
        logger.warning(f"Error inserting video call into Supabase with user_id={clean_user_id}: {e}")
        if "user_id" in row:
            try:
                row["user_id"] = None
                await asyncio.to_thread(client.table("video_calls").insert(row).execute)
                logger.info(f"Video call {call_id} persisted in Supabase with user_id=None fallback.")
            except Exception as e2:
                logger.error(f"Fallback insert for video call {call_id} also failed: {e2}")
    return call_id


async def update_video_call(call_id: str, updates: dict):
    """Update fields of an existing video call record in Supabase and memory."""
    client = get_supabase()
    clean_updates = dict(updates)
    clean_updates["updated_at"] = _now()

    if call_id in _in_memory_video_calls:
        _in_memory_video_calls[call_id].update(clean_updates)

    for k in ("briefing", "transcript", "analysis"):
        if k in clean_updates and isinstance(clean_updates[k], str):
            try:
                clean_updates[k] = json.loads(clean_updates[k])
            except Exception:
                pass

    try:
        await asyncio.to_thread(
            client.table("video_calls").update(clean_updates).eq("id", call_id).execute
        )
    except Exception as e:
        logger.warning(f"Error updating video call {call_id} in Supabase: {e}")


async def get_video_call(call_id: str) -> Optional[dict]:
    """Fetch single video call by ID from Supabase with in-memory fallback."""
    client = get_supabase()
    try:
        res = await asyncio.to_thread(
            client.table("video_calls").select("*").eq("id", call_id).maybe_single().execute
        )
        if res and res.data:
            _in_memory_video_calls[call_id] = res.data
            return res.data
    except Exception as e:
        logger.warning(f"Error fetching video call {call_id} from Supabase: {e}")

    return _in_memory_video_calls.get(call_id)


async def list_video_calls(
    user_id: Optional[str] = None,
    limit: int = 100,
) -> List[dict]:
    """List recent video calls for a user from Supabase with in-memory fallback."""
    client = get_supabase()
    clean_user_id = _ensure_uuid(user_id)
    try:
        query = client.table("video_calls").select("*")
        if clean_user_id:
            query = query.eq("user_id", clean_user_id)
        query = query.order("created_at", desc=True).limit(limit)
        res = await asyncio.to_thread(query.execute)
        if res and res.data:
            return res.data
    except Exception as e:
        logger.warning(f"Error listing video calls from Supabase: {e}")

    # In-memory fallback
    calls = list(_in_memory_video_calls.values())
    if clean_user_id:
        calls = [c for c in calls if str(c.get("user_id") or "") == clean_user_id]
    return calls[:limit]


async def get_video_call_by_tavus_id(tavus_conversation_id: str) -> Optional[dict]:
    """Fetch single video call by Tavus conversation ID from Supabase with in-memory fallback."""
    client = get_supabase()
    try:
        res = await asyncio.to_thread(
            client.table("video_calls")
            .select("*")
            .eq("tavus_conversation_id", tavus_conversation_id)
            .maybe_single()
            .execute
        )
        if res and res.data:
            return res.data
    except Exception as e:
        logger.warning(
            f"Error fetching video call with tavus_conversation_id '{tavus_conversation_id}' from Supabase: {e}"
        )

    for c in _in_memory_video_calls.values():
        if c.get("tavus_conversation_id") == tavus_conversation_id:
            return c
    return None

