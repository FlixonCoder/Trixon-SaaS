"""
Trixon Backend — VCS Connection API Routes

Endpoints for connecting and disconnecting GitHub/GitLab accounts
via OAuth. Handles the OAuth callback flow: receives an authorization
code, exchanges it for an access token, and stores it encrypted.
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException, status

from backend.core.auth import CurrentUser
from backend.core.config import get_settings
from backend.core.encryption import encrypt_token
from backend.core.supabase_client import get_supabase
from backend.models.vcs import VCSConnectRequest, VCSConnectionResponse, VCSDisconnectResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vcs", tags=["VCS Connections"])


@router.get("", response_model=list[VCSConnectionResponse])
async def list_vcs_connections(user: CurrentUser) -> list[VCSConnectionResponse]:
    """List all VCS connections for the current user."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    try:
        res = (
            supabase.table("vcs_connections")
            .select("*")
            .eq("user_id", user["id"])
            .execute()
        )
        return [
            VCSConnectionResponse(
                id=c["id"],
                platform=c["platform"],
                platform_username=c.get("platform_username"),
                created_at=str(c["created_at"]),
            )
            for c in res.data
        ]
    except Exception as e:
        logger.error(f"Failed to list VCS connections for user {user['id']}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list VCS connections",
        )


# -----------------------------------------------
# GitHub OAuth
# -----------------------------------------------

GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


@router.post("/github/connect", response_model=VCSConnectionResponse)
async def connect_github(
    user: CurrentUser,
    body: VCSConnectRequest,
) -> VCSConnectionResponse:
    """
    GitHub OAuth callback handler.

    Receives the authorization code from the frontend, exchanges it
    for an access token via GitHub's OAuth API, fetches the GitHub
    user profile, and stores the encrypted token in `vcs_connections`.
    """
    settings = get_settings()

    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth not configured",
        )

    # Step 1: Exchange authorization code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GITHUB_TOKEN_URL,
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": body.code,
            },
            headers={"Accept": "application/json"},
        )

    if token_response.status_code != 200:
        logger.error(f"GitHub token exchange failed: {token_response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to authenticate with GitHub. Please try again.",
        )

    token_data = token_response.json()
    access_token = token_data.get("access_token")

    if not access_token:
        error = token_data.get("error_description", "Unknown error")
        logger.error(f"GitHub OAuth error: {error}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub authentication failed: {error}",
        )

    # Step 2: Fetch GitHub user profile
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )

    if user_response.status_code != 200:
        logger.error(f"Failed to fetch GitHub user: {user_response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch GitHub user profile",
        )

    github_user = user_response.json()

    # Step 3: Encrypt the access token and store in database
    encrypted_token = encrypt_token(access_token)

    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    try:
        # Check if a GitHub connection already exists for this user
        existing = (
            supabase.table("vcs_connections")
            .select("id")
            .eq("user_id", user["id"])
            .eq("platform", "github")
            .execute()
        )

        if existing.data:
            # Update existing connection
            result = (
                supabase.table("vcs_connections")
                .update(
                    {
                        "platform_user_id": str(github_user["id"]),
                        "platform_username": github_user.get("login", ""),
                        "access_token": encrypted_token,
                    }
                )
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
            # Create new connection
            result = (
                supabase.table("vcs_connections")
                .insert(
                    {
                        "user_id": user["id"],
                        "platform": "github",
                        "platform_user_id": str(github_user["id"]),
                        "platform_username": github_user.get("login", ""),
                        "access_token": encrypted_token,
                    }
                )
                .execute()
            )

        connection = result.data[0]
        return VCSConnectionResponse(
            id=connection["id"],
            platform="github",
            platform_username=github_user.get("login"),
            created_at=connection["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to store GitHub connection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save GitHub connection",
        )


# -----------------------------------------------
# GitLab OAuth
# -----------------------------------------------

GITLAB_TOKEN_URL = "https://gitlab.com/oauth/token"
GITLAB_USER_URL = "https://gitlab.com/api/v4/user"


@router.post("/gitlab/connect", response_model=VCSConnectionResponse)
async def connect_gitlab(
    user: CurrentUser,
    body: VCSConnectRequest,
) -> VCSConnectionResponse:
    """
    GitLab OAuth callback handler.

    Receives the authorization code from the frontend, exchanges it
    for an access token via GitLab's OAuth API, fetches the GitLab
    user profile, and stores the encrypted token in `vcs_connections`.
    """
    settings = get_settings()

    if not settings.gitlab_client_id or not settings.gitlab_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitLab OAuth not configured",
        )

    # Step 1: Exchange authorization code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GITLAB_TOKEN_URL,
            data={
                "client_id": settings.gitlab_client_id,
                "client_secret": settings.gitlab_client_secret,
                "code": body.code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{settings.allowed_origins.split(',')[0].strip()}/auth/callback/gitlab",
            },
        )

    if token_response.status_code != 200:
        logger.error(f"GitLab token exchange failed: {token_response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to authenticate with GitLab. Please try again.",
        )

    token_data = token_response.json()
    access_token = token_data.get("access_token")

    if not access_token:
        error = token_data.get("error_description", "Unknown error")
        logger.error(f"GitLab OAuth error: {error}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitLab authentication failed: {error}",
        )

    # Step 2: Fetch GitLab user profile
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            GITLAB_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if user_response.status_code != 200:
        logger.error(f"Failed to fetch GitLab user: {user_response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch GitLab user profile",
        )

    gitlab_user = user_response.json()

    # Step 3: Encrypt the access token and store in database
    encrypted_token = encrypt_token(access_token)

    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    try:
        # Check if a GitLab connection already exists for this user
        existing = (
            supabase.table("vcs_connections")
            .select("id")
            .eq("user_id", user["id"])
            .eq("platform", "gitlab")
            .execute()
        )

        if existing.data:
            result = (
                supabase.table("vcs_connections")
                .update(
                    {
                        "platform_user_id": str(gitlab_user["id"]),
                        "platform_username": gitlab_user.get("username", ""),
                        "access_token": encrypted_token,
                    }
                )
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
            result = (
                supabase.table("vcs_connections")
                .insert(
                    {
                        "user_id": user["id"],
                        "platform": "gitlab",
                        "platform_user_id": str(gitlab_user["id"]),
                        "platform_username": gitlab_user.get("username", ""),
                        "access_token": encrypted_token,
                    }
                )
                .execute()
            )

        connection = result.data[0]
        return VCSConnectionResponse(
            id=connection["id"],
            platform="gitlab",
            platform_username=gitlab_user.get("username"),
            created_at=connection["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to store GitLab connection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save GitLab connection",
        )


# -----------------------------------------------
# Disconnect VCS
# -----------------------------------------------


@router.delete("/{connection_id}", response_model=VCSDisconnectResponse)
async def disconnect_vcs(
    user: CurrentUser,
    connection_id: str,
) -> VCSDisconnectResponse:
    """
    Disconnect a VCS account.

    Removes the VCS connection and its encrypted access token.
    Only the owning user can disconnect their own connections.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    try:
        # Verify the connection belongs to the current user
        existing = (
            supabase.table("vcs_connections")
            .select("id")
            .eq("id", connection_id)
            .eq("user_id", user["id"])
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="VCS connection not found",
            )

        # Delete the connection
        supabase.table("vcs_connections").delete().eq("id", connection_id).execute()

        return VCSDisconnectResponse()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to disconnect VCS {connection_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect VCS account",
        )
