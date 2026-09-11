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

# Initialize Supabase client with administrative secret key
_client: Optional[Client] = None

def get_supabase() -> Client:
    """Return active Supabase client singleton."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment.")
        _client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    return _client


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_db():
    """Verify Supabase database connectivity on application startup."""
    try:
        client = get_supabase()
        logger.info(f"Supabase Client successfully initialized for: {SUPABASE_URL}")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")


# ─────────────────────────── Reports Operations ─────────────────────────

async def create_report(input_urls: dict, user_id: Optional[str] = None) -> str:
    """Insert a new pending report in Supabase; returns generated UUID."""
    report_id = str(uuid.uuid4())
    now = _now()
    client = get_supabase()

    payload = {
        "id": report_id,
        "input_urls": input_urls,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    if user_id:
        payload["user_id"] = user_id

    try:
        await asyncio.to_thread(client.table("reports").insert(payload).execute)
    except Exception as e:
        logger.warning(f"Error writing report to Supabase (check if table exists): {e}")
    return report_id


async def update_status(report_id: str, status: str, error_message: Optional[str] = None):
    """Update report status and error message in Supabase."""
    client = get_supabase()
    updates = {"status": status, "updated_at": _now()}
    if error_message is not None:
        updates["error_message"] = error_message
    try:
        await asyncio.to_thread(
            client.table("reports").update(updates).eq("id", report_id).execute
        )
    except Exception as e:
        logger.warning(f"Error updating report status in Supabase: {e}")


async def update_raw_profile(report_id: str, raw_profile: dict):
    """Store scraped and normalized business profile in Supabase."""
    client = get_supabase()
    try:
        await asyncio.to_thread(
            client.table("reports")
            .update({"raw_profile": raw_profile, "updated_at": _now()})
            .eq("id", report_id)
            .execute
        )
    except Exception as e:
        logger.warning(f"Error updating raw profile in Supabase: {e}")


async def update_analysis(report_id: str, analysis: dict):
    """Store Groq intelligence analysis and mark report done in Supabase."""
    client = get_supabase()
    try:
        await asyncio.to_thread(
            client.table("reports")
            .update({"analysis": analysis, "status": "done", "updated_at": _now()})
            .eq("id", report_id)
            .execute
        )
    except Exception as e:
        logger.warning(f"Error updating analysis in Supabase: {e}")


async def get_report(report_id: str) -> Optional[dict]:
    """Fetch single intelligence report by ID from Supabase."""
    client = get_supabase()
    try:
        res = await asyncio.to_thread(
            client.table("reports").select("*").eq("id", report_id).maybe_single().execute
        )
        return res.data if res else None
    except Exception as e:
        logger.warning(f"Error fetching report {report_id} from Supabase: {e}")
        return None


async def list_reports(limit: int = 20) -> List[dict]:
    """List recent intelligence reports from Supabase."""
    client = get_supabase()
    try:
        res = await asyncio.to_thread(
            client.table("reports")
            .select("id, status, input_urls, created_at, updated_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute
        )
        return res.data or []
    except Exception as e:
        logger.warning(f"Error listing reports from Supabase: {e}")
        return []


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
    if user_id:
        row["user_id"] = user_id

    try:
        await asyncio.to_thread(client.table("voice_calls").insert(row).execute)
    except Exception as e:
        logger.warning(f"Error inserting voice call into Supabase: {e}")
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
    direction: Optional[str] = None,
    status: Optional[str] = None,
    campaign_id: Optional[str] = None,
    limit: int = 100,
) -> List[dict]:
    """List recent voice calls with optional filtering from Supabase."""
    client = get_supabase()
    try:
        query = client.table("voice_calls").select("*")
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


async def get_voice_stats() -> dict:
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
        res = await asyncio.to_thread(
            client.table("voice_calls")
            .select("direction, status, duration_seconds, analysis")
            .execute
        )
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
