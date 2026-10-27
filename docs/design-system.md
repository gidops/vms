# Design system

**Who this is for:** frontend developers and designers. **What you'll learn:**
where colours and components come from, what exists today, and the rules for
adding to it.

`@vms/ui` is the component library; `@vms/tokens` is the single source of truth
for **design tokens** (named values for colours, type sizes, spacing and so on).
Both are used by the frontend and shown in **Storybook**, a workshop app that
renders each component on its own.

## Tokens (`@vms/tokens`)

Tailwind v4 **CSS‑first** (`@theme`), two tiers:

- **Primitive palette** — full scales: `teal` (primary), `brand` (deep
  Afreximbank green, for emphasis surfaces), `gold` (CTA accent), `orange`
  (warning), `green` (success), `red` (danger), `amber` (accent), `blue` (info),
  `neutral` (slate). Plus type scale, radii, elevation, z‑index.
- **Semantic tokens** — what components actually use, so theme/rebrand is a
  config change: `bg-canvas`, `bg-surface`, `text-fg` / `text-fg-muted`,
  `border`, `bg-primary` / `text-primary-fg`, `success`/`warning`/`danger`/`info`
  (+ `-subtle` / `-fg` variants), `ring`, plus **`emphasis`** /`-fg`/`-muted`/`-border`
  (deep‑green nav & promo surfaces) and **`accent`** /`-hover`/`-subtle`/`-fg` (gold CTA).

**Dark mode** swaps semantic values via `[data-theme="dark"]` on `<html>`
(attribute strategy, also exposed as the `dark:` variant). **RTL** is handled by
components using logical properties (`ms/me`, `ps/pe`, `start/end`,
`text-start`); tokens are direction‑agnostic. All tokens live in one file,
`packages/tokens/src/theme.css`.

Apps and Storybook both `@import "tailwindcss"; @import "@vms/tokens/theme.css";`
so they render identically.

## Components (`@vms/ui`)

Layered **foundations → primitives → components → patterns**, built on Radix UI /
React Aria and styled with `tailwind-variants`. Variant axes are standardized:
`intent`, `tone`, `size`. The public list is `packages/ui/src/index.ts`.

- **Foundations**: `cn` (clsx + tailwind‑merge), `tv` (tailwind‑variants),
  `contentContainer` (page width), shared `Size`/`Intent`/`Tone` types.
- **Primitives (15)**: Avatar, Badge, Button, Checkbox, Dialog, Input (also
  exports `PasswordInput`), Label, Popover, Select, Skeleton, Spinner, Switch,
  Tabs, Textarea, Tooltip.
- **Components (18)**: Alert, AreaChart, BarChart, Breadcrumbs, Card,
  DonutChart, Drawer, EmptyState, InboxCard (Requests & Alerts feed card),
  Pagination, RangeCalendar, SearchInput, SegmentedControl (pill toggle and
  required Yes/No question: `default` or `onEmphasis` variant, `primary` tone,
  `value={null}` for unanswered, `invalid`, `fullWidth`), StatCard,
  StatusBadge (maps the contracts `VisitStatus` to display labels), Table,
  Timeline (visit progress stepper), Toast.
- **Patterns (9)**: AlertModal, AuthLayout, DetailDrawer, FilterBar,
  PrintSheet (paper-only content, see below), RecordTable, SideNav, TopNav,
  TopNavShell (the deep‑green top‑nav layout).

### Printing

Anything printed (the evacuation roll, the walk-in QR poster, access cards) is
wrapped in `<PrintSheet>`. It is hidden on screen; while printing it is the
only thing on the page, so menus and dialogs never reach the paper. The rules
live in `@vms/ui/print.css` (imported by the app's `globals.css` and by
Storybook), which also defines the A4 page and a card-sized `cr80` page.
Colours come from the print tokens `--color-print-ink`, `--color-print-paper`,
`--color-print-rule` and `--color-print-band`, which stay black on white in
dark mode. Each view keeps its own layout in a CSS module next to it, e.g.
`EvacuationRollPrint.module.css`.

Most exports have a Storybook story next to them. **Label** and **Drawer** do
not have their own story yet; `PasswordInput` is shown in the Input story.

Pattern stories rebuild parts of the real screens, such as the top‑nav layout,
the visitor records table, the detail drawer and the flagged visitor alert
modal.

## Storybook

```bash
npm run storybook -w @vms/ui          # dev server (port 6006)
npm run build-storybook -w @vms/ui    # static build (also a CI gate)
```

Storybook 9 + `@storybook/react-vite`, with addons: **a11y** (axe per story),
**themes** (light/dark via `data-theme` + LTR/RTL via `dir` toolbar toggles).

## Conventions

- Components reference **semantic tokens only** (never raw palette).
- Co‑located files: `Component.tsx`, `Component.variants.ts`, `Component.stories.tsx`.
- Status/lifecycle values come from `@vms/contracts` so the UI can't render a
  state the backend doesn't define.

- New screens follow the staff and VMC dashboard patterns (top nav, overview
  band, record table).
- Components consumed by the frontend as TypeScript source use
  **extensionless** relative imports.
