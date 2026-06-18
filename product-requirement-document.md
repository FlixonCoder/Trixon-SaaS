# Trixon — Antigravity Build Prompt
### AI-Powered Technical Intelligence Platform for Non-Technical Founders

---

## CONTEXT & MISSION

You are building **Trixon** — an AI-powered technical intelligence platform that helps non-technical founders understand, audit, and scale their software systems. The core pain point: founders today use AI tools ("vibe coding") to ship products fast, but have no idea what they actually built. Trixon connects to their codebase, analyzes it deeply, and translates the findings into plain English — reports, documentation, onboarding guides, and investor-ready technical audits.

**Primary user:** Non-technical founder who has shipped a SaaS or app using AI tools (Cursor, Bolt, Lovable, Replit, etc.) and needs to understand what's under the hood before hiring devs, raising a round, or scaling users.

**The product must feel like a brilliant technical co-founder explaining your own codebase to you — not a developer tool.**

---

## TECH STACK

- **Backend:** Python (FastAPI)
- **Frontend:** Next.js 14+ (App Router, TypeScript, Tailwind CSS)
- **Database & Auth:** Supabase (Postgres + Auth + Storage)
- **Deployment:** Vercel (frontend) + Railway (backend)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514) for analysis & generation
- **Queue:** Redis + RQ (background analysis jobs on Railway)
- **Integrations:** GitHub OAuth + GitHub API (repos), GitLab OAuth + API

---

## MVP SCOPE — FEATURES TO BUILD

### 1. Authentication & Onboarding
- Email/password + GitHub OAuth via Supabase Auth
- Onboarding flow: collect founder name, company name, role, and primary goal (understand codebase / prepare for investors / prepare to hire devs)
- After auth, immediately prompt to connect their first repo

### 2. Repository Connection
- Connect GitHub or GitLab account via OAuth
- List and select repos from their connected accounts
- Support for public and private repos (scoped OAuth tokens)
- Store repo metadata in Supabase (repo_id, name, url, platform, last_synced_at)

### 3. Codebase Analysis Engine (Python backend)
When a user connects a repo, trigger a background job (RQ on Railway) that:
- Clones/fetches the repo via GitHub/GitLab API
- Walks the file tree and extracts:
  - Language breakdown (files, lines)
  - Framework detection (Next.js, FastAPI, Django, Express, etc.)
  - Dependency graph (package.json, requirements.txt, pyproject.toml, etc.)
  - API surface (routes, endpoints — detect REST, GraphQL patterns)
  - Environment variables referenced but not defined (security check)
  - Database schema if detectable (Prisma, SQLAlchemy models, migration files)
  - Third-party services used (Stripe, Supabase, OpenAI, Twilio — via imports and env vars)
  - Git history stats: commit frequency, number of contributors, last active date
- Chunk relevant code and feed structured context to Claude API
- Generate the following AI-powered outputs (stored as JSON + Markdown in Supabase Storage):
  1. **Executive Summary** — 3 paragraphs, zero jargon, "here's what you built"
  2. **Architecture Overview** — how the pieces connect, in plain English with a simple diagram description
  3. **Tech Debt Report** — what's messy, risky, or unscalable (categorized: Low / Medium / High severity)
  4. **Security Risk Scan** — hardcoded secrets, missing auth, exposed endpoints, env var issues
  5. **Scalability Assessment** — can this handle 10x users? what breaks first?
  6. **Developer Onboarding Guide** — what a new dev needs to know to get up to speed fast
  7. **Investor Technical Summary** — 1-pager framing the codebase positively for due diligence

### 4. Dashboard — Project Overview
Post-analysis, show the founder a clean dashboard per project:
- Project health score (0–100), broken down by: Security, Scalability, Code Quality, Documentation
- Visual language/framework breakdown (donut chart)
- Third-party services detected (icon grid)
- Key stats: total files, lines of code, number of endpoints, dependencies count
- Last analyzed date + "Re-analyze" button

