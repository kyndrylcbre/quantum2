# Quantum 2.0 — CBRE Data Center Operations Platform

A single platform for CBRE's Data Center Ops business to run daily operations globally.
**Integration-first by design**: clients arrive with wildly different stacks (DCIM, BMS/BAS,
CMMS, ITSM), so every module is built to connect to third-party systems — CBRE-internal and
client-side — over REST APIs and MCP.

Currently running on **dummy data for 10 imaginary pilot sites** across Americas, EMEA, and APAC.

## Run it

```bash
npm install
npm run dev
```

Dev server: http://localhost:5180

## Stack

- React 18 + TypeScript + Vite
- react-router-dom (hash routing), Recharts
- No UI framework — custom design-token layer approximating the CBRE Emerald design system
  (light corporate theme + dark ops-console theme, toggle in the top bar)

## Module roadmap (built in chunks)

| Module | Chunk | Status |
|---|---|---|
| Dashboard | 1 | ✅ Built — portfolio KPIs, load/PUE trends, WO volumes, incident feed, site health table |
| Monitoring | 1 | ✅ Built — BMS/BAS telemetry, alarm feed **with write-back acknowledge**, equipment status |
| Birdseye | 1 | ✅ Built — interactive 2D raised-floor SVG (racks + mechanical), status/temp/power overlays |
| Ticketing | 1 | ✅ Built — **read/write**: create WOs, status transitions, reassignment — all pushed to the CMMS of record |
| Integrations | 1 | ✅ Built — connection registry + live push/pull activity feed for the session |
| Capacity Planning | 2 | ✅ Built — headroom by site/hall, stranded capacity, rebalance suggestions with push-to-DCIM |
| Operations Mgmt | 2 | ✅ Built — FTE by site, hard/soft cost split (raised floor vs M&E), service matrix |
| Rounds & Shifts | 2 | ✅ Built — rounds checklists with reading capture, shift handover publish/acknowledge |
| Incidents | 2 | ✅ Built — SEV1–4 board, severity-based notification matrix, editable in-tool RCA |
| Assets | 2 | ✅ Built — registry with condition/age, lifecycle flags, maintenance history |
| HSE | 3 | ✅ Built — log/close observations, near misses, incidents; recordables tracking |
| Risk Mgmt | 3 | ✅ Built — living register, 5×5 heat matrix, CBRE/Client/Shared ownership, review cadence |
| Projects | 3 | ✅ Built — Kahua-synced opex/capex delivery + capital candidates auto-derived from asset lifecycle flags, promote-to-project |

### Push-pull, not read-only

Mutable entities live in a client-side store (`src/context/DataContext.tsx`). Every mutation
(create WO, ack alarm, log reading, publish handover, save RCA) raises a **sync event** against
the owning external system — visible as a toast and in the Integrations activity feed. In
production these events become API/MCP calls with returned references reconciled both ways.

## Layout of the code

```
src/
  styles/        tokens.css (CBRE design tokens, both themes), base.css, shell.css
  data/          types.ts, sites.ts (the 10 sites), generate.ts (seeded generators), index.ts (store)
  context/       AppContext (global site scope + theme)
  components/    Sidebar, TopBar, ui.tsx (Card/StatTile/Badge/Segmented), charts.tsx, Icons
  pages/         Dashboard, Monitoring, Birdseye, Ticketing, Integrations, Stub
  modules.tsx    module registry (nav, chunks, planned integrations)
```

All dummy data is generated deterministically (seeded PRNG) so numbers are stable across
reloads. The global site selector ("All sites" or any one site) scopes every module.

## Design notes

- Brand tokens approximate CBRE Emerald from public brand standards (`#003F2D` green,
  `#17E88F` accent, Financier/Calibre type stacks with fallbacks). Refine against
  https://docs.emerald.cbre.com once SSO access is arranged.
- Chart palettes were validated for colorblind separation, lightness band, chroma, and
  contrast in **both** themes (light: `#00915B #2F7FC1 #B2790C #A34B85`,
  dark: `#00A870 #4A90D9 #BC8A00 #B05589`).
