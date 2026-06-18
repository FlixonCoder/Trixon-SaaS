"""
Trixon Backend — Repository Listing API Routes

Endpoints that list repositories from connected GitHub/GitLab accounts.
Requires an active VCS connection (stored in vcs_connections table).
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.encryption import decrypt_token
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Repositories"])


class RepoItem(BaseModel):
    id: str
    name: str
    full_name: str
    description: str | None
    private: bool
    default_branch: str
    language: str | None
    updated_at: str | None
    url: str
    platform: str


@router.get("/github/repos", response_model=list[RepoItem])
async def list_github_repos(user: CurrentUser) -> list[RepoItem]:
    """
    List all GitHub repositories accessible to the connected account.

    Fetches the user's VCS connection from the database, decrypts the
    stored access token, and proxies the request to GitHub's API.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    # Get the GitHub connection for this user
    conn_resp = (
        supabase.table("vcs_connections")
        .select("access_token")
        .eq("user_id", user["id"])
        .eq("platform", "github")
        .maybe_single()
        .execute()
    )

    if conn_resp is None or not conn_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No GitHub account connected. Please connect your GitHub account first.",
        )

    access_token = decrypt_token(conn_resp.data["access_token"])
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    repos = []
    page = 1

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            resp = await client.get(
                "https://api.github.com/user/repos",
                headers=headers,
                params={
                    "per_page": 100,
                    "page": page,
                    "sort": "updated",
                    "type": "all",
                },
            )

            if resp.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="GitHub token expired or revoked. Please reconnect your GitHub account.",
                )
            if resp.status_code != 200:
                logger.error(f"GitHub repos API error: {resp.status_code} {resp.text}")
                raise HTTPException(status_code=502, detail="Failed to fetch repos from GitHub")

            page_repos = resp.json()
            if not page_repos:
                break

            for r in page_repos:
                repos.append(RepoItem(
                    id=str(r["id"]),
                    name=r["name"],
                    full_name=r["full_name"],
                    description=r.get("description"),
                    private=r.get("private", False),
                    default_branch=r.get("default_branch", "main"),
                    language=r.get("language"),
                    updated_at=r.get("updated_at"),
                    url=r["html_url"],
                    platform="github",
                ))
            page += 1

            # Stop if we have enough (GitHub can return thousands)
            if len(repos) >= 300:
                break

    return repos


@router.get("/gitlab/repos", response_model=list[RepoItem])
async def list_gitlab_repos(user: CurrentUser) -> list[RepoItem]:
    """
    List all GitLab projects accessible to the connected account.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    conn_resp = (
        supabase.table("vcs_connections")
        .select("access_token")
        .eq("user_id", user["id"])
        .eq("platform", "gitlab")
        .maybe_single()
        .execute()
    )

    if conn_resp is None or not conn_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No GitLab account connected. Please connect your GitLab account first.",
        )

    access_token = decrypt_token(conn_resp.data["access_token"])
    headers = {"Authorization": f"Bearer {access_token}"}

    repos = []
    page = 1

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            resp = await client.get(
                "https://gitlab.com/api/v4/projects",
                headers=headers,
                params={
                    "per_page": 100,
                    "page": page,
                    "membership": True,
                    "order_by": "last_activity_at",
                    "sort": "desc",
                },
            )

            if resp.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="GitLab token expired. Please reconnect your GitLab account.",
                )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="Failed to fetch repos from GitLab")

            page_repos = resp.json()
            if not page_repos:
                break

            for r in page_repos:
                repos.append(RepoItem(
                    id=str(r["id"]),
                    name=r["name"],
                    full_name=r["path_with_namespace"],
                    description=r.get("description"),
                    private=r.get("visibility") != "public",
                    default_branch=r.get("default_branch", "main"),
                    language=None,
                    updated_at=r.get("last_activity_at"),
                    url=r["web_url"],
                    platform="gitlab",
                ))
            page += 1

            if len(repos) >= 300:
                break

    return repos
