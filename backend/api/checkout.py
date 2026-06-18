"""
Trixon Backend — Checkout API Routes

Stripe Checkout integration for one-time Full Audit purchases ($497).
Includes session creation, webhook handling, and access-level checks.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.config import get_settings
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/checkout", tags=["Checkout"])


# -----------------------------------------------
# Request / Response Models
# -----------------------------------------------

class CreateCheckoutSessionRequest(BaseModel):
    project_id: str


class CheckoutSessionResponse(BaseModel):
    checkout_url: str


class AccessLevelResponse(BaseModel):
    access: str  # 'basic' | 'full'


# -----------------------------------------------
# Helpers
# -----------------------------------------------

FREE_REPORT_TYPES = {"executive_summary", "security"}


def check_report_access(project_id: str, report_type: str, user_id: str) -> bool:
    """
    Free tier: executive_summary and security reports only.
    Full tier: all 8 reports — requires completed audit_purchase for this project.
    Bypassed in beta mode.
    """
    if get_settings().beta_mode:
        return True

    if report_type in FREE_REPORT_TYPES:
        return True

    supabase = get_supabase()
    if supabase is None:
        return False

    try:
        purchase_resp = (
            supabase.table("audit_purchases")
            .select("id")
            .eq("project_id", project_id)
            .eq("user_id", user_id)
            .eq("status", "complete")
            .limit(1)
            .execute()
        )
        return bool(purchase_resp.data)
    except Exception as e:
        logger.warning(f"Error checking report access (migration may be missing): {e}")
        return False


def get_access_level(project_id: str, user_id: str) -> str:
    """Returns 'full' if a completed purchase exists or beta mode is true, otherwise 'basic'."""
    if get_settings().beta_mode:
        return "full"

    supabase = get_supabase()
    if supabase is None:
        return "basic"

    try:
        purchase_resp = (
            supabase.table("audit_purchases")
            .select("id")
            .eq("project_id", project_id)
            .eq("user_id", user_id)
            .eq("status", "complete")
            .limit(1)
            .execute()
        )
        return "full" if purchase_resp.data else "basic"
    except Exception as e:
        logger.warning(f"Error checking access level (migration may be missing): {e}")
        return "basic"


# -----------------------------------------------
# Endpoints
# -----------------------------------------------

@router.get("/purchases")
async def list_purchases(user: CurrentUser) -> list[dict]:
    """List all audit purchases for the current user."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        result = (
            supabase.table("audit_purchases")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.warning(f"Failed to list purchases for user {user['id']}: {e}")
        return []


