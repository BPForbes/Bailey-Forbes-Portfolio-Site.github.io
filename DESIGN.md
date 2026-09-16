# DESIGN.md — Rules for Reducing AI Slop in UI/UX

Research date: 2026-09-15.

## Purpose and use

Build interfaces that have a clear purpose, a coherent identity, and complete
behavior. In this document, AI slop means generic, weakly justified,
inconsistent, or unfinished design produced without enough attention to users
and context. It is a description of output quality, not proof that an interface
was made by AI.

Use this file as project guidance for designers and coding agents. Fill in the
project brief below; reuse an existing design system when one exists. Explicit
project requirements take precedence over aesthetic defaults here. Record
exceptions with a reason and a way to evaluate them.

MUST is an acceptance requirement under this guide. SHOULD is a default that can
be changed for a documented reason. MAY is optional. These labels express this
guide's policy; they do not turn preferences into external standards.

## What the research supports

- Give the model curated knowledge of users, tasks, constraints, and the
  product's design language. A generic request lacks the context needed to
  produce a suitable interface. NN/G: UX-Context Design
- Evaluate output while it is being built. A functioning demo can still create
  confusion, excess features, and UX debt. NN/G: The Custodial Era of UX
- Specify typography, color, and visual direction instead of asking for
  something merely "modern." Anthropic demonstrates how targeted guidance
  changes generated designs; its examples are practitioner demonstrations, not
  universal evidence of usability gains. Anthropic: Improving frontend design
  through Skills
- Use reusable patterns with contextual guidance. Component and page templates
  provide a starting structure that still needs adaptation. GOV.UK patterns,
  USWDS templates

Synthesis: Better context, fewer arbitrary decisions, and observed task
performance are more useful than a blacklist of visual trends. The detailed
workflow, defaults, and review gates below are an original practical synthesis.
They are not a scientifically validated "slop score."

## 1. Establish the project brief

**R01 — MUST define the task before the layout.** Identify the primary user,
what they are trying to accomplish, the information they need, and what
successful completion looks like. If evidence is missing, mark an assumption;
never invent interviews or user preferences.

**R02 — MUST inspect the existing product before changing its style.** Read its
tokens, shared components, content conventions, and representative screens.
Extend the established system unless a redesign is requested or a specific
defect requires change.

**R03 — SHOULD select references by purpose.** Use two or three references,
explaining what each contributes: typography, navigation, density, imagery, or
interaction. Do not merge unrelated styles or copy another product's branding.

**R04 — MUST translate adjectives into decisions.** Replace "premium," "clean,"
and "futuristic" with choices that someone can implement and review. Example:
"Use a restrained palette, left-aligned reading areas, compact metadata, and
real product screenshots."

Fill this in before generating a new interface. For a small edit, update only
the relevant fields.

```yaml
product: "bailey-forbes.com — Bailey Forbes' engineering portfolio (static site, GitHub Pages)"
screen_or_flow: "Whole site: /home/, /projects/, the five /projects/<id>/ write-ups, 404"
primary_user: "A hiring engineer or engineering manager evaluating Bailey for a software role"
primary_task: "Judge the depth and durability of the work, then get in touch"
success_condition: >
  Within the first screen the visitor knows who this is and what he builds;
  within two clicks they are reading a project write-up with its real timeline
  or running the live QPU / Flinstone lab; contact details are reachable from
  every page footer.
evidence_and_known_constraints:
  - "Copy is sourced from Bailey's résumé and public git history on github.com/BPForbes (compiled 11 Sep 2026). Numbers on the page must trace back to one of those."
  - "Static hosting: no server, no analytics, no build step beyond `tsc`. All behavior is client-side."
  - "The QPU and Flinstone labs are third-party-origin iframes from bpforbes.github.io; Flinstone additionally needs cross-origin isolation and may legitimately fail to attach."
  - "KeyQuorum has no runnable web build. Its README is explicit that USB tokens are roadmap, not shipped."
assumptions_to_validate:
  - "Recruiters skim the home page before opening any project page. Not measured — no analytics on this site."
  - "Visitors arrive on desktop more often than mobile. Not measured."
content_source: "home/index.html, projects/**/index.html (hand-authored); timeline events and language splits from src/data.ts"
existing_components_and_tokens:
  - "css/styles.css — the single stylesheet and the token layer (:root)"
  - "src/site.ts — injected header and footer, timeline renderer, language bars"
  - "src/guestWindow.ts — the live-lab guest window (titlebar, dock, stage, states)"
  - "Components: .btn, .card, .entry, .chip, .kicker, .eyebrow, .section-head, .timeline, .guest-window, .note, .stat-list, .spec-list"
visual_direction: >
  Workshop notebook, not a product landing page. Warm near-black ground, one
  copper action colour, one patina accent for provenance labels. Fraunces for
  headings (editorial, slightly bookish), Sora for reading text, IBM Plex Mono
  reserved for dates, versions, labels and code — the things that are literally
  machine records. Boxes are earned: prose stays unboxed on a plain ground, and
  a bordered surface means a discrete destination or a repeated record. The
  mark is the BF monogram, drawn once in favicon.svg and repeated in the header
  as `.brand-mark`; the one photograph of Bailey lives in the home hero and
  nowhere else, so the site is identified by the mark, not by a face.
references:
  - url: "https://design-system.service.gov.uk/patterns/"
    borrow: "Task-first page order and plain outcome-named actions"
    avoid: "GOV.UK's identity, typeface and full-width banner chrome"
  - url: "https://designsystem.digital.gov/templates/"
    borrow: "The documentation-page shape: short hero, then body content with a clear single column of prose"
    avoid: "Government branding and the agency masthead"
  - url: "https://www.nngroup.com/videos/homepage-design-mistakes/"
    borrow: "Avoid false floors; keep scrolling cues and hierarchy legible"
    avoid: "Nothing visual — this is a review heuristic, not a style source"
primary_action: "Home: 'View the projects'. Project page: the project's own repository or live lab."
secondary_actions:
  - "Home: 'Read about Bailey' (jumps to the personal section)"
  - "Project page: 'Jump to timeline'"
  - "Every page: contact links in the footer"
required_states:
  - "Live lab: connecting, loaded-without-handshake, attached, could-not-attach (with retry and open-in-new-tab), minimized, not-attached (KeyQuorum, by design)"
  - "Timeline: populated, and empty when a project has no compiled entries"
  - "404, with a full list of the site's real pages"
target_devices_and_input_methods:
  - "Desktop pointer + keyboard (primary)"
  - "Phone touch, 320 CSS px and up, portrait and landscape"
  - "Screen reader over the same DOM; no separate mobile markup"
performance_constraints:
  - "Static files on GitHub Pages; no render-blocking JS (site.js is type=module, deferred by default)"
  - "Three web font families, at most two weights each"
  - "Portraits carry explicit width/height so the hero does not shift"
out_of_scope:
  - "Any CMS, comment system, analytics, or newsletter capture"
  - "Rewriting the project prose — copy changes here are limited to control labels, state messages, and source attribution"
  - "Building a KeyQuorum web demo"
```

## 2. Make layout reflect information

**R05 — MUST make purpose and the next action apparent.** The first meaningful
viewport should explain what the page is for. In a tool, prioritize the task
area; in a portfolio, prioritize evidence of work; in a service, prioritize the
user's next step.

**R06 — SHOULD establish one dominant action per task region.** Secondary
actions must remain discoverable but quieter. Destructive actions need
separation and proportionate protection. Do not make every button visually
primary.

**R07 — MUST choose containers by content relationships.** Use tables for
comparing repeated fields, lists for scanning items, and cards for discrete
summaries or destinations. Do not wrap every heading, paragraph, or metric in a
rounded rectangle.

**R08 — SHOULD use a repeatable alignment and spacing system.** Choose content
widths and a spacing scale; give closely related items less separation than
unrelated sections. Avoid one-off offsets used to patch an incoherent layout.

**R09 — MUST preserve familiar navigation.** Use meaningful destinations,
recognizable controls, current-location cues, and predictable back behavior.
Visual originality must not make navigation an unexplained puzzle.

**R10 — MUST make continued content discoverable.** Avoid a full-screen
composition that looks like the page has ended when important content follows.
Test normal scrolling, sticky elements, and nested scroll areas. NN/G's homepage
video specifically highlights false floors, scrolling cues, and hierarchy.
Homepage Design: 4 Common Mistakes

## 3. Create a coherent visual identity

**R11 — SHOULD choose a small set of recognizable characteristics.** Examples
include a particular editorial type treatment, domain-specific illustrations, or
a consistent technical annotation style. Repeat those characteristics with
restraint; do not invent a new visual theme for each section.

**R12 — MUST assign visual tokens semantic roles.** Define background, surface,
text, muted text, border, action, focus, success, warning, and error roles. Also
define typography, spacing, radii, elevation, and motion. Reuse tokens rather
than approximating colors and dimensions screen by screen.

**R13 — SHOULD limit typography before adding decoration.** Start with one
reading family and, if useful, one display family. Reserve monospace for content
where it helps. Define heading levels, body text, labels, and metadata. Test
long headings, real names, punctuation, and font fallbacks.

**R14 — MUST justify visual effects.** A gradient, glow, blur, glass surface,
illustration, or large hero must support hierarchy, context, feedback, or an
established brand direction. Remove effects that compete with content or make
text harder to read.

**R15 — MUST use authentic evidence.** Prefer actual product screenshots,
meaningful diagrams, and relevant imagery. Never fabricate testimonials,
customer logos, usage counts, awards, or performance claims. Clearly identify
sample data in demonstrations.

Common fonts, purple palettes, rounded cards, and minimalist layouts are not
inherently poor design. Anthropic's anti-generic prompt includes strong
aesthetic exclusions; this guide deliberately treats those as optional creative
direction rather than universal bans. Changing a font alone does not establish
good UX.

