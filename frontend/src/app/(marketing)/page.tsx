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
} from "lucide-react";
import { ParallaxFeatureCard } from "@/components/marketing/ParallaxFeatureCard";
import { DemoTimeline } from "@/components/marketing/DemoTimeline";

export const metadata: Metadata = {
  title: "Trixon — Know What Changed. Know What's Next.",
  description:
    "Connect your repo once and every commit gets analyzed, scored, and turned into a clear next step. Continuous codebase intelligence in plain English — built for non-technical founders.",
  openGraph: {
    title: "Trixon — Continuous Technical Intelligence for Founders",
    description:
      "Know what changed. Know what's next. AI-powered codebase intelligence in plain English.",
    type: "website",
    url: "https://trixon.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trixon — Continuous Technical Intelligence for Founders",
    description:
      "Connect your repo once. Every commit gets analyzed, scored, and turned into a clear next step.",
  },
};

/* ============================================================
   Code lines for the Living Diff hero background.
   These are realistic-looking but generic placeholder lines.
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
      <section className="relative bg-[#1e1b1b] overflow-hidden grain-overlay">
        {/* Ambient glow orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#039a85]/5 blur-3xl pointer-events-none" />

        {/* Living Diff — scrolling code wall */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none select-none"
          aria-hidden="true"
        >
          <div className="code-wall absolute left-0 right-0 font-mono text-[11px] leading-[1.8] text-white/[0.08] whitespace-pre px-8 sm:px-16">
            {/* Duplicate the lines so scroll loops seamlessly */}
            {[...CODE_LINES, ...CODE_LINES].map((line, i) => (
              <div key={i} className={line.startsWith("+") ? "text-[#039a85]/[0.12]" : line.startsWith("-") ? "text-[#ef4444]/[0.10]" : ""}>
                {line}
              </div>
            ))}
          </div>

          {/* Scan line — signal-colored gradient band */}
          <div className="scan-line absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-[#039a85]/[0.06] to-transparent pointer-events-none" />
        </div>

        {/* Hero content with vignette for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b1b]/60 via-transparent to-[#1e1b1b]/80 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-28 sm:pt-32 sm:pb-36">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#039a85]/10 border border-[#039a85]/20 rounded-full px-4 py-1.5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-[#039a85] animate-pulse" />
              <span className="text-xs font-medium text-[#039a85]">
                Free during beta
              </span>
            </div>

            {/* Heading — Space Grotesk via CSS variable */}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Know what changed.
              <br />
              <span className="gradient-text">Know what&apos;s next.</span>
            </h1>

            {/* Subheading */}
            <p className="mt-6 text-lg sm:text-xl text-[#a39e9f] max-w-2xl mx-auto leading-relaxed">
              Connect your repo once. Every commit gets analyzed, scored, and
              turned into a clear next step — so you always know what changed
              and what to fix.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                id="hero-cta-primary"
                className="group inline-flex items-center gap-2 bg-[#039a85] text-white font-medium px-8 py-3.5 rounded-lg hover:bg-[#02816f] transition-all duration-300 hover:shadow-xl hover:shadow-[#039a85]/20 text-base"
              >
                Start tracking your codebase
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
                <span>Free during beta</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#039a85]" />
                <span>Reports in under 5 min</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#039a85]" />
                <span>Auto-tracks every push</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade into next section */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#f9f9f8] to-transparent" />
      </section>

      {/* ============================================================
          VALUE PROP — Parallax Feature Cards
          ============================================================ */}
      <section className="bg-[#f9f9f8] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#1e1b1b] tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              You shipped fast. Now understand what&apos;s under the hood.
            </h2>
            <p className="mt-4 text-base text-[#837e80] leading-relaxed">
              Whether you used Cursor, Bolt, Lovable, or Replit — you built
              something real. Trixon reads your codebase and gives you the
              clarity you need to hire developers, raise funding, or scale
              users.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ParallaxFeatureCard
              title="Understand your code"
              description="Get a plain-English executive summary and architecture overview. No jargon, no confusion — just clarity on what you built and how it works."
              icon={<Eye className="w-6 h-6 text-[#039a85]" />}
            />
            <ParallaxFeatureCard
              title="Track every change"
              description="Every push gets a new snapshot. See exactly what improved, what broke, and what's still open — compared against your last commit, not just a one-time guess."
              icon={<RefreshCw className="w-6 h-6 text-[#039a85]" />}
            />
            <ParallaxFeatureCard
              title="Get unstuck, instantly"
              description="Every finding comes with a ready-to-paste prompt for Cursor, Claude Code, or whatever you're already using. No more wondering what to do with a report."
              icon={<Sparkles className="w-6 h-6 text-[#039a85]" />}
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS — Steps + "Then it keeps going" callout
          ============================================================ */}
      <section id="how-it-works" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#1e1b1b] tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Three steps to total clarity
            </h2>
            <p className="mt-4 text-base text-[#837e80]">
              From codebase chaos to crystal-clear understanding in under 5
              minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: GitBranch,
                title: "Connect your repo",
                description:
                  "Link your GitHub or GitLab account with one click. We securely access your codebase — your code never leaves our encrypted pipeline.",
              },
              {
                step: "02",
                icon: Zap,
                title: "AI analyzes everything",
                description:
                  "Our engine reads every file, maps the architecture, detects frameworks, scans for security risks, and evaluates scalability — all automatically.",
              },
              {
                step: "03",
                icon: FileText,
                title: "Get reports + a live timeline",
                description:
                  "See your health scores, open action items, and a running history of every snapshot — not a PDF you'll forget about.",
              },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                {/* Connector line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-12 left-[calc(50%+60px)] w-[calc(100%-120px)] h-px bg-gradient-to-r from-[#039a85]/30 to-[#039a85]/10" />
                )}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-[#f9f9f8] border border-[#e0dada] mb-6 relative">
                    <item.icon className="w-10 h-10 text-[#1e1b1b]" />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#039a85] text-white text-xs font-bold flex items-center justify-center">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#1e1b1b] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#837e80] leading-relaxed max-w-xs mx-auto">
                    {item.description}
                  </p>
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
              Connect auto-tracking and every future push gets analyzed
              automatically. Trixon remembers everything — ask it anything in
              chat.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          DEMO TIMELINE — Proof moment
          ============================================================ */}
      <section className="bg-[#1e1b1b] py-20 sm:py-24 relative grain-overlay overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#039a85]/5 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              This is what continuous tracking looks like
            </h2>
            <p className="mt-3 text-sm text-[#837e80]">
              Real health scores. Real diffs. Not a marketing mockup.
            </p>
          </div>
          <DemoTimeline />
        </div>
      </section>

      {/* ============================================================
          REPORT GRID — Seven reports
          ============================================================ */}
      <section id="features" className="bg-[#f9f9f8] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#1e1b1b] tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Seven AI-generated reports
            </h2>
            <p className="mt-4 text-base text-[#837e80]">
              Reports that translate your code into insights you can actually
              use.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: FileText,
                title: "What You Built",
                description:
                  "A plain-English overview of your product — what it does, how it's structured, and what matters most.",
                tag: "Essential",
              },
              {
                icon: Code2,
                title: "How It All Connects",
                description:
                  "Your architecture mapped out simply — services, data flow, and dependencies at a glance.",
                tag: "Essential",
              },
              {
                icon: BarChart3,
                title: "What's Messy & Risky",
                description:
                  "Tech debt categorized by severity — what to fix first, what can wait, and what's fine.",
                tag: "Risk",
              },
              {
                icon: Shield,
                title: "Security Risk Scan",
                description:
                  "Hardcoded secrets, missing auth, exposed endpoints — catch vulnerabilities before they catch you.",
                tag: "Risk",
              },
              {
                icon: TrendingUp,
                title: "Can It Handle Growth?",
                description:
                  "Can your app handle 10x users? Find out what breaks first and what's already solid.",
                tag: "Growth",
              },
              {
                icon: Users,
                title: "Dev Onboarding Guide",
                description:
                  "A guide for new developers joining your team — everything they need to get up to speed fast.",
                tag: "Team",
              },
              {
                icon: BarChart3,
                title: "Investor Technical Summary",
                description:
                  "A due-diligence-ready technical overview to share with investors — no CTO needed.",
                tag: "Investor",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="card-elevated group bg-white rounded-xl p-6 border border-[#e0dada] transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#039a85]/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-[#039a85]" />
                  </div>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-[#837e80] bg-[#efeeec] px-2.5 py-1 rounded-full">
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
            Pick what&apos;s useful now — add more anytime. Nothing is wasted;
            Trixon remembers your codebase between snapshots.
          </p>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA SECTION
          ============================================================ */}
      <section className="bg-[#1e1b1b] py-20 sm:py-24 relative overflow-hidden grain-overlay">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#039a85]/5 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Ready to track your codebase?
          </h2>
          <p className="mt-4 text-lg text-[#a39e9f] max-w-2xl mx-auto">
            Join founders who ship fast and scale smart. Connect your first
            repo and start seeing what changes with every push.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              id="footer-cta-primary"
              className="group inline-flex items-center gap-2 bg-[#039a85] text-white font-medium px-8 py-3.5 rounded-lg hover:bg-[#02816f] transition-all duration-300 hover:shadow-xl hover:shadow-[#039a85]/20 text-base"
            >
              Start tracking your codebase
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
          <p className="mt-6 text-xs text-[#837e80]">
            Free during beta. No credit card required.
          </p>
        </div>
      </section>
    </>
  );
}
