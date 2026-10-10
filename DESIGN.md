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
  or running the live QPU / Flinstone / KeyQuorum lab; contact details are reachable from
  every page footer.
evidence_and_known_constraints:
  - "Copy is sourced from Bailey's résumé and public git history on github.com/BPForbes (compiled 11 Sep 2026). Numbers on the page must trace back to one of those."
  - "Static hosting: no server, no analytics, no build step beyond `tsc`. All behavior is client-side."
  - "The QPU, Flinstone and KeyQuorum labs are third-party-origin iframes from bpforbes.github.io; Flinstone additionally needs cross-origin isolation and may legitimately fail to attach."
  - "KeyQuorum's lab is a WebAssembly build of the crate's own quorum, custody and delivery code, published to bpforbes.github.io; its seeded users, mock USB drives and passphrases are synthetic and public."
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
  THE THEME IS A COMMIT LOG (2026-10-10). Every project page already draws
  its history as a git branch; the home page is the trunk those branches
  come off: a numbered record whose chapters are nodes on a line, a story
  strip that draws itself from beat to beat as it is read, a left-margin
  trunk that fills with the reader's progress, project rows that preview
  their own branch texture on hover, and figures that count up to the
  numbers the résumé states. All motion is keyed to the reader (load,
  scroll, hover), runs once, and collapses to the final state under
  reduced motion or the Display control. Underneath that: workshop
  notebook, not a product landing page. Warm near-black ground, one
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
  - "Live lab: connecting, loaded-without-handshake, attached, could-not-attach (with retry and open-in-new-tab), minimized"
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
may use. The raw palette (`--p-copper`, `--p-patina`, `--p-stone`, …) exists
solely to give the role tokens a value; do not reference a raw palette name
from a component rule.

Since the 2026-10-10 redesign the one token layer has **four renderings**: two
themes (dark, the default workshop ground; and paper, a light rendering) each
with a standard and a high-contrast cut. The rendering is chosen by attributes
the Display control writes onto `<html>` (`data-theme`, `data-contrast`,
`data-motion`, `data-text`; see B4) or, with none set, by the visitor's own
`prefers-color-scheme` / `prefers-contrast` / `prefers-reduced-motion`. Both
themes live in one declaration per token via `light-dark()` (light value
first), switched by `color-scheme`; the dark values are also declared plainly
first as the fallback for a browser without it.

| Role token | Dark | Paper | Dark · high contrast | Paper · high contrast | Used for |
|---|---|---|---|---|---|
| `--surface-page` | `#10120f` | `#f4eee2` | `#000000` | `#ffffff` | Page ground |
| `--surface-raised` | `#181a16` | `#fbf7ee` | `#0d0e0c` | `#ffffff` | Hover bands, guest window, panel |
| `--surface-sunken` | `#1f221c` | `#ebe3d2` | `#161815` | `#f1f1f1` | Titlebars, notes, inset strips |
| `--surface-invert` | `#f3ead8` | `#fffaf0` | `#ffffff` | `#ffffff` | Card stock, `.note-card` only |
| `--text` | `#ebe6d8` | `#1f1b14` | `#ffffff` | `#000000` | Headings and body |
| `--text-muted` | `#c4bdae` | `#4a4336` | `#f1ede4` | `#111111` | Supporting prose |
| `--text-subtle` | `#8f897b` | `#605847` | `#d9d4c7` | `#2a2a2a` | Metadata, captions, legends |
| `--text-on-action` | `#0b0c0a` | `#ffffff` | `#000000` | `#ffffff` | Label on a filled action |
| `--text-on-invert` | `#2a2418` | `#2a2418` | `#000000` | `#000000` | Ink on card stock |
| `--text-on-invert-muted` | `#6b5e48` | `#5c5040` | `#2b2b2b` | `#2b2b2b` | The mono label on card stock |
| `--border` | `#2c2f28` | `#d8cfbb` | `#6f746a` | `#8a8a8a` | Separation between static surfaces |
| `--border-strong` | `#3d4036` | `#b9ad94` | `#9ea396` | `#5a5a5a` | Rules: section heads, ledger rows, entries |
| `--border-interactive` | `#6d7264` | `#7d7460` | `#c9cdc3` | `#2a2a2a` | Any border that *is* the control's visible boundary (≥3:1, WCAG 1.4.11) |
| `--action` / `--action-hover` | `#c98a4a` / `#e0b27a` | `#8a4612` / `#6b350c` | `#f3bd74` / `#ffd59a` | `#6b3400` / `#4a2300` | The single call-to-action colour; links and folio numerals use `--action-hover` |
| `--accent` | `#7ea36a` | `#3f6b33` | `#b8e0a4` | `#1f4d17` | Provenance labels (`.eyebrow`) — "this came from the git record" |
| `--focus` | `#e0b27a` | `#8a4612` | `#ffffff` | `#000000` | Focus ring, on every focusable element |
| `--status-ok` / `--status-wait` / `--status-error` | `#9dc389` / `#e0b27a` / `#e0685c` | `#2f6a2a` / `#8a4612` / `#a8281f` | `#b8e0a4` / `#f3bd74` / `#ff9d93` | `#1f4d17` / `#6b3400` / `#9c1c12` | Live-lab and form status, always paired with text |
| `--rule` / `--rule-strong` | `1px` / `1px` | same | `2px` / `2px` | `2px` / `2px` | Hairline thickness; every rule and control border reads it |
| `--ground-line` | 5% bone | 7% ink | transparent | transparent | The ruled grid in the page margins (`.site-ground`) |
| `--glass-tint` / `-bar` / `-sheet` | 74% / 86% / 93% of the raised surface | 72% / 84% / 93% of the paper surface | the opaque surface | the opaque surface | Glass fills for tiles and entries, the header bar, and sheets |
| `--glass-blur`, `--glass-saturate` | 20px, 1.7 | 20px, 1.7 | 0px, 1 | 0px, 1 | The backdrop blur and colour boost behind every glass surface |
| `--glass-fill`, `--glass-rim`, `--glass-hi`, `--glass-gloss` | white 6%, 16%, 22%, a 16px edge | white 50%, brown 24%, white 95%, a 16px edge | none | none | Inner fill for controls, the outer hairline, the lit top edge, the specular edge |
| `--glow-a`, `--glow-b`, `--scrim` | copper 18%, patina 13%, 55% black | copper 22%, patina 18%, 40% ink | transparent, 72% black | transparent, 72% black | The ambient colour behind the glass, and the sheet scrim |

