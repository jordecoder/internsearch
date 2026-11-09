# Intern Scout — Design System (MASTER)

Global source of truth for UI decisions. Page-specific overrides go in `pages/<page>.md`.
Built with the UI UX Pro Max workflow (Job Board / Recruitment profile: flat + minimal/Swiss, professional blue as the trust colour) and Emil Kowalski's design-engineering motion rules.

## Direction

**Charcoal & Sand.** Calm, warm, paper-like. Charcoal ink on sand, with a cobalt blue used only as a *hint*: focus, links, active indicators, info. Nothing glows, nothing is neon.

**Dark mode — "Graphite & Sand".** Warm graphite surfaces (not black), sand text, periwinkle blue hints. No pure black, no green accent.

## Tokens

All colours live as CSS variables in `frontend/src/index.css` and are exposed through Tailwind. Components must use tokens only — never raw hex or Tailwind palette colours (`emerald-500`, `blue-700`, etc.).

| Token (Tailwind) | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F3EEE4` sand | `#1C1B19` graphite | Page |
| `foreground` | `#262523` charcoal | `#ECE5D7` sand | Body text |
| `card` / `popover` | `#FAF7F1` / `#FCFAF6` | `#242320` / `#292825` | Raised surfaces |
| `primary` | `#2B2A27` charcoal | `#E6DCC8` sand | Primary buttons, strong emphasis |
| `secondary`, `muted`, `accent` | sand tints | graphite tints | Quiet fills, hover surfaces |
| `muted-foreground` | `#6A6358` | `#A69E90` | Secondary text (≥ 4.7:1) |
| `border` / `input` | `#DCD3C3` / `#D3C9B7` | `#36342F` / `#3D3A35` | Hairlines |
| `hint` | `#2F5EA8` cobalt | `#8FB0EA` periwinkle | Links, focus ring, active nav marker, info icons |
| `hint-soft` + `hint-soft-foreground` | `#E3EAF5` / `#24497F` | `#24304A` / `#A9C2F0` | Info badges, selected rows |
| `success` + `success-soft` | moss `#3F6B3A` | `#9CC18F` | Offers, strong match |
| `warning` + `warning-soft` | ochre `#8A5A10` | `#E0B56A` | Interviewing, mid match, notices |
| `danger` + `danger-soft` | brick `#A8352A` | `#E58A7E` | Rejected, errors |
| `ring` | = `hint` | = `hint` | Focus rings |

Soft badge recipe: `bg-<tone>-soft text-<tone> border-<tone>/25` (e.g. `bg-warning-soft text-warning border-warning/25`). For blue: `bg-hint-soft text-hint-soft-foreground border-hint/25`.

### Blue usage budget
Blue is the accent, not the brand fill. Allowed: focus rings, text links, the active-nav indicator, info badges/icons, one data series in charts, the "tailoring" status. Not allowed: large blue backgrounds, primary buttons, headings.

## Typography
Unchanged: Plus Jakarta Sans (display) + Inter (body). Base 14–16px, line-height ≥ 1.5 for prose, no body text under 12px.

## Motion (Emil Kowalski rules)

Tokens: `ease-out` = `cubic-bezier(0.23,1,0.32,1)`, `ease-in-out` = `cubic-bezier(0.77,0,0.175,1)`, `ease-drawer` = `cubic-bezier(0.32,0.72,0,1)`. Durations `duration-120/160/180/250` added.

| Element | Duration | Easing |
|---|---|---|
| Button press | 160ms | `ease-out`, `active:scale-[0.97]` (or `.pressable`) |
| Tooltip / small popover | 120–160ms | `ease-out`, `animate-scale-in`, origin-aware |
| Dropdown / select | 160–200ms | `ease-out`, `animate-scale-in`, origin-aware |
| Sheet / drawer | 250–300ms | `ease-drawer` |
| Hover / colour change | 150ms | default `transition-colors` |
| Content entrance | 220ms | `animate-fade-up` (6px), stagger 30–60ms max |

Rules:
- Never `transition-all` — name the properties.
- Never `ease-in` on UI. Never animate from `scale(0)` — start at 0.95–0.97 with opacity.
- Popovers scale from their trigger: `origin-[var(--radix-dropdown-menu-content-transform-origin)]` (Radix exposes `--radix-<component>-content-transform-origin` for dropdown-menu, select, tooltip, popover). Modals stay centred.
- No animation on keyboard-triggered or 100+/day actions (command menu open, list keyboard nav).
- Exit faster than enter.
- Hover transforms gated behind `@media (hover: hover)`; colour-only hovers are fine.
- `prefers-reduced-motion` is handled globally in `index.css`.

## Accessibility checklist
- Text contrast ≥ 4.5:1 (all token pairs verified), focus ring visible (blue, 2px), icon-only buttons have `aria-label`, don't convey status by colour alone (keep the text label).
