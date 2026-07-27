# Emerald design system — integration notes

Extracted from docs.emerald.cbre.com (SSO) on 2026-07-27. `src/styles/tokens.css` now uses
these real values; Emerald token names are inline as comments there.

## Key facts

- **React is first-class.** Emerald ships Enterprise UI for **React** (`@emerald-react/*`),
  React MUI, and Angular. Our React choice is fully supported.
- **Typography rule:** Calibre for headings *and* body on **enterprise** experiences.
  Financier Display is reserved for **branded/marketing** surfaces. (We switched our
  headings from serif to Calibre accordingly.)
- **Dark mode is neutral gray** (#1A1A1A / #282828 / #353535), not green-tinted.
  Primary flips from `@cbre-green #003F2D` (light) to `@accent-green #17E88F` (dark);
  dark-mode focus rings use `@light-blue #C8D1D3`.
- **Data-viz categorical order (cat-1…4):** blue `#6484C8`, teal `#205A60`,
  green `#4C9E8C`, velvet `#885073` (light) / `#7D97D9 #287077 #80B8AD #A15D80` (dark).
  14 categorical slots exist; sequential ramps are shared across modes.

## Installing the real packages (requires Artifactory access)

Packages live on **CBRE JFrog Artifactory**, not public npm — that's why
`npm install @emerald-react/design-system` 404s without setup.

1. Log in: https://us.artifactory.gcso.cbre.com/ui/login/
   (no access → ServiceNow request to the `gcso-artifactory` team)
2. Profile → **Generate an Identity Token**, then base64-encode it:
   `printf 'your_email@cbre.com:IDENTITY_TOKEN' | base64`
   (Emerald docs say to base64 the token; some Artifactory setups want `email:token` —
   try token-only first if auth fails)
3. Add to `.npmrc` in this project (already partially staged below) and set auth:

```
@emerald:registry=https://us.artifactory.gcso.cbre.com/artifactory/api/npm/devx-npm-nonprod-virtual/
@emerald-react:registry=https://us.artifactory.gcso.cbre.com/artifactory/api/npm/devx-npm-nonprod-virtual/
@emerald-angular:registry=https://us.artifactory.gcso.cbre.com/artifactory/api/npm/devx-npm-nonprod-virtual/
```

```bash
npm config set //us.artifactory.gcso.cbre.com/artifactory/api/npm/devx-npm-nonprod-virtual/:username=brad.hauser@cbre.com --location=user
npm config set //us.artifactory.gcso.cbre.com/artifactory/api/npm/devx-npm-nonprod-virtual/:email=brad.hauser@cbre.com --location=user
npm config set //us.artifactory.gcso.cbre.com/artifactory/api/npm/devx-npm-nonprod-virtual/:_password=BASE64_IDENTITY_TOKEN --location=user
```

4. Then: `npm install '@emerald-react/design-system@latest'` and import
   `@emerald/style/_index.css` — this also brings the real **Calibre font files**
   (until then our stack falls back to system sans).

Support: EmeraldEngineering@cbre.com

## Deviation log

- Emerald has no "serious" semantic step; ours maps to `@orange800/@orange400`.
- Info-text light `#5C5CC5` is a darkened `@info-500 #7979DD` for badge contrast.
- Sidebar stays CBRE green in light mode (brand anchor); Emerald's own chrome is white.
- Emerald cat colors are more muted than our previous validated palette; they pass CVD
  separation strongly (ΔE 13–17) and we keep legends + tooltips + mark gaps as relief
  for the low-chroma/dark-contrast edge cases.
