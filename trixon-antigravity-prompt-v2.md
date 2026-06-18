# Trixon — Antigravity Changes Prompt v2.0
### Strategic Realignment: From Standalone SaaS → Audit-Led BOT Conversion Engine

---

## CONTEXT & OBJECTIVE

You are modifying the existing Trixon codebase (built from the Antigravity Build Prompt v1.0).

Trixon's core business is **Build-Operate-Transfer (BOT) consulting**: Trixon comes in, architects the technical foundation, hires and installs the internal team, then formally exits. The original MVP was built as a standalone SaaS product with a freemium model. This prompt realigns every part of the product to serve and feed the consulting model.

**The single strategic goal of every change below:**
Every feature, report, and email should move a founder closer to booking a Trixon BOT engagement. The product is a diagnostic tool and a sales engine — not a standalone recurring-revenue business.

---

## CRITICAL BUSINESS MODEL CHANGE — READ THIS FIRST

**REMOVE:** Monthly subscription / freemium model (Free: 1 repo, Pro: unlimited repos)
**REPLACE WITH:** One-time audit purchase model

### New Pricing Tiers

| Tier | Price | Access |
|------|-------|--------|
| **Basic Audit** | Free | Executive Summary + Security Scan only. 1 public repo. No PDF. No share links. Teaser — enough to show value, not enough to solve the problem. |
| **Full Audit** | $497 one-time | All 8 reports (7 original + new Team Readiness). PDF export. Share links + password protection. "Share with Trixon" feature. 1 audit per purchase — additional audits are additional $497 purchases. |
| **Trixon Engage** | $25K–$60K (sold off-platform) | The BOT consulting engagement. This product feeds leads here. |

**Why this matters:** A $49/month SaaS positions Trixon as a dev tool. A $497 one-time audit matches the premium consulting brand, creates a natural decision moment, and can be credited against the BOT engagement fee at signing — turning the product into a subsidised discovery call.

---

## DATABASE CHANGES

### Remove
- Remove `plan` field from `profiles` table (no longer `'free' | 'pro'`)
- Remove all plan-gating logic from codebase

### Add New Tables

```sql
-- One-time audit purchases (Stripe)
audit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  project_id uuid references projects(id),
  stripe_payment_intent_id text,
  stripe_session_id text,
  amount_cents integer default 49700,   -- $497.00
  status text default 'pending',        -- 'pending' | 'complete' | 'refunded'
  purchased_at timestamptz,
  created_at timestamptz default now()
)

-- Founder → Trixon team outreach sessions
trixon_share_sessions (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references analyses(id),
  user_id uuid references profiles(id),
  founder_message text,                  -- optional note from the founder
  status text default 'pending',         -- 'pending' | 'reviewed' | 'contacted'
  created_at timestamptz default now()
)
```

### Modify Existing Tables

```sql
-- Link an analysis to its purchase
ALTER TABLE analyses
  ADD COLUMN purchase_id uuid references audit_purchases(id);

-- Store effort estimates per tech-debt finding
ALTER TABLE reports
  ADD COLUMN effort_estimates jsonb;
-- Structure:
-- [
--   {
--     "finding_id": "string",
--     "severity": "High" | "Medium" | "Low",
--     "effort_level": "quick-win" | "moderate" | "complex" | "architectural",
--     "effort_description": "One plain-English sentence.",
--     "trixon_timeline": "Week 1 of a Trixon engagement"
--   }
-- ]
```

---

## BACKEND CHANGES (FastAPI)

### New Environment Variables

```bash
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_AUDIT_FULL=       # $497 one-time price object from Stripe dashboard

# Trixon internal
TRIXON_TEAM_EMAIL=hello@trixon.cloud
RESEND_API_KEY=                    # already exists if welcome email implemented
```

### New API Routes

