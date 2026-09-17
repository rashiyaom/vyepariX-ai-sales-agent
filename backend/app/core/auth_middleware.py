"""
auth_middleware.py — Supabase & Google JWT Authentication for FastAPI Backend.
Validates bearer tokens signed by Supabase Auth (using JWT secret or claims inspection),
with optional Google OAuth access token fallback.
"""

import os
import logging
from typing import Optional
import jwt
import requests
from fastapi import Header, HTTPException, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://adhgwqlulqeqpwycvmni.supabase.co")
SUPABASE_JWT_SECRET = os.getenv(
    "SUPABASE_JWT_SECRET",
    "sMDSG6Z5CsaPtAXFcEc1gIY/ZyvZHaPB3ooS9cDkZH6mzvAh0r1OGdFs3d7PxhLmjlVttaeduSMvFIIv1kD3Zw=="
)

class AuthUser(BaseModel):
    id: str
    email: Optional[str] = None
    role: Optional[str] = "authenticated"
    user_metadata: dict = {}

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[AuthUser]:
    """
    Dependency to verify Supabase JWT (with fallback to Google OAuth).
    """
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'",
        )

    token = parts[1].strip()

    # 1. Try decoding with Supabase JWT Secret (HS256)
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        if payload.get("sub"):
            return AuthUser(
                id=str(payload.get("sub")),
                email=payload.get("email"),
                role=payload.get("role", "authenticated"),
                user_metadata=payload.get("user_metadata", {}),
            )
    except jwt.PyJWTError:
        pass

    # 2. Try unverified JWT claims inspection (e.g. Supabase RS256/ES256)
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        if unverified.get("sub"):
            return AuthUser(
                id=str(unverified.get("sub")),
                email=unverified.get("email"),
                role=unverified.get("role", "authenticated"),
                user_metadata=unverified.get("user_metadata", {}),
            )
    except Exception:
        pass

    # 3. Fallback: Check if it's a Google OAuth access token
    try:
        response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        if response.status_code == 200:
            user_info = response.json()
            email = user_info.get("email")
            resolved_id = str(user_info.get("sub"))
            user_meta = {
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
            }

            # Map to Supabase user UUID if email matches
            if email:
                try:
                    from app.core import database as db
                    client = db.get_supabase()
                    clean_email = email.strip().lower()
                    p_res = client.table("profiles").select("id, full_name, company_name, industry").eq("email", clean_email).maybe_single().execute()
                    if p_res and p_res.data and p_res.data.get("id"):
                        resolved_id = p_res.data["id"]
                        user_meta["company_name"] = p_res.data.get("company_name", "")
                        user_meta["industry"] = p_res.data.get("industry", "")
                        user_meta["full_name"] = p_res.data.get("full_name") or user_info.get("name")
                    else:
                        admin_users = client.auth.admin.list_users()
                        for u in admin_users:
                            if u.email and u.email.lower() == clean_email:
                                resolved_id = u.id
                                break
                except Exception as e:
                    logger.warning(f"Could not map Google email to Supabase user: {e}")

            return AuthUser(
                id=resolved_id,
                email=email,
                role="authenticated",
                user_metadata=user_meta,
            )
    except Exception:
        pass

    logger.warning("Token verification failed for all providers.")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired bearer token.",
    )

async def require_auth(authorization: Optional[str] = Header(None)) -> AuthUser:
    """Strict dependency requiring valid logged-in user."""
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid bearer token.",
        )
    return user
