# Trixon — Codebase Cleanup: Audit First, Then Remediate

---

## CONTEXT

Before public beta hosting, the codebase needs cleanup: dead code, repetitive code, broken/stale tests, and leftover debug statements removed — while explicitly preserving code intended for future use (RQ worker, Ollama provider, Gemini provider) by clearly relabeling it, not deleting it. Old superseded business logic (the v2.0 $497 one-time Stripe checkout flow) should be removed entirely, since it represents a replaced model, not a future option.

**Do not delete anything in this pass without first producing the audit report below for review.** This mirrors the same audit-first approach used for the earlier paywall cleanup — categorize before acting, since blind deletion in a codebase this iterated-on risks removing something that's still load-bearing in a non-obvious way.

---

## PART 1 — AUDIT (Read-Only, Produces a Report)

#### [NEW] `scripts/audit_codebase_cleanup.py`

Scan `/backend` and `/frontend/src` and produce `cleanup_audit_report.md` with these sections:

### 1. Confirmed Dead Code
- Python files/functions never imported or called anywhere else in the codebase (use static analysis — e.g. check for any `import` or call-site reference; flag files with zero inbound references)
- Frontend components/files under `/components` or `/app` never imported by any page or other component
- Unused imports at the top of files (flag via `ruff check --select F401` or equivalent)

### 2. Commented-Out Code Blocks and Debug Statements
- Any multi-line commented-out code blocks (not docstrings/explanatory comments — actual disabled code)
- `console.log`, `print()`, `debugger` statements left in non-test code (excluding intentional `logger.info/debug/warning/error` calls, which should stay)

### 3. URGENT — Admin Route Authentication Check
- Specifically check: do `/api/v1/admin/backfill-action-items`, `/api/v1/admin/backfill-analysis-scores`, and `/api/v1/admin/key-pool-status` have ANY authentication/authorization check, or are they currently callable by anyone with the URL?
- Report this prominently at the TOP of the audit report, regardless of where it's found in the file tree — this is a likely security gap that should be fixed immediately, not bundled with general cleanup priority.

### 4. Superseded Business Logic (Recommend REMOVE)
- The v2.0 one-time $497 Stripe checkout flow (`checkout.py` or similarly named files) and any frontend pages/components referencing it
- Any other code explicitly tied to the old one-time-audit business model that v3.0+ superseded

### 5. Future-Use Infrastructure (Recommend RELABEL, NOT DELETE)
- `backend/workers/worker.py` (RQ worker — deprecated for now per the hosting consolidation, but intentionally kept for future re-introduction at scale)
- Any Ollama provider file (`ollama.py` or similar)
- Any Gemini provider file (`gemini.py` or similar)
- `backend/core/redis_client.py` (if present after the hosting consolidation — kept dormant for future horizontal scaling)
- For each: confirm it's clearly marked with a module-level docstring explaining it's not currently active and why it's being kept (e.g. `"""NOT CURRENTLY USED. Kept for future multi-provider support. See [relevant prompt/decision] for context."""`)

### 6. Test Suite Status
- Run the existing test suite (`pytest` for backend, relevant frontend test runner if one exists) and report: how many tests exist, how many pass, how many fail, how many are stale (reference removed functions/tables/endpoints)
- Do NOT delete failing tests automatically — report them, categorized as: "fixable — references current code incorrectly," "obsolete — tests removed functionality," or "needs human judgment"

### 7. Ambiguous Items (Needs Human Review)
- Anything the audit script can't confidently classify into the above categories — list with file path and a one-line reason it's ambiguous

### Output Format

```
| File | Category | Reason | Suggested Action |
```
Suggested Action: `REMOVE`, `RELABEL_KEEP`, `FIX_TEST`, `REMOVE_TEST`, `INVESTIGATE`

---

## PART 2 — REMEDIATION (After Reviewing the Audit Report)

> [!IMPORTANT]
> Wait for explicit confirmation of the audit findings before proceeding with this part. Adjust the categories below based on what Part 1 actually finds — some items may already be correctly handled.

### Fix the admin route auth gap immediately, regardless of anything else found
If confirmed unauthenticated, add a simple admin check — e.g. a shared `ADMIN_SECRET` env var checked via header, or restrict to requests from a known IP if simpler for beta. This should not wait for the rest of cleanup.

### Remove confirmed dead code
Delete files/functions/imports confirmed to have zero references, per the audit.

### Remove superseded business logic
Delete the v2.0 checkout flow and any UI referencing it, confirmed dormant and unregistered per the audit.

### Relabel future-use infrastructure
Add clear docstrings to worker.py, ollama.py, gemini.py, redis_client.py (or wherever they live) per the audit findings — do not delete these.

### Address test suite findings
- Fix tests categorized as "fixable"
- Remove tests categorized as "obsolete"
- Flag "needs human judgment" tests back for a decision rather than guessing

### Remove debug statements and dead comments
Clean up confirmed `console.log`/`print()`/commented-out blocks, preserving intentional `logger.*` calls.

---

## SUCCESS CRITERIA

- [ ] `cleanup_audit_report.md` produced and reviewed before any deletions happen
- [ ] Admin route auth status confirmed and fixed immediately if it was unauthenticated
- [ ] v2.0 checkout flow removed entirely (files + any referencing UI)
- [ ] worker.py, ollama.py, gemini.py (and redis_client.py if applicable) clearly relabeled with docstrings, NOT deleted
- [ ] Confirmed dead code/unused imports removed
- [ ] Test suite runs cleanly — failing/obsolete tests resolved per audit categorization, not silently ignored
- [ ] `npm run build` and `ruff check` both pass after cleanup
- [ ] Manual smoke test after cleanup: connect repo → analyze → view reports → action items → chat all still work end-to-end
