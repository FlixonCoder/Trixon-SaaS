"""
Trixon Backend — Admin Metrics API Routes

Used by the internal `/admin` dashboard.
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException

from backend.core.auth import get_current_user, CurrentUser
from backend.core.supabase_client import get_supabase

router = APIRouter(prefix="/admin/metrics", tags=["Admin Metrics"])


async def require_admin(user: CurrentUser):
    """Dependency to check if the current user is an admin."""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    profile_resp = (
        supabase.table("profiles")
        .select("is_admin")
        .eq("id", user["id"])
        .maybe_single()
        .execute()
    )

    if not profile_resp.data or not profile_resp.data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/overview")
async def get_overview(admin: dict = Depends(require_admin)):
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    total_users = supabase.table("profiles").select("id", count="exact").execute().count or 0
    total_projects = supabase.table("projects").select("id", count="exact").execute().count or 0
    total_analyses = supabase.table("analyses").select("id", count="exact").execute().count or 0
    total_chat_messages = supabase.table("project_chats").select("id", count="exact").execute().count or 0

    signups_7d = supabase.table("profiles").select("id", count="exact").gte("created_at", seven_days_ago).execute().count or 0
    signups_30d = supabase.table("profiles").select("id", count="exact").gte("created_at", thirty_days_ago).execute().count or 0

    # Active projects (projects that had an analysis or chat in the last 7 days)
    # Since we can't easily do complex joins or count distinct across two tables in supabase python perfectly,
    # we can use the usage_events table
    active_projects_resp = (
        supabase.table("usage_events")
        .select("project_id")
        .gte("created_at", seven_days_ago)
        .in_("event_type", ["analysis_triggered", "chat_message_sent"])
        .execute()
    )
    active_projects = len(set(e["project_id"] for e in (active_projects_resp.data or []) if e.get("project_id")))

    return {
        "total_users": total_users,
        "total_projects": total_projects,
        "total_analyses": total_analyses,
        "total_chat_messages": total_chat_messages,
        "signups_last_7_days": signups_7d,
        "signups_last_30_days": signups_30d,
        "active_projects_last_7_days": active_projects,
    }


@router.get("/signups-timeseries")
async def get_signups_timeseries(days: int = 30, admin: dict = Depends(require_admin)):
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).isoformat()

    resp = (
        supabase.table("profiles")
        .select("created_at")
        .gte("created_at", cutoff)
        .execute()
    )
    
    # Bucket by day
    from collections import defaultdict
    daily_counts = defaultdict(int)
    for p in (resp.data or []):
        day = p["created_at"][:10]  # YYYY-MM-DD
        daily_counts[day] += 1
        
    # Fill in zeros for missing days
    result = []
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        result.append({"date": d, "signups": daily_counts.get(d, 0)})

    return result


@router.get("/feature-adoption")
async def get_feature_adoption(admin: dict = Depends(require_admin)):
    supabase = get_supabase()
    total_users = supabase.table("profiles").select("id", count="exact").execute().count or 1  # avoid div0

    # Distinct users who did actions
    def get_users_with_event(event_type):
        resp = supabase.table("usage_events").select("user_id").eq("event_type", event_type).execute()
        return len(set(r["user_id"] for r in (resp.data or [])))

    webhook_users = get_users_with_event("webhook_enabled")
    chat_users = get_users_with_event("chat_message_sent")
    share_users = get_users_with_event("report_shared")
    export_users = get_users_with_event("report_exported_pdf")

    return {
        "webhook_adoption_pct": round((webhook_users / total_users) * 100, 1),
        "chat_adoption_pct": round((chat_users / total_users) * 100, 1),
        "share_adoption_pct": round((share_users / total_users) * 100, 1),
        "export_adoption_pct": round((export_users / total_users) * 100, 1),
    }


@router.get("/most-viewed-reports")
async def get_most_viewed_reports(admin: dict = Depends(require_admin)):
    supabase = get_supabase()
    resp = (
        supabase.table("usage_events")
        .select("event_properties")
        .eq("event_type", "report_viewed")
        .execute()
    )
    
    from collections import defaultdict
    counts = defaultdict(int)
    for event in (resp.data or []):
        rt = event.get("event_properties", {}).get("report_type")
        if rt:
            counts[rt] += 1
            
    result = [{"report_type": k, "views": v} for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)]
    return result


@router.get("/health-score-distribution")
async def get_health_score_distribution(admin: dict = Depends(require_admin)):
    supabase = get_supabase()
    resp = (
        supabase.table("analyses")
        .select("health_score")
        .not_.is_("health_score", "null")
        .execute()
    )
    
    buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
    for row in (resp.data or []):
        s = row.get("health_score", 0)
        if s <= 25: buckets["0-25"] += 1
        elif s <= 50: buckets["26-50"] += 1
        elif s <= 75: buckets["51-75"] += 1
        else: buckets["76-100"] += 1
        
    return [{"bucket": k, "count": v} for k, v in buckets.items()]


@router.get("/recent-activity")
async def get_recent_activity(limit: int = 50, admin: dict = Depends(require_admin)):
    supabase = get_supabase()
    resp = (
        supabase.table("usage_events")
        .select("*, profiles(full_name), projects(repo_name)")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    
    events = []
    for row in (resp.data or []):
        name = row.get("profiles", {}).get("full_name") if row.get("profiles") else None
        if not name and row.get("user_id"):
            name = f"User {str(row['user_id'])[:8]}"
        name = name or "Unknown User"
        
        repo = row.get("projects", {}).get("repo_name") if row.get("projects") else None
        etype = row.get("event_type")
        
        # Build human readable summary
        summary = f"{name} triggered {etype}"
        if etype == "signup_completed": summary = f"{name} completed onboarding"
        elif etype == "repo_connected": summary = f"{name} connected repo {repo or ''}"
        elif etype == "analysis_triggered": summary = f"{name} triggered analysis on {repo or ''}"
        elif etype == "report_shared": summary = f"{name} shared a report for {repo or ''}"
        elif etype == "chat_message_sent": summary = f"{name} asked a question in chat for {repo or ''}"
        elif etype == "webhook_enabled": summary = f"{name} enabled webhook for {repo or ''}"
        
        events.append({
            "id": row["id"],
            "event_type": etype,
            "summary": summary,
            "created_at": row["created_at"]
        })
        
    return events
