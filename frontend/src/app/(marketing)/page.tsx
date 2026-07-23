import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  BarChart3,
  FileText,
  GitBranch,
  Zap,
  Users,
  ArrowRight,
  Check,
  Code2,
  Eye,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Quote,
  Search,
  MessageSquare,
  ListTodo,
} from "lucide-react";
import { ParallaxFeatureCard } from "@/components/marketing/ParallaxFeatureCard";
import { DemoTimeline } from "@/components/marketing/DemoTimeline";
import { HeroScreenshot } from "@/components/marketing/HeroScreenshot";

export const metadata: Metadata = {
  title: "Trixon — AI Codebase Intelligence for Non-Technical Founders",
  description:
    "Connect your repo once. Every commit gets analyzed, scored, and turned into a plain-English action plan. Understand what you built, catch security risks, and impress investors — no CTO needed.",
  keywords: [
    "codebase intelligence",
    "AI code analysis",
    "non-technical founders",
    "tech debt tracking",
    "code health score",
    "security scan",
    "investor technical summary",
    "Cursor founders",
    "vibe coding",
    "software due diligence",
    "continuous codebase monitoring",
  ],
  openGraph: {
    title: "Trixon — AI Codebase Intelligence for Non-Technical Founders",
    description:
      "Know what changed. Know what's next. AI-powered codebase intelligence in plain English — built for founders who ship with Cursor, Bolt, or Lovable.",
    type: "website",
    url: "https://trixon.cloud",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trixon — AI Codebase Intelligence for Non-Technical Founders",
    description:
      "Connect your repo once. Every commit analyzed, scored, and turned into a clear next step.",
  },
};

/* ============================================================
   Code lines for the Living Diff hero background.
   ============================================================ */
const CODE_LINES = [
  "+ const result = await analyze(repo);",
  "  import { createClient } from '@supabase/ssr';",
  "- this.timeout = 3000;",
  "+ this.timeout = 5000; // increased for stability",
  "  export async function getHealthScore(id) {",
  "    const scores = await fetchScores(projectId);",
  "- const auth = basicAuth(user, pass);",
  "+ const auth = bearerToken(session.jwt);",
  "  return { status: 'healthy', score: 78 };",
  "  }",
  "  async function runMigration(db) {",
  "+ await db.schema.createIndex('idx_user_id');",
  "  const config = loadEnv(process.env);",
  "- console.log('debug:', payload);",
  "  export default function middleware(req) {",
  "+ const rateLimit = new RateLimiter(100);",
  "  if (!session) return redirect('/login');",
  "  const report = generateReport(analysis);",
  "- fetch('/api/data', { cache: 'no-store' });",
  "+ fetch('/api/data', { next: { revalidate: 60 } });",
  "  return NextResponse.next();",
  "  }",
  "  const snapshot = await createSnapshot(repo);",
  "+ const diff = compareSnapshots(prev, current);",
];