### 5. Reports Module
- Each of the 7 AI-generated outputs rendered as beautiful, readable pages in the UI
- "Explain this to me like I'm 5" toggle on any section (calls Claude API inline for simpler re-explanation)
- Copy to clipboard / Export as PDF for each report
- Share report via a public link (with optional password protection)

### 6. Settings & Billing
- Manage connected repos (add/remove)
- Manage GitHub/GitLab connections
- Plan display (Free: 1 repo / Pro: unlimited repos + PDF exports + shareable links)
- Basic usage stats (analyses run this month)

---

## DATABASE SCHEMA (Supabase / Postgres)

```sql
-- Users (extends Supabase auth.users)
profiles (
  id uuid references auth.users primary key,
  full_name text,
  company_name text,
  role text, -- 'founder' | 'investor' | 'agency'
  primary_goal text,
  plan text default 'free', -- 'free' | 'pro'
  created_at timestamptz default now()
)

-- Connected VCS accounts
vcs_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  platform text, -- 'github' | 'gitlab'
  platform_user_id text,
  platform_username text,
  access_token text, -- encrypted
  token_expiry timestamptz,
  created_at timestamptz default now()
)

-- Projects (connected repos)
projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  vcs_connection_id uuid references vcs_connections(id),
  repo_id text, -- platform's internal id
  repo_name text,
  repo_url text,
  platform text,
  default_branch text,
  last_synced_at timestamptz,
  created_at timestamptz default now()
)

-- Analysis runs
analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  status text default 'queued', -- 'queued' | 'running' | 'complete' | 'failed'
  health_score integer, -- 0-100
  security_score integer,
  scalability_score integer,
  quality_score integer,
  docs_score integer,
  language_breakdown jsonb, -- { "Python": 60, "JavaScript": 30, ... }
  dependencies jsonb,
  third_party_services jsonb,
  stats jsonb, -- { files, lines, endpoints, contributors }
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
)

-- Generated reports
reports (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references analyses(id),
  report_type text, -- 'executive_summary' | 'architecture' | 'tech_debt' | 'security' | 'scalability' | 'onboarding' | 'investor'
  content_markdown text,
  content_json jsonb,
  share_token text unique,
  share_password_hash text,
  share_enabled boolean default false,
  created_at timestamptz default now()
)
```

---

## API ROUTES (FastAPI — Python Backend)

```
POST   /api/v1/projects                  — Create project (link a repo)
GET    /api/v1/projects                  — List user's projects
GET    /api/v1/projects/{id}             — Get project details
DELETE /api/v1/projects/{id}             — Remove project

POST   /api/v1/projects/{id}/analyze     — Trigger analysis job
GET    /api/v1/analyses/{id}             — Poll analysis status + results
GET    /api/v1/analyses/{id}/reports     — Get all reports for an analysis
GET    /api/v1/analyses/{id}/reports/{type} — Get a specific report

POST   /api/v1/reports/{id}/simplify     — "ELI5" re-explain a report section
POST   /api/v1/reports/{id}/share        — Enable/configure public share link
GET    /api/v1/share/{token}             — Public share endpoint (no auth required)

POST   /api/v1/vcs/github/connect        — GitHub OAuth callback handler
POST   /api/v1/vcs/gitlab/connect        — GitLab OAuth callback handler
DELETE /api/v1/vcs/{id}                  — Disconnect VCS account

GET    /api/v1/github/repos              — List repos from connected GitHub account
GET    /api/v1/gitlab/repos              — List repos from connected GitLab account
```

All private endpoints require Supabase JWT in Authorization header.

---

## FRONTEND ROUTES (Next.js App Router)

```
/                          → Marketing landing page
/login                     → Auth page (email + GitHub OAuth)
/signup                    → Signup with onboarding questions
/onboarding                → Post-signup: connect first repo
/dashboard                 → Projects list view
/projects/[id]             → Project dashboard (health scores, stats)
/projects/[id]/reports     → All reports for latest analysis
/projects/[id]/reports/[type] → Individual report view
/projects/[id]/history     → Past analysis runs
/settings                  → Account, connected repos, VCS connections
/share/[token]             → Public shareable report view
```

