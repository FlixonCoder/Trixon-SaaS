# Trixon — Pre-Beta Security Review

---

## CONTEXT

Trixon handles genuinely sensitive data: GitHub/GitLab OAuth tokens with repo read access, actual source code content from private repositories, and user account information. Before real beta users connect real private repos, this review must confirm that the security measures specified during development are actually implemented correctly — not just assumed to be based on the implementation plans.

This is a **verification-first review** — check what's actually in the code and database, not what the plans said would be there. Flag anything that doesn't match.

---

## PART 1 — VERIFICATION CHECKS (Read-Only First)

Run these checks before making any changes. Produce a `security_audit_report.md` with findings, severity (Critical / High / Medium / Low), and recommended fix for each item found.

### CHECK 1 — VCS Token Encryption (Critical)

The spec required AES-256 encryption of GitHub/GitLab access tokens stored in `vcs_connections.access_token`.

Verify:
- Is encryption actually applied before insert? Find the code path that writes to `vcs_connections` and confirm it calls the encryption function before storing
- Is the `ENCRYPTION_KEY` env var actually set in the Render deployment, or is the field being stored as plaintext because the key is missing?
- Run this SQL to spot-check — if any tokens look like raw OAuth tokens (typically start with `gho_` for GitHub or `glpat-` for GitLab), encryption is NOT working:
```sql
SELECT id, platform, LEFT(access_token, 10) as token_prefix
FROM vcs_connections
LIMIT 10;
```
If any `token_prefix` starts with `gho_` or `glpat-`, this is a Critical finding requiring immediate remediation.

### CHECK 2 — Admin Routes Authentication (Critical)

Confirm these routes require `is_admin = true` and are NOT callable by unauthenticated or regular authenticated users:
- `POST /api/v1/admin/backfill-action-items`
- `POST /api/v1/admin/backfill-analysis-scores`
- `GET /api/v1/admin/key-pool-status`
- All routes under `/api/v1/admin/metrics/`

Test each route:
1. Call without any Authorization header → should return 401
2. Call with a valid JWT of a non-admin user → should return 403
3. Call with a valid JWT of an admin user → should return 200

If any admin route returns 200 for case 1 or 2, it's a Critical finding.

### CHECK 3 — Row Level Security Policies (Critical)

