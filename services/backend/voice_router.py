"""
voice_router.py — FastAPI Router for Voice Fleet & Telephony Module.

Provides endpoints for:
- Outbound calling (Single and CSV batch campaigns)
- Inbound call simulation & webhooks
- Call logs & timely transcript retrieval
- Groq AI post-call review triggering
- Twilio & Vapi credentials configuration
"""

import asyncio
import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from pydantic import BaseModel, Field

import database as db
import voice_engine

logger = logging.getLogger(__name__)

router = APIRouter()


# ─────────────────────────── Schemas ───────────────────────────────────

class CallRequest(BaseModel):
    customer_name: str = Field(..., min_length=1, description="Target customer or lead name")
    customer_phone: str = Field(..., min_length=3, description="Phone number with country code")
    business_name: str = Field(..., min_length=1, description="Company/business name represented by AI SDR")
    call_reason: str = Field(..., min_length=1, description="Specific context and reason why called")
    direction: Optional[str] = "outbound"
    campaign_id: Optional[str] = None
    force_simulate: Optional[bool] = False
    language: Optional[str] = "auto"


class BatchCallRequest(BaseModel):
    campaign_name: Optional[str] = "CSV Batch Campaign"
    calls: List[CallRequest] = Field(..., min_length=1)
    force_simulate: Optional[bool] = False


class InboundSimRequest(BaseModel):
    customer_name: str = "Vikram Patel"
    customer_phone: str = "+1 (555) 892-4110"
    business_name: str = "Vyaperi X Commercial"
    caller_inquiry: str = "Pricing inquiry for 25 sales seats and enterprise API integration"


class VoiceSettingsPayload(BaseModel):
    vapi_api_key: Optional[str] = None
    vapi_public_key: Optional[str] = None
    vapi_phone_number_id: Optional[str] = None
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_number: Optional[str] = None
    voice_provider: Optional[str] = "11labs"
    voice_id: Optional[str] = "sarah"


# ─────────────────────────── Endpoints ─────────────────────────────────

@router.post("/calls", status_code=201)
async def create_single_call(payload: CallRequest, background_tasks: BackgroundTasks):
    """
    Dispatch a single voice call. Injects dynamic context (business name, customer name, why called).
    Supports live Vapi/Twilio dispatch with automatic fallback to high-fidelity simulation.
    """
    call_id = str(uuid.uuid4())
    call_data = {
        "id": call_id,
        "campaign_id": payload.campaign_id,
        "direction": payload.direction or "outbound",
        "customer_name": payload.customer_name.strip(),
        "customer_phone": payload.customer_phone.strip(),
        "business_name": payload.business_name.strip(),
        "call_reason": payload.call_reason.strip(),
        "status": "queued",
        "duration_seconds": 0,
        "transcript": [],
        "analysis": None,
    }

    await db.create_voice_call(call_data)

    if payload.force_simulate:
        background_tasks.add_task(
            voice_engine.simulate_call_lifecycle,
            call_id=call_id,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            business_name=payload.business_name,
            call_reason=payload.call_reason,
            direction=payload.direction or "outbound",
            language=payload.language or "auto",
        )
    else:
        background_tasks.add_task(
            voice_engine.dispatch_vapi_call,
            call_id=call_id,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            business_name=payload.business_name,
            call_reason=payload.call_reason,
            language=payload.language or "auto",
        )

    return {"success": True, "call_id": call_id, "status": "queued"}


