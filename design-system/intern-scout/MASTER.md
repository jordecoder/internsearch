# Intern Scout — Design System (MASTER)

Global source of truth for UI decisions. Page-specific overrides go in `pages/<page>.md`.
Built with the UI UX Pro Max workflow (Job Board / Recruitment profile, flat + minimal), Emil Kowalski's
design-engineering rules for everyday motion, and Apple's product-page language for showcase moments.

## Direction

**Charcoal & Sand, Apple-grade.** Warm-white tiles floating on sand, charcoal ink, large tight-tracked
headlines, soft layered depth instead of borders, frosted materials for anything that floats. Cobalt blue
is a *hint*, never a fill.

**Dark mode — "Graphite & Sand".** Deep warm graphite (#161513, never black), sand ink, periwinkle hints,
tiles lifted by a faint top highlight rather than drop shadows. No green accent.

## Tokens (`frontend/src/index.css`)

Components use tokens only — never raw hex or Tailwind palette colours. The one exception is `AppMark`,
the app icon, whose brand colours are fixed (they match the favicon).

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F3EEE5` sand | `#161513` graphite | Page |
| `sidebar` | `#ECE6DA` | `#1B1A18` | Sidebar surface |
| `card` / `popover` | `#FDFBF8` / `#FFFDFA` | `#201F1C` / `#262522` | Tiles, sheets, menus |
| `foreground` | `#1F1E1C` charcoal | `#EFE9DE` sand | Text |
| `muted-foreground` | `#6B645A` | `#A49C8F` | Secondary text (≥ 4.7:1 everywhere) |
| `primary` | `#22211F` | `#ECE3D2` | Primary buttons, avatar |
| `hint` | `#2B5FC0` cobalt | `#8FB2F2` periwinkle | Links, focus, active nav icon, "Top match", good-tier ring |
| `success` / `warning` / `danger` (+ `-soft`) | moss / ochre / brick | lifted equivalents | Status, score tiers |

Depth: `shadow-tile` (tiles), `shadow-float` (sheets, menus, login field), `shadow-control` (pills, inputs).
Materials: `.material` (toolbar, sheet footer), `.material-popover` (menus, command menu).
Radius: tiles 22px, sheets 28px, list monograms 27% squircles, buttons and controls are pills.

### Blue budget
Allowed: focus rings, text links, the active-nav icon, "Top match" eyebrow, the good-tier score ring,
the Tailoring status, the command-menu selection, one pipeline segment. Not allowed: primary buttons,
headings, large fills, repeated icons down a list.

## Typography
Inter with optical sizing (`opsz` 14–32) — the closest free match to SF Pro. No uppercase micro-labels.

| Class | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `type-hero` | 36→56px | 620 | −0.036em | Home statement |
| `type-title` | 30→40px | 680 | −0.03em | Page large titles |
| `type-headline` | 21px | 620 | −0.018em | Tile titles |
| `type-eyebrow` | 13px | 600 | −0.003em | Sentence-case labels above titles |

Headlines are two-tone: a statement in `foreground`, then a softer follow-up in `muted-foreground`.
(Classes are `type-*`, not `text-*`, so `tailwind-merge` doesn't mistake them for colours and drop them.)

## Motion

Two families, never mixed up:

**UI motion (Emil Kowalski)** — fast and decisive, for things used all day.

| Element | Duration | Easing |
|---|---|---|
| Press | 160ms | `ease-out`, scale 0.97 (`.pressable`) |
| Menus, selects, tooltips | 160–180ms | `ease-out`, `animate-scale-in`, origin-aware |
| Hover / colour | 150ms | default |
| Segmented control thumb | 400ms | `ease-spring` |
| Command menu (⌘K), list keyboard nav | none | — |

**Showcase motion (Apple)** — slow and cinematic, plays once when content first appears.

| Element | How |
|---|---|
| Large titles | `WordReveal`: words rise out of a 12px blur, 70ms apart, 1000ms `ease-expo` |
| Sections and tiles | `Reveal`: rise 28px + unblur as they scroll in, 70ms stagger |
| Numbers | `CountUp`: roll up from zero (or from the old value when data arrives late) |
| Score rings | Draw in over 1.1–1.6s when first visible |
| Bars | `.grow-x` inside a `Reveal`: grow from the left in sequence |
| Route change | `.page-enter`: content settles in (560ms) |
| Toolbar | Transparent at top; frosted + hairline once content scrolls under; compact title fades in when the large title leaves |
| Sheets | iOS spring `cubic-bezier(0.32, 0.72, 0, 1)`, 460–520ms, blurred backdrop |
| Login | Icon pops in, headline reveals, aurora drifts slowly behind |
| Tiles (desktop) | `.spotlight`: soft highlight follows the pointer |

Rules: never `transition-all`; never `ease-in` on UI; never animate from `scale(0)`; hover transforms only
behind `@media (hover: hover)`; finished animations must not leave `transform`/`filter` on wrappers (it
traps fixed children). `prefers-reduced-motion` turns every showcase effect into a plain appearance.

All motion is CSS plus small hooks in `src/components/motion.tsx` — no animation library.

## Patterns
- **Inset grouped list** (iOS): one tile, rows separated by hairlines inset past the monogram.
- **Bento**: top match (tall) + pipeline + two metric tiles.
- **Stat strip**: big numbers separated by hairlines, no boxes.
- **Lanes**: board columns as soft wells; the hovered drop target turns hint-soft with a blue inset ring.

## Accessibility
Text ≥ 4.5:1 in both themes (verified), 2px blue focus rings on every control, `aria-label` on icon
buttons, status always has a text label, scores always show the number.
