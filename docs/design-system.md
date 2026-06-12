# Design System

`@vms/ui` is the component library; `@vms/tokens` is the single source of truth
for design tokens. Both are consumed by the frontend and rendered in Storybook.

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
`text-start`); tokens are direction‑agnostic. A JS mirror (`tokens.ts`) backs
Storybook docs.

Apps and Storybook both `@import "tailwindcss"; @import "@vms/tokens/theme.css";`
so they render identically.

## Components (`@vms/ui`)

Layered **foundations → primitives → components → patterns**, built on Radix UI /
React Aria and styled with `tailwind-variants`. Every export has a Storybook
story. Variant axes are standardized: `intent`, `tone`, `size`.

- **Foundations**: `cn` (clsx + tailwind‑merge), `tv` (tailwind‑variants), shared `Size`/`Intent`/`Tone` types.
- **Primitives (13)**: Button (incl. `accent`/gold intent), Input, Label, Select, **Checkbox**, Dialog, Tabs, Tooltip, Popover, Badge (incl. `accent`), Avatar, Spinner, Skeleton.
- **Components (16)**: Card, Alert, Table (incl. `striped` zebra rows), Pagination, Breadcrumbs, SearchInput, **SegmentedControl** (pill toggle, `default` + `onEmphasis`), Toast, EmptyState, StatCard, **StatStrip** (joined stat cells), **InboxCard** (Requests & Alerts feed card), **Timeline** (visit lifecycle stepper), StatusBadge (maps the contracts `VisitStatus` → display labels: Expected/Onsite/Checked Out/…), Drawer.
- **Patterns (9)**: AppShell (sidebar shell), **TopNav** + **TopNavShell** (the deep‑green top‑nav layout), **QuickActionsPanel** (gold‑CTA promo panel), PageHeader, FilterBar, DetailDrawer, RecordTable, AlertModal.

Pattern stories reconstruct the real VMC screens — the dashboard (top‑nav + stat
strip + visitor records), the Requests & Alerts inbox, the Visit Request Details
drawer, and the Flagged Visitor alert modal.

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

## Roadmap

`DataGrid` (TanStack Table) and token‑docs MDX pages (Colors/Typography/Spacing)
are planned additions.
