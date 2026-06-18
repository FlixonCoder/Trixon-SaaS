"""
Trixon Backend — Pydantic Models for Profiles

Request/response schemas for user profile operations.
"""

from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    """Request body for updating a user's profile during onboarding."""

    full_name: str | None = Field(None, min_length=1, max_length=200)
    company_name: str | None = Field(None, max_length=200)
    role: str | None = Field(None, pattern="^(founder|agency|other)$")
    primary_goal: str | None = Field(None, max_length=500)


class ProfileResponse(BaseModel):
    """Response body for profile data."""

    id: str
    full_name: str | None = None
    company_name: str | None = None
    role: str | None = None
    primary_goal: str | None = None
    plan: str = "free"
    is_admin: bool = False
    created_at: str | None = None
