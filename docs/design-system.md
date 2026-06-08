# Design System

`@vms/ui` is the component library; `@vms/tokens` is the single source of truth
for design tokens. Both are consumed by the frontend and rendered in Storybook.

## Tokens (`@vms/tokens`)

Tailwind v4 **CSS‑first** (`@theme`), two tiers:

- **Primitive palette** — full scales: `teal` (brand/primary), `orange`
  (warning), `green` (success), `red` (danger), `amber` (accent), `blue` (info),
  `neutral` (slate). Plus type scale, radii, elevation, z‑index.
- **Semantic tokens** — what components actually use, so theme/rebrand is a
  config change: `bg-canvas`, `bg-surface`, `text-fg` / `text-fg-muted`,
  `border`, `bg-primary` / `text-primary-fg`, `success`/`warning`/`danger`/`info`
  (+ `-subtle` / `-fg` variants), `ring`.

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
- **Primitives (12)**: Button, Input, Label, Select, Dialog, Tabs, Tooltip, Popover, Badge, Avatar, Spinner, Skeleton.
- **Components (13)**: Card, Alert, Table, Pagination, Breadcrumbs, SearchInput, Toast, EmptyState, StatCard, **Timeline** (visit lifecycle stepper), StatusBadge (maps the contracts `VisitStatus`), Drawer.
- **Patterns (6)**: AppShell (topbar + sidebar), PageHeader, FilterBar, DetailDrawer, RecordTable, AlertModal.

Pattern stories reconstruct the real VMC screens — dashboard, Visit Request
Details drawer, and the Flagged Visitor alert modal.

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
