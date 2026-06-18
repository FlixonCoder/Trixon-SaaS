"""
Trixon Backend — Analytics API Routes

Endpoint for frontend usage tracking pings.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.services.analytics import track_event

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class ClientEventRequest(BaseModel):
    event_type: str
    project_id: str | None = None
    properties: dict | None = None


@router.post("/event")
async def track_client_event(user: CurrentUser, body: ClientEventRequest):
    """
    Receive an arbitrary analytics event from the frontend.
    """
    track_event(
        user_id=user["id"],
        event_type=body.event_type,
        project_id=body.project_id,
        properties=body.properties,
    )
    return {"status": "tracked"}