@router.post("/create-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(user: CurrentUser, body: CreateCheckoutSessionRequest) -> CheckoutSessionResponse:
    """
    Creates a Stripe Checkout session for the Full Audit ($497).
    Returns the hosted checkout URL for the client to redirect to.
    """
    settings = get_settings()

    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service not configured. Please contact support.",
        )

    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    # Verify project belongs to user
    project_resp = (
        supabase.table("projects")
        .select("id, repo_name")
        .eq("id", body.project_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    if not project_resp or not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if already purchased
    existing = (
        supabase.table("audit_purchases")
        .select("id")
        .eq("project_id", body.project_id)
        .eq("user_id", user["id"])
        .eq("status", "complete")
        .limit(1)
        .execute()
    )

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Full audit already purchased for this project.",
        )

    try:
        import stripe
        stripe.api_key = settings.stripe_secret_key

        # Create the audit_purchase record as pending
        purchase_resp = (
            supabase.table("audit_purchases")
            .insert({
                "user_id": user["id"],
                "project_id": body.project_id,
                "status": "pending",
            })
            .execute()
        )
        purchase_id = purchase_resp.data[0]["id"]

        # Determine URLs
        frontend_url = settings.allowed_origins.split(",")[0].strip()
        success_url = f"{frontend_url}/checkout/success?project_id={body.project_id}"
        cancel_url = f"{frontend_url}/checkout/cancelled?project_id={body.project_id}"

        # Create Stripe Checkout session
        checkout_params = {
            "mode": "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": body.project_id,
            "metadata": {
                "purchase_id": purchase_id,
                "user_id": user["id"],
                "project_id": body.project_id,
            },
        }

        # Use price ID if available, otherwise create a price on the fly
        if settings.stripe_price_id_audit_full:
            checkout_params["line_items"] = [{
                "price": settings.stripe_price_id_audit_full,
                "quantity": 1,
            }]
        else:
            checkout_params["line_items"] = [{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": 49700,
                    "product_data": {
                        "name": "Trixon Full Audit",
                        "description": f"Complete 8-report codebase audit for {project_resp.data['repo_name']}",
                    },
                },
                "quantity": 1,
            }]

        session = stripe.checkout.Session.create(**checkout_params)

        # Store the session ID
        supabase.table("audit_purchases").update({
            "stripe_session_id": session.id,
        }).eq("id", purchase_id).execute()

        return CheckoutSessionResponse(checkout_url=session.url)

    except Exception as e:
        logger.error(f"Failed to create checkout session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request):
    """
    Stripe webhook endpoint. Verifies signature, processes checkout.session.completed.
    No auth — Stripe signature is the authentication mechanism.
    """
    settings = get_settings()

    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        import stripe
        stripe.api_key = settings.stripe_secret_key

        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except Exception as e:
        logger.error(f"Stripe webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        _handle_checkout_completed(session)

    return {"status": "ok"}


def _handle_checkout_completed(session: dict) -> None:
    """Process a completed Stripe checkout session."""
    supabase = get_supabase()
    if supabase is None:
        logger.error("Supabase unavailable during webhook processing")
        return

    metadata = session.get("metadata", {})
    purchase_id = metadata.get("purchase_id")
    project_id = metadata.get("project_id") or session.get("client_reference_id")
    user_id = metadata.get("user_id")

    if not purchase_id:
        logger.error(f"No purchase_id in checkout session metadata: {session.get('id')}")
        return

    try:
        # Update purchase status
        supabase.table("audit_purchases").update({
            "status": "complete",
            "purchased_at": datetime.now(timezone.utc).isoformat(),
            "stripe_payment_intent_id": session.get("payment_intent"),
            "stripe_session_id": session.get("id"),
        }).eq("id", purchase_id).execute()

        logger.info(f"Audit purchase {purchase_id} completed for project {project_id}")

        # Check if project needs analysis triggered
        if project_id:
            project_resp = (
                supabase.table("projects")
                .select("id")
                .eq("id", project_id)
                .maybe_single()
                .execute()
            )

            if project_resp and project_resp.data:
                # Check if there's already a complete analysis
                analysis_resp = (
                    supabase.table("analyses")
                    .select("id, status")
                    .eq("project_id", project_id)
                    .in_("status", ["complete", "running", "queued"])
                    .limit(1)
                    .execute()
                )

                if not analysis_resp.data:
                    # No analysis yet — trigger one
                    new_analysis = (
                        supabase.table("analyses")
                        .insert({
                            "project_id": project_id,
                            "status": "queued",
                            "purchase_id": purchase_id,
                        })
                        .execute()
                    )

                    if new_analysis.data:
                        from backend.core.redis_client import get_redis
                        redis_conn = get_redis()
                        if redis_conn:
                            from rq import Queue
                            from backend.workers.analyze import analyze_project
                            q = Queue(connection=redis_conn)
                            q.enqueue(
                                analyze_project,
                                project_id,
                                new_analysis.data[0]["id"],
                                None,  # report_types = all
                                job_timeout=600,
                            )
                            logger.info(f"Triggered analysis for project {project_id}")

        # Send confirmation email (best-effort)
        _send_purchase_confirmation(user_id, project_id)

    except Exception as e:
        logger.error(f"Error processing checkout webhook: {e}")


def _send_purchase_confirmation(user_id: str | None, project_id: str | None) -> None:
    """Send purchase confirmation email via Resend. Best-effort, non-blocking."""
    settings = get_settings()
    if not settings.resend_api_key or not user_id:
        return

    try:
        supabase = get_supabase()
        if supabase is None:
            return

        profile_resp = (
            supabase.table("profiles")
            .select("full_name, company_name")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )

        if not profile_resp or not profile_resp.data:
            return

        # Get user email from auth
        user_resp = supabase.auth.admin.get_user_by_id(user_id)
        email = user_resp.user.email if user_resp and user_resp.user else None

        if not email:
            return

        import resend
        resend.api_key = settings.resend_api_key

        name = profile_resp.data.get("full_name", "there")
        resend.Emails.send({
            "from": "Trixon Audit <noreply@trixon.cloud>",
            "to": [email],
            "subject": "Your Trixon Full Audit is ready",
            "html": f"""
                <p>Hi {name},</p>
                <p>Your Full Audit purchase is confirmed. All 8 reports are now unlocked for your project.</p>
                <p>Log in to view your complete audit results.</p>
                <p>— The Trixon Team</p>
            """,
        })

    except Exception as e:
        logger.warning(f"Failed to send purchase confirmation email: {e}")
