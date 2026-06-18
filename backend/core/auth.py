"""
Trixon Backend — JWT Authentication Middleware

Validates Supabase JWT tokens from the Authorization header
on all private API routes. Extracts the user ID from the token
and makes it available to route handlers via dependency injection.

Supabase JWTs are standard JWTs signed with the project's JWT secret.
We verify them by fetching the JWKS from Supabase's auth endpoint.
"""

import logging
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Request, status
from supabase import Client

from backend.core.config import get_settings
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)


async def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency that extracts and validates the Supabase JWT
    from the Authorization header.

    Returns a dict with user information:
        {
            "id": "uuid-string",
            "email": "user@example.com",
            "role": "authenticated"
        }

    Raises HTTPException 401 if the token is missing, invalid, or expired.
    """
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract token from "Bearer <token>"
    parts = auth_header.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]

    # Validate token using Supabase's auth.get_user()
    # This is the most reliable approach — Supabase verifies the JWT
    # server-side and returns the user if valid.
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable. Please try again later.",
        )

    try:
        user_response = supabase.auth.get_user(token)

        if user_response is None or user_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = user_response.user
        return {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Type alias for use in route handler signatures
# Usage: async def my_route(user: CurrentUser):
CurrentUser = Annotated[dict, Depends(get_current_user)]