---

## KEY UX PRINCIPLES

1. **Zero jargon on the surface.** Labels like "API endpoints" should have a tooltip saying "The entry points into your app — like doors that other apps knock on." 
2. **Progressive disclosure.** Show the summary first. Let the user drill deeper by clicking.
3. **Analysis is async, UI is not.** Show a live progress tracker (with friendly stage labels: "Reading your codebase…", "Mapping the architecture…", "Checking for security risks…", "Writing your reports…") while the background job runs. Use polling (every 3s) on the frontend.
4. **Celebrate what's good.** Every report must lead with positives before surfacing risks.
5. **Mobile-responsive.** Founders check things on their phone. The dashboard and reports must be fully usable on mobile.

---

## ANALYSIS PIPELINE DETAIL (Python Background Job)

```
Job: analyze_project(project_id, analysis_id)

Step 1: Clone repo
  - Use GitPython or GitHub API to fetch file tree + file contents
  - Limit: only fetch files < 500KB, skip: node_modules, .git, dist, build, __pycache__
  - Max repo size for MVP: 50MB uncompressed

Step 2: Static extraction (no AI yet)
  - Detect languages: count extensions
  - Detect frameworks: look for config files (next.config.js, fastapi in requirements, etc.)
  - Extract dependencies: parse package.json, requirements.txt, pyproject.toml, go.mod, etc.
  - Find API routes: regex scan for route decorators (@app.get, router.get, app.use, etc.)
  - Find env var usage: grep for process.env.X, os.environ.get('X'), os.getenv('X')
  - Find DB models: look for Prisma schema, SQLAlchemy Base, Django models.py
  - Find third-party imports: match against a known-services list (stripe, openai, supabase, twilio, sendgrid, etc.)

Step 3: Build AI context package
  - Summarize findings into structured JSON
  - Select most representative code files (README, main entry points, key route files, schema files)
  - Chunk to fit within Claude's context window

Step 4: Claude API calls (run in sequence)
  - Call 1: Executive summary + architecture
  - Call 2: Tech debt analysis (pass relevant files)
  - Call 3: Security scan (pass env references, auth files, exposed routes)
  - Call 4: Scalability assessment
  - Call 5: Developer onboarding guide
  - Call 6: Investor technical summary

Step 5: Score computation
  - Compute health scores from structured Claude outputs
  - Store all results in Supabase

Step 6: Mark analysis complete
  - Update analysis.status = 'complete'
  - Trigger webhook/realtime event so frontend stops polling
```

---

## DEPLOYMENT ARCHITECTURE

```
Vercel (Frontend - Next.js)
  ↕ HTTPS API calls
Railway (Backend - FastAPI + Redis + RQ Worker)
  ↕ Supabase Client SDK
Supabase (Postgres DB + Auth + File Storage)
  ↕ GitHub/GitLab APIs for repo access
  ↕ Anthropic Claude API for AI generation
```

**Environment Variables needed:**
```
# Backend (Railway)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
REDIS_URL=
ENCRYPTION_KEY=           # for encrypting VCS tokens at rest

# Frontend (Vercel)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=      # Railway backend URL
NEXT_PUBLIC_GITHUB_CLIENT_ID=
```

---

## BUILD TIMELINE — PHASE BASED

---

### PHASE 1 — Foundation & Infrastructure
**Goal:** Everything is scaffolded, deployed, and connected. Nothing breaks on boot.

**Backend (FastAPI)**
- [ ] Init FastAPI project: folder structure (`/api`, `/services`, `/workers`, `/models`), linting (ruff), env config
- [ ] Supabase client setup (service role key, Postgres connection)
- [ ] Redis + RQ worker process configured and running on Railway
- [ ] Health check endpoint (`GET /health`) live on Railway

**Frontend (Next.js)**
- [ ] Init Next.js 14 App Router project: TypeScript, Tailwind CSS, shadcn/ui
- [ ] Brand tokens wired into Tailwind config (`primary: #1e1b1b`, `secondary: #F6F4F4`, `muted: #837e80`, `accent: #039a85`)
- [ ] Logo assets added from `/assets/` folder into `public/` — light + dark variants
- [ ] Base layout: nav (logo + auth state), page wrapper, footer