```
POST   /api/v1/checkout/create-session
       — Creates a Stripe Checkout session for the Full Audit ($497).
         Requires: project_id in body. Returns: { checkout_url }.

POST   /api/v1/checkout/webhook
       — Stripe webhook endpoint (no auth, Stripe signature verified).
         On payment_intent.succeeded: update audit_purchases.status → 'complete',
         set purchased_at, trigger full analysis pipeline if not already run.

GET    /api/v1/projects/{id}/access-level
       — Returns { access: 'basic' | 'full' }.
         'full' = a completed audit_purchase exists for this project_id + user_id.

POST   /api/v1/trixon-share
       — Body: { analysis_id, founder_message? }.
         Creates trixon_share_session, sends email to TRIXON_TEAM_EMAIL via Resend.
         Email body: founder name, company, share link, founder message.
         Returns: { session_id, status: 'sent' }.

GET    /api/v1/trixon-share/{session_id}
       — Returns trixon_share_session status. Founder polls this to see if reviewed.
```

### Modify: Report Access Control

Apply this gating logic to all report-fetching endpoints:

```python
FREE_REPORT_TYPES = {'executive_summary', 'security'}

def check_report_access(project_id: str, report_type: str, user_id: str) -> bool:
    """
    Free tier: executive_summary and security reports only.
    Full tier: all 8 reports — requires completed audit_purchase for this project.
    """
    if report_type in FREE_REPORT_TYPES:
        return True

    purchase = db.query(AuditPurchase).filter(
        AuditPurchase.project_id == project_id,
        AuditPurchase.user_id == user_id,
        AuditPurchase.status == 'complete'
    ).first()
    return purchase is not None
```

For locked reports, return HTTP 402 with body: `{ "error": "full_audit_required", "upgrade_url": "/pricing" }`. The frontend handles this with a paywall overlay on the report page.

### Modify: Analysis Pipeline — Add 8th Report Type

Add `team_readiness` to the Claude API call sequence in the `analyze_project` RQ job.

This is Call 7 in the pipeline (after the existing 6):

```python
TEAM_READINESS_PROMPT = """
You are a senior engineering org designer and technical recruiter reviewing a codebase for a non-technical founder.

Based on the codebase analysis provided, generate a Team Readiness Report. This should read like advice from a trusted technical co-founder — zero jargon, grounded in what's actually in this specific codebase.

Structure the report exactly as follows:

---

## What your codebase tells us about who built it
[2–3 sentences inferring from code patterns: Was this AI-built? A solo dev? An agency? What signals in the code support this? Be concrete.]

---

## Hires you need in the next 0–3 months

For each role, provide:
**[Role Title]**
- Why you need them: [Tied to a specific finding in the codebase. Plain English.]
- What to look for: [3 skills max. No acronyms without explanation.]
- Red flags in interviews: [2 concrete warning signs for a non-technical interviewer]
- Market rate: [$X–$Y/year, USD, 2024–2025 range]

---

## Hires you'll need in 3–12 months
[Same format. These aren't urgent but will become blockers as the product grows.]

---

## How your team should be structured
[2–3 paragraphs describing the org structure: who leads, what teams exist, what the reporting lines look like. Write this like you're sketching it on a whiteboard for the founder.]

---

## Hiring order and why
[A numbered list: hire X first, then Y, then Z. For each: one sentence on what breaks if you get this wrong.]

---

## A note from Trixon
Building and vetting a technical team is one of the hardest things a non-technical founder does alone. Trixon's Build-Operate-Transfer model was designed for exactly this: we hire, install, and manage your engineering team — then formally hand it over to you. By the time we leave, you own the team, the code, and the hiring playbook. If you'd like to talk through what this looks like for your situation, we offer a free 30-minute scoping call.

---

RULES:
- Every hire recommendation must reference something specific found in this codebase.
- Market rates must be realistic 2024–2025 US ranges.
- Write for a non-technical founder who has never managed engineers before.
- The Trixon note must feel like advice, not an ad.
"""
```

Store this report with `report_type = 'team_readiness'` in the reports table.
The Team Readiness report is **full tier only** (not in FREE_REPORT_TYPES).

### Modify: Tech Debt Report Prompt

Append the following to the existing tech debt Claude prompt:

