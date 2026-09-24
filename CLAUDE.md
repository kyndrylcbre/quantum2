# Quantum 2.0 — working notes for Claude

Data Center Operations platform for CBRE (Kyndryl account context). React 18 + TS + Vite,
no UI framework. `npm run dev` → port 5180 (`.claude/launch.json` has a `quantum-dev` entry).

## Rules of this codebase

- **Design tokens only** — never hard-code colors in components. Everything themable lives in
  `src/styles/tokens.css` as CSS variables, defined per `[data-theme="light"]` and
  `[data-theme="dark"]`. Both themes must work for every new UI.
- **Chart colors**: use `--chart-1..4` in fixed order (green, blue, amber, plum) — the sets were
  computationally validated for CVD separation per theme. Status colors (`--status-*`) are
  reserved for state and always ship with a label/icon, never color alone. One y-axis per chart.
- **All data is dummy** and must stay deterministic: seeded PRNG in `src/data/rng.ts`, entity
  generators in `src/data/generate.ts`, memoized store in `src/data/index.ts`. Never use
  `Math.random()` in components. 10 imaginary sites live in `src/data/sites.ts`.
- **Global scope**: every module reads `siteId` from `useApp()` (`'all'` or a site id) and uses
  the `get*(siteId)` accessors. New modules must respect the site selector.
- **Module registry**: `src/modules.tsx` drives nav and stub pages. To build out a stubbed
  module: add a page in `src/pages/`, register it in the `BUILT` map in `App.tsx`.
- Integration story matters: every record shows its **system of record** (site's CMMS/BMS/DCIM
  from `sites.ts`) — keep that pattern when adding modules.

## Design standard

Tokens are now **real Emerald values** extracted from docs.emerald.cbre.com — see
`docs/emerald-integration.md` for sources, Artifactory install steps, and the deviation log.
Rules: Calibre (sans) for ALL text on enterprise surfaces — no serif headings; dark mode is
neutral gray (#1A1A1A family), not green-tinted; primary flips #003F2D (light) ↔ #17E88F (dark);
chart colors are Emerald data-vis cat-1…4 in fixed order. Sidebar stays CBRE green in light mode.

## Push-pull data flow

Read-only is not acceptable for workflow modules. Mutable entities (tickets, incidents,
alarms, rounds, handovers) live in `src/context/DataContext.tsx` — components read via
`useData()` + `scoped(arr, siteId)` and mutate via its actions. Every mutation raises a
sync event (pushing → confirmed) against the owning external system, surfaced by
`SyncTray` toasts and the Integrations activity feed. New writable features must follow
this pattern; never mutate the static store in `src/data`.

## Role-based views (personas)

`useApp().role` is `'ops' | 'executive'` (persisted as `qtm.role`), switched from the header
user chip (`src/components/UserMenu.tsx`). `App.tsx` swaps the whole route table per role and
`Sidebar.tsx` swaps the nav: ops = 13 modules + site selector; executive = `/executive` only.
The **Executive view** (`src/pages/ExecutiveView.tsx`) lists CBRE DCS clients from
`src/data/clients.ts` with health, weighted risk, incidents/outages, capex/opex project
spend, management fee/margin, and a fixed-order service matrix (M&E, Raised Floor, Projects,
E&S, Space Planning, Lease Admin). Scoring lives in `src/data/clientHealth.ts` — pure functions
over the live DataContext arrays; contract commercials come from `commercialsFor()` in
`generate.ts`. To add a client: append to `CLIENTS`; map `siteIds` for live-derived metrics or
leave empty for a deterministic synthetic snapshot ("Not yet onboarded"). Financial system of
record is CBRE Vantage Analytics. Role switching is a demo shortcut — production maps roles
from CBRE SSO groups.

## Chunk roadmap

Chunk 1 (done): shell, Dashboard, Monitoring, Birdseye, Ticketing, Integrations.
Chunk 2 (done): Capacity Planning, Operations Mgmt, Rounds & Shifts, Incidents, Assets,
read/write Ticketing + alarm ack + sync-event layer.
Chunk 3 (done): HSE, Risk Mgmt, Projects with capital planning derived from asset lifecycle
flags + maintenance spend (promote-to-project pushes to Autodesk Construction Cloud). All 13 modules are now built.
Chunk 4 (done, 2026-09-24): role-based shell + Executive view (client health list, 6 demo clients).
Next: agentic capex planning — prompt-driven plan of where spend goes with smart suggestions from
asset condition, maintenance history, alarms, and BMS/sensor data (Monitoring). Then the fuller
client roster for the Executive view, real Emerald token true-up, real API/MCP integration layer.

## Repo

GitHub: https://github.com/kyndrylcbre/quantum2.0 — commit and push when a chunk lands.
