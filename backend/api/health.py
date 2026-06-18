"""
Trixon Backend — Health Check Endpoint

Provides a /health endpoint that verifies connectivity to
Supabase and Redis, and reports the application version.
"""

from fastapi import APIRouter, Header, HTTPException

from backend.core.config import get_settings
from backend.core.supabase_client import check_supabase_health

router = APIRouter()


def verify_admin(x_admin_secret: str = Header(...)):
    settings = get_settings()
    if not settings.admin_secret or x_admin_secret != settings.admin_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret")


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


from fastapi import Depends
@router.get("/admin/key-pool-status", tags=["Admin"], dependencies=[Depends(verify_admin)])
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