export default function Home() {
  return (
    <>
      {/* ============================================================
          HERO SECTION — Living Diff Background
          ============================================================ */}
      <section
        className="relative bg-[#1e1b1b] overflow-hidden grain-overlay"
        aria-label="Hero"
      >
        {/* Ambient glow orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#039a85]/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#039a85]/3 blur-3xl pointer-events-none" />

        {/* Living Diff — scrolling code wall */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none select-none"
          aria-hidden="true"
        >
          <div className="code-wall absolute left-0 right-0 font-mono text-[11px] leading-[1.8] text-white/[0.08] whitespace-pre px-8 sm:px-16">
            {[...CODE_LINES, ...CODE_LINES].map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("+")
                    ? "text-[#039a85]/[0.12]"
                    : line.startsWith("-")
                    ? "text-[#ef4444]/[0.10]"
                    : ""
                }
              >
                {line}
              </div>
            ))}
          </div>

          {/* Scan line */}
          <div className="scan-line absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-[#039a85]/[0.06] to-transparent pointer-events-none" />
        </div>

        {/* Vignette for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b1b]/60 via-transparent to-[#1e1b1b]/80 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-32 sm:pb-24">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#039a85]/10 border border-[#039a85]/20 rounded-full px-4 py-1.5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-[#039a85] animate-pulse" />
              <span className="text-xs font-medium text-[#039a85]">
                Free during beta — no credit card required
              </span>
            </div>

            {/* H1 */}
            <h1
              className="text-4xl sm:text-5xl lg:text-[3.75rem] font-bold text-white leading-[1.1] tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              You shipped fast.
              <br />
              <span className="gradient-text">Now understand what you built.</span>
            </h1>

            {/* Subheading */}
            <p className="mt-6 text-lg sm:text-xl text-[#a39e9f] max-w-2xl mx-auto leading-relaxed">
              Trixon connects to your repo and turns every commit into a
              plain-English health report — with security scans, tech debt
              analysis, and ready-to-paste AI prompts. Built for founders who
              ship with Cursor, Bolt, Lovable, or Replit.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                id="hero-cta-primary"
                className="group inline-flex items-center gap-2 bg-[#039a85] text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-[#02816f] transition-all duration-300 hover:shadow-xl hover:shadow-[#039a85]/25 text-base"
              >
                Understand your codebase — free
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href="#how-it-works"
                id="hero-cta-secondary"
                className="inline-flex items-center gap-2 text-[#a39e9f] hover:text-white font-medium px-8 py-3.5 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200 text-base"
              >
                See how it works
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-[#837e80]">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#039a85]" />
                <span>First report in under 5 minutes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#039a85]" />
                <span>Auto-tracks every push</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#039a85]" />
                <span>Works with GitHub &amp; GitLab</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#039a85]" />
                <span>Plain English — no jargon</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#f9f9f8] to-transparent" />
      </section>

      {/* ============================================================
          PRODUCT SCREENSHOT BANNER
          ============================================================ */}
      <section
        className="bg-[#f9f9f8] py-16 sm:py-20"
        aria-label="Product preview"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#039a85] mb-3">
              The dashboard
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold text-[#1e1b1b] tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Everything your codebase is doing — at a glance
            </h2>
            <p className="mt-3 text-sm text-[#837e80] max-w-xl mx-auto">
              Health scores, snapshot history, action items, and 7 AI-generated
              reports — all in one place. No setup beyond connecting your repo.
            </p>
          </div>
          <HeroScreenshot
            label="Trixon Dashboard"
            caption="Health score, snapshot timeline, and prioritized action items — all in one view"
          />
        </div>
      </section>

      {/* ============================================================
          ICP POSITIONING STRIP
          ============================================================ */}
      <section className="bg-white py-12 border-y border-[#e0dada]" aria-label="Who it's for">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12">
            <p className="text-sm text-[#837e80] font-medium whitespace-nowrap">
              Built for founders using:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6">
              {["Cursor", "Bolt", "Lovable", "Replit", "Claude Code", "v0"].map(
                (tool) => (
                  <span
                    key={tool}
                    className="text-sm font-semibold text-[#1e1b1b] bg-[#f9f9f8] border border-[#e0dada] px-4 py-1.5 rounded-full"
                  >
                    {tool}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          VALUE PROP — Parallax Feature Cards
          ============================================================ */}
      <section
        className="bg-[#f9f9f8] py-20 sm:py-24"
        aria-label="Core features"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#039a85] mb-3">
              Why Trixon
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#1e1b1b] tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              You shipped fast. Now scale with confidence.
            </h2>
            <p className="mt-4 text-base text-[#837e80] leading-relaxed">
              Whether you used Cursor, Bolt, Lovable, or Replit — you built
              something real. Trixon reads your codebase and gives you the
              clarity to hire developers, raise funding, or scale users.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ParallaxFeatureCard
              title="Understand what you built"
              description="Get plain-English executive summaries and architecture maps of your app. Translate complex technical files and code structures into clear descriptions you can confidently share with team members and investors."
              icon={<Eye className="w-6 h-6 text-[#039a85]" />}
              tag="AI Reports"
            />
            <ParallaxFeatureCard
              title="Prioritized Action Items"
              description="Instantly view tech debt, security risks, and bottlenecks categorized by severity. Every issue comes with a customized, one-shot prompt you can copy-paste into Cursor or Claude to patch it immediately."
              icon={<ListTodo className="w-6 h-6 text-[#039a85]" />}
              tag="Action Items"
            />
            <ParallaxFeatureCard
              title="Automated Health Timeline"
              description="Connect auto-tracking with one click. Every commit push triggers a new snapshot automatically, letting you watch your codebase health score trend over time with detailed visual diff changelogs."
              icon={<RefreshCw className="w-6 h-6 text-[#039a85]" />}
              tag="Timeline"
            />
            <ParallaxFeatureCard
              title="Talk straight to your code"
              description="Have a question about a function, a dependencies layer, or how to implement a new feature? Chat directly with Trixon's AI advisor which retains context of your entire codebase structure."
              icon={<MessageSquare className="w-6 h-6 text-[#039a85]" />}
              tag="AI Chat"
            />
            <ParallaxFeatureCard
              title="Semantic Search Engine"
              description="Quickly parse through and search the entire codebase. Locate specific functions, API endpoints, routes, or configuration files across your directories in seconds using smart natural language queries."
              icon={<Search className="w-6 h-6 text-[#039a85]" />}
              tag="Semantic Search"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS
          ============================================================ */}
      <section
        id="how-it-works"
        className="bg-white py-20 sm:py-24"
        aria-label="How it works"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#039a85] mb-3">
              Getting started
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#1e1b1b] tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              From codebase chaos to crystal clarity in 3 steps
            </h2>
            <p className="mt-4 text-base text-[#837e80]">
              Your first report is ready in under 5 minutes. No engineering
              required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: GitBranch,
                title: "Connect your repo",
                description:
                  "Link your GitHub or GitLab account with one click. We securely read your codebase — your code never leaves our encrypted pipeline, and we never write to your repo.",
                detail: "GitHub & GitLab supported",
              },
              {
                step: "02",
                icon: Zap,
                title: "AI analyzes everything",
                description:
                  "Our engine reads every file, maps your architecture, detects frameworks, scans for security risks, and evaluates scalability — all automatically, in minutes.",
                detail: "7 reports generated per snapshot",
              },
              {
                step: "03",
                icon: FileText,
                title: "Get reports + a live timeline",
                description:
                  "Review your health score, security findings, tech debt, and action items. Then connect auto-tracking — every future push analyzed without lifting a finger.",
                detail: "Webhook auto-tracking included",
              },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                {/* Connector line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-12 left-[calc(50%+60px)] w-[calc(100%-120px)] h-px bg-gradient-to-r from-[#039a85]/30 to-[#039a85]/10" />
                )}
                <div className="text-center group">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-[#f9f9f8] border border-[#e0dada] mb-6 relative transition-all duration-300 group-hover:border-[#039a85]/30 group-hover:bg-[#039a85]/5">
                    <item.icon className="w-10 h-10 text-[#1e1b1b] transition-colors duration-300 group-hover:text-[#039a85]" />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#039a85] text-white text-xs font-bold flex items-center justify-center">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#1e1b1b] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#837e80] leading-relaxed max-w-xs mx-auto mb-3">
                    {item.description}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider text-[#039a85] bg-[#039a85]/8 px-3 py-1 rounded-full">
                    <Check className="w-3 h-3" />
                    {item.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* "Then it keeps going" callout */}
          <div className="mt-16 max-w-2xl mx-auto text-center bg-[#f9f9f8] rounded-2xl p-8 border border-[#e0dada]">
            <div className="inline-flex items-center gap-2 text-[#039a85] mb-3">
              <RefreshCw className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Then it keeps going
              </span>
            </div>
            <p className="text-sm text-[#837e80] leading-relaxed">
              Enable auto-tracking and every future push gets a new analysis
              automatically. Trixon remembers your codebase history — ask it
              anything in plain English via the built-in AI chat.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          DEMO TIMELINE — Proof moment
          ============================================================ */}
      <section
        className="bg-[#1e1b1b] py-20 sm:py-24 relative grain-overlay overflow-hidden"
        aria-label="Live demo"
      >
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#039a85]/5 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#039a85] mb-3">
              Live tracking in action
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              This is what continuous tracking looks like
            </h2>
            <p className="mt-3 text-sm text-[#837e80] max-w-lg mx-auto">
              Real health scores across 5 snapshots. Hover each point to see
              what changed. Not a marketing mockup — this is the actual
              component from the app.
            </p>
          </div>
          <DemoTimeline />

          <div className="mt-8 text-center">
            <Link
              href="/signup"
              id="demo-cta"
              className="group inline-flex items-center gap-2 text-[#039a85] hover:text-white font-medium text-sm transition-colors duration-200"
            >
              Start tracking your own codebase
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          REPORT GRID — Seven reports
          ============================================================ */}
      <section
        id="features"
        className="bg-[#f9f9f8] py-20 sm:py-24"
        aria-label="AI reports"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#039a85] mb-3">
              What you get
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#1e1b1b] tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              7 AI-generated reports, every snapshot
            </h2>
            <p className="mt-4 text-base text-[#837e80]">
              Each report translates technical reality into decisions you can
              act on — whether you&apos;re hiring a dev, raising funding, or
              just trying to understand what you shipped.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: FileText,
                title: "What You Built",
                description:
                  "A plain-English overview of your product — what it does, how it's structured, and what matters most. Stop fumbling when someone asks about your tech stack.",
                tag: "Essential",
                tagColor: "bg-blue-50 text-blue-600",
              },
              {
                icon: Code2,
                title: "How It All Connects",
                description:
                  "Your architecture mapped simply — services, data flow, and dependencies. Great for onboarding devs or explaining your system to a technical investor.",
                tag: "Essential",
                tagColor: "bg-blue-50 text-blue-600",
              },
              {
                icon: BarChart3,
                title: "What's Messy & Risky",
                description:
                  "Tech debt categorized by severity — what to fix first, what can wait, and what's already fine. Prioritized so you don't waste time on the wrong things.",
                tag: "Risk",
                tagColor: "bg-amber-50 text-amber-600",
              },
              {
                icon: Shield,
                title: "Security Risk Scan",
                description:
                  "Hardcoded secrets, missing auth, exposed endpoints — catch vulnerabilities before they catch you. Every finding comes with a Cursor-ready fix prompt.",
                tag: "Risk",
                tagColor: "bg-red-50 text-red-600",
              },
              {
                icon: TrendingUp,
                title: "Can It Handle Growth?",
                description:
                  "Can your app handle 10x users tomorrow? Find out what breaks first and what's already solid — before you spend on scaling.",
                tag: "Growth",
                tagColor: "bg-emerald-50 text-emerald-600",
              },
              {
                icon: Users,
                title: "Dev Onboarding Guide",
                description:
                  "Everything a new developer needs to get up to speed fast. Hire with confidence knowing your codebase is documented and explainable.",
                tag: "Team",
                tagColor: "bg-purple-50 text-purple-600",
              },
              {
                icon: BarChart3,
                title: "Investor Technical Summary",
                description:
                  "A due-diligence-ready technical overview to share with investors. Demonstrate you know what you built — no CTO required.",
                tag: "Investor",
                tagColor: "bg-indigo-50 text-indigo-600",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="card-elevated group bg-white rounded-xl p-6 border border-[#e0dada] transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#039a85]/10 flex items-center justify-center group-hover:bg-[#039a85]/15 transition-colors duration-300">
                    <feature.icon className="w-5 h-5 text-[#039a85]" />
                  </div>
                  <span
                    className={`text-[10px] uppercase font-semibold tracking-wider px-2.5 py-1 rounded-full ${feature.tagColor}`}
                  >
                    {feature.tag}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#1e1b1b] mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#837e80] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-[#837e80]">
            Pick what&apos;s useful now — add more anytime. Trixon remembers your
            codebase between snapshots so nothing is ever wasted.
          </p>
        </div>
      </section>

      {/* ============================================================
          FOUNDER QUOTE SECTION
          ============================================================ */}
      <section
        className="bg-[#1e1b1b] py-20 sm:py-24 relative overflow-hidden grain-overlay"
        aria-label="Founder quote"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#039a85]/4 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#039a85] mb-3">
              Built by a founder, for founders
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              No fluff. No bloat. Just execution.
            </h2>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="relative bg-[#272424] border border-white/10 rounded-2xl p-8 sm:p-10">
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-[#039a85]/40 mb-6" />

              <blockquote className="text-lg sm:text-xl text-white/90 leading-relaxed font-light italic">
                &ldquo;I take non-technical founders from idea to
                production-ready product. No fluff, no bloat — just execution,
                done by the person you&apos;re actually talking to.&rdquo;
              </blockquote>

              <div className="mt-8 flex items-center gap-4">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-[#039a85]/20 border border-[#039a85]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#039a85] font-bold text-lg">MS</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Mohammed Saqib Junaid Khan
                  </p>
                  <p className="text-xs text-[#a39e9f]">
                    Founder, Trixon
                  </p>
                </div>
              </div>

              {/* Decorative corner accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#039a85]/5 to-transparent rounded-2xl pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA SECTION
          ============================================================ */}
      <section
        className="bg-[#f9f9f8] py-20 sm:py-24 relative overflow-hidden"
        aria-label="Call to action"
      >
        {/* Subtle top border accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-[#039a85]/40 to-transparent" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#039a85] mb-4">
            Get started today
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-[#1e1b1b] tracking-tight"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Your codebase has a story.
            <br />
            <span className="gradient-text">Let&apos;s read it together.</span>
          </h2>
          <p className="mt-5 text-lg text-[#837e80] max-w-2xl mx-auto leading-relaxed">
            Connect your repo once. Get a full analysis in under 5 minutes.
            Know exactly what you built, what needs fixing, and what to do
            next — in plain English.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              id="footer-cta-primary"
              className="group inline-flex items-center gap-2 bg-[#1e1b1b] text-white font-semibold px-8 py-4 rounded-lg hover:bg-[#039a85] transition-all duration-300 hover:shadow-xl hover:shadow-[#039a85]/20 text-base"
            >
              Analyze my codebase — free
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/pricing"
              id="footer-cta-secondary"
              className="inline-flex items-center gap-2 text-[#837e80] hover:text-[#1e1b1b] font-medium px-8 py-4 rounded-lg border border-[#e0dada] hover:border-[#1e1b1b]/20 transition-all duration-200 text-base"
            >
              View pricing
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#837e80]">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#039a85]" />
              <span>Free during beta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#039a85]" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#039a85]" />
              <span>Cancel or pause anytime</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
