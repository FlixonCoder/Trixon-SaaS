# Trixon — Antigravity Changes Prompt v3.5
### Landing Page Repositioning + Premium 2-Tone Design System

---

## PART 1 — CONTEXT & POSITIONING PROBLEM

The current landing page (`/`) was built during early development and still describes Trixon as a **one-time audit tool**: "Start your free audit," "Reports in under 5 min," "No subscription required," "Receive 7 comprehensive reports." This is the pre-pivot pitch.

Trixon's actual differentiated product (built across v3.0–v3.4) is **continuous codebase intelligence**: snapshot tracking across commits, diffs showing what improved/regressed, trackable action items with ready-to-paste AI prompts, and a chat that remembers the project's full history. None of this appears on the landing page. A visitor today would think Trixon does what Cursor or Claude could do in one sitting — the exact "commodity" problem the v3.0 pivot was meant to solve.

**Also fix this factual inconsistency:** the page currently says "Receive 7 comprehensive reports" in one section and "Eight AI-generated reports" in another section header, while only displaying 6 report cards in the actual grid. Pick the correct number (7, matching `report_catalog`) and make it consistent everywhere, and ensure the report grid shows all 7 (Executive Summary, Architecture, Tech Debt, Security Risk Scan, Scalability, Dev Onboarding, Investor Summary).

---

## PART 2 — NEW COPY DIRECTION

Replace the audit-framed copy with continuous-intelligence framing. Tone: direct, plain verbs, no filler, conversational but confident — matching the existing brand voice. Suggested copy (adjust naturally, don't paste verbatim if it doesn't flow):

**Hero:**
- Headline: "Your codebase, watched." or "Know what changed. Know what's next." (pick whichever tests better — both signal ongoing tracking, not a one-time scan)
- Subhead: "Connect your repo once. Every commit gets analyzed, scored, and turned into a clear next step — so you always know what changed and what to fix."
- CTA: "Start tracking your codebase →" (replaces "Start your free audit")
- Remove "No subscription required" badge — this will conflict with future pricing tiers. Replace with: "Free during beta" or similar honest, temporary framing.

**"You shipped fast" section — keep the framing, update the 3 cards:**
- Card 1: "Understand your code" (keep)
- Card 2: "Track every change" (NEW — replaces a generic "find what's risky" framing): "Every push gets a new snapshot. See exactly what improved, what broke, and what's still open — compared against your last commit, not just a one-time guess."
- Card 3: "Get unstuck, instantly" (NEW): "Every finding comes with a ready-to-paste prompt for Cursor, Claude Code, or whatever you're already using. No more wondering what to do with a report."

**"Three steps" section — extend to reflect the ongoing nature:**
- Step 1: Connect your repo (keep)
- Step 2: AI analyzes everything (keep)
- Step 3: Replace "Get your reports" with "Get reports + a live timeline" — "See your health scores, open action items, and a running history of every snapshot — not a PDF you'll forget about."
- Consider adding a 4th step or a callout beneath the 3 steps: "Then it keeps going" — "Connect auto-tracking and every future push gets analyzed automatically. Trixon remembers everything — ask it anything in chat."

**Report grid section:**
- Fix header to say "Seven AI-generated reports" (matching actual catalog count)
- Add a line beneath the grid: "Pick what's useful now — add more anytime. Nothing is wasted; Trixon remembers your codebase between snapshots."

**Final CTA section:** keep structure, update copy to drop "no subscription required" (replace with beta framing as above).

---

## PART 3 — DESIGN SYSTEM REFRESH

### Design Direction

Two-tone foundation (already brand-defined): `#1e1b1b` (dark) and `#f9f9f8` (light), with depth created through tints/shades of these two anchors rather than introducing new colors. The signature accent `#039a85` (turquoise) is used sparingly — reserved for the one signature visual motif, primary CTAs, and "live/active" states — not scattered everywhere.

### Color Tokens (extend Tailwind config)

```js
colors: {
  obsidian: '#1e1b1b',           // primary dark — page backgrounds, nav, footer
  'obsidian-raised': '#272424',   // elevated dark surfaces — cards on dark sections
  'obsidian-deep': '#141212',     // recessed dark — deepest shadows, overlays
  paper: '#f9f9f8',               // primary light — page backgrounds
  'paper-raised': '#ffffff',      // elevated light surfaces — cards on light sections
  'paper-sunken': '#efeeec',      // recessed light — input backgrounds, dividers
  signal: '#039a85',              // the ONE accent — CTAs, live states, signature motif
  'signal-glow': 'rgba(3, 154, 133, 0.15)',  // for glow shadows, never solid fills
  ash: '#837e80',                 // muted text/labels (existing brand support color)
}
```

### Typography

```js
fontFamily: {
  display: ['Space Grotesk', 'sans-serif'],   // headlines only — bold, geometric, used with restraint
  body: ['Inter', 'sans-serif'],               // existing — keep for all body copy
  mono: ['JetBrains Mono', 'monospace'],       // NEW — for scores, stats, file paths, commit SHAs
}
```