## 4. Write content that belongs to the product

**R16 — MUST use realistic content before judging the design.** Include
representative long and short titles, empty values, plausible record counts, and
actual terminology. A layout that only works with three equal-length placeholder
cards is unfinished.

**R17 — MUST label actions by outcome.** Prefer "Upload file," "Save changes,"
or "Open documentation" over repeated "Explore," "Learn more," or "Get started"
when a specific destination or action is known.

**R18 — SHOULD remove unsupported promotional language.** Replace "Unlock
seamless next-generation productivity" with what the product actually does. Keep
explanations that help decisions; do not shorten instructions merely to make a
screenshot look cleaner.

**R19 — MUST make feedback useful.** Error messages should identify the problem
and a recovery action where known. Empty states should explain the absence and
an appropriate next step. Do not blame the user or report success before the
operation succeeds.

## 5. Design complete behavior

**R20 — MUST define relevant states before calling a feature complete.** Cover
initial, loading, populated, empty, no-results, validation error, service
failure, success, and unavailable or permission-restricted states where
applicable. Mark irrelevant states as such rather than creating unnecessary
screens.

**R21 — MUST connect every visible control to real behavior.** Links navigate to
valid destinations; buttons perform their stated action. Search and filters
change results. A clearly labeled prototype may simulate behavior, but
production must not silently retain fake controls.

**R22 — MUST protect continuity.** Preserve entered data after recoverable
errors. Explain consequential actions before commitment. Provide undo where
feasible; use confirmation when consequences justify it. Do not add confirmation
dialogs to every routine action.

**R23 — SHOULD show actual operation status.** Prevent accidental duplicate
submissions, acknowledge input promptly, and offer cancellation for suitable
long-running tasks. Never invent completion percentages or use a success toast
to conceal a failed request.

**R24 — MUST design for the actual input methods and screen sizes.** Keep
essential actions available without hover. Check long content, open menus, the
on-screen keyboard, portrait and landscape layouts, and zoom. Avoid unintended
page-wide horizontal overflow.

## 6. Accessibility requirements

**R25 — MUST target WCAG 2.2 AA and verify applicable criteria.** This is a
project quality target, not a claim of legal compliance. Key checks include:

- Normal text contrast of at least 4.5:1; large text at least 3:1. Applicable
  non-text controls and graphics require 3:1.
- Keyboard operation, visible focus, and focus that is not entirely obscured.
- Accessible names, meaningful structure, labels, and programmatically exposed
  states.
- Errors and status conveyed beyond color alone.
- Text resizing to 200% and reflow at 320 CSS pixels, subject to the criteria's
  exceptions.
- Pointer targets at least 24 × 24 CSS pixels or an allowed exception, including
  qualifying spacing. Prefer 44 × 44 for primary touch controls as this guide's
  usability default.

These are selected checks, not the full standard. W3C WCAG 2.2 Quick Reference

**R26 — MUST review with both automation and manual interaction.** Check
keyboard navigation and representative assistive-technology use; an automated
score alone does not establish accessibility. Respect reduced-motion preferences
and provide a usable static alternative to decorative movement.

## 7. Motion and performance

**R27 — SHOULD use motion to explain change.** Animate feedback, expansion, or
spatial continuity where it helps. Avoid staggered reveals on every block,
continuous decorative motion beside reading content, scroll hijacking, and
animation that delays access to controls.

**R28 — MUST prioritize active work over decoration.** If an interface includes
a simulation, large visualization, or other intensive task, reduce or pause
nonessential effects under load. Preserve input responsiveness and meaningful
progress. Do not claim that CSS reallocates backend CPU; backend scheduling
requires separate implementation.

**R29 — SHOULD load only what the current experience needs.** Defer heavy
optional modules, reserve image dimensions, limit font variants, and pause
off-screen animation. A decorative feature should not require an entire
rendering library without an explicit benefit.

**R30 — MUST measure performance claims.** For web delivery, use Core Web Vitals
as a starting target: LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1 at the 75th
percentile of visits, evaluated separately for mobile and desktop. During
development, report laboratory conditions and results separately; a lab pass
does not establish a field pass. Google: Web Vitals

## 8. Templates: reuse structure with judgment

Select a template because its information structure fits the task. Remove
irrelevant sections, replace demonstration content, map components to project
tokens, and verify all states after customization. Record the source, version or
retrieval date, and applicable license before copying assets or code.