**Supabase**
- [ ] Create all tables: `profiles`, `vcs_connections`, `projects`, `analyses`, `reports`
- [ ] Row Level Security policies on all tables (users see only their own data)
- [ ] Storage bucket: `reports` (for markdown/JSON outputs)
- [ ] `profiles` auto-created on signup via Supabase auth trigger

**CI/CD**
- [ ] GitHub Actions: lint + type-check on push
- [ ] Vercel auto-deploy from `main` (frontend)
- [ ] Railway auto-deploy from `main` (backend + worker)

**Deliverable:** A live URL with a blank app that boots, connects to Supabase, and deploys cleanly.

---

### PHASE 2 — Auth & Onboarding
**Goal:** A founder can sign up, tell Trixon about themselves, and land on a dashboard.

**Backend**
- [ ] GitHub OAuth callback handler (`POST /api/v1/vcs/github/connect`) — exchanges code for token, stores encrypted in `vcs_connections`
- [ ] GitLab OAuth callback handler (`POST /api/v1/vcs/gitlab/connect`)
- [ ] Token encryption at rest (AES-256 via Python `cryptography` library)
- [ ] JWT middleware: validate Supabase session token on all private routes

**Frontend**
- [ ] `/login` — email/password + "Continue with GitHub" button
- [ ] `/signup` — signup form + onboarding questions (name, company, role, primary goal: understand codebase / prep for investors / prep to hire devs)
- [ ] `/onboarding` — post-signup screen prompting to connect first repo (GitHub or GitLab OAuth trigger)
- [ ] `/dashboard` — empty state for users with no projects yet ("Connect your first repo →")
- [ ] Session persistence via Supabase client (auto-refresh tokens)

**Deliverable:** Full auth loop working end-to-end. User signs up → answers 3 onboarding questions → sees dashboard.

---

### PHASE 3 — Repo Connection & Static Analysis
**Goal:** A founder connects a GitHub/GitLab repo and Trixon reads it.

**Backend**
- [ ] `GET /api/v1/github/repos` — list user's repos from connected GitHub account
- [ ] `GET /api/v1/gitlab/repos` — same for GitLab
- [ ] `POST /api/v1/projects` — create project, link to VCS connection
- [ ] Repo fetcher service: clone/fetch repo via GitHub API (skip: `node_modules`, `.git`, `dist`, `build`, `__pycache__`; limit: files < 500KB; max repo: 50MB)
- [ ] Static extractor service:
  - Language detection (count file extensions)
  - Framework detection (next.config.js, fastapi/django in requirements, etc.)
  - Dependency parsing (package.json, requirements.txt, pyproject.toml, go.mod)
  - API route detection (regex scan for decorators + route patterns)
  - Env var usage scan (process.env.X, os.environ.get, os.getenv)
  - Third-party service detection (match imports against known-services list: stripe, openai, supabase, twilio, sendgrid, etc.)
  - DB model detection (Prisma schema, SQLAlchemy Base, Django models.py)
  - Git stats: commit frequency, contributors, last active date

**Frontend**
- [ ] `/onboarding` and `/dashboard`: repo picker UI (list repos from connected account, searchable)
- [ ] Project card on dashboard (repo name, platform badge, "Analyze" button)
- [ ] `GET /api/v1/projects` wired to dashboard

**Deliverable:** User connects a repo, Trixon fetches and statically parses it. Results are stored in `analyses` table (status: `queued` → `running`).

---

### PHASE 4 — AI Analysis Engine
**Goal:** Trixon reads the codebase and generates all 7 reports using Claude.

