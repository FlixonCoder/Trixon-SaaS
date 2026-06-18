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

from fastapi import Depends, HTTPException, Request, status

from backend.core.config import get_settings

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

    # Validate token statelessly using Supabase Auth REST API
    # This prevents state leakage on the singleton Supabase client.
    settings = get_settings()
    auth_url = f"{settings.supabase_url}/auth/v1/user"
    
    try:
        import httpx
        with httpx.Client() as client:
            resp = client.get(
                auth_url,
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {token}",
                },
            )
            
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        user_data = resp.json()
        return {
            "id": user_data.get("id"),
            "email": user_data.get("email"),
            "role": user_data.get("role"),
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