@router.post("/calls/batch", status_code=202)
async def create_batch_calls(payload: BatchCallRequest, background_tasks: BackgroundTasks):
    """
    Dispatch a batch of calls parsed from an uploaded CSV file.
    Each call gets its unique context (customer name, why called, business name).
    """
    campaign_id = str(uuid.uuid4())
    created_call_ids = []

    async def _process_batch(items: List[CallRequest], camp_id: str, force_sim: bool):
        for item in items:
            c_id = str(uuid.uuid4())
            call_data = {
                "id": c_id,
                "campaign_id": camp_id,
                "direction": item.direction or "outbound",
                "customer_name": item.customer_name.strip(),
                "customer_phone": item.customer_phone.strip(),
                "business_name": item.business_name.strip(),
                "call_reason": item.call_reason.strip(),
                "status": "queued",
                "duration_seconds": 0,
                "transcript": [],
                "analysis": None,
            }
            await db.create_voice_call(call_data)
            created_call_ids.append(c_id)

            if force_sim:
                await voice_engine.simulate_call_lifecycle(
                    call_id=c_id,
                    customer_name=item.customer_name,
                    customer_phone=item.customer_phone,
                    business_name=item.business_name,
                    call_reason=item.call_reason,
                    direction=item.direction or "outbound",
                )
            else:
                await voice_engine.dispatch_vapi_call(
                    call_id=c_id,
                    customer_name=item.customer_name,
                    customer_phone=item.customer_phone,
                    business_name=item.business_name,
                    call_reason=item.call_reason,
                )
            await asyncio.sleep(0.5)

    background_tasks.add_task(
        _process_batch,
        payload.calls,
        campaign_id,
        payload.force_simulate or False,
    )

    return {
        "success": True,
        "campaign_id": campaign_id,
        "campaign_name": payload.campaign_name,
        "total_queued": len(payload.calls),
        "status": "processing",
    }


