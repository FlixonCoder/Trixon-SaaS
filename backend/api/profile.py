"""
Trixon Backend — Profile API Routes

Endpoints for viewing and updating user profiles.
Used during onboarding to collect founder information.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from backend.core.auth import CurrentUser
from backend.core.supabase_client import get_supabase
from backend.models.profile import ProfileResponse, ProfileUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(user: CurrentUser) -> ProfileResponse:
    """
    Get the current user's profile.

    Returns profile data including onboarding information
    (name, company, role, primary goal) and plan status.
    Auto-creates a default profile if one doesn't exist yet.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    try:
        result = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user["id"])
            .maybe_single()
            .execute()
        )

        if result is None or result.data is None:
            # Auto-create a blank profile for this user
            logger.info(f"Auto-creating profile for user {user['id']}")
            insert_result = (
                supabase.table("profiles")
                .insert({
                    "id": user["id"],
                    "full_name": "",
                    "company_name": None,
                    "role": None,
                    "primary_goal": None,
                    "plan": "free",
                })
                .execute()
            )
            if not insert_result.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create profile",
                )
            return ProfileResponse(**insert_result.data[0])

        return ProfileResponse(**result.data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch profile for user {user['id']}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch profile",
        )


@router.patch("", response_model=ProfileResponse)
async def update_profile(
    user: CurrentUser,
    profile_data: ProfileUpdate,
) -> ProfileResponse:
    """
    Update the current user's profile.

    Used during onboarding to save founder name, company name,
    role, and primary goal. Only non-null fields are updated.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    # Only include fields that were explicitly set (not None)
    update_data = profile_data.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    try:
        result = (
            supabase.table("profiles")
            .update(update_data)
            .eq("id", user["id"])
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found",
            )

        return ProfileResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update profile for user {user['id']}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )
