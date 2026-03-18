# EB-2 India Priority Date Tracker — Design Ideas

## Approach 1: Data Journalism / Editorial

<response>
<text>
**Design Movement**: Data journalism meets editorial design (think The Economist / FiveThirtyEight)

**Core Principles**:
- Information hierarchy: every element earns its space through data density
- Restrained palette with one bold accent to draw attention to key insights
- Typographic storytelling — headlines carry the narrative, charts carry the proof
- Structured asymmetry: left-anchored text columns, right-side charts

**Color Philosophy**: Deep navy (#0F1B2D) background with warm cream (#F5EDD8) text — evokes authority and gravitas. Single amber accent (#E8A020) for critical callouts and chart highlights.

**Layout Paradigm**: Newspaper-column grid. Left 40% is narrative text, right 60% is interactive chart. Sections stack vertically with clear typographic dividers.

**Signature Elements**:
- Thin horizontal rules in amber between sections
- Pull-quote callouts with oversized numbers
- Annotated chart markers pointing to key events (retrogressions, big jumps)

**Interaction Philosophy**: Hover reveals data; scroll triggers section reveals; tooltips are editorial-style with context, not just numbers.

**Animation**: Slow, deliberate fade-ins on scroll. Chart lines draw themselves left-to-right. No bouncing or playful motion.

**Typography System**: Playfair Display (display/headlines) + Source Serif 4 (body) + JetBrains Mono (data/numbers)
</text>
<probability>0.08</probability>
</response>

## Approach 2: Government/Policy Dashboard (Selected)

<response>
<text>
**Design Movement**: Civic tech / policy dashboard — clean, trustworthy, data-forward

**Core Principles**:
- Clarity over decoration — every pixel serves comprehension
- Dense information display without visual noise
- Trust signals: official sources cited, methodology transparent
- Color-coded status system (red/amber/green for urgency)

**Color Philosophy**: Slate blue (#1E3A5F) as primary with white cards. Accent: teal (#0D9488) for positive movement, amber (#D97706) for caution, red (#DC2626) for retrogression. Neutral grays for supporting data.

**Layout Paradigm**: Dashboard grid with a sticky header showing current status. Top section: key metrics cards. Middle: main timeline chart. Bottom: scenario projections + methodology.

**Signature Elements**:
- Status badge (e.g., "CURRENT FAD: Jul 2014") prominently displayed
- Progress bar showing how far Aug 2016 is from current date
- Scenario comparison table with color-coded rows

**Interaction Philosophy**: Tab-based navigation between "Overview", "History", "Projections", "Methodology". Tooltips on all data points.

**Animation**: Subtle counter animations for key numbers. Chart bars grow on load. Smooth tab transitions.

**Typography System**: DM Sans (headings) + DM Mono (data values) — clean, modern, readable
</text>
<probability>0.07</probability>
</response>

## Approach 3: Personal Finance / Investment Style

<response>
<text>
**Design Movement**: Bloomberg Terminal meets modern fintech (Robinhood / Coinbase aesthetic)

**Core Principles**:
- Dark mode first — data glows on dark backgrounds
- Gradient accents for positive/negative movement
- Card-based layout with glassmorphism
- Real-time feel even for static data

**Color Philosophy**: Near-black (#0A0E1A) background. Neon green (#00D4AA) for positive movement, coral (#FF6B6B) for retrogression. Electric blue (#4F8EF7) for primary UI elements.

**Layout Paradigm**: Full-width dark canvas. Floating metric cards at top. Large area chart dominates center. Horizontal scrollable scenario cards at bottom.

**Signature Elements**:
- Glowing number counters for key stats
- Area chart with gradient fill (green above target, red below)
- "Estimated wait" countdown-style display

**Interaction Philosophy**: Hover on chart shows crosshair with full data tooltip. Scenario cards flip on hover to show assumptions.

**Animation**: Numbers count up on load. Chart animates with spring physics. Cards slide in from bottom.

**Typography System**: Space Grotesk (headings) + IBM Plex Mono (numbers/data)
</text>
<probability>0.06</probability>
</response>

---

## Selected Approach: Approach 2 — Civic Tech Policy Dashboard

The civic tech / policy dashboard approach best serves this content. It communicates authority and trustworthiness for immigration data, uses a color system that maps naturally to urgency levels, and provides the structured layout needed for dense data presentation without overwhelming the reader.

**Chosen palette**: Slate blue primary, teal for positive, amber for caution, red for retrogression
**Chosen fonts**: DM Sans + DM Mono
**Layout**: Sticky header with current status → KPI cards → interactive timeline → scenario projections → methodology