```
For each finding, you must also output a JSON block immediately after the finding text, formatted as:

<finding-meta>
{
  "finding_id": "unique-slug-for-this-finding",
  "severity": "High" | "Medium" | "Low",
  "effort_level": "quick-win" | "moderate" | "complex" | "architectural",
  "effort_description": "A senior engineer can fix this in about 2 days.",
  "trixon_timeline": "Week 1 of a Trixon engagement"
}
</finding-meta>

effort_level definitions (use these precisely):
- quick-win: < 1 engineer-day
- moderate: 1–5 engineer-days
- complex: 1–3 engineer-weeks
- architectural: requires structural redesign, 3+ weeks
```

Parse these `<finding-meta>` blocks after the Claude response and store as structured JSON in `reports.effort_estimates`.

### Remove: Rate Limiting by Monthly Analysis Count

Remove the existing logic: Free users = 3 analyses/month.
Replace with: Free users can only analyze 1 public repo at a time. Report access is gated by purchase, not by count.

---

## FRONTEND CHANGES (Next.js App Router)

### New Environment Variables (Vercel)

```bash
NEXT_PUBLIC_BOOKING_URL=        # Calendly / Cal.com link for discovery calls
NEXT_PUBLIC_TRIXON_EMAIL=hello@trixon.cloud
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### New Routes

```
/pricing                        → Pricing page (see spec below)
/engage                         → BOT model explainer / sales page (see spec below)
/checkout/success               → Post-Stripe payment confirmation
/checkout/cancelled             → Stripe checkout abandoned screen
```

### Remove from All Pages
- Every instance of "Free plan" / "Pro plan" language
- "Upgrade to Pro" buttons and prompts
- "Analyses run this month" stat
- All plan-gating UI that references the old subscription model

---

### Page: /pricing

Two cards, side by side on desktop / stacked on mobile:

**Card 1 — Basic Audit (Free)**
- Badge: "No credit card required"
- Feature list:
  - ✓ Executive Summary report
  - ✓ Security Risk Scan report
  - ✓ 1 public GitHub or GitLab repo
  - ✓ Project health dashboard
  - ✗ Investor Summary (locked)
  - ✗ Team Readiness Report (locked)
  - ✗ PDF export (locked)
  - ✗ Share links (locked)
- CTA: "Start free →" → /onboarding

**Card 2 — Full Audit ($497)**
- Badge: "One-time purchase · No subscription"
- Feature list (all unlocked):
  - ✓ All 8 reports including Investor Summary + Team Readiness
  - ✓ PDF export for every report
  - ✓ Shareable links with optional password protection
  - ✓ "Share with Trixon" for expert readout
  - ✓ Unlimited re-analyses of the same repo
- CTA: "Get full audit — $497 →" → triggers Stripe Checkout session creation
- Small text below CTA: "$497 is credited back if you proceed to a Trixon engagement"

**Below both cards — Trixon Engage callout:**
- Background: accent color (#039a85), white text
- Heading: "Need someone to actually fix this?"
- Body: "The audit shows you what's wrong. Trixon fixes it. We architect your foundation, hire your team, and hand everything over — then we leave. Most engagements run $25,000–$60,000. The audit fee comes back to you at signing."
- CTA: "Book a free discovery call →" → NEXT_PUBLIC_BOOKING_URL

---

### Page: /engage

Header: "What happens after the audit?"
Subheader: "Trixon's Build-Operate-Transfer model — designed for founders who have something built but can't safely scale it."

Three phase cards:

**Phase 1 — Architecture**
Icon: ti-blueprint
Title: "We come in and design a scalable foundation"
Body: "We audit your codebase deeply, map what's blocking you, and design a technical architecture that can support 10× growth. You get a clear plan — what to build, what to fix, what to throw away."
Timeline badge: "2–4 weeks"

**Phase 2 — Build & Hire**
Icon: ti-users
Title: "We build the foundation and hire your team"
Body: "We implement the architectural plan and simultaneously recruit and onboard your internal engineering team. We manage them. We train them. We make sure they understand the codebase before we leave."
Timeline badge: "4–12 weeks"

**Phase 3 — Transfer & Exit**
Icon: ti-door-exit
Title: "We hand over the keys and walk away"
Body: "We transfer full ownership: codebase, team, documentation, and hiring playbook. Trixon's job is to make itself unnecessary. By the time we leave, you own everything and need nobody."
Timeline badge: "2–4 weeks"

**What you own at the end** (icon grid, 4 items):
- Your IP (no agency lock-in)
- Your team (hired and trained)
- Your documentation (every system documented)
- Your independence (no Trixon dependency)

**Pricing note** (muted text box):
"Every engagement is scoped individually. Most founders invest $25,000–$60,000 for the full Build-Operate-Transfer. The audit fee ($497) is credited back when you sign."

**CTA** (full width, accent color):
"Book a free 30-minute scoping call →" → NEXT_PUBLIC_BOOKING_URL
Subtext: "We'll review your audit together and tell you exactly what a Trixon engagement would look like for your situation."

Link this page from: TrixonEngageCTA component, sticky bottom bar, post-analysis interstitial, /pricing.

---

### New Component: `<TrixonEngageCTA />`

Location: Render immediately below the health score section on `/projects/[id]`.

**Logic (determine variant from scores):**

| Condition | Variant | Heading | Body |
|-----------|---------|---------|------|
| Any score < 60 | Critical (red-accented border) | "Critical issues that need a human to fix" | "Your audit found high-severity problems that can't be patched with a checklist. Trixon specialises in exactly this — we come in, fix it, and build your team to own it." |
| All scores 60–79 | Moderate (amber-accented border) | "Your codebase has real gaps before it can scale" | "The audit found moderate issues that will become critical at your next growth stage. Trixon can close them before they close a deal for you." |
| All scores 80+ | Positive (teal-accented border) | "Solid foundation — now build the team to own it" | "Your codebase is in good shape. The next challenge is building an internal engineering team that can maintain and scale it. That's Trixon's specialty." |

All variants include:
- "Learn how Trixon works →" → /engage
- "Book a free call →" → NEXT_PUBLIC_BOOKING_URL (accent button)

Design: Full-width card. Left: icon (ti-building-factory) + text. Right: two buttons. Clean and warm — feels like co-founder advice, not an ad.

---

### New Component: `<StickyEngageBar />`

Render on all individual report pages (`/projects/[id]/reports/[type]`).

**Desktop:** Sticky bottom bar (z-50, full width, above footer)
- Left: "Issues found? Trixon can fix them." (muted, 13px)
- Right: "Book a free call →" button (accent, links to NEXT_PUBLIC_BOOKING_URL) + "How Trixon works →" text link (links to /engage)

**Mobile:** Replace sticky bar with a card at the bottom of each report (above the footer), same content.

---

### Modify: Individual Report Pages

#### All Reports
- Add `<StickyEngageBar />` to every report page.

#### Tech Debt Report (`report_type = 'tech_debt'`)

For each finding card, add below the existing severity badge:

```
[Effort badge: "quick-win" | "moderate" | "complex" | "architectural"]
[Effort description text, 13px, muted: e.g. "A senior engineer can resolve this in about 2 days."]
```

For **High severity findings only**, add a teal callout box at the bottom of the card:
```
"Trixon addresses this in [trixon_timeline]. Book a call to discuss."
[Book a call →] button (small, outline style, accent color)
```

#### Investor Technical Summary (`report_type = 'investor'`)

Add a highlighted callout box **at the top of the report**, before the content:

```
Background: #039a85 with 10% opacity
Border-left: 3px solid #039a85
Icon: ti-certificate
Text: "This report was generated by Trixon's AI analysis engine. For a live technical walkthrough you can present to your VC — with a Trixon engineer on the call — book a discovery session."
CTA link: "Book a walkthrough →" → NEXT_PUBLIC_BOOKING_URL
```

#### Team Readiness Report (`report_type = 'team_readiness'`)

This is a new report page. Follow the same layout as other report pages with one addition:
After the "Hires needed" section, add a `<TrixonBOTExplainer />` inline component — a compact 3-step summary of the BOT model with a "See full details →" link to /engage.

#### Locked Reports (Free Tier Attempting to Access Full Reports)

When `check_report_access` returns false, render the report page with a blur overlay and a paywall card:

```
Blur: backdrop-filter: blur(8px) on the report content (only the content div, not the header)

