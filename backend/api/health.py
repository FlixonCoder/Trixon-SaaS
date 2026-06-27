"""
Trixon Backend — Health Check Endpoint

Provides a /health endpoint that verifies connectivity to
Supabase and Redis, and reports the application version.
"""

from fastapi import APIRouter, Depends, HTTPException

from backend.core.auth import require_admin
from backend.core.config import get_settings
from backend.core.supabase_client import check_supabase_health

router = APIRouter()


@router.get("/health", tags=["Infrastructure"])
async def health_check() -> dict:
    """
    Health check endpoint.

    Returns the application status, version, and connectivity
    status for Supabase and Redis. Used by Railway for health
    monitoring and by the frontend for API availability checks.
    """
    settings = get_settings()

    supabase_ok = await check_supabase_health()

    return {
        "status": "ok",
        "version": settings.app_version,
        "service": settings.app_name,
        "supabase": supabase_ok,
    }


@router.get("/admin/key-pool-status", tags=["Admin"], dependencies=[Depends(require_admin)])
async def key_pool_status() -> dict:
    """
    Returns the current rate limit and cooldown status for all keys in the Groq pool.
    """
    from backend.core.key_pool_client import get_key_pool
    pool = get_key_pool()
    if pool is None:
        return {
            "error": "Key pool not initialized or no keys configured."
        }

    return {
        "pool_size": len(pool),
        "keys": pool.status()
    }

