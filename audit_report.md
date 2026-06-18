# Trixon v3.2 Completeness & Gating Audit Report

## 1. Gating & Limit Mechanisms
| File | Line | Snippet | Likely Origin | Suggested Action |
| --- | --- | --- | --- | --- |
| backend\main.py | 102 | `from backend.api.checkout import router as checkout_router` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\main.py | 106 | `app.include_router(checkout_router, prefix="/api/v1")` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\action_items.py | 139 | `raise HTTPException(status_code=403, detail="Not authorized")` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\action_items.py | 175 | `raise HTTPException(status_code=403, detail="Not authorized")` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\action_items.py | 271 | `raise HTTPException(status_code=403, detail="Not authorized")` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\analyses.py | 176 | `from backend.api.checkout import check_report_access` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\checkout.py | 4 | `Stripe Checkout integration for one-time Full Audit purchases ($497).` | v2 | KEEP |
| backend\api\checkout.py | 19 | `router = APIRouter(prefix="/checkout", tags=["Checkout"])` | v2 | KEEP |
| backend\api\checkout.py | 31 | `checkout_url: str` | v2 | KEEP |
| backend\api\checkout.py | 100 | `async def create_checkout_session(user: CurrentUser, body: CreateCheckoutSession...` | v2 | KEEP |
| backend\api\checkout.py | 102 | `Creates a Stripe Checkout session for the Full Audit ($497).` | v2 | KEEP |
| backend\api\checkout.py | 103 | `Returns the hosted checkout URL for the client to redirect to.` | v2 | KEEP |
| backend\api\checkout.py | 107 | `if not settings.stripe_secret_key:` | v2 | KEEP |
| backend\api\checkout.py | 148 | `import stripe` | v2 | KEEP |
| backend\api\checkout.py | 149 | `stripe.api_key = settings.stripe_secret_key` | v2 | KEEP |
| backend\api\checkout.py | 165 | `success_url = f"{frontend_url}/checkout/success?project_id={body.project_id}"` | v2 | KEEP |
| backend\api\checkout.py | 166 | `cancel_url = f"{frontend_url}/checkout/cancelled?project_id={body.project_id}"` | v2 | KEEP |
| backend\api\checkout.py | 168 | `# Create Stripe Checkout session` | v2 | KEEP |
| backend\api\checkout.py | 169 | `checkout_params = {` | v2 | KEEP |
| backend\api\checkout.py | 182 | `if settings.stripe_price_id_audit_full:` | v2 | KEEP |
| backend\api\checkout.py | 183 | `checkout_params["line_items"] = [{` | v2 | KEEP |
| backend\api\checkout.py | 184 | `"price": settings.stripe_price_id_audit_full,` | v2 | KEEP |
| backend\api\checkout.py | 188 | `checkout_params["line_items"] = [{` | v2 | KEEP |
| backend\api\checkout.py | 193 | `"name": "Trixon Full Audit",` | v2 | KEEP |
| backend\api\checkout.py | 200 | `session = stripe.checkout.Session.create(**checkout_params)` | v2 | KEEP |
| backend\api\checkout.py | 204 | `"stripe_session_id": session.id,` | v2 | KEEP |
| backend\api\checkout.py | 207 | `return CheckoutSessionResponse(checkout_url=session.url)` | v2 | KEEP |
| backend\api\checkout.py | 210 | `logger.error(f"Failed to create checkout session: {e}")` | v2 | KEEP |
| backend\api\checkout.py | 211 | `raise HTTPException(status_code=500, detail="Failed to create checkout session")` | v2 | KEEP |
| backend\api\checkout.py | 215 | `async def stripe_webhook(request: Request):` | v2 | KEEP |
| backend\api\checkout.py | 217 | `Stripe webhook endpoint. Verifies signature, processes checkout.session.complete...` | v2 | KEEP |
| backend\api\checkout.py | 218 | `No auth — Stripe signature is the authentication mechanism.` | v2 | KEEP |
| backend\api\checkout.py | 222 | `if not settings.stripe_secret_key or not settings.stripe_webhook_secret:` | v2 | KEEP |
| backend\api\checkout.py | 223 | `raise HTTPException(status_code=503, detail="Stripe not configured")` | v2 | KEEP |
| backend\api\checkout.py | 226 | `sig_header = request.headers.get("stripe-signature", "")` | v2 | KEEP |
| backend\api\checkout.py | 229 | `import stripe` | v2 | KEEP |
| backend\api\checkout.py | 230 | `stripe.api_key = settings.stripe_secret_key` | v2 | KEEP |
| backend\api\checkout.py | 232 | `event = stripe.Webhook.construct_event(` | v2 | KEEP |
| backend\api\checkout.py | 233 | `payload, sig_header, settings.stripe_webhook_secret` | v2 | KEEP |
| backend\api\checkout.py | 238 | `logger.error(f"Stripe webhook signature verification failed: {e}")` | v2 | KEEP |
| backend\api\checkout.py | 241 | `if event["type"] == "checkout.session.completed":` | v2 | KEEP |
| backend\api\checkout.py | 243 | `_handle_checkout_completed(session)` | v2 | KEEP |
| backend\api\checkout.py | 248 | `def _handle_checkout_completed(session: dict) -> None:` | v2 | KEEP |
| backend\api\checkout.py | 249 | `"""Process a completed Stripe checkout session."""` | v2 | KEEP |
| backend\api\checkout.py | 261 | `logger.error(f"No purchase_id in checkout session metadata: {session.get('id')}"...` | v2 | KEEP |
| backend\api\checkout.py | 269 | `"stripe_payment_intent_id": session.get("payment_intent"),` | v2 | KEEP |
| backend\api\checkout.py | 270 | `"stripe_session_id": session.get("id"),` | v2 | KEEP |
| backend\api\checkout.py | 328 | `logger.error(f"Error processing checkout webhook: {e}")` | v2 | KEEP |
| backend\api\checkout.py | 367 | `"subject": "Your Trixon Full Audit is ready",` | v2 | KEEP |
| backend\api\checkout.py | 370 | `<p>Your Full Audit purchase is confirmed. All 8 reports are now unlocked for you...` | v2 | KEEP |
| backend\api\projects.py | 331 | `from backend.api.checkout import get_access_level` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\reports.py | 57 | `raise HTTPException(status_code=403, detail="Not authorized to access this repor...` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\reports.py | 59 | `raise HTTPException(status_code=403, detail="Not authorized")` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\reports.py | 94 | `raise HTTPException(status_code=403, detail="Not authorized")` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\reports.py | 96 | `raise HTTPException(status_code=403, detail="Not authorized")` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\share.py | 45 | `raise HTTPException(status_code=403, detail="Sharing is disabled for this report...` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\api\webhooks.py | 320 | `commit_sha = payload.get("checkout_sha", "")` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\core\config.py | 61 | `# --- Stripe (one-time audit purchases) ---` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\core\config.py | 62 | `stripe_secret_key: str = ""` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\core\config.py | 63 | `stripe_webhook_secret: str = ""` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\core\config.py | 64 | `stripe_price_id_audit_full: str = ""  # $497 one-time price from Stripe dashboar...` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\llm_client.py | 213 | `is_rate_limit_error: bool = False` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\static_extractor.py | 24 | `"stripe": "Stripe (Payments)",` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\gemini.py | 41 | `is_rate_limit = False` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\gemini.py | 83 | `if "429" in str(e) or "quota" in str(e).lower() or "rate" in str(e).lower():` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\gemini.py | 85 | `is_rate_limit = True` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\gemini.py | 98 | `is_rate_limit_error=is_rate_limit,` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 38 | `def _update_rate_limit_state(response: httpx.Response) -> None:` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 110 | `_update_rate_limit_state(response)` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 151 | `is_rate_limit = False` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 162 | `_update_rate_limit_state(response)` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 168 | `is_rate_limit = True` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 199 | `is_rate_limit = True` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 202 | `wait_time = 60.0 if is_rate_limit else 3.0` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 213 | `is_rate_limit_error=is_rate_limit,` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 239 | `_update_rate_limit_state(response)` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 283 | `_update_rate_limit_state(response)` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\groq.py | 335 | `_update_rate_limit_state(response)` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\services\providers\ollama.py | 89 | `is_rate_limit_error=False,` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\tests\api\test_profile.py | 12 | `"plan": "free",` | v1/v2 | GATE_BEHIND_BETA_MODE |
| backend\workers\analyze.py | 268 | `if output.is_rate_limit_error:` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(app)\dashboard\page.tsx | 54 | `const isFreeTier = profile?.plan === "free" \|\| !profile?.plan;` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(app)\onboarding\page.tsx | 93 | `if (profile?.plan === "free" \|\| !profile?.plan) {` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(app)\projects\[id]\reports\page.tsx | 226 | `Full Audit` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(app)\projects\[id]\reports\page.tsx | 240 | `Unlock report <span className="text-lg">→</span>` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(app)\projects\[id]\reports\[type]\page.tsx | 247 | `This report is part of the Full Audit` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(app)\projects\[id]\reports\[type]\page.tsx | 262 | `Unlock full audit →` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(app)\settings\page.tsx | 42 | `const isFreeTier = profile?.plan === "free" \|\| !profile?.plan;` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(marketing)\page.tsx | 349 | `No credit card required. Upgrade to Full Audit for $497 when you&apos;re ready.` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\app\(marketing)\pricing\page.tsx | 96 | `{/* Full Audit */}` | v1/v2 | REMOVE |
| frontend\src\app\(marketing)\pricing\page.tsx | 106 | `<h2 className="text-2xl font-bold text-[#1e1b1b]">Full Audit</h2>` | v1/v2 | REMOVE |
| frontend\src\app\checkout\cancelled\page.tsx | 7 | `description: "Your checkout was not completed.",` | v2 | REMOVE |
| frontend\src\components\paywall-overlay.tsx | 18 | `const handleUnlock = async () => {` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\paywall-overlay.tsx | 29 | ``${process.env.NEXT_PUBLIC_API_URL \|\| ""}/api/v1/checkout/create-session`,` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\paywall-overlay.tsx | 46 | `throw new Error(err.detail \|\| "Failed to start checkout");` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\paywall-overlay.tsx | 49 | `const { checkout_url } = await res.json();` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\paywall-overlay.tsx | 50 | `window.location.href = checkout_url;` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\paywall-overlay.tsx | 69 | `This report is part of the Full Audit` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\paywall-overlay.tsx | 83 | `onClick={handleUnlock}` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\paywall-overlay.tsx | 87 | `{loading ? "Starting checkout..." : "Unlock full audit →"}` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\project-dashboard.tsx | 672 | `<Lock className="w-3.5 h-3.5" /> Locked (Requires Full Audit)` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\components\project-dashboard.tsx | 702 | `<h3 className="text-base font-bold text-[#1e1b1b] mb-2">Unlock Full Technical Au...` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\lib\api.ts | 271 | `apiFetch<{ checkout_url: string }>("/api/v1/checkout/create-session", token, {` | v1/v2 | GATE_BEHIND_BETA_MODE |
| frontend\src\lib\api.ts | 298 | `}[]>("/api/v1/checkout/purchases", token),` | v1/v2 | GATE_BEHIND_BETA_MODE |

