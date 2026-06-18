"""
Trixon Backend — Repo Fetcher Service

Fetches repository file tree and content via the GitHub/GitLab APIs.
Does NOT use git clone — all access is via authenticated REST API calls.

Constraints enforced:
- Max individual file size: 500KB
- Max total repo size: 50MB uncompressed
- Skips: node_modules/, .git/, dist/, build/, __pycache__/, *.min.js, *.lock
"""

import base64
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# --- Skip patterns ---
SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "__pycache__",
    ".next", ".nuxt", "vendor", "venv", ".venv", "env",
    "coverage", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "target",  # Rust/Java
}

SKIP_EXTENSIONS = {
    ".min.js", ".min.css", ".map", ".lock",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".rar",
    ".pyc", ".pyo", ".pyd",
    ".exe", ".dll", ".so", ".dylib",
    ".pdf", ".docx", ".xlsx",
}

MAX_FILE_SIZE_BYTES = 500 * 1024       # 500KB per file
MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024  # 50MB total


@dataclass
class FetchedRepo:
    """Result of a repository fetch operation."""
    files: dict[str, str] = field(default_factory=dict)  # {path: content}
    total_bytes: int = 0
    skipped_count: int = 0
    error: Optional[str] = None


def _should_skip_path(path: str) -> bool:
    """Return True if this file path should be excluded from analysis."""
    parts = path.split("/")

    # Skip if any directory component is in the skip list
    for part in parts[:-1]:
        if part in SKIP_DIRS:
            return True

    # Skip by extension
    lower = path.lower()
    for ext in SKIP_EXTENSIONS:
        if lower.endswith(ext):
            return True

    return False


async def fetch_github_repo(
    owner: str,
    repo: str,
    branch: str,
    access_token: str,
) -> FetchedRepo:
    """
    Fetch all relevant files from a GitHub repository via the Trees API.

    Args:
        owner: GitHub username or org name
        repo: Repository name
        branch: Branch name (e.g. 'main', 'master')
        access_token: Decrypted GitHub OAuth access token

    Returns:
        FetchedRepo with file contents and metadata
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    result = FetchedRepo()

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Step 1: Get the full file tree (recursive)
        tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        tree_resp = await client.get(tree_url, headers=headers)

        if tree_resp.status_code == 404:
            result.error = f"Repository {owner}/{repo}@{branch} not found"
            return result
        if tree_resp.status_code != 200:
            result.error = f"GitHub API error: {tree_resp.status_code}"
            return result

        tree_data = tree_resp.json()

        if tree_data.get("truncated"):
            logger.warning(f"GitHub tree was truncated for {owner}/{repo} — very large repo")

        blobs = [
            item for item in tree_data.get("tree", [])
            if item.get("type") == "blob"
            and not _should_skip_path(item["path"])
            and item.get("size", 0) < MAX_FILE_SIZE_BYTES
        ]

        logger.info(f"Fetching {len(blobs)} files from {owner}/{repo}@{branch}")

        # Step 2: Fetch file contents in batches
        for item in blobs:
            if result.total_bytes >= MAX_TOTAL_SIZE_BYTES:
                logger.warning(f"Hit 50MB limit for {owner}/{repo}, stopping fetch")
                result.skipped_count += 1
                continue

            path = item["path"]
            blob_url = f"https://api.github.com/repos/{owner}/{repo}/git/blobs/{item['sha']}"

            try:
                blob_resp = await client.get(blob_url, headers=headers)
                if blob_resp.status_code != 200:
                    result.skipped_count += 1
                    continue

                blob_data = blob_resp.json()
                encoding = blob_data.get("encoding")
                raw_content = blob_data.get("content", "")

                if encoding == "base64":
                    try:
                        content = base64.b64decode(raw_content).decode("utf-8", errors="replace")
                    except Exception:
                        result.skipped_count += 1
                        continue
                else:
                    content = raw_content

                size = len(content.encode("utf-8"))
                result.files[path] = content
                result.total_bytes += size

            except Exception as e:
                logger.warning(f"Failed to fetch {path}: {e}")
                result.skipped_count += 1

    logger.info(
        f"Fetched {len(result.files)} files ({result.total_bytes // 1024}KB) "
        f"from {owner}/{repo}. Skipped {result.skipped_count} files."
    )
    return result


async def fetch_gitlab_repo(
    project_id: int,
    branch: str,
    access_token: str,
    gitlab_host: str = "https://gitlab.com",
) -> FetchedRepo:
    """
    Fetch all relevant files from a GitLab repository via the Repository Files API.

    Args:
        project_id: GitLab project ID (integer)
        branch: Branch name
        access_token: Decrypted GitLab OAuth access token
        gitlab_host: GitLab instance URL (defaults to cloud gitlab.com)

    Returns:
        FetchedRepo with file contents and metadata
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    result = FetchedRepo()

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Step 1: Get the repository tree recursively
        tree_url = f"{gitlab_host}/api/v4/projects/{project_id}/repository/tree"
        params = {"recursive": True, "per_page": 100, "ref": branch}

        all_items = []
        page = 1
        while True:
            params["page"] = page
            resp = await client.get(tree_url, headers=headers, params=params)
            if resp.status_code != 200:
                result.error = f"GitLab API error: {resp.status_code}"
                return result

            items = resp.json()
            if not items:
                break
            all_items.extend(items)
            page += 1

        blobs = [
            item for item in all_items
            if item.get("type") == "blob"
            and not _should_skip_path(item["path"])
        ]

        logger.info(f"Fetching {len(blobs)} files from GitLab project {project_id}@{branch}")

        for item in blobs:
            if result.total_bytes >= MAX_TOTAL_SIZE_BYTES:
                result.skipped_count += 1
                continue

            path = item["path"]
            encoded_path = path.replace("/", "%2F")
            file_url = (
                f"{gitlab_host}/api/v4/projects/{project_id}"
                f"/repository/files/{encoded_path}?ref={branch}"
            )

            try:
                file_resp = await client.get(file_url, headers=headers)
                if file_resp.status_code != 200:
                    result.skipped_count += 1
                    continue

                file_data = file_resp.json()
                size = file_data.get("size", 0)
                if size > MAX_FILE_SIZE_BYTES:
                    result.skipped_count += 1
                    continue

                raw_content = file_data.get("content", "")
                encoding = file_data.get("encoding", "base64")

                if encoding == "base64":
                    try:
                        content = base64.b64decode(raw_content).decode("utf-8", errors="replace")
                    except Exception:
                        result.skipped_count += 1
                        continue
                else:
                    content = raw_content

                byte_size = len(content.encode("utf-8"))
                result.files[path] = content
                result.total_bytes += byte_size

            except Exception as e:
                logger.warning(f"Failed to fetch GitLab file {path}: {e}")
                result.skipped_count += 1

    logger.info(
        f"Fetched {len(result.files)} files ({result.total_bytes // 1024}KB) "
        f"from GitLab project {project_id}. Skipped {result.skipped_count} files."
    )
    return result
