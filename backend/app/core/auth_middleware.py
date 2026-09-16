"""
auth_middleware.py — Google JWT Authentication for FastAPI Backend.
Validates bearer tokens signed by Google (RS256) instead of Supabase.
"""

import os
import logging
import requests
from typing import Optional
from fastapi import Header, HTTPException, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

class AuthUser(BaseModel):
    id: str
    email: Optional[str] = None
    role: Optional[str] = "authenticated"
    user_metadata: dict = {}

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[AuthUser]:
    """
    Dependency to verify Google JWT.
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

    try:
        # Verify the Google access token by calling the userinfo endpoint
        response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        
        if response.status_code != 200:
            raise ValueError(f"Google API returned {response.status_code}: {response.text}")
            
        user_info = response.json()
        
        return AuthUser(
            id=user_info.get("sub"),
            email=user_info.get("email"),
            role="authenticated",
            user_metadata={
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
            },
        )
    except ValueError as e:
        logger.warning(f"Google JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Google token: {e}",
        )
    except Exception as e:
        logger.warning(f"Unexpected error verifying token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )

async def require_auth(authorization: Optional[str] = Header(None)) -> AuthUser:
    """Strict dependency requiring valid logged-in user."""
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Google bearer token.",
        )
    return user