## 2. Chat Feature Presence
- **`/projects/[id]/chat/page.tsx` Exists:** ✅ Yes
- **`project-chat.tsx` Component Exists:** ✅ Yes

### References to Chat in codebase:
- [frontend\src\app\(app)\projects\[id]\chat\page.tsx](file:///c:\Users\Dell\OneDrive\Desktop\product\frontend\src\app\(app)\projects\[id]\chat\page.tsx)
- [frontend\src\components\project-chat.tsx](file:///c:\Users\Dell\OneDrive\Desktop\product\frontend\src\components\project-chat.tsx)
- [frontend\src\components\project-dashboard.tsx](file:///c:\Users\Dell\OneDrive\Desktop\product\frontend\src\components\project-dashboard.tsx)
- [frontend\src\lib\api.ts](file:///c:\Users\Dell\OneDrive\Desktop\product\frontend\src\lib\api.ts)

## 3. Report Catalog vs. Report Display Reconciliation
### Report Catalog (from SQL Seed):
| ID | Title | Is Default |
| --- | --- | --- |
| executive_summary | What You Built | TRUE |
| architecture | How It All Connects | TRUE |
| security | Security Risk Scan | FALSE |
| scalability | Can It Handle Growth? | FALSE |
| onboarding | Dev Onboarding Guide | FALSE |
| investor | Investor Technical Summary | FALSE |

### Identified Report Pages / Components:
- [frontend\src\app\(app)\projects\[id]\reports\page.tsx](file:///c:\Users\Dell\OneDrive\Desktop\product\frontend\src\app\(app)\projects\[id]\reports\page.tsx)
- [frontend\src\app\(app)\projects\[id]\reports\[type]\loading.tsx](file:///c:\Users\Dell\OneDrive\Desktop\product\frontend\src\app\(app)\projects\[id]\reports\[type]\loading.tsx)
- [frontend\src\app\(app)\projects\[id]\reports\[type]\page.tsx](file:///c:\Users\Dell\OneDrive\Desktop\product\frontend\src\app\(app)\projects\[id]\reports\[type]\page.tsx)

## 4. Orphaned / Dead Code Detection
| Legacy Concept | File Reference | Current Status | Suggested Action |
| --- | --- | --- | --- |
| Stripe Checkout API | backend/api/checkout.py | Dormant (but registered in main.py) | KEEP |

## 5. Audit Conclusions
This report has been compiled automatically. Adjustments will be made based on user review and the implementation of the global `BETA_MODE` flag.