@router.get("/calls")
async def list_calls(
    direction: Optional[str] = Query(None, description="outbound | inbound | all"),
    status: Optional[str] = Query(None, description="queued | in-progress | completed | failed | all"),
    campaign_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """List call history with optional filters and search."""
    calls = await db.list_voice_calls(
        direction=direction,
        status=status,
        campaign_id=campaign_id,
        limit=limit,
    )
    if search and search.strip():
        s = search.strip().lower()
        calls = [
            c for c in calls
            if s in c.get("customer_name", "").lower()
            or s in c.get("customer_phone", "").lower()
            or s in c.get("business_name", "").lower()
            or s in c.get("call_reason", "").lower()
        ]
    return calls


@router.get("/calls/{call_id}")
async def get_call_details(call_id: str):
    """Retrieve full details of a specific call including timely transcripts and Groq AI analysis."""
    call = await db.get_voice_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")

    # If call was placed via live Vapi and is still active, sync latest status & transcripts
    if call.get("vapi_call_id") and call.get("status") in ("queued", "in-progress", "ringing"):
        try:
            synced = await voice_engine.sync_vapi_call_status(call_id)
            if synced:
                call = synced
        except Exception as e:
            logger.warning(f"Failed to sync Vapi call {call_id}: {e}")

    return call


@router.post("/calls/{call_id}/hangup")
async def hangup_call(call_id: str):
    """Explicitly hang up / terminate an ongoing call immediately (via Vapi/telephony carrier)."""
    call = await db.get_voice_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")
    result = await voice_engine.hangup_vapi_call(call_id)
    return result


@router.delete("/calls/{call_id}")
async def delete_call(call_id: str):
    """Delete a call log."""
    deleted = await db.delete_voice_call(call_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Call record not found")
    return {"success": True, "deleted_call_id": call_id}


@router.post("/calls/{call_id}/analyze")
async def analyze_call(call_id: str):
    """(Re)run Groq AI review and analysis on a completed call transcript."""
    call = await db.get_voice_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")

    transcript = call.get("transcript") or []
    if not transcript:
        raise HTTPException(status_code=400, detail="Cannot analyze call with no recorded transcript")

    analysis = await asyncio.to_thread(
        voice_engine.analyze_call_with_groq,
        business_name=call["business_name"],
        customer_name=call["customer_name"],
        call_reason=call["call_reason"],
        transcript=transcript,
        direction=call.get("direction", "outbound"),
    )

    await db.update_voice_call(call_id, {"analysis": analysis})
    return {"success": True, "call_id": call_id, "analysis": analysis}


@router.post("/simulate-inbound", status_code=201)
async def simulate_inbound_call(payload: InboundSimRequest, background_tasks: BackgroundTasks):
    """
    Simulate an inbound customer call to test inbound call logging,
    timely transcript streaming, and Groq analysis.
    """
    call_id = str(uuid.uuid4())
    call_data = {
        "id": call_id,
        "campaign_id": None,
        "direction": "inbound",
        "customer_name": payload.customer_name.strip(),
        "customer_phone": payload.customer_phone.strip(),
        "business_name": payload.business_name.strip(),
        "call_reason": payload.caller_inquiry.strip(),
        "status": "queued",
        "duration_seconds": 0,
        "transcript": [],
        "analysis": None,
    }
    await db.create_voice_call(call_data)

    background_tasks.add_task(
        voice_engine.simulate_call_lifecycle,
        call_id=call_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        business_name=payload.business_name,
        call_reason=payload.caller_inquiry,
        direction="inbound",
    )

    return {"success": True, "call_id": call_id, "direction": "inbound", "status": "queued"}


@router.post("/webhook/vapi")
async def vapi_webhook(request: Request):
    """
    Public webhook receiver for Vapi AI events (call started, speech transcript, call ended).
    Captures timely transcripts and executes post-call Groq review.
    """
    try:
        body = await request.json()
        logger.info(f"Vapi webhook payload received: {list(body.keys())}")
        result = await voice_engine.handle_vapi_webhook(body)
        return {"ok": True, "result": result}
    except Exception as e:
        logger.exception(f"Error processing Vapi webhook: {e}")
        return {"ok": False, "error": str(e)}


@router.get("/stats")
async def get_stats():
    """Retrieve aggregate statistics for dashboard metric cards."""
    return await db.get_voice_stats()


@router.get("/config")
async def get_config():
    """Get active voice and telephony configuration (masked for security)."""
    creds = await voice_engine.get_credentials()
    return {
        "has_vapi_key": bool(creds.get("vapi_api_key")),
        "vapi_key_masked": f"...{creds['vapi_api_key'][-4:]}" if creds.get("vapi_api_key") else "",
        "vapi_public_key": creds.get("vapi_public_key", ""),
        "vapi_phone_number_id": creds.get("vapi_phone_number_id", ""),
        "has_twilio_sid": bool(creds.get("twilio_account_sid")),
        "twilio_account_sid_masked": f"...{creds['twilio_account_sid'][-4:]}" if creds.get("twilio_account_sid") else "",
        "twilio_phone_number": creds.get("twilio_phone_number", ""),
        "voice_provider": creds.get("voice_provider", "11labs"),
        "voice_id": creds.get("voice_id", "sarah"),
    }


@router.post("/config")
async def save_config(payload: VoiceSettingsPayload):
    """Save or update Vapi & Twilio telephony credentials."""
    updates = {}
    if payload.vapi_api_key is not None:
        updates["vapi_api_key"] = payload.vapi_api_key.strip()
    if payload.vapi_public_key is not None:
        updates["vapi_public_key"] = payload.vapi_public_key.strip()
    if payload.vapi_phone_number_id is not None:
        updates["vapi_phone_number_id"] = payload.vapi_phone_number_id.strip()
    if payload.twilio_account_sid is not None:
        updates["twilio_account_sid"] = payload.twilio_account_sid.strip()
    if payload.twilio_auth_token is not None:
        updates["twilio_auth_token"] = payload.twilio_auth_token.strip()
    if payload.twilio_phone_number is not None:
        updates["twilio_phone_number"] = payload.twilio_phone_number.strip()
    if payload.voice_provider is not None:
        updates["voice_provider"] = payload.voice_provider.strip()
    if payload.voice_id is not None:
        updates["voice_id"] = payload.voice_id.strip()

    await db.save_voice_settings(updates)
    return {"success": True, "message": "Telephony configuration updated successfully"}
