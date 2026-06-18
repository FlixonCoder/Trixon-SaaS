"""
Trixon Backend — Environment Configuration

Loads all environment variables using pydantic-settings.
All secrets are read from .env file or environment variables.
"""

from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


from pathlib import Path

# Resolve the backend directory path dynamically
BACKEND_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_name: str = "Trixon API"
    app_version: str = "0.2.0"
    debug: bool = False
    allowed_origins: str = "http://localhost:3000"  # comma-separated for CORS

    # --- Supabase ---
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # --- AI Settings ---
    llm_provider: str = "groq"  # "ollama", "gemini", or "groq" (temporary detour)
    ollama_url: str = "http://localhost:11434"
    gemini_api_key: str = ""

    # --- Groq (temporary detour from Ollama) ---
    groq_api_key: str = ""           # Kept for backward compat — used as fallback if groq_api_keys is empty
    groq_api_keys: Any = []    # Comma-separated pool of keys, each from a separate Groq account
    groq_model: str = "openai/gpt-oss-120b"  # GPT-OSS 120B on Groq

    @field_validator("groq_api_keys", mode="before")
    @classmethod
    def parse_groq_keys(cls, v: Any) -> list[str]:
        """Accept comma-separated string or list; deduplicate and strip whitespace."""
        if isinstance(v, str):
            keys = [k.strip() for k in v.split(",") if k.strip()]
            return list(dict.fromkeys(keys))  # deduplicate, preserving order
        if isinstance(v, list):
            return [k.strip() for k in v if str(k).strip()]
        return []

    @property
    def effective_groq_api_keys(self) -> list[str]:
        """Returns the pool of Groq keys to use. Falls back to singular groq_api_key if pool is empty."""
        if self.groq_api_keys:
            return self.groq_api_keys
        if self.groq_api_key:
            return [self.groq_api_key]
        return []

    # --- GitHub OAuth ---
    github_client_id: str = ""
    github_client_secret: str = ""

    # --- GitLab OAuth ---
    gitlab_client_id: str = ""
    gitlab_client_secret: str = ""

    # --- Security ---
    encryption_key: str = ""  # AES-256 key for encrypting VCS tokens at rest
    admin_secret: str = ""    # Secret key for protecting admin routes

    # --- Stripe (one-time audit purchases) ---
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id_audit_full: str = ""  # $497 one-time price from Stripe dashboard

    # --- Trixon Internal ---
    trixon_team_email: str = "hello@trixon.cloud"

    # --- Resend (transactional email) ---
    resend_api_key: str = ""

    # --- Webhook Secrets (v3.0) ---
    github_webhook_secret: str = ""   # HMAC-SHA256 secret for verifying GitHub push events
    gitlab_webhook_secret: str = ""   # Token for verifying GitLab push events

    # --- TPM Budget (v3.1) ---
    llm_tpm_limit: int = 7000         # Groq tokens-per-minute limit — used for adaptive sleep

    # --- Beta Mode (v3.2) ---
    beta_mode: bool = True            # When True, all plan gating and repository limits are bypassed

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached Settings instance.
    Uses lru_cache so the .env file is only read once.
    """
    return Settings()
