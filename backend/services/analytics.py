"""
Trixon Backend — Usage Analytics Service

Fire-and-forget event tracking. Failures here should NEVER break the
actual feature being tracked.
"""

import logging
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

def track_event(
    user_id: str,
    event_type: str,
    project_id: str | None = None,
    properties: dict | None = None,
) -> None:
    """
    Tracks a usage event asynchronously.
    """
    try:
        supabase = get_supabase()
        if not supabase:
            return
            
        supabase.table("usage_events").insert({
            "user_id": user_id,
            "project_id": project_id,
            "event_type": event_type,
            "event_properties": properties or {},
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to track event '{event_type}' for user {user_id}: {e}")