| Resource | Best application | Adaptation required |
|---|---|---|
| [Google Labs DESIGN.md](https://github.com/google-labs-code/design.md) | A structured description of visual identity for coding agents | Use as a format reference; add user goals, behavior, and validation. This document is a standalone rules guide, not a claim of conformance to that specification. |
| [USWDS templates](https://designsystem.digital.gov/templates/) | Documentation, landing, authentication, form, and 404 layouts | Select the matching page type and customize its composition; remove government identity elements for unrelated products. |
| [GOV.UK patterns](https://design-system.service.gov.uk/patterns/) | Questions, validation recovery, confirmation, and service flows | Read the usage guidance; adapt questions and flow to the user's context. This is a pattern library, not a decorative theme. |
| [shadcn/ui Blocks](https://ui.shadcn.com/blocks) | React dashboard, sidebar, login, and signup scaffolding | Keep useful components; replace generic metrics, content, density, and visual styling with product-specific decisions. |

Do not combine several UI kits simply to make pages look different. If an
existing project has suitable components, those are the first choice.

## 9. Quick replacement guide

These are review prompts, not blanket prohibitions.

| Warning sign | Better default | When the original can be appropriate |
|---|---|---|
| Huge abstract hero above a working tool | Put the task and necessary context first | A campaign or narrative introduction with a clear purpose |
| Identical cards for every section | Choose lists, tables, prose, or cards by information structure | Independent destinations that benefit from parallel summaries |
| Gradients, glows, and glass everywhere | Establish hierarchy with type, spacing, and restrained emphasis | A defined visual identity with tested contrast and performance |
| Dashboard statistics added to fill space | Show metrics that support a real decision | Operational monitoring with meaningful data |
| Icon-only navigation without explanation | Use text labels or a clearly understood convention | Familiar controls with accessible names and sufficient context |
| Vague CTA repeated across the page | Name the specific action or destination | An introductory action where the next step is already clear |
| A pristine empty demo | Exercise realistic content and adverse states | An intentionally labeled visual exploration |
| Constant animation beside dense content | Animate relevant changes and pause decoration | A focused visualization where movement conveys information |

## 10. Workflow for a coding agent

1. **Inspect:** Read this file, the relevant project instructions, existing UI,
   and task requirements. Identify reusable components and constraints.
2. **Specify:** Fill the relevant brief fields. For a new visual direction,
   propose two or three meaningfully different options and explain fit; do not
   generate alternatives for a tiny fix.
3. **Compose:** Build one representative screen with realistic content, clear
   hierarchy, and the primary action. Check the narrow layout early.
4. **Complete:** Implement applicable interaction states and recovery paths.
   Extend shared components across the remaining screens.
5. **Review:** Inspect rendered pages at representative widths, interact with
   the primary flow, and check accessibility and performance. Critique specific
   defects rather than asking whether it "looks professional."
6. **Refine:** Fix the largest task or comprehension problems first, then
   consistency, then decorative details. Remove elements that have no clear
   purpose.
7. **Report:** State what changed, what was actually verified, and what remains
   uncertain. Update tokens and this brief when design decisions change.

AI critique is useful for generating questions and finding inconsistencies. It
is not evidence that actual users can complete the task. Where feasible, observe
representative users performing it without coaching.

## 11. Acceptance checklist

- [ ] The primary user, task, and success condition are explicit.
- [ ] The layout gives priority to the task and relevant evidence.
- [ ] Content uses the product's real terminology and realistic lengths.
- [ ] Claims, testimonials, screenshots, and numbers have a valid source or are labeled samples.
- [ ] Typography, spacing, color, and component behavior follow the chosen system.
- [ ] Major visual choices have a product-specific reason.
- [ ] Every visible control works or is explicitly identified as a prototype limitation.
- [ ] Applicable loading, empty, error, success, and restricted states have been exercised.
- [ ] The primary flow works on narrow screens and with keyboard input.
- [ ] Accessibility checks include manual review; unresolved issues are recorded.
- [ ] Motion respects user preferences and does not obstruct work.
- [ ] Performance results include test conditions and avoid unsupported claims.
- [ ] Template boilerplate and irrelevant sections have been removed.
- [ ] The result has been inspected in a rendered environment, not only in source code.

Do not mark work complete when the main task is broken, critical content is
fabricated, or a required interaction is inaccessible. If verification is
unavailable, say precisely which checks remain unverified.

## 12. Research library: articles, videos, and format references

The video entries below were checked through their publisher pages and
summaries; full audiovisual content was not reviewed. Their descriptions are
limited accordingly. Sources were accessed on 2026-09-15.

| Type | Source | Contribution and limit |
|---|---|---|
| Article | [NN/G — UX-Context Design](https://www.nngroup.com/articles/ux-context-design/) — July 24, 2026 | Curating product and user context for generation; supports the brief and persistent guidance. Does not establish that a file alone guarantees good design. |
| Article | [NN/G — The Custodial Era of UX](https://www.nngroup.com/articles/ai-ux-debt/) — August 28, 2026 | Explains UX debt from rapid generation and the role of evaluation. Supports reviewing usefulness and behavior before completion. |
| Article / demonstrations | [Anthropic — Improving frontend design through Skills](https://claude.com/blog/improving-frontend-design-through-skills) — November 12, 2025 | Examples of targeted visual prompting. Useful for art direction; aesthetic prescriptions require judgment. |
| Video | [NN/G — Homepage Design: 4 Common Mistakes](https://www.nngroup.com/videos/homepage-design-mistakes/) — July 10, 2024; 5 minutes | Publisher summary covers false floors, scrolling cues, familiar standards, and hierarchy. Useful when reviewing landing pages. |
| Video | [NN/G — "It Depends": Why UX Is Dependent on Context](https://www.nngroup.com/videos/it-depends-ux-context/) — July 12, 2019; 4 minutes | A short introduction to contextual UX judgment. Recommended background for applying rules without treating every default as universal. |
| Format reference | [Google Labs — DESIGN.md](https://github.com/google-labs-code/design.md) | Describes visual identity for coding agents. Complements a product-specific behavior brief. |
| Templates | [USWDS — Templates](https://designsystem.digital.gov/templates/) | Concrete page scaffolds, presented by the publisher as adaptable starting points. |
| Patterns | [GOV.UK — Patterns](https://design-system.service.gov.uk/patterns/) | Task-based design guidance with coded examples where available. |
| Component blocks | [shadcn/ui — Blocks](https://ui.shadcn.com/blocks) | Reusable React UI compositions; a starting implementation, not a finished product identity. |
| Standard reference | [W3C — WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/) | Authoritative accessibility criteria; evaluate all applicable requirements. |
| Technical guidance | [Google — Web Vitals](https://web.dev/articles/vitals) | Loading, responsiveness, and stability metrics with field-assessment guidance. |

## Maintenance

Keep this guide short enough for the team to use. After a recurring design
defect, add a concrete example or refine the relevant rule. Remove stale
exceptions. Keep the project brief and actual component tokens in agreement; do
not accumulate contradictory instructions after each generation attempt.

---

# Part B — How this site applies the guide

Everything below is project-specific. It is the record R12, R08 and the
"Maintenance" note ask for. `css/styles.css` is the implementation; if the two
disagree, the stylesheet is wrong.

## B1. Token roles (R12)

Semantic role tokens are defined in `:root` and are the only names components
may use. The raw palette (`--copper`, `--patina`, `--stone`, …) exists solely to
give the role tokens a value; do not reference a raw palette name from a
component rule.

| Role token | Value | Used for |
|---|---|---|
| `--surface-page` | `#10120f` | Page ground |
| `--surface-raised` | `#181a16` | Cards, entries, guest window |
| `--surface-sunken` | `#1f221c` | Titlebars, notes, inset strips |
| `--surface-invert` | `#f3ead8` | Card stock, `.note-card` only |
| `--text` | `#ebe6d8` | Headings and body |
| `--text-muted` | `#c4bdae` | Supporting prose |
| `--text-subtle` | `#8f897b` | Metadata, captions, legends |
| `--text-on-action` | `#0b0c0a` | Label on a filled action |
| `--text-on-invert` | `#2a2418` | Ink on card stock |
| `--text-on-invert-muted` | `#6b5e48` | The mono label on card stock |
| `--border` | `#2c2f28` | Separation between static surfaces |
| `--border-strong` | `#3d4036` | Emphasised static separation |
| `--border-interactive` | `#6d7264` | Any border that *is* the control's visible boundary (≥3:1, WCAG 1.4.11) |
| `--action` / `--action-hover` | `#c98a4a` / `#e0b27a` | The single call-to-action colour |
| `--accent` | `#7ea36a` | Provenance labels (`.eyebrow`) — "this came from the git record" |
| `--focus` | `#e0b27a` | Focus ring, on every focusable element |
| `--status-ok` / `--status-wait` / `--status-error` | `#9dc389` / `#e0b27a` / `#e0685c` | Live-lab status, always paired with text |

Measured contrast (sRGB, computed from the values above on 2026-09-15):
`--text` 15.1:1 on page, `--text-muted` 9.4:1 on raised, `--text-subtle` 4.6:1
on sunken, `--text-on-invert` 12.9:1 and `--text-on-invert-muted` 5.3:1 on card
stock, `--status-error` 4.8:1 on sunken, `--border-interactive` 3.3–3.8:1
across the three surfaces, `--text-on-action` on `--action` 6.7:1. Every one of
those was then re-checked against the *rendered* pages, not just the token
table — see B5.

Scales: spacing `--space-1` 0.25rem through `--space-9` 5rem (a 4px-based
ramp); radii `--radius-sm/md/lg`; `--elevation-1`; `--motion-fast` 120ms and
`--motion-base` 200ms, both zeroed under `prefers-reduced-motion`.

## B2. Typography (R13)

- **Fraunces** — headings only, two weights (560, 640).
- **Sora** — reading text and controls, two weights (400, 600).
- **IBM Plex Mono** — one weight (400), reserved for dates, version strings,
  status text, labels and `<code>`. Never for prose.

Heading sizes use `clamp()` with a floor that fits "Electronic medical record"
and "Bailey Forbes" inside a 320 CSS px viewport without horizontal overflow.

**Icons** are Font Awesome Free 6.7.2, inlined as `<svg class="icon">` at each
use site from the subset in `tools/icons.json`. They go where a repeated,
nameable kind of thing benefits from a mark: actions, contact and social
destinations, skill categories, record types (job, degree, release), the two
deck collections, timeline entry kinds, lab chrome and status, and limitation
callouts.

Section headings on the project pages carry one too, at Bailey's request, so
those pages read in the same language as "Off the clock". Each is chosen for
what the section is about rather than applied as decoration.

They are deliberately absent from four places, and that is the design, not an
omission: **site navigation** (the quick-replacement guide prefers text labels
there, and five short words gain nothing); **technology chips** (eighteen in a row is noise, and the free set has
no marks for most of these languages); **résumé figures** (the number is the
point); and **timeline entry titles** (the kind chip in the same row already
carries the mark, and a second would double up). Every icon sits beside text that
already says what it means, so all of them are `aria-hidden` and none is ever a
control's only label (R17, R25). They are sized in `em` so they track their
label, except beside the small mono labels where an em-sized glyph lands around
11px and reads as a smudge; there they are 1rem and take `--action`, so they
anchor the label instead of vanishing into it.

## B3. Container rules (R07)

- **`.card`** — only for a discrete destination: one project the visitor can
  open. Nothing else gets a card.
- **`.entry`** — a repeated record with the same fields (role/org/dates, or
  release/date/summary).
- **`.note-card` in a `.deck`** — one item in a browsable collection that is
  read, not opened (a dish, a game). It is a card because the items are
  discrete and parallel, and a cycling stack because the collection is short,
  unranked, and meant to be gone through one at a time. It is never a link; if
  one ever needs to be, it becomes a `.card` instead.
- **`.spec-list` (`<dl>`)** — label/value pairs: skills, release specs. Not
  cards; there is nowhere to go.
- **`.stat-list`** — résumé figures as a captioned `<dl>` with the source
  stated inline, not four boxed tiles.
- **Plain prose in `.prose`** — anything that is simply read.

## B4. Recorded exceptions

| Exception | Reason | How to evaluate |
|---|---|---|
| The two CLI projects show a styled text transcript, not a screenshot | R15 asks for real evidence of the product running, and for a terminal that evidence *is* text. Kept as text it stays selectable, searchable, legible at any zoom and reflows on a phone; a PNG of a shell does none of that and is heavier. The transcripts are literal output from a real local run, with the command lines marked so they can be picked out. | Every line must be reproducible by running the stated command at the stated commit. Any edit for layout must be disclosed in the caption — the Flinstone one reflows a six-item list onto two lines and says so; the KeyQuorum one abbreviates a secret and says so. Nothing else may be changed. |
| The project timeline's scrub glow | R14 asks a decorative effect to justify itself. This one reports scroll: it sits on the spine, its position tracks reading position and its length and brightness track scroll speed, so a fast scrub streaks and reading barely shows it. Nothing depends on it — every state it hints at is also carried by the active entry's own styling. | It must decay to zero once the page stops moving; a glow frozen part-lit means the settle loop is broken. Under `prefers-reduced-motion` the graph is marked still and the glow is never drawn (R26). |
| Only the current timeline entry is expanded | The history stays scannable as dates and titles while exactly one commit is readable, which is what keeps an eighteen-entry rail from being a wall. Scrolling scrubs which one is open, and so does focusing a card, so every entry is reachable without a pointer. | Exactly one card may have a non-zero detail height once scrolling has settled; two part-open cards are only correct mid-scrub, as the crossfade. Every card stays in the DOM in source order, so assistive technology reads the whole history regardless of which is open. |
| The rail is a plain column, not pinned | Entries have to travel past the focus line for the next one to open as you reach it; pinned, the rail never moves relative to the viewport and one entry stays open the whole way down. The cost is that the rail ends before the prose column does, leaving the right side empty low on a long page — an ordinary sidebar, and the readable choice. | Scroll the page: the open entry must change, and must stay on screen while any of the rail is. |
| Opening an entry changes the rail's height | Entries are in normal flow, so the one below moves. That is safe only because the rail is always shorter than the prose column beside it, so the grid row is sized by the prose and the page's own height never changes — if it did, the reader would be moved by the thing their scroll position controls. | If a project page ever has a rail taller than its prose column, this is void: opening an entry would resize the page and feed back into the scroll that picked it. |
| The timeline cards float continuously | R27 warns against constant decorative motion beside reading content, and this is the exception to it, asked for deliberately. The amplitude is scaled to scroll activity: about 0.35° at rest, roughly 1° during a scrub, so the resting state is a float rather than an animation competing with the prose. It stops dead under `prefers-reduced-motion`. | With reduced motion set, two samples 700ms apart must give a byte-identical transform. If the resting amplitude is ever raised much past 1°, it stops being a float and R27 applies again. A previous pass tipped the deck back to 45° for depth; it cost more legibility than it bought and was removed, so the depth cue is a small scale and fade. |
| The card stack's geometry lives in `src/deck.ts`, not the stylesheet | Moving between cards is a transition, not a swap: every card is posed from one continuous progress value so a drag and a button press run the same code, and half way through a drag the stack really is half way between two states. CSS can name the resting poses but cannot be sampled at arbitrary points between them. | The stylesheet still owns how a card *looks*; only the poses and the tween moved. If a pose is ever duplicated in CSS, one of the two is wrong. The no-JS path does not depend on it — unstacked cards are a plain list. |
| The deal is sampled at ~24fps rather than every display frame | Asked for, and the point of it: stepped motion reads as cards being dealt one at a time, where a smooth 60fps tween reads as a single glide. `FRAMES_PER_SECOND` in `deck.ts` is the one place to change it. | Sample the front card's transform across a transition: there should be about eight distinct poses for a 340ms deal, with a mean gap near 41.7ms. Derive the step from elapsed time, not from counting animation frames — counting rounds every step up to three display frames and yields 20fps. |
| `.note-card` uses card stock — the one light surface on a dark site | R11 asks for a small set of recognisable characteristics repeated with restraint. This is that one characteristic: index-card stock, a red title rule and ruled note lines, used for both off-the-clock decks and nowhere else. It is a motif, not the one-off inverted panel that was removed before it. | If card stock appears outside a `.deck`, the motif has become decoration and this is void. The ruled lines depend on `.note-card-note` keeping a fixed `line-height` in the same unit as the gradient; change one and you must change the other, or the ruling drifts under the text. |
| The deck's previous/next controls are arrow glyphs with no visible text | The quick-replacement guide allows icon-only controls that are "familiar controls with accessible names and sufficient context". Prev/next on a pager is that case: each has an `aria-label` naming its deck ("Next game"), each is 44 × 44, and they sit either side of a visible "n of m". | If the arrows ever become the *only* way to reach a card, they need text labels. Verify by cycling each deck with the keyboard alone. |
| Tapping a card behind the front one deals it forward, and that shortcut is pointer-only | It is a convenience on top of controls that already do the job: the arrow buttons and the stack's own arrow keys reach every card, so no function is pointer-exclusive (WCAG 2.1.1 is met by the equivalent path, not by the shortcut). Making the peeking cards focusable would put four extra stops in the tab order for something the buttons already do. | If the tap ever becomes the only way to reach a card, it needs a keyboard equivalent. Verify by cycling a deck end to end with Tab and the arrow keys and no pointer. |
| The stack cycles, so there is no last card | A pile you keep dealing through has no natural end, which would leave no way to tell you had seen everything. The visible "n of m" is what supplies that, and it is why the count is not optional chrome. | If the count is ever removed, the cycling has to go with it. |
| Links inside a sentence are under 24 × 24 CSS px | WCAG 2.5.8's inline exception: their size is constrained by the line-height of the surrounding text. Every *standalone* link (card action, nav item, timeline heading, 404 index, `.entry .org`) is given a real target box. | The rendered-page audit treats a link as inline only when its parent holds more text than the link itself. A standalone link under 24px is a defect, not an exception. |
| The Flinstone lab may never attach | Third-party cross-origin isolation; outside this repo's control (R21's "prototype limitation" is stated on the page, not hidden) | The guest window must reach the `could not attach` state with a working retry and an open-in-new-tab escape within 12 s. Verified by throttling/blocking the guest origin. |
| KeyQuorum's live lab shows a permanent "not attached" panel | There is no web build. The panel says so and links the repository instead of pretending. | If a web build ships, replace the panel with a live guest; do not leave a decorative window. |

## B5. Verified / not verified

All of the following was run against the pages as rendered in headless
Chromium (Playwright), not read off the source:

- **No horizontal overflow** on all eight pages at 320 px, at 768 px with 200%
  zoom, and at 1280 px with 400% zoom (the WCAG 1.4.10 reflow condition).
- **Target size**: no standalone interactive element under 24 × 24 CSS px at
  320 / 768 / 1280 px. Links inline in a sentence are excluded per the recorded
  exception above.
- **Contrast**: every text node on every page measured against its real
  computed background; all meet 4.5:1, or 3:1 where the rendered size and
  weight qualify as large text.
- **Keyboard**: every focusable element reached by Tab has a visible 3 px focus
  ring, and none is obscured by the sticky header (WCAG 2.4.11) — this needed
  `scroll-padding-top` on the scroller; `scroll-margin-top` on the targets did
  not do it.
- **Heading structure**: exactly one `h1` per page and no skipped levels.
- **Live lab**: connecting → could-not-attach → retry exercised with the guest
  origin blocked at the network layer, and minimize → restore exercised.
  KeyQuorum's "no web build" panel checked separately.
- **Right-hand gutters**, measured as the rightmost painted ink per section
  against the content column: every section now reaches it. Before this pass
  "Off the clock" left 407 px empty and "Contact" left 765 px — 71% of the
  column. The fix was to use the width (two columns, the two piles side by
  side, contact on one row), never to stretch prose past its reading measure.
- **Card stacks**, at 1280 px and 390 px: next and previous cycle in both
  directions and wrap; a full cycle returns to the first card; the count and
  the polite status line follow the front card; the stack takes focus and
  answers arrow keys; tapping a peeking card deals it forward; a swipe past the
  threshold advances while a short nudge snaps back and clears its inline
  transform; all five cards stay in the accessibility tree at their source
  position whichever is on top; and no page-level horizontal overflow.
- **Timeline branch**, on three project pages: newest commit first on every
  one, including ties on the same date; the spine renders and every dot lands
  on it; scrolling opens entries in order and the open one stays on screen for
  the whole length of the rail; exactly one entry carries a non-zero detail
  height once settled, with every other at 0; no entry's box overlaps its
  neighbour at any scroll position; the current index does not oscillate while
  the page is idle; focusing the seventh entry opens entry 7; and under reduced
  motion the open heights are byte-identical between frames.
- **Project evidence**: each project was built and run locally before anything
  was published. QPU's screenshot is the workbench's own canvas after compiling
  and running the repository's `TwoBitFullAdder` sample; Flinstone's transcript
  is a host `make all` build whose `version` line independently confirms the
  4.5.4 this site claims; KeyQuorum's is a 2-of-3 split, its tree, and a
  reconstruct that returned the original secret from two shares; Homework
  Central's screenshot is its own React frontend against its own ASP.NET Core
  API and PostgreSQL, all three started from the repository, showing a public
  room whose messages were posted during the run and persisted. Captions carry
  the commit and the date.
- **Icons**: 197 rendered across the eight pages. Every one is `aria-hidden`,
  `focusable="false"`, has a non-zero box, inherits `currentColor`, and none is
  the whole accessible name of the control it sits in. The lab's error panel
  was checked with the panel open, which is how a real bug surfaced: setting
  `textContent` on those two controls to relabel them per guest was deleting
  the icon beside the text. They now relabel a child span.
- **The transition has real frames**: sampling the front card's inline
  transform across a deal gives eight distinct poses and a mean gap of 40.5ms,
  about 24.7fps, with opacity swept across nine values. A press during a deal
  lands the current card and starts the next rather than being dropped.
- **The stack degrades**: with JavaScript disabled the cards render as a plain
  vertical list, each at its own position, and the nav stays `hidden` — so the
  section is readable and carries no control that cannot work.
- **Reduced motion**: `scroll-behavior` falls back to `auto` and transitions
  collapse under `prefers-reduced-motion: reduce`.
- **Navigation**: the narrow-screen menu opens, closes on Escape, and closes
  when a destination is chosen.
- **No console or page errors** on any page.

Not verified, and not claimed anywhere on the site:

- **The EMR has no screenshot, and cannot have one.** Its tree is not public, so
  there is nothing here to build or run. Inventing a mockup would be exactly the
  fabricated evidence R15 forbids, so that page stays as prose.
- **Homework Central's screenshot came from a run this environment first looked
  unable to host, and the correction is worth recording.** An earlier pass
  claimed here that there was no .NET SDK and no Docker daemon and therefore
  nothing honest to capture. Only the first half was true, and only of one
  source: Microsoft's own CDN is blocked by the proxy, but Ubuntu's archive
  carries `dotnet-sdk-10.0`, so the SDK installed and the API built clean. The
  capture is a real run — PostgreSQL 16 on the port the repository's own config
  names, the API issuing its own dev JWTs, the frontend's `/devlogin` bypass,
  and one of the repository's seeded personas — and the caption says so. Two
  details of that run are worth knowing before repeating it, neither of which
  touched this repository or theirs: the scratch clone's `global.json` pins SDK
  feature band 10.0.3xx and Ubuntu ships 10.0.112, so it was relaxed to 10.0.100
  in the scratch copy alone (the original is kept beside it), and the API's two
  "must be set" secrets were supplied as a throwaway dev value and the
  repository's own documented development placeholder.

- Real assistive-technology output. There is no screen reader in the build
  environment, so the semantics were checked structurally (roles, accessible
  names, heading order), which is not the same as hearing them (R26).
- Field Core Web Vitals. This site has no analytics, so there is no 75th
  percentile to report; no LCP, INP or CLS figure appears anywhere on the site
  or in this file. Lab conditions here were a local static server with the
  third-party guest origin blocked.
- Whether a real hiring engineer can complete the primary task unaided. No
  users were observed (R10 of the workflow, and the closing note in §10).
- One line in the food deck — Spaghetti — describes the dish rather than
  Bailey's relationship to it, because no personal detail was supplied for it.
  It is marked here rather than invented around (R01, R15). Every other card in
  both decks carries detail he gave.
- The two decks sit in adjacent grid columns, so their piles line up only while
  their intro paragraphs wrap to the same number of lines. Lengthen one blurb
  and the stacks will sit at different heights. `grid-template-rows: subgrid`
  would hold them, and is worth adding if the copy changes.
- The Google Fonts stylesheet was blocked by the build environment's proxy, so
  every screenshot above shows the **fallback** stack. That is a useful worst
  case and the layout holds in it, but the intended Fraunces / Sora / IBM Plex
  Mono rendering has not been seen.
