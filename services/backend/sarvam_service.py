"""
Sarvam AI Text-to-Speech (Bulbul v3) Integration Service
Provides ultra-realistic, native Indic voice synthesis for Hindi, Gujarati, and other regional languages.
Used for direct web browser playback and Vapi Custom Voice telephony bridging.
"""

import os
import io
import wave
import base64
import logging
from typing import Optional, Tuple
import httpx

logger = logging.getLogger("vyepari.sarvam")

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_DEFAULT_MODEL = "bulbul:v3"

# Valid Bulbul:v3 speakers
VALID_SPEAKERS = {
    "priya": {"gender": "female", "description": "Clear, natural Indian female voice (recommended for Hindi & Gujarati)"},
    "aditya": {"gender": "male", "description": "Articulate, professional Indian male voice"},
    "pooja": {"gender": "female", "description": "Warm, consultative Indian female voice"},
    "shubh": {"gender": "male", "description": "Smooth, engaging Indian male voice"},
    "ritu": {"gender": "female", "description": "Expressive Indian female voice"},
    "rohan": {"gender": "male", "description": "Energetic Indian male voice"},
    "simran": {"gender": "female", "description": "Pleasant Indian female voice"},
    "kavya": {"gender": "female", "description": "Polite Indian female voice"},
}

# In-memory audio cache: key -> {"audio_b64": str, "pcm_bytes": bytes, "sample_rate": int}
_AUDIO_CACHE: dict[str, dict] = {}


def get_sarvam_api_key() -> str:
    """Retrieve Sarvam API key from env or fallback."""
    return os.getenv("SARVAM_API_KEY", "").strip()


def resolve_language_code(language_input: Optional[str] = "hi") -> str:
    """
    Resolve shorthand language names/codes to Sarvam BCP-47 language codes.
    Default to Hindi if ambiguous or auto.
    """
    lang = (language_input or "hi").strip().lower()
    if lang in ("gu", "gujarati", "gu-in"):
        return "gu-IN"
    elif lang in ("hi", "hindi", "hi-in"):
        return "hi-IN"
    elif lang in ("en", "english", "en-in"):
        return "en-IN"
    elif lang in ("mr", "marathi", "mr-in"):
        return "mr-IN"
    elif lang in ("ta", "tamil", "ta-in"):
        return "ta-IN"
    elif lang in ("te", "telugu", "te-in"):
        return "te-IN"
    elif lang in ("bn", "bengali", "bn-in"):
        return "bn-IN"
    return "hi-IN"


def resolve_speaker(speaker_input: Optional[str] = "priya") -> str:
    """Ensure speaker is valid for Bulbul:v3."""
    spk = (speaker_input or "priya").strip().lower()
    if spk in VALID_SPEAKERS:
        return spk
    return "priya"


async def synthesize_speech(
    text: str,
    language: Optional[str] = "hi",
    speaker: Optional[str] = "priya",
    pace: float = 1.0,
    api_key: Optional[str] = None,
) -> dict:
    """
    Synthesizes speech using Sarvam AI Bulbul:v3.
    Returns:
        {
            "success": bool,
            "audio_b64": str (WAV audio base64 encoded),
            "mime_type": "audio/wav",
            "language_code": str,
            "speaker": str,
            "error": Optional[str]
        }
    """
    key = (api_key or get_sarvam_api_key()).strip()
    if not key:
        return {
            "success": False,
            "error": "Sarvam API key is not configured. Set SARVAM_API_KEY in backend settings.",
        }

    clean_text = text.strip()
    if not clean_text:
        return {"success": False, "error": "Text cannot be empty."}

    lang_code = resolve_language_code(language)
    spk = resolve_speaker(speaker)

    # Check cache
    cache_key = f"{lang_code}:{spk}:{pace}:{clean_text}"
    if cache_key in _AUDIO_CACHE:
        cached = _AUDIO_CACHE[cache_key]
        return {
            "success": True,
            "audio_b64": cached["audio_b64"],
            "mime_type": "audio/wav",
            "language_code": lang_code,
            "speaker": spk,
            "cached": True,
        }

    headers = {
        "api-subscription-key": key,
        "Content-Type": "application/json",
    }

    # Sarvam expects inputs as an array of strings, max 2500 chars total
    payload = {
        "inputs": [clean_text[:2400]],
        "target_language_code": lang_code,
        "speaker": spk,
        "model": SARVAM_DEFAULT_MODEL,
        "pace": max(0.5, min(2.0, pace)),
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(SARVAM_TTS_URL, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                audios = data.get("audios", [])
                if audios:
                    audio_b64 = audios[0]
                    # Cache the result (limit cache to 200 entries to prevent memory leak)
                    if len(_AUDIO_CACHE) > 200:
                        _AUDIO_CACHE.pop(next(iter(_AUDIO_CACHE)))
                    _AUDIO_CACHE[cache_key] = {
                        "audio_b64": audio_b64,
                    }
                    return {
                        "success": True,
                        "audio_b64": audio_b64,
                        "mime_type": "audio/wav",
                        "language_code": lang_code,
                        "speaker": spk,
                    }
                else:
                    return {"success": False, "error": "Sarvam returned empty audio list."}
            else:
                err_msg = resp.text
                logger.error(f"Sarvam TTS failed ({resp.status_code}): {err_msg}")
                return {"success": False, "error": f"Sarvam error ({resp.status_code}): {err_msg}"}
    except Exception as e:
        logger.exception(f"Exception during Sarvam TTS request: {e}")
        return {"success": False, "error": str(e)}


async def synthesize_raw_pcm(
    text: str,
    language: Optional[str] = "hi",
    speaker: Optional[str] = "priya",
    api_key: Optional[str] = None,
) -> Tuple[Optional[bytes], int]:
    """
    Synthesizes speech and returns raw 16-bit PCM bytes and sample rate
    specifically required by Vapi Custom Voice webhook interface.
    Returns: (pcm_bytes, sample_rate)
    """
    res = await synthesize_speech(text, language=language, speaker=speaker, api_key=api_key)
    if not res.get("success") or not res.get("audio_b64"):
        return None, 0

    try:
        raw_wav_bytes = base64.b64decode(res["audio_b64"])
        with wave.open(io.BytesIO(raw_wav_bytes), "rb") as wf:
            sample_rate = wf.getframerate()
            frames = wf.readframes(wf.getnframes())
            return frames, sample_rate
    except Exception as e:
        logger.exception(f"Failed to extract PCM frames from Sarvam WAV: {e}")
        return None, 0
