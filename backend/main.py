"""
Trixon Backend — FastAPI Application Entry Point

Main application module that configures CORS, includes routers,
and sets up logging for the Trixon API server.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.health import router as health_router
from backend.api.profile import router as profile_router
from backend.api.vcs import router as vcs_router
from backend.api.repos import router as repos_router
from backend.api.projects import router as projects_router
from backend.api.analyses import router as analyses_router
from backend.api.webhooks import router as webhooks_router       # v3.0
from backend.api.action_items import router as action_items_router  # v3.0 + v3.1
from backend.api.chat import router as chat_router                  # v3.0
from backend.core.config import get_settings
from backend.core.redis_client import get_redis
from backend.core.supabase_client import get_supabase

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    On startup: initializes Supabase and Redis clients, logs status.
    On shutdown: cleanup resources.
    """
    settings = get_settings()
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")

    # Initialize Supabase client
    supabase = get_supabase()
    if supabase:
        logger.info("✓ Supabase client ready")
    else:
        logger.warning("✗ Supabase not configured — database features disabled")

    # Initialize Redis client
    redis = get_redis()
    if redis:
        logger.info("✓ Redis client ready")
    else:
        logger.warning("✗ Redis not available — background jobs disabled")

    yield

    # Shutdown
    logger.info("Shutting down Trixon API...")


def create_app() -> FastAPI:
    """Creates and configures the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI-powered technical intelligence platform for non-technical founders. "
            "Connects to your codebase, analyzes it deeply, and translates findings "
            "into plain English."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS middleware — allow frontend origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(profile_router, prefix="/api/v1")
    app.include_router(vcs_router, prefix="/api/v1")
    app.include_router(repos_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    app.include_router(analyses_router, prefix="/api/v1")
    from backend.api.reports import router as reports_router
    from backend.api.share import router as share_router
    from backend.api.checkout import router as checkout_router
    from backend.api.trixon_share import router as trixon_share_router
    app.include_router(reports_router, prefix="/api/v1")
    app.include_router(share_router, prefix="/api/v1")
    app.include_router(checkout_router, prefix="/api/v1")
    app.include_router(trixon_share_router, prefix="/api/v1")

    # v3.0 + v3.1 routers — no prefix since routes already include /api/v1
    app.include_router(webhooks_router)
    app.include_router(action_items_router)
    app.include_router(chat_router)

    return app


# Application instance used by uvicorn
app = create_app()