**Backend**
- [ ] RQ job: `analyze_project(project_id, analysis_id)` — orchestrates the full pipeline
- [ ] Build AI context package: structure static extraction output as JSON, select representative files (README, entry points, route files, schema), chunk to fit Claude context window
- [ ] Claude API integration (`claude-sonnet-4-20250514`) — one call per report type:
  1. **Executive Summary** — "Here's what you built", zero jargon, 3 paragraphs
  2. **Architecture Overview** — how the pieces connect, plain English + diagram description
  3. **Tech Debt Report** — issues categorized by severity (Low / Medium / High), with what to fix first
  4. **Security Risk Scan** — hardcoded secrets, missing auth, exposed endpoints, env var gaps
  5. **Scalability Assessment** — what breaks at 10x users, what's solid
  6. **Developer Onboarding Guide** — what a new dev needs to know on day 1
  7. **Investor Technical Summary** — 1-pager framing the codebase positively for due diligence
- [ ] Score computation from Claude outputs: Health, Security, Scalability, Quality, Docs (each 0–100)
- [ ] Store all report markdown + structured JSON in Supabase Storage + `reports` table
- [ ] Analysis status transitions: `queued → running → complete | failed`
- [ ] Retry logic: auto-retry failed Claude calls up to 2 times before marking failed
- [ ] `POST /api/v1/projects/{id}/analyze` — triggers the job
- [ ] `GET /api/v1/analyses/{id}` — returns status + scores (used for polling)
- [ ] `GET /api/v1/analyses/{id}/reports/{type}` — returns a specific report

**Deliverable:** Full analysis pipeline working. Trigger analysis → all 7 reports generated and stored within 3 minutes.

---

### PHASE 5 — Dashboard & Reports UI
**Goal:** The founder sees their results in a clear, beautiful, non-technical interface.

**Frontend**
- [ ] `/projects/[id]` — Project Dashboard:
  - Health score ring (overall, colored in `#039a85`)
  - Sub-scores: Security, Scalability, Quality, Docs (smaller rings or progress bars)
  - Stats grid: total files, lines of code, endpoints, contributors, dependencies
  - Language breakdown donut chart (Recharts)
  - Third-party services icon grid (detected services)
  - "Re-analyze" button + last analyzed timestamp
- [ ] Live analysis progress tracker:
  - Poll `GET /api/v1/analyses/{id}` every 3 seconds
  - Show stage labels: "Reading your codebase…" → "Mapping the architecture…" → "Checking for security risks…" → "Writing your reports…"
  - Animated progress bar in `#039a85`
- [ ] `/projects/[id]/reports` — Reports list (7 report cards with status + preview)
- [ ] Individual report pages for each of the 7 types:
  - Rendered from Markdown with styled typography
  - Severity badges (color-coded: turquoise / amber / red)
  - Callout boxes for key findings
  - "Explain this to me simply" button per section (calls `POST /api/v1/reports/{id}/simplify`)
- [ ] Tooltip system: jargon terms (e.g. "API endpoint", "dependency") show plain-English tooltip on hover

**Deliverable:** Full read path — founder can see scores, charts, and all 7 reports in a polished UI.

---

### PHASE 6 — Sharing, Export & Settings
**Goal:** Founders can share reports externally (with investors, advisors) and manage their account.

**Backend**
- [ ] `POST /api/v1/reports/{id}/share` — enable public share link, optionally set password
- [ ] `GET /api/v1/share/{token}` — public endpoint (no auth), returns report if token valid + password matches
- [ ] PDF generation endpoint — render report Markdown to PDF (Puppeteer or WeasyPrint)
- [ ] Rate limiting: free users max 3 analyses/month (enforced in job trigger endpoint)

**Frontend**
- [ ] Share modal on report page: toggle public link, copy URL, set optional password
- [ ] `/share/[token]` — public report view (Trixon logo, report content, "Analyzed by Trixon" footer CTA)
- [ ] PDF export button on each report page
- [ ] `/settings`:
  - Connected VCS accounts (add/remove GitHub or GitLab)
  - Projects list with remove option
  - Plan display (Free / Pro) + usage stats (analyses this month)
- [ ] `/projects/[id]/history` — list of past analysis runs with scores + timestamps

**Deliverable:** Shareable reports, PDF export, and full settings management working.

---

### PHASE 7 — Polish, Security & Beta Launch
**Goal:** Trixon is airtight, fast, and ready for real founders to use.

