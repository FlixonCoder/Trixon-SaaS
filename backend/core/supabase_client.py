"""
Trixon Backend — Supabase Client

Initializes and provides a singleton Supabase client using the
service role key for backend operations (bypasses RLS).
"""

import logging

from supabase import Client, create_client

from backend.core.config import get_settings

# ── Monkey Patch postgrest-py (maybe_single() 204 error bug) ──
try:
    import postgrest._sync.request_builder
    import postgrest._async.request_builder
    from postgrest.exceptions import APIError

    def patched_sync_execute(self):
        try:
            return postgrest._sync.request_builder.SyncSingleRequestBuilder.execute(self)
        except APIError as e:
            if e.details and "The result contains 0 rows" in e.details:
                return None
            raise

    async def patched_async_execute(self):
        try:
            return await postgrest._async.request_builder.AsyncSingleRequestBuilder.execute(self)
        except APIError as e:
            if e.details and "The result contains 0 rows" in e.details:
                return None
            raise

    postgrest._sync.request_builder.SyncMaybeSingleRequestBuilder.execute = patched_sync_execute
    postgrest._async.request_builder.AsyncMaybeSingleRequestBuilder.execute = patched_async_execute
    logging.getLogger(__name__).info("Applied postgrest maybe_single monkey patch successfully.")
except Exception as patch_err:
    logging.getLogger(__name__).error(f"Failed to apply postgrest monkey patch: {patch_err}")

logger = logging.getLogger(__name__)

_supabase_client: Client | None = None


def get_supabase() -> Client | None:
    """
    Returns the Supabase client singleton.
    Returns None if credentials are not configured.
    """
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning(
            "Supabase credentials not configured. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file."
        )
        return None

    try:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
        logger.info("Supabase client initialized successfully.")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


async def check_supabase_health() -> bool:
    """
    Checks if the Supabase connection is healthy by attempting
    a simple query against the profiles table.
    """
    try:
        client = get_supabase()
        if client is None:
            return False
        # Attempt a lightweight query to verify connectivity
        client.table("profiles").select("id").limit(1).execute()
        return True
    except Exception as e:
        logger.error(f"Supabase health check failed: {e}")
        return False