Verify RLS is enabled and correctly scoped on every table containing user data:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Every table in this list should show `rowsecurity = true`:
- `profiles`
- `vcs_connections`
- `projects`
- `analyses`
- `reports`
- `action_items`
- `analysis_diffs`
- `project_chats`
- `webhook_connections`
- `code_snapshots`
- `usage_events`
- `report_catalog` (read-only seed data — RLS optional here since it's not user-specific)

For any table showing `rowsecurity = false`, this is a Critical finding.

Also verify the policies themselves are correct — not just that RLS is enabled:
```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```
Check: do SELECT/INSERT/UPDATE/DELETE policies correctly reference `auth.uid()` rather than being overly permissive (e.g. `USING (true)` would bypass all protection despite RLS being enabled)?

### CHECK 4 — Webhook Signature Verification (High)

Confirm the GitHub and GitLab webhook receivers (`POST /api/v1/webhooks/github`, `POST /api/v1/webhooks/gitlab`) verify the request signature before processing:
- GitHub: HMAC-SHA256 of the raw request body using `GITHUB_WEBHOOK_SECRET`, compared against the `X-Hub-Signature-256` header
- GitLab: token comparison against `X-Gitlab-Token` header using `GITLAB_WEBHOOK_SECRET`

Verify:
- The comparison uses a constant-time comparison function (e.g. `hmac.compare_digest()`) — NOT a regular string equality check, which is vulnerable to timing attacks
- If `GITHUB_WEBHOOK_SECRET` is not set or empty, what happens? The endpoint should reject the request, not process it with no verification

### CHECK 5 — CORS Configuration (High)

Confirm `CORS_ALLOWED_ORIGINS` in the deployed Render backend is set to the specific Vercel frontend URL only — NOT `*` (wildcard) or `http://localhost:3000` in production:

```python
# What SHOULD be in production:
allow_origins=["https://your-actual-vercel-url.vercel.app"]  # or custom domain

# What would be a High finding:
allow_origins=["*"]
allow_origins=["http://localhost:3000"]  # in production
```

### CHECK 6 — JWT Validation on All Private Routes (High)

Confirm the FastAPI middleware/dependency that validates Supabase JWTs is applied to every route that returns user-specific data. The risk: a route that was added quickly during development might have had the auth dependency accidentally omitted.

Check by calling a sampling of private endpoints without an Authorization header:
- `GET /api/v1/projects` → should return 401
- `GET /api/v1/projects/{any_id}` → should return 401
- `GET /api/v1/projects/{any_id}/action-items` → should return 401
- `POST /api/v1/projects/{any_id}/analyze` → should return 401
- `GET /api/v1/projects/{any_id}/chat` → should return 401

Any 200 response without auth is a High finding.

### CHECK 7 — IDOR (Insecure Direct Object Reference) (High)

Confirm that a user cannot access another user's resources by guessing UUIDs.

Test: with two test accounts (User A and User B), confirm:
- User A cannot call `GET /api/v1/projects/{User_B_project_id}` successfully
- User A cannot call `GET /api/v1/analyses/{User_B_analysis_id}/diff` successfully
- User A cannot call `GET /api/v1/projects/{User_B_project_id}/chat` successfully

This should be guaranteed by RLS if Check 3 passes, but worth confirming at the API level too — the backend should validate ownership in the route handler OR rely on RLS rejecting the Supabase query, not assume one implies the other.

### CHECK 8 — Sensitive Data in Logs (Medium)

Search the backend codebase for any logging statements that might inadvertently log sensitive values:

```bash
grep -rn "logger\.\|logging\.\|print(" backend/ | grep -i "token\|secret\|key\|password\|auth"
```

Raw VCS tokens, Groq API keys, webhook secrets, and user passwords must never appear in logs. The key pool's `_key_id()` hash function was specifically designed to prevent this — confirm it's used consistently and no code path bypasses it to log the raw key.

### CHECK 9 — Environment Variables Never Exposed to Frontend (Medium)

Confirm no server-side secrets are accidentally prefixed with `NEXT_PUBLIC_` in the frontend environment (which would embed them in the client-side JavaScript bundle):

Check `frontend/.env` and Vercel environment variable settings — only these should be `NEXT_PUBLIC_`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_GITHUB_CLIENT_ID`

If `SUPABASE_SERVICE_ROLE_KEY`, any `GROQ_API_KEY`, `ENCRYPTION_KEY`, or `GITHUB_CLIENT_SECRET` appear as `NEXT_PUBLIC_*`, this is a High finding (demoted from Critical only because Vercel likely won't let server-only vars be accidentally public, but confirm).

### CHECK 10 — Public Share Link Security (Medium)

The `reports.share_token` is the only thing protecting a shared report from public access.

Verify:
- Tokens are sufficiently random (should be a UUID or at minimum a cryptographically random 32+ byte string — NOT an incrementing integer or predictable pattern)
- The `GET /api/v1/share/{token}` endpoint does NOT require auth (by design — it's a public link), but confirm it ONLY returns the specific report for that token, with no way to enumerate other tokens or access other data

### CHECK 11 — Repo Content Handling (Medium)

Confirm that repo content fetched during analysis is never written to persistent disk storage on the Render instance (ephemeral disk, but still worth confirming). It should be:
1. Fetched into memory (or a temp directory that's cleaned up within the same job)
2. Used to build LLM context
3. Selectively persisted to `code_snapshots` (the intentional persistence)
4. Discarded — never written to a permanent path that could accumulate over time

---

## PART 2 — REMEDIATION

After producing `security_audit_report.md`, fix all Critical and High findings immediately. Medium findings should be fixed before the first real beta user is onboarded. Low findings can be addressed in a follow-up pass.

**For each Critical/High fix, document:**
- What was wrong
- What was changed
- How to verify the fix worked

**Specific remediations if confirmed needed:**

If VCS tokens are stored in plaintext → encrypt all existing rows using the encryption key + update the storage code path. Do NOT just delete and re-request tokens — users would need to reconnect their accounts.

If any admin route is unauthenticated → add the `require_admin` dependency from the analytics prompt immediately, before any other work.

If any RLS policy is missing → add it and test with two accounts as described in Check 7.

If CORS is set to `*` → update `CORS_ALLOWED_ORIGINS` on Render to the specific Vercel URL.

---

## SUCCESS CRITERIA

- [ ] `security_audit_report.md` produced with findings for all 11 checks
- [ ] Zero Critical findings unresolved
- [ ] Zero High findings unresolved
- [ ] VCS tokens confirmed encrypted (SQL spot-check shows no raw `gho_`/`glpat-` prefixes)
- [ ] All admin routes return 401/403 for unauthenticated/non-admin requests
- [ ] RLS confirmed enabled on all 10 user-data tables
- [ ] CORS confirmed set to specific production origin only
- [ ] Two-account IDOR test passes for projects, analyses, and chat
- [ ] No raw secrets appear in application logs