**Security & Quality**
- [ ] Full RLS policy audit on all Supabase tables
- [ ] Confirm VCS tokens never exposed to frontend (server-side only)
- [ ] Env var exposure check in the codebase itself (dogfood: run Trixon on Trixon)
- [ ] Input validation on all API endpoints (Pydantic models)

**Performance**
- [ ] Confirm analysis completes in < 3 minutes for repos up to 50MB
- [ ] Add job timeout (5 min hard limit) + graceful failure message
- [ ] Lazy load report content on individual report pages

**UX & Onboarding**
- [ ] Loading skeletons on all async data loads
- [ ] Full empty states (no repos, no analysis yet, analysis failed)
- [ ] Error states with friendly messages ("Something went wrong — we're looking into it")
- [ ] Welcome email on signup (Supabase + Resend integration)
- [ ] Mobile responsiveness pass: dashboard, reports, share page

**Landing Page**
- [ ] `/` — Marketing landing page with: headline, 3 use cases, how it works (3 steps), CTA to sign up
- [ ] SEO meta tags, OG image

**Beta Launch**
- [ ] Soft launch to 20 beta founders
- [ ] Feedback collection (Tally or simple in-app form)
- [ ] Monitor: analysis success rate target > 90%, report clarity NPS target ≥ 4/5

---

## NON-FUNCTIONAL REQUIREMENTS

- Analysis must complete in under 3 minutes for repos up to 50MB
- All VCS access tokens encrypted at rest (AES-256 via Python cryptography library)
- Supabase Row Level Security: users can only access their own projects and analyses
- GitHub/GitLab tokens never exposed to frontend — only used server-side
- Rate limit: Free users = 3 analyses/month, Pro users = unlimited
- Reports must render cleanly for non-technical users: no raw code blocks in summaries, use callout boxes for severity, friendly icons and color coding

---

## DESIGN SYSTEM NOTES

### Brand Colors
| Role | Hex | Usage |
|---|---|---|
| Primary | `#1e1b1b` | Backgrounds, headers, nav, primary text |
| Secondary | `#F6F4F4` | Page backgrounds, card surfaces, light sections |
| Support Gray | `#837e80` | Subtext, labels, muted UI elements |
| Accent / Action | `#039a85` | CTAs, links, highlights, health score rings, badges |

Semantic color mappings (for reports):
- **Healthy / Good:** `#039a85` (Vivid Turquoise)
- **Warning / Medium risk:** `#F59E0B` (Amber — bring in as one-off, not part of brand palette)
- **Critical / High risk:** `#E53E3E` (Rose Red — one-off for severity only)

### Logo
- Logo files are located in `/assets/` (provided by the team — use wherever a logo is needed: nav, auth pages, reports header, PDF exports, share pages)
- Use the light variant of the logo on dark (`#1e1b1b`) backgrounds
- Use the dark variant on light (`#F6F4F4`) backgrounds
- Never stretch or recolor the logo

### Typography
- **Font:** Inter (Google Fonts)
- **Headings:** Inter Bold / Semibold, color `#1e1b1b`
- **Body:** Inter Regular, color `#1e1b1b` at 90% opacity
- **Muted/labels:** Inter Regular, color `#837e80`

### Components & Libraries
- **Component base:** shadcn/ui
- **Icons:** Lucide React
- **Charts:** Recharts (donut for language breakdown, radial for health scores)
- **Feel:** Premium, calm, trustworthy — not a developer tool. Think Notion meets Linear meets a consultant's report. The turquoise accent should feel like a guiding hand, not a loud tech brand.

---

## SUCCESS METRICS FOR BETA

- Time to first report: < 5 minutes from signup
- Analysis completion rate: > 90% (jobs don't fail)
- Report clarity NPS: founders rate report usefulness ≥ 4/5
- Activation rate: % of signups who connect a repo and view at least one report

---

*Build this as a production-grade, clean, well-structured codebase. Trixon is itself going to be analyzed by its own product — the code should be something to be proud of.*