**Where to apply mono font (this is the subject-specific choice — borrowing code's own visual language):**
- Health score numbers (66, 55, 45, etc.) on the dashboard
- File paths anywhere they appear (action items, reports)
- Commit SHAs in chat and timeline
- Stats grid numbers (files, lines, endpoints, dependencies)
- Do NOT use mono for body copy, descriptions, or headlines — it's a data/code accent, not a general typeface

Load both new fonts via `next/font/google` in the root layout.

### Signature Element — "Living Diff" Hero Background

This replaces any generic gradient-mesh or abstract 3D shape. The hero section gets an animated background:

- A faint wall of monospace text resembling code/diff lines (use realistic-looking but generic placeholder lines — `+ const result = await analyze(repo)`, `- this.timeout = 3000`, function signatures, etc. — NOT real customer code) scrolling slowly upward, very low opacity (8-12%) against the `obsidian` background
- A soft horizontal `signal`-colored gradient band (the "scan line") sweeps slowly downward through the code wall on a loop (12-20s duration), slightly brightening the lines it passes over as it goes — implying continuous, ongoing analysis, not a single pass
- Build as a CSS-only or lightweight Canvas animation — no heavy WebGL needed. Respect `prefers-reduced-motion`: if set, show the code wall static with no scan animation
- Hero headline and CTA sit on top with a subtle dark gradient/vignette behind the text for legibility

**Second appearance of the motif (proves the claim, doesn't just illustrate it):** further down the page, in the "Get reports + a live timeline" step or a new short section, embed an actual miniature, simplified version of the real `timeline-chart.tsx` component (using placeholder/demo data, not live data) showing a health-score trend across several snapshot dots — this should look and behave like the real in-product timeline, not a mockup illustration. This is the proof moment: "this isn't a marketing graphic, it's the actual feature."

### Depth & "3D" Treatment (Restrained)

Avoid generic glassmorphism or default AI-design shadows. Use:

1. **Glow-based elevation, not flat shadows:**
```css
.card-elevated {
  box-shadow: 0 8px 30px -10px rgba(3, 154, 133, 0.08), 0 2px 8px rgba(30, 27, 27, 0.06);
}
.card-elevated:hover {
  box-shadow: 0 12px 40px -8px rgba(3, 154, 133, 0.18), 0 4px 12px rgba(30, 27, 27, 0.08);
  transform: translateY(-2px);
}
```

2. **Subtle mouse-parallax tilt on the 3 feature cards** ("Understand your code" / "Track every change" / "Get unstuck instantly") — capped rotation so it feels alive without being gimmicky:
```jsx
// Cap rotation at 3-4 degrees max, based on cursor position relative to card center
const handleMouseMove = (e, cardRef) => {
  const rect = cardRef.current.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  cardRef.current.style.transform =
    `perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateZ(8px)`;
};
// Reset transform on mouseleave with a smooth transition
```
Apply `transition: transform 0.15s ease-out` and reset to neutral transform on `onMouseLeave`. This should feel responsive and subtle, not slow or exaggerated.

3. **Faint grain texture on dark sections** (hero, final CTA, footer) — a low-opacity (3-5%) noise overlay for tactile depth instead of flat color. Can use a tiny repeating SVG noise pattern or a single small noise PNG tiled via CSS `background-image`.

4. **Soft ambient glow orbs** — 1-2 large, very low-opacity (`signal-glow`) blurred circles positioned behind key sections (hero, final CTA) for depth, NOT scattered throughout the whole page. Use sparingly — this is the one place per major section where a glow is allowed.

### What NOT to do
- Do not add gradient text effects, do not add more than one accent color, do not add glassmorphism/frosted-blur cards (overused AI-design default), do not animate every element on scroll — pick 2-3 deliberate moments (hero load, the Living Diff scan, maybe one scroll-reveal on the step-by-step section) rather than animating everything.
- Do not change the actual product app's internal pages (dashboard, reports, action items, chat, timeline) in this pass — this prompt is scoped to the public marketing site (`/`) only. The in-app design system can get a consistency pass later if desired, but don't touch it now.

---

## SUCCESS CRITERIA

- [ ] Landing page no longer uses "audit," "one-time," or "no subscription required" framing
- [ ] Hero, feature cards, and steps section reference continuous tracking, diffs, and action items — not just "get a report"
- [ ] Report count is consistent everywhere on the page (7, matching `report_catalog`) and the grid shows all 7 report types
- [ ] New color tokens (`obsidian-raised`, `obsidian-deep`, `paper-raised`, `paper-sunken`, `signal-glow`) added to Tailwind config and used for elevation/depth instead of generic shadows
- [ ] Space Grotesk loads for headlines only; Inter remains for body; JetBrains Mono used specifically for scores/stats/file paths/SHAs (verify this doesn't leak into body copy)
- [ ] Hero background shows the scrolling code-wall + scan-line animation; respects `prefers-reduced-motion`
- [ ] A real (simplified/demo-data) version of `timeline-chart.tsx` appears further down the page as proof of the continuous-tracking claim
- [ ] The 3 feature cards have working, capped mouse-parallax tilt that resets smoothly on mouse leave
- [ ] No glassmorphism, no gradient text, no more than one accent color used throughout
- [ ] Mobile responsiveness maintained — code-wall animation and parallax tilt should gracefully degrade or disable on mobile (parallax tilt has no meaning on touch; disable it there)
