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
`Sidebar.tsx` swaps the nav: ops = 14 modules + site selector; executive = **Summary**
(`/executive`, `src/pages/ExecutiveSummary.tsx`) plus one nav entry per DCS account (worst health
first, score pill) opening a **client dashboard** (`/executive/:clientId`,
`src/pages/ClientDashboard.tsx`). The summary is the holistic organization view: commercial and
operational KPI rows, an attention feed, margin/fee chart, account scorecards (a responsive card
grid — no wide tables on exec pages), a service coverage matrix and regional footprint. Exec pages
are wrapped in `.exec-page`, whose responsive rules live at the bottom of `executive.css`. The client dashboard covers health, weighted risk,
incidents/outages, margin, contract & services, drivers and top risks, spend, IT-load trend by
site, the planner's capital outlook, and the sites under contract with systems of record. Clients
come from `src/data/clients.ts`; scoring lives in `src/data/clientHealth.ts` (pure functions over
the live DataContext arrays); contract commercials come from `commercialsFor()` in `generate.ts`;
shared exec UI bits are in `src/components/exec.tsx`. To add a client: append to `CLIENTS`; map
`siteIds` for live-derived metrics or leave empty for a deterministic synthetic snapshot ("Not yet
onboarded"). Financial system of record is CBRE Vantage Analytics. Role switching is a demo
shortcut — production maps roles from CBRE SSO groups.

## Agentic capital planning

`/capital` (`src/pages/CapitalPlanning.tsx`) is a prompt-driven planner. The engine is pure and
deterministic in `src/data/capexPlanner.ts`: `interpretPrompt()` reads horizon, budget envelope
(per-year or total), budget cuts, priority (resilience / efficiency / compliance / cost), deferral,
scope (client name, site code or city) and asset classes from free text; `buildPlan()` scores every
major M&E asset on condition 30% · age vs design life 20% · maintenance history 20% · BMS alarms &
equipment state 20% · whitespace telemetry + linked risks + reactive WOs 10%, picks an intervention
(Replace / Refurbish / Extend life / Monitor), assigns a natural year and levels against the envelope.
Alarms match assets via `source` ("CRAH-03" → `<site>-crah-3`), tickets via `asset`, risks via
category → asset-class map. The page streams the plan steps (pull steps raise sync events) and offers
"Ask the planner" follow-ups answered from the same evidence. Plan parameters and Accept / Defer /
Dismiss decisions live in DataContext (`capexPlan`, `capexDecisions`); Accept calls `addProject`,
which pushes to Autodesk Construction Cloud and drops the asset from the open plan. The `Planner`
inputs/outputs are the seam for a real Claude/MCP-backed planner later — no LLM is called today.

## Chunk roadmap

Chunk 1 (done): shell, Dashboard, Monitoring, Birdseye, Ticketing, Integrations.
Chunk 2 (done): Capacity Planning, Operations Mgmt, Rounds & Shifts, Incidents, Assets,
read/write Ticketing + alarm ack + sync-event layer.
Chunk 3 (done): HSE, Risk Mgmt, Projects with capital planning derived from asset lifecycle
flags + maintenance spend (promote-to-project pushes to Autodesk Construction Cloud). All 13 modules are now built.
Chunk 4 (done, 2026-09-24): role-based shell + Executive view (client health list, 6 demo clients).
Chunk 5 (done, 2026-09-24): agentic Capital Planning module (see above); Executive view
restructured into Summary + per-client dashboards with the client list in the sidebar.
Next: fuller client roster for the Executive view, real Emerald token true-up, real API/MCP
integration layer (first candidate: swap the rules planner for a Claude/MCP planner behind the
same `buildPlan` inputs).

## Repo

GitHub: https://github.com/kyndrylcbre/quantum2.0 — commit and push when a chunk lands.