Measured contrast (sRGB, `tools/contrast.py`, 2026-10-10): in every rendering
every text role holds ≥4.5:1 on all three surfaces, `--text-on-action` ≥4.5:1
on `--action` and `--action-hover`, and `--border-interactive`, `--focus` and
`--action` ≥3:1 on all three surfaces. The weakest pairs are `--accent` on
`--surface-sunken` in paper (4.9:1) and `--text-subtle` on `--surface-sunken`
in dark (4.6:1). The high-contrast cuts hold ≥7:1 for every text role. Every
one of those was then re-checked against the *rendered* pages, not just the
token table — see B5.

**Glass is held to the same bar on its worst backdrop, not the flat colour.**
`tools/contrast.py` also checks every text role a glass surface carries against the
worst thing that surface can sit over: tiles and entries over the page plus both
glows at full strength; the header bar over pure white (dark theme) or pure black
(paper), as a bright or dark photograph scrolling beneath it; sheets over the scrim
over the same extremes; chips over the worst tile plus their fill. All pass at 4.5:1
or better (the tightest, `--text-subtle` on a dark tile, is 4.61:1). The gloss is
confined to a 16px edge so it never sits behind text, and the header's secondary
text uses the muted role for the same reason.

Scales: spacing `--space-1` 0.25rem through `--space-9` 5rem (a 4px-based
ramp); radii `--radius-sm/md/lg` (3/4/6px — small on purpose, this is a drafted
document, not rounded tiles); `--elevation-1`; `--motion-fast` 120ms and
`--motion-base` 200ms, both zeroed under `prefers-reduced-motion` or the
Display control's "Reduced". `:root[data-text="large"]` sets the root font
size to 118%; everything is in rem, so that one declaration scales the page.

## B2. Typography (R13)

- **Fraunces** — headings only, loaded as a variable font with its `opsz`,
  `wght`, `SOFT` and `WONK` axes. The page title (`h1`) and the résumé figures
  turn `SOFT` up; the `h1` alone turns `WONK` on — the slanted terminals and
  old-style forms are the one place the face is allowed its quirk, so the
  name reads as lettering and everything else stays a plain serif.
- **Sora** — reading text and controls, two weights (400, 600).
- **IBM Plex Mono** — one weight (400), reserved for dates, version strings,
  status text, labels and `<code>`, and since the redesign for the running
  head (nav links), button labels, chips and the spec sheet — everything that
  is a label or a record rather than a sentence. Never for prose.

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

- **`.tile`** in **`.bento`** — the home page's overview (2026-10-10, the
  "use a template" pass, built in this stack after the bento-grid pattern
  rather than adopting a template's code). A tile is a summary or a
  destination of a *different kind* from its neighbours — who this is, the
  story line, a lab, a project, skills, what is happening now, the ways to
  reach him — taken in at once. That is why the overview is a grid of tiles
  while everything below it stays ruled rows: a list is for repeated records
  of one kind. Tiles have the site's only rounder corners (`--radius-tile`,
  18px), varied spans (one, six and twelve columns across the three layers),
  and lift 2px on hover only when they hold a destination.
- **`.ledger`** (`<ol>` of `.ledger-row`) — the project list: one discrete
  destination per row, numbered in the margin, ruled off from the next. It
  replaced a grid of `.card` tiles on the home and projects pages because
  five boxes in a grid is the shape every portfolio has; a numbered index is
  the shape a parts list has. On the index page the whole row is one link
  (`.ledger-link`); on the home page each row carries its own actions.
- **`.card`** — still only for a discrete destination the visitor can open,
  kept for any future use that is genuinely a tile. Nothing else gets a card.
- **`.spec-sheet`** (`<dl>`) — the home hero's at-a-glance facts (based,
  stack, now, latest release, status) as ruled label/value rows in mono. It
  replaced a row of pill badges: the same facts, in the shape of a datasheet
  header rather than a tag cloud.
- **`.entry`** — a repeated record with the same fields (role/org/dates, or
  release/date/summary). Ruled, not boxed, since the redesign: a rule above
  each record is enough to separate repeated records, and a box around each
  was the generic-résumé look.
- **`.note-card` in a `.deck`** — one item in a browsable collection that is
  read, not opened (a dish, a game). It is a card because the items are
  discrete and parallel, and a cycling stack because the collection is short,
  unranked, and meant to be gone through one at a time. It is never a link; if
  one ever needs to be, it becomes a `.card` instead.
- **`.spec-list` (`<dl>`)** — label/value pairs: skills, release specs. Not
  cards; there is nowhere to go.
- **`.stat-list`** — résumé figures as a captioned `<dl>` with the source
  stated inline, not four boxed tiles. Reused as-is, no modifier class, for a
  project page's impact strip: the shape (big figure, small label, rule
  above/below, no box) is identical, so it is the same component rather than
  a lookalike beside it.
- **`.strength`** — a project page's one-line "what this demonstrates"
  statement plus its evidence sentence. An accent-coloured left rule, the
  same idiom `.note` already uses for a callout, but at full text strength
  rather than `.note`'s muted small print: this is confidence, not a caveat.
- **`.chip[data-topic]`** — a topic tag: a technology or a practice the work actually
  used. It is the only thing the topic filter reads, so what a visitor sees on a card is
  exactly what the filter matches. Its text must equal the label in `src/topics.ts`.
  A chip without `data-topic` (a version, a commit count, "Axum", "HIPAA testing") is a
  fact about the item, not a filter topic.
- **Plain prose in `.prose`** — anything that is simply read.

## B4. Recorded exceptions

| Exception | Reason | How to evaluate |
|---|---|---|
| The site has a **Display control** (header, `src/display.ts`) offering theme, contrast, motion and text size | Asked for directly ("still ADA compliant — perhaps a setting?"). The default rendering already meets AA; the control exists so a visitor can go past it: a 7:1 high-contrast cut, reduced motion without changing an OS setting, a larger root size, and a paper theme for anyone who reads dark pages badly. Each choice is written as a `data-*` attribute on `<html>` and the stylesheet does the rest; "System" means the attribute is absent and the OS media query decides, so the no-JS page, the first paint and the settled page agree. The choice is kept in `localStorage` (`bf-display`) and re-applied by a four-line inline script in every page's `<head>` before first paint, so nothing flashes. Native radios in fieldsets, so grouping, arrow keys and announcement cost nothing. | The panel must open from the button on Enter, land focus on the current theme radio, change the rendering on an arrow key, persist across a reload, close on Escape with focus returned to the button, and close on a click outside. Checked that way, keyboard only, by `tools/audit-a11y.mjs`. If the inline boot script and `applyPrefs()` ever disagree, the page will flash on load — they must stay identical. |
| **The home page opens on a bento overview** (`.bento-section`) | Asked for ("perhaps a template?") and chosen over adopting one: a bento grid built in this stack keeps the labs, timelines, decks and the Display control, which a template port would have discarded. The overview replaced the hero, the story strip and the featured ledger; the record (experience, education, off the clock, contact) continues below it, and the trunk walks that record. The ledger stays on the projects index. Two facts moved into tiles rather than being duplicated: skills (out of Education, now "Education") and "Right now" (out of Off the clock). | Tiles must stack in source order at 320px with nothing hidden; the h1 must stay inside the intro tile and the section be labelled by it; no tile may rely on hover for anything its text does not carry; every lab tile's primary action must reach the lab (`#live-lab`) and its secondary the write-up. Checked at 390 / 900 / 1440 px in dark and paper. |
| **A live local clock** in the spec sheet (`[data-local-time]`) | A fact about where he is, kept current: the hour in Indiana, formatted by `Intl` for `America/Indiana/Indianapolis`, refreshed on the minute. `aria-live="off"`, so it is read when reached and never announced on change; the `<time>` carries the machine value. Falls back to the static text "Eastern time" without script or `Intl`. | The displayed hour must match Indianapolis (EDT/EST by date, checked against the `datetime` attribute). It must never announce. |
| **"Copy" beside the email address** (`.copy-btn`) | A small convenience the mailto link does not give: the address on the clipboard. Drawn only where `navigator.clipboard` exists; the link is the real route and works regardless. Success and failure are spoken through a `role="status"` line and shown on the button for two seconds, so the outcome is not colour alone (R25). | With the clipboard unavailable the button must not exist. After a click the status line must read the address and "copied", and the button must return to "Copy". |
| **The story strip** (`.tile-story`, `.story-line`) on the home page | The theme needs a story told in order, and the page's sections are ordered by importance to a recruiter, not by time. The strip is six dated beats — tutoring, the EMR team, Flinstone's origin, Baker Hill, the Homework Central migration, now — each a fact that already appears on this page or a project page (R15: nothing new is claimed), joined by a line that draws from beat to beat as each is reached, with "Now" drawn as HEAD (an open ring) rather than a filled commit. Links in it go to the project pages. | Every sentence must trace to an existing page. The line must draw only once, in reading order, and be fully drawn with no script or under reduced motion (`src/story.ts` adds `.is-seen` to every beat in that case). At 320px the beats stack with the line vertical; at the wide layer they run across. |
| **Sections and records arrive on scroll** (`.reveal`, added by `src/story.ts`) | Motion that explains change (R27): a chapter appears as the reader reaches it, 12px and 360ms, staggered 60ms between records that arrive together — the skill's scroll-reveal band, chosen over a slide. The class is added by script, so with scripting off nothing is hidden, and nothing is added at all under reduced motion. | Nothing below the fold may be hidden without script. Under reduced motion `document.querySelectorAll(".reveal")` must be empty. An element must never reveal twice. |
| **Résumé figures count up** (`.stat-list dt`) | The one "effect" in the strip, and it is about the numbers: the figure is reached, not shown. The authored text stays in the DOM in a visually-hidden span and the counting happens in an aria-hidden twin, so assistive technology reads "sixteen thousand" once and never a number on its way there. 900ms, ease-out, lands on the authored string exactly. | After counting, the visible twin must equal the hidden original byte for byte (checked in the story capture). Under reduced motion no twin is created. Figures with a prefix (`~70`, `<2 weeks`) or suffix (`584 million`) keep them throughout. |
| **The trunk** (`nav.trunk`, home page, ≥80rem) | The theme's spine: a page-local nav in the left margin, one node per numbered chapter, the line between them filling with the reader's progress and the current chapter ringed. It is real links in a real `<nav aria-label>` with `aria-current="location"`, so it is a table of contents first and a progress indicator second. Only built where the margin can hold it; the header nav covers everything else. | Every node must be reachable by Tab and show the chapter title on focus, not only on hover. `--trunk-progress` must reach 1 at the last chapter and be 1 immediately under reduced motion. The nav must never overlap the content column (its left edge is computed from `--measure-page`). |
| **A project row previews its branch on hover** (`.ledger-motif`) | Hovering (or focusing into) a row in the log shows, faintly and only on the row's right half, the same motif its project page draws, with its flow line running only while the row is active — a preview of the branch you would switch to. It is pointer- and focus-driven decoration, carries nothing not in the row's text, is `aria-hidden`, sits under the text, and is not clipped in a way that could cut a focus ring. | Nothing in the row may depend on the motif; the flow animation must be paused when the row is not hovered or focused; the row must not set `overflow: hidden` (a focus ring on its right-hand action would be cut). |
| **The hero writes itself in on load** | ~700ms of CSS keyframes: the kicker's rule draws, the title and lede rise, the spec sheet's rows and the actions follow, the portrait's offset rule slides in. It is the one load-time animation and it is what makes arriving on the page feel like a page being opened rather than a template being served. CSS only; the sitewide reduced-motion rule zeroes its durations, so it becomes a plain first paint. | Under reduced motion the kicker rule's computed transform must be the identity and the title's opacity 1 at first paint (checked in the story capture). Nothing may animate after it settles. |
| **Menus open as sheets** (`src/sheet.ts`, `.sheet`) | Asked for: a bottom sheet on a phone and a side sheet on a desktop. The Display control and the compact navigation menu are both sheets. Each is one native modal `<dialog>`, so the browser supplies focus trapping, an inert page behind it and Escape; the stylesheet picks the shape, a bottom sheet with a grab handle below 56rem and a 26rem side sheet from the right above it, so a resized window reshapes an open sheet. The scrim click, focus return to the opener, the page scroll lock on a phone, and a drag-down-to-dismiss on the handle are added in script. Open and close are transitions on transform and opacity, with `display` and `overlay` transitioned as discrete properties so the closing motion is seen. The wide layout keeps its inline links; only the compact menu is a sheet. | The sheet must open on Enter from its button and land focus on its first useful control (the current theme choice, or the current page); Escape and the close button close it and return focus to the button; clicking the scrim closes it; `aria-expanded` is true only while open. Dragging is a shortcut only, never the sole route (WCAG 2.5.7). `tools/audit-a11y.mjs` opens both sheets by keyboard, audits their text and targets while open, and checks the close. |
| **Glass surfaces** (`--glass-*` tokens, applied once in the "glass" block of `css/styles.css`) | Asked for, in the manner of Apple's Liquid Glass: translucent tinted surfaces with a backdrop blur and colour boost, a lit top edge, and a soft ambient glow behind so there is something to refract. It covers the header bar, tiles, role entries, sheets, the live lab's chrome, and the fill of controls. It is the one effect on the site that can hurt legibility, so it is bounded: tints are dense enough for the worst backdrop (see B1), controls keep their own interactive border rather than the glass rim, and the filled action keeps its colour with a sheen that fades before the label. Glass resolves to the opaque surface, with the glow removed, in both high-contrast cuts, under the OS reduced-transparency preference, and in a browser that cannot blur. | `tests/glass.test.mjs` checks that all three collapse conditions set the opaque tokens, that the default is opaque until blur is proven, and that every `backdrop-filter` is driven by the blur token. `tools/contrast.py` checks the worst-case backdrops. If a new glass surface carries text, add its case there. |
| **Animations replay in both scroll directions** (`src/story.ts`) | Asked for: reveals, the story line and the résumé counters run every time they come into view, scrolling down or back up, not once per visit. Two observers per element: one fires as it crosses the viewport; the other watches a band 35% of a screen taller on both sides and resets it only after it is well out of that band, so the reset is never visible. The counter restarts from zero, cancels a count in progress when it leaves, and restores its authored text. The tiles and the page heroes join the same system, so the first load is the same entrance, with a first-paint hold keyed to `html.js` that only applies where the reveal will run and fades itself in after 2.5 seconds if the script never arrives. | Under reduced motion `.reveal` must not exist and nothing is hidden; with scripting off nothing is hidden; with the site script blocked the tiles must be visible within 3 seconds. Scroll to Experience, away, and back: the figure counts again each time. `.reveal-ready` is set only once the observers are attached. |
| **Filter by topic** (`[data-topic-filter]`, `src/topics.ts`) on the home page and the projects index | Asked for directly: pick topics such as Rust or Cloudflare and hide the projects and roles that used none of them. Toggle buttons with `aria-pressed`, grouped as Languages, Platforms and Practice, each with its item count. Selection is OR, so adding a topic never hides more. The state is in the URL (`?topics=rust,cloudflare`) through `replaceState`, so a filtered view can be shared without adding history entries. A polite status line says what is shown ("2 of 5 projects and 2 of 4 roles tagged Rust or C#"), a group whose items are all hidden shows a line saying so, and matched chips are drawn heavier with a rule beneath. The groups sit in a native disclosure that is open on the wide layer and closed on the compact one, because 22 toggles fill a phone's screen. The control is revealed by script, so with scripting off nothing is hidden. Education entries, the skills tile and the story are not filtered: they are not tied to one technology. | `tests/topics.test.mjs` checks the topic list, the OR match, the URL round trip, that every `data-topic` on a page is known and its chip says its label, that every filter item carries a topic, and that every topic is used. In a browser: Space on a topic toggles it; Clear returns focus to the first topic; a `?topics=` link pre-selects; with JavaScript off no item is hidden and the control is absent. |
| **Topic assignments** | Each tag is evidenced. Languages come from the repositories' Linguist splits (`data/project-metadata.json`): Flinstone C and Assembly; KeyQuorum Rust and TypeScript (its lab); Homework Central C#, TypeScript and Rust (its `rust/` kernels); QPU TypeScript; the EMR's Kotlin and Java are the curated estimate. Platforms and practice come from each repository's code and docs: Flinstone's Cloudflare Worker and Durable Object, Emscripten shell (WebAssembly), TCP/IP and Wi-Fi stack (networking) and kernel (systems programming); KeyQuorum's SQLite store, Cloudflare Workers, R2 and Access, WebAssembly lab, security model, and relay operations with Terraform, backups and secrets (system administration); Homework Central's React frontend, PostgreSQL, Docker Compose and Kubernetes layout (Docker, system administration) and neural moderation model (machine learning); QPU's React workbench, compiler and quantum simulator; the EMR's Firebase and HIPAA-focused testing (security). Roles carry the stack the résumé names: Baker Hill C#, TypeScript and CI/CD; the EMR team Kotlin, Java, Firebase and security; tutoring security, because it included cybersecurity. HTML is not a topic: it is a fraction of a percent of every repository. | A new tag needs the same kind of evidence. Do not tag an item with a topic its repository or the résumé does not show. |
| A faint **ruled grid** (`.site-ground`) sits behind the page | R14 asks every effect to earn its place. This is the one texture on the site and it is what makes a wide window read as a drafting sheet with the content set on it rather than a dark void with a column in the middle. It is masked out from behind the content column entirely, so no text is ever painted over it; it is zero-width on a phone, where there is no margin; and it is transparent in the high-contrast cut. | `tools/audit-a11y.mjs` measures every text node against its real painted background; the grid must never appear in that measurement. If a future layout puts text in the margins, the grid has to go. |
| **Section heads and ledger rows are numbered** with generated content | The folio numerals are what make the page read as a numbered document, but they are decoration: the `<ol>` already gives assistive technology the count and position, and a heading does not need "zero one" read before it. They use the `content: … / ""` alternative-text syntax so the number is painted and not announced. | Only the home page's top-level sections are counted (`.wrap > section`); the project pages' nested sections must never acquire numbers, because they would count in an order that means nothing. Check with a screen reader or the accessibility tree that no numeral is announced. |
| The two CLI projects show a styled text transcript, not a screenshot | R15 asks for real evidence of the product running, and for a terminal that evidence *is* text. Kept as text it stays selectable, searchable, legible at any zoom and reflows on a phone; a PNG of a shell does none of that and is heavier. The transcripts are literal output from a real local run, with the command lines marked so they can be picked out. | Every line must be reproducible by running the stated command at the stated commit. Any edit for layout must be disclosed in the caption — the Flinstone one reflows a six-item list onto two lines and says so; the KeyQuorum one abbreviates a secret and says so. Nothing else may be changed. |
| The timeline shows five entries at a time, with three levels of detail | The history stays scannable as dates and titles while exactly one commit is readable, which is what keeps a nineteen-entry rail from being a wall. Selection is explicit — click, arrow keys, or the pager — rather than derived from scroll position, and the expanded card is a third level asked for on purpose. The card is bounded and scrolls rather than truncating, because "show details" has to mean all of them; a card free to grow would push the other four commits off the screen and undo the window. | Exactly one entry may show a summary, and at most one may show a card. The visible "n of m" and the range readout are what tell you the rest of the history exists, so neither is optional chrome. Verify by reaching the last entry with the keyboard alone. |
| The expanded card scrolls natively, with no on-screen up/down control | An earlier pass added a pair of buttons for this. They turned out to be redundant: the body is already `overflow-y: auto` and focusable, so wheel, touch, and the keyboard all reach it without anything drawn on top. A bottom fade is the only added chrome, and only once the body actually overflows — it hints that there is more to read without claiming a control that does nothing new. | The body must be reachable and scrollable by keyboard alone (Tab to it, then arrow keys or Page Down). The fade must track real scroll position — present while `scrollTop` is short of the bottom, gone once it is not — never a static decoration. |
| The rail does not respond to scrolling at all | An earlier version derived the open entry from scroll position. It read well going slowly and badly otherwise: an open entry is taller than a closed one, so every change reflowed the rows below it, and scrubbing up and down fed that back into itself as jitter. Decoupling the two removes the feedback loop rather than damping it. | Scroll the page fast in both directions: `document.body.scrollHeight` must not change, and the selected entry must not move. If either does, something has been re-coupled to scroll. |
| Expanding a card still changes the rail's height | Entries are in normal flow, so the one below moves. That is safe now in a way it was not before: nothing derives selection from scroll position, so a height change cannot feed back into the thing that chose which entry is open. It is an ordinary disclosure. | Paging or selecting must never scroll the page on its own. Only the five windowed rows are in the DOM, so assistive technology reads the window, and the range readout says where that window sits in the whole history. |
| The timeline cards float continuously | R27 warns against constant decorative motion beside reading content, and this is the exception to it, asked for deliberately. The amplitude is scaled to scroll activity: about 0.35° at rest, roughly 1° during a scrub, so the resting state is a float rather than an animation competing with the prose. It stops dead under `prefers-reduced-motion`. | With reduced motion set, two samples 700ms apart must give a byte-identical transform. If the resting amplitude is ever raised much past 1°, it stops being a float and R27 applies again. A previous pass tipped the deck back to 45° for depth; it cost more legibility than it bought and was removed, so the depth cue is a small scale and fade. |
| The card stack's geometry lives in `src/deck.ts`, not the stylesheet | Moving between cards is a transition, not a swap: every card is posed from one continuous progress value so a drag and a button press run the same code, and half way through a drag the stack really is half way between two states. CSS can name the resting poses but cannot be sampled at arbitrary points between them. | The stylesheet still owns how a card *looks*; only the poses and the tween moved. If a pose is ever duplicated in CSS, one of the two is wrong. The no-JS path does not depend on it — unstacked cards are a plain list. |
| The deal is sampled at ~24fps rather than every display frame | Asked for, and the point of it: stepped motion reads as cards being dealt one at a time, where a smooth 60fps tween reads as a single glide. `FRAMES_PER_SECOND` in `deck.ts` is the one place to change it. | Sample the front card's transform across a transition: there should be about eight distinct poses for a 340ms deal, with a mean gap near 41.7ms. Derive the step from elapsed time, not from counting animation frames — counting rounds every step up to three display frames and yields 20fps. |
| `.note-card` uses card stock — the one light surface on a dark site | R11 asks for a small set of recognisable characteristics repeated with restraint. This is that one characteristic: index-card stock, a red title rule and ruled note lines, used for both off-the-clock decks and nowhere else. It is a motif, not the one-off inverted panel that was removed before it. | If card stock appears outside a `.deck`, the motif has become decoration and this is void. The ruled lines depend on `.note-card-note` keeping a fixed `line-height` in the same unit as the gradient; change one and you must change the other, or the ruling drifts under the text. |
| The deck's previous/next controls are arrow glyphs with no visible text | The quick-replacement guide allows icon-only controls that are "familiar controls with accessible names and sufficient context". Prev/next on a pager is that case: each has an `aria-label` naming its deck ("Next game"), each is 44 × 44, and they sit either side of a visible "n of m". | If the arrows ever become the *only* way to reach a card, they need text labels. Verify by cycling each deck with the keyboard alone. |
| Tapping a card behind the front one deals it forward, and that shortcut is pointer-only | It is a convenience on top of controls that already do the job: the arrow buttons and the stack's own arrow keys reach every card, so no function is pointer-exclusive (WCAG 2.1.1 is met by the equivalent path, not by the shortcut). Making the peeking cards focusable would put four extra stops in the tab order for something the buttons already do. | If the tap ever becomes the only way to reach a card, it needs a keyboard equivalent. Verify by cycling a deck end to end with Tab and the arrow keys and no pointer. |
| The stack cycles, so there is no last card | A pile you keep dealing through has no natural end, which would leave no way to tell you had seen everything. The visible "n of m" is what supplies that, and it is why the count is not optional chrome. | If the count is ever removed, the cycling has to go with it. |
| Links inside a sentence are under 24 × 24 CSS px | WCAG 2.5.8's inline exception: their size is constrained by the line-height of the surrounding text. Every *standalone* link (card action, nav item, timeline heading, 404 index, `.entry .org`) is given a real target box. | The rendered-page audit treats a link as inline only when its parent holds more text than the link itself. A standalone link under 24px is a defect, not an exception. |
| Commit bodies are rendered with react-markdown and KaTeX, behind a dynamic import | The detail comes from pull request bodies, so it is GFM: bold, backticked identifiers, nested lists, tables and task lists. A hand-rolled subset was tried first and was the wrong tool — it approximated maths by substituting Unicode characters, so a fraction only looked arranged. KaTeX typesets it, and remark/rehype is the same lineage GitHub renders these bodies with, so an author sees what they wrote. The cost is real — about 194 KB gzipped — which is why `src/commitBody.tsx` is reached only through `import()`: the chunk, the stylesheet and the bodies file are all fetched the first time a card is expanded and never for a visitor who does not. KaTeX's CSS and fonts are vendored into `css/vendor/katex/` rather than pulled from a CDN (R29). | Nothing may be added that pulls `commitBody` into the entry bundle — check `js/site.js` stays near 23 KB gzipped, and that a project page makes no request for the chunk, the KaTeX stylesheet or `data/commit-bodies.json` until a card is expanded. `rehype-raw` must never be enabled: commit bodies are other people's writing, and raw HTML in one must stay text. Link targets are restricted to http, https and mailto, and images are not requested. Covered by `tests/commitbody.test.mjs`. |
| The Flinstone lab may never attach | Third-party cross-origin isolation; outside this repo's control (R21's "prototype limitation" is stated on the page, not hidden) | The guest window must reach the `could not attach` state with a working retry and an open-in-new-tab escape within 12 s. Verified by throttling/blocking the guest origin. |
| Every project-page hero has an animated background texture | Asked for directly: text, backgrounds, or animation that echo what each project is, not decoration for its own sake. One mechanism (`src/projectMotif.ts`) — a repeating SVG tile with a single line animating its own `stroke-dashoffset` — so the whole texture reads as one coherent surface instead of several independently-looping elements (the "stagger-spam"/"pulsing indicator" patterns this file already warns against). Only the five tiles' line art differ: PCB traces (Flinstone), connected nodes (Homework Central), a gate-and-wire diagram (QPU), a branching tree — the actual M-of-N structure KeyQuorum implements (KeyQuorum), and a restrained ECG line, the one place a literal nod fits the domain (EMR). Opacity is capped at 12%, `aria-hidden`, and `pointer-events: none`. | The motif must never sit above a focusable element in tab order or in `elementFromPoint` hit-testing at the hero's real buttons — checked with Playwright at 320/390/768/1024/1440px. Under `prefers-reduced-motion: reduce` two samples of the animated line's `stroke-dashoffset` taken 500ms apart must be identical (it inherits the sitewide reduced-motion rule; no per-component guard). |
| The language split renders as a donut alone, with no bar beside it | Asked for directly as the primary visualisation, overriding this site's own dataviz guidance (which defaults part-to-whole to a stacked bar and treats a donut as the form it deprioritizes). That guidance's own exception — a donut sanctioned "for a quick read at a handful of segments" — still bounds it: a repository reporting more than `MAX_NAMED + 2` languages (`src/languageChart.ts`) is not "a handful," so `foldLanguages()` folds the tail into one "Other" segment before the chart ever sees it, capping the chart at five named segments plus Other regardless of how many languages Linguist reports. The chart carries its own `role="img"`/`aria-label` now — there is no longer a bar beside it whose label the legend could defer to — and the legend is `aria-hidden` so the figures are not announced twice. | `donutSegments()` and `foldLanguages()` are both pure and covered by `tests/languagechart.test.mjs` without a browser: check the fold triggers only past seven languages, keeps the five largest by percentage (not by original order), and never colours "Other" the same as a real language. Colours for the named segments must still come from the existing `languageColor()` table, never a new palette. |
| The project-page timeline rail is `position: sticky` | An earlier version of this file recorded the rail as deliberately non-sticky, because the timeline's open entry used to be derived from scroll position and a sticky rail would have fed that feedback loop. That coupling no longer exists (see "The rail does not respond to scrolling at all," above) — selection is explicit pager/click/arrow-key state, not scroll-derived — so the original reason to avoid `position: sticky` is gone. Turning it on fixes a real problem: a project page's main column (impact strip, strength, live lab, language chart, technical write-up) runs well past the five-entry timeline, which otherwise left a tall stretch of empty space beside the prose once the rail scrolled out of view. Only applied in the wide layer (`min-width: 56rem`) where the two-column layout exists at all. | Scroll a rebuilt project page (e.g. Flinstone) past the language chart at ≥896px: the rail must stay pinned under the header rather than scrolling away, and must never overlap the header or bleed past the bottom of `.project-main`. Below 56rem the rail must remain in normal flow (stacked under the main column), since the sticky rule does not apply there. |
| The project pages' technical prose sits behind a "Read the technical write-up" `<details>` toggle | The impact strip and strength block from the prior redesign pass narrowed the *first* thing a visitor reads, but the dense multi-section prose ("What it is," "How it grew," etc.) still ran immediately after at full weight — visitors still described the page as "word soup." The fix layers rather than rewrites: a short, plain-language "Why it exists" paragraph is now the default-visible explanation (grounded only in facts the project owner gave for this purpose — DESIGN.md B5's no-fabrication standard still applies), and the existing technical prose — unedited — moves behind one native `<details>`/`<summary>` per page. A native element gives keyboard support and correct expanded/collapsed announcement for free, the same reason `releases.ts` reaches for it; the `.disclosure-body` grid-rows height animation is new because this toggle reveals several paragraphs at once (`releases.ts`'s one-line disclosure never needed to animate a height). 420ms, not `--motion-base`, because 200ms was tuned for a much smaller reveal. | Toggling `<details class="disclosure">` open must animate the height (not snap instantly) and must reach a fully open, fully scrollable end state; toggling closed must return to zero height. Under `prefers-reduced-motion: reduce` the transition collapses via the sitewide blanket rule — verified by reading `.disclosure-body`'s computed `transition-duration` in a `reducedMotion: 'reduce'` Playwright context. Keyboard: Enter/Space on the `<summary>` must toggle it with no separate script — this is native `<details>` behaviour, not something this codebase implements. |

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
  KeyQuorum now attaches as a live guest with the same handshake.
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
  Central's three screenshots are its own React frontend against its own
  ASP.NET Core API and PostgreSQL, all three started from the repository: one
  shows a public room with a plain message, a message with real Markdown and
  LaTeX rendered by KaTeX, and a reply from a second account with a resolved
  `@mention`; the second shows that mention's notification in the recipient's
  own inbox; the third, from the unmerged neural-net branch, shows the
  moderation model's real two-stage architecture and its 3D mesh, initialized
  but untrained. Captions carry the commit and the date.
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
- **Sheets, glass and replay pass (2026-10-10)**, Playwright at 390 and 1440 px: the
  Display sheet is 416px wide and flush right on desktop and full-width flush bottom
  on a phone; the nav sheet opens on a phone with five links, focus on the current
  page, closes on a link press with the hash applied; Escape, the close button, the
  scrim click and the handle drag each close a sheet and return focus to its button.
  Glass computes to `blur(20px) saturate(1.7)` on tiles and the header, and to an
  opaque surface with no blur or glow under high contrast. The Experience counter
  counts from zero on each arrival, from above and from below, and its elements reset
  only once far off screen; the story beats go 6, 0, 6 on leaving and returning; under
  reduced motion no `.reveal` exists and tiles are fully opaque; with the site script
  blocked tiles are hidden at 0.3s and visible at 2.9s. The rendered audit now also
  audits the open sheets; its 23 reports are unchanged and are all the controls inside
  closed disclosures.
- **Topic filter pass (2026-10-10)**, Playwright at 390 and 1440 px: 22 topics render in
  three groups with counts; Rust shows KeyQuorum and Homework Central and the roles empty
  state; Rust or C# also shows the two roles that used C#; Clear restores everything and
  focus; `/projects/?topics=cloudflare` pre-selects and shows Flinstone and KeyQuorum with
  their Cloudflare chips marked; with JavaScript off the control is absent and nothing is
  hidden; no horizontal overflow on a phone, where the topics start collapsed. The rendered
  audit is unchanged.
- **Bento pass (2026-10-10)**, Playwright at 390 / 900 / 1440 px in dark and
  paper: tiles stack, pair and span as the three layers say; the heading
  order is h1 then h2s with no skipped level; the clock reads the Indiana
  hour with a matching `datetime`; the copy control is present under a
  clipboard-capable context; a lab tile lifts, brightens its motif and runs
  its flow line on hover. `tools/audit-a11y.mjs` re-run after the change is
  unchanged.
- **Story pass (2026-10-10)**, Playwright at 1440px: the trunk builds with six
  nodes, marks the current chapter with `aria-current` and fills to the
  scrolled progress; every counter lands on its authored text exactly; the
  story line draws beat by beat; under `reducedMotion: reduce` no `.reveal`
  class exists, every beat is marked seen, trunk progress is 1 and the hero
  is at its final state on first paint. The rendered audit below was re-run
  after these additions and is unchanged.
- **Redesign pass (2026-10-10)**, `tools/audit-a11y.mjs` against all eight pages
  in all four renderings at 320 / 768 / 1280 px: every rendered text node
  measured against its real painted background meets 4.5:1 (3:1 where the
  rendered size qualifies as large); no standalone target under 24 × 24 CSS px
  (inline links excepted per B4); no horizontal overflow; every focusable
  element reached by Tab shows an outline of at least 2 px; the Display
  control's open / arrow-key / persist / Escape / focus-return sequence
  passes keyboard-only; the saved preference is applied before first paint
  (the `data-*` attributes are present on `<html>` when the page is read).
  Token-level contrast for all four renderings is `tools/contrast.py`, which
  exits non-zero on any failing pair. Screenshots of the dark, paper and
  dark-high-contrast renderings were reviewed at 1280 and 390 px.

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
- **Getting a real mention notification took one more local-only adjustment,
  on top of finding that DevAdmin — not a second persona — had to send it.**
  The app's `@mention` regex, front and back end, stops at the first space, so
  a persona whose seeded username is two words (`Marie Curie`) can never be
  pinged as typed; a local, disclosed rename to `MarieCurie` in the scratch
  database (not the repository, not the catalog it reseeds from) fixed that
  half. The other half was tenant isolation, working as documented in the
  source repo's own `docs/tenancy-isolation.md`
  ([BPForbes/Homework-Central](https://github.com/BPForbes/Homework-Central)):
  an ordinary developer persona's eligible-recipient list is scoped to its own
  tenant database, and every persona here is the sole user of its own, so two
  personas can never notify each other. Only DevAdmin, whose recipient list
  spans every tenant, could actually reach her — which is why the second
  screenshot's message is from DevAdmin rather than a persona.
- **The neural-net screenshot is from a second checkout of an unmerged
  branch, run against its own database, and shows an untrained model.** The
  feature (`/server/NeuralNet/*`, gated on `ManageServerInfrastructure`) lives
  on `cursor/training-speed-c7b9`, which `main` has not absorbed — the same
  `global.json` relaxation applied there, in a separate git worktree, on a
  separate local database so it could not touch the run behind the other two
  screenshots. Generating synthetic training examples calls a local Ollama
  model (`qwen3:0.6b`) this environment does not have and cannot reach —
  ollama.com and its GitHub releases are both proxy-blocked — so no training
  pass was run and none is claimed. What the screenshot shows is real:
  the architecture's own reported shape (`HashedMlpV8`, 21,887 parameters,
  429 nodes, 21,544 edges) and the database's actual, honestly-empty state
  (12 seeded approved examples, 0 pending feedback) from a fresh install of
  that branch.

- Whether the `content: … / ""` alternative-text syntax hides the folio
  numerals in every screen reader. It is specified and shipped in Chromium,
  WebKit and Firefox, but see the next item.
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

## Contact form addition (2026-09-16)
The user authorized a Turnstile-protected contact form, a separate workers.dev
API, and Resend email delivery. Namecheap DNS and GitHub Pages remain in place.
The form extends the existing single-column contact section and semantic tokens.
It preserves the direct email link and announces pending, failure and success
states. The frontend remains unpublished until Resend domain verification and
its encrypted API key are ready. Automated backend tests and TypeScript compile
pass; production email delivery and interactive browser verification remain
pending those prerequisites.

## Related instruction files

These files refer to each other. A change to one that affects another should update both.

- [`AGENTS.md`](AGENTS.md): the design rule set this site is built to
- [`docs/agents/multi-repo.md`](docs/agents/multi-repo.md): evidence rules R15 and R16 apply to project figures
- [`projects/AGENTS.md`](projects/AGENTS.md): design rules and evidence rules for project pages
- [`src/AGENTS.md`](src/AGENTS.md): design rules the components must follow