Paywall card (centered over blurred content):
  - Icon: ti-lock
  - Heading: "This report is part of the Full Audit"
  - Body: "Get all 8 reports including Investor Summary, Team Readiness, and detailed Tech Debt analysis."
  - Price: "$497 — one-time, no subscription"
  - CTA: "Unlock full audit →" → triggers checkout
  - Small text: "Or book a call and let us walk you through it → [link]"
```

---

### New Feature: "Share with Trixon" Button

**Location:** Inside the existing share modal on every report page. Add as a third option below "Copy public link" and "Export PDF".

**UI:**
```
Button: "📨 Send to Trixon team"
Subtext: "Get a free 15-minute readout from a Trixon engineer on what they'd fix first."
```

**On click — flow:**
1. Open a lightweight modal (not a full page):
   - Heading: "Send your audit to Trixon"
   - Subtext: "We'll review your analysis and reach out within 24 hours."
   - Textarea (optional): placeholder: "Anything specific you'd like us to look at?"
   - Button: "Send →" (accent color)
   - Small text: "No commitment. We'll tell you exactly what we see."

2. POST to `/api/v1/trixon-share` with `{ analysis_id, founder_message }`

3. Backend:
   - Creates `trixon_share_session`
   - Sends email to `TRIXON_TEAM_EMAIL` (via Resend) with:
     - Subject: `[Trixon Audit] New founder share — [company_name]`
     - Founder name + company
     - Link to the shared report (use existing share_token mechanism)
     - Founder's message (if provided)
     - Audit health score
     - Top 3 findings summary
     - CTA for Trixon team to click through and review

4. Show success state in modal:
   - Icon: ✓ (teal)
   - Heading: "Sent!"
   - Body: "Expect a reply within 24 hours. We review every submission personally."

This is your highest-intent lead capture. Treat it as a hot inbound — priority response.

---

### New: Post-Analysis Interstitial Screen

After `analysis.status` transitions to `'complete'`, before rendering the full dashboard, show a single interstitial screen:

**Route:** Rendered at `/projects/[id]?view=results` or as a modal overlay on first completion.

**Content:**
- Large health score ring (centre, 120px, accent color)
- Heading: "Your audit is ready."
- 3-line summary: pull the first 3 critical findings from the executive summary (store a `key_findings` JSON field on the analysis, populated during Claude's executive summary call)
- Two CTAs side by side:
  - Primary (full accent): "View your full audit →" → /projects/[id]/reports
  - Secondary (outline): "Talk to Trixon about this →" → NEXT_PUBLIC_BOOKING_URL
- Small text below: "Or send this audit to the Trixon team for a free 15-min readout →" → triggers Share with Trixon modal

This is the highest-conversion moment in the product. The founder sees their score and feels the problem most acutely here.

---

### Modify: /settings

**Remove:**
- Plan display card (Free/Pro)
- Usage stats (analyses run this month)
- "Upgrade to Pro" CTA

**Add:**
- Purchase history section:
  - List of `audit_purchases` for this user
  - Columns: Project name, Date, Amount ($497), Status badge, Receipt link (Stripe portal)
  - If no purchases: "No purchases yet. [Get your full audit →](/pricing)"

---

### Modify: Onboarding Flow (/signup)

**Role dropdown — update options:**

Remove: `investor`
Keep: `founder`
Keep: `agency` (agencies sometimes audit client codebases)
Add: `other`

**Primary goal — update options:**

Remove: `understand codebase` (too vague, covered by everything)
Keep: `prepare for investors`
Keep: `prepare to hire devs`
Add: `answer an enterprise security question`
Add: `recover from an agency codebase`
Add: `general audit / peace of mind`

Store selected goal in `profiles.primary_goal`. Use this value to reorder which reports are shown first on the reports list page — surface the most relevant report type at the top based on their stated goal.

---

## COPY & MESSAGING CHANGES

Apply these updates globally across the product:

| Location | Old | New |
|----------|-----|-----|
| All plan references | "Your plan: Free" | Remove entirely |
| All upgrade prompts | "Upgrade to Pro" | "Get full audit — $497" |
| All usage displays | "Analyses run this month: X" | Remove |
| Settings heading | "Plan & Billing" | "Purchases" |
| Report share option | "Share report" | "Share / Talk to Trixon" |
| Page `<title>` tags | "Trixon" | "Trixon Audit — [Page Name]" |
| Footer | "Trixon · [links]" | "Trixon Audit · Book a call · hello@trixon.cloud" |
| Report header (small text) | — | "Analyzed by Trixon · [Fix these issues →](BOOKING_URL)" |
| Dashboard empty state | "You have no projects yet" | "Connect a repo and we'll tell you exactly what you've built — and what it would take to scale it." |
| Analysis progress labels | "Reading your codebase…" | Keep as-is ✓ |
| Analysis complete | "Analysis complete" | "Your audit is ready" |

---

## STRIPE CHECKOUT IMPLEMENTATION NOTES

- Use Stripe Checkout (hosted page) — not Stripe Elements. Fastest to ship, handles all edge cases.
- Mode: `payment` (one-time, not `subscription`)
- On `checkout.session.completed` webhook event:
  1. Retrieve the session to get `client_reference_id` (set this to `project_id` when creating the session)
  2. Find or create `audit_purchase` record
  3. Set `status = 'complete'`, set `purchased_at = now()`
  4. If the project hasn't been analyzed yet, trigger `analyze_project` job
  5. Send confirmation email to founder via Resend
- `success_url`: `/checkout/success?project_id={project_id}`
- `cancel_url`: `/checkout/cancelled?project_id={project_id}`

**Success page (`/checkout/success`):**
- Heading: "You're all set."
- Body: "Your full audit is running. We'll email you when your 8 reports are ready — usually within 3 minutes."
- CTA: "Watch the analysis →" → /projects/[project_id]

**Cancelled page (`/checkout/cancelled`):**
- Heading: "No worries."
- Body: "Your basic audit is still available. Come back whenever you're ready."
- Secondary option: "Want to talk through what the full audit includes? [Book a 15-min call →]" → BOOKING_URL
- CTA: "Back to dashboard →" → /dashboard

---

## WHAT NOT TO CHANGE

Do not touch the following — they are working correctly and out of scope:

- All 7 existing report types and their Claude prompts (except tech debt additions above)
- The analysis pipeline architecture (RQ + Railway + Redis)
- GitHub and GitLab OAuth flows and token handling
- The existing share link system (reused by the new Trixon sharing feature)
- Dashboard charts (health score rings, language donut, third-party icons)
- Mobile responsiveness (maintain all existing breakpoints)
- Design tokens and brand palette (#039a85, #1e1b1b, #F6F4F4, #837e80)
- The ELI5 "Explain this simply" toggle on reports
- The project history page (/projects/[id]/history)
- Supabase Row Level Security policies
- AES-256 VCS token encryption

---

## SUCCESS CRITERIA

All of the following must pass before this change set is considered complete:

- [ ] A founder can sign up, connect a public repo, and receive 2 free reports without entering a credit card
- [ ] A founder can purchase the full audit for $497 via Stripe Checkout in under 3 clicks from the dashboard
- [ ] Stripe webhook correctly unlocks full reports on payment confirmation (test with Stripe CLI)
- [ ] Every High severity tech debt finding shows an effort estimate and a Trixon CTA
- [ ] The "Share with Trixon" button sends an email to `TRIXON_TEAM_EMAIL` within 60 seconds of clicking
- [ ] The /engage page accurately describes the BOT model with the three phases and pricing context
- [ ] The /pricing page clearly explains both tiers and has working CTAs for both
- [ ] The post-analysis interstitial screen appears on first completion with two CTA options
- [ ] The TrixonEngageCTA component renders the correct variant based on actual scores
- [ ] The sticky bottom bar appears on all report pages on desktop and mobile
- [ ] No page in the product contains the words "Free plan", "Pro plan", or "upgrade" in the old subscription framing
- [ ] The Team Readiness report is generated as the 8th report type and renders on its own page
- [ ] Locked reports show a paywall overlay with a clear unlock CTA for free-tier users
