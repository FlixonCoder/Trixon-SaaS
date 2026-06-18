"""
Trixon Backend — Pydantic Models for VCS Connections

Request/response schemas for GitHub/GitLab OAuth operations.
"""

from pydantic import BaseModel, Field


class VCSConnectRequest(BaseModel):
    """Request body for connecting a VCS account via OAuth callback."""

    code: str = Field(..., description="OAuth authorization code from the callback")
    state: str | None = Field(None, description="OAuth state parameter for CSRF protection")


class VCSConnectionResponse(BaseModel):
    """Response body for a VCS connection."""

    id: str
    platform: str
    platform_username: str | None = None
    created_at: str


class VCSDisconnectResponse(BaseModel):
    """Response body after disconnecting a VCS account."""

    message: str = "VCS connection removed successfully"
