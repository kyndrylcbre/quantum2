/* Executive-view client health model. Pure functions over the live DataContext arrays
   (risks / incidents / projects) plus static site data — no React, no randomness beyond
   the deterministic generators. Reused by the executive view; intended for capex planning next. */
import { commercialsFor, syntheticFootprintFor } from './generate'
import { siteById } from './sites'
import type {
  Client, ClientCommercials, Incident, Project, Risk, RiskOwner, Site,
} from './types'

export type HealthBand = 'Healthy' | 'Watch' | 'At risk'
export type RiskBand = 'Low' | 'Medium' | 'High' | 'Critical'
export type Tone = 'good' | 'warn' | 'serious' | 'critical' | 'info' | 'neutral'

/** Ownership weight — CBRE carries the exposure on risks it owns. */
export const OWNER_WEIGHT: Record<RiskOwner, number> = { CBRE: 1, Shared: 0.75, Client: 0.5 }

/** Health composite weights (sum to 1). Surfaced in the UI footnote — keep in sync. */
export const HEALTH_WEIGHTS = { risk: 0.35, incidents: 0.30, margin: 0.20, delivery: 0.15 } as const

const INCIDENT_WINDOW_DAYS = 90

export interface ClientSnapshot {
  client: Client
  /** true when the client's footprint is mapped to Quantum sites (live-derived metrics). */
  onboarded: boolean
  sites: Site[]
  siteCount: number
  itLoadMW: number
  commercials: ClientCommercials
  risk: {
    live: number
    high: number // L×I ≥ 10
    weighted: number // Σ L×I×ownerWeight across live risks
    perSite: number
    band: RiskBand
    tone: Tone
    byOwner: Record<RiskOwner, number>
    top: Risk[]
  }
  incidents: {
    total90d: number
    sev1: number // outages — customer-impacting
    sev2: number
    active: number
    mttrMin: number
    recent: Incident[]
  }
  projects: {
    capexBudget: number
    capexSpent: number
    opexBudget: number
    opexSpent: number
    inFlight: number
    overBudget: number
    onHold: number
    total: number
    list: Project[]
  }
  health: {
    score: number // 0–100, higher is better
    band: HealthBand
    tone: Tone
    drivers: string[] // plain-language reasons, worst first
  }
}

export interface HealthInputs {
  risks: Risk[]
  incidents: Incident[]
  projects: Project[]
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export const riskBand = (perSite: number): { band: RiskBand; tone: Tone } =>
  perSite >= 45 ? { band: 'Critical', tone: 'critical' }
  : perSite >= 35 ? { band: 'High', tone: 'serious' }
  : perSite >= 25 ? { band: 'Medium', tone: 'warn' }
  : { band: 'Low', tone: 'good' }

export const healthBand = (score: number): { band: HealthBand; tone: Tone } =>
  score >= 70 ? { band: 'Healthy', tone: 'good' }
  : score >= 55 ? { band: 'Watch', tone: 'warn' }
  : { band: 'At risk', tone: 'critical' }

/** Build the executive snapshot for one client. */
export function snapshotFor(client: Client, data: HealthInputs): ClientSnapshot {
  const sites = client.siteIds.map(siteById).filter((s): s is Site => Boolean(s))
  return sites.length > 0 ? liveSnapshot(client, sites, data) : syntheticSnapshot(client)
}

export const snapshotsFor = (clients: Client[], data: HealthInputs): ClientSnapshot[] =>
  clients.map(c => snapshotFor(c, data))

/* ------------------------------------------------------------------ */

function liveSnapshot(client: Client, sites: Site[], data: HealthInputs): ClientSnapshot {
  const ids = new Set(sites.map(s => s.id))
  const risks = data.risks.filter(r => ids.has(r.siteId))
  const incidents = data.incidents.filter(i => ids.has(i.siteId))
  const projects = data.projects.filter(p => ids.has(p.siteId))
  const siteCount = sites.length

  /* risk */
  const live = risks.filter(r => r.status !== 'Closed')
  const byOwner: Record<RiskOwner, number> = { CBRE: 0, Shared: 0, Client: 0 }
  let weighted = 0
  for (const r of live) {
    byOwner[r.owner] += 1
    weighted += r.likelihood * r.impact * OWNER_WEIGHT[r.owner]
  }
  weighted = Math.round(weighted)
  const perSite = Math.round(weighted / siteCount)
  const high = live.filter(r => r.likelihood * r.impact >= 10).length
  const top = [...live].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact).slice(0, 3)

  /* incidents */
  const recentWindow = incidents.filter(i => i.startedDaysAgo <= INCIDENT_WINDOW_DAYS)
  const sev1 = recentWindow.filter(i => i.severity === 'SEV1').length
  const sev2 = recentWindow.filter(i => i.severity === 'SEV2').length
  const active = incidents.filter(i => i.status === 'Active' || i.status === 'Monitoring').length
  const closed = recentWindow.filter(i => i.status === 'Closed')
  const mttrMin = closed.length ? Math.round(closed.reduce((s, i) => s + i.durationMin, 0) / closed.length) : 0
  const recent = [...incidents].sort((a, b) => a.startedDaysAgo - b.startedDaysAgo).slice(0, 4)

  /* projects */
  const sum = (arr: Project[], k: 'budgetUSD' | 'spentUSD') => arr.reduce((s, p) => s + p[k], 0)
  const capex = projects.filter(p => p.type === 'Capex')
  const opex = projects.filter(p => p.type === 'Opex')
  const overBudget = projects.filter(p => p.spentUSD > p.budgetUSD).length
  const onHold = projects.filter(p => p.status === 'On Hold').length
  const inFlight = projects.filter(p => p.status === 'In Flight').length

  /* commercials */
  const managedSpend = sites.reduce((s, x) => s + x.monthlyOpexUSD * 12, 0)
  const commercials = commercialsFor(client, managedSpend)

  const health = scoreHealth({
    perSite, sev1PerSite: sev1 / siteCount, sev2PerSite: sev2 / siteCount, active,
    marginGap: commercials.targetMarginPct - commercials.actualMarginPct,
    overBudget, onHold, totalProjects: projects.length, high, siteCount,
  })

  return {
    client,
    onboarded: true,
    sites,
    siteCount,
    itLoadMW: +sites.reduce((s, x) => s + x.itLoadMW, 0).toFixed(1),
    commercials,
    risk: { live: live.length, high, weighted, perSite, ...riskBand(perSite), byOwner, top },
    incidents: { total90d: recentWindow.length, sev1, sev2, active, mttrMin, recent },
    projects: {
      capexBudget: sum(capex, 'budgetUSD'), capexSpent: sum(capex, 'spentUSD'),
      opexBudget: sum(opex, 'budgetUSD'), opexSpent: sum(opex, 'spentUSD'),
      inFlight, overBudget, onHold, total: projects.length,
      list: [...projects].sort((a, b) => b.budgetUSD - a.budgetUSD),
    },
    health,
  }
}

function syntheticSnapshot(client: Client): ClientSnapshot {
  const f = syntheticFootprintFor(client)
  const commercials = commercialsFor(client, f.annualOpexUSD)
  const perSite = Math.round(f.weightedRisk / f.sites)
  const health = scoreHealth({
    perSite, sev1PerSite: f.sev1 / f.sites, sev2PerSite: (f.incidents90d - f.sev1) * 0.4 / f.sites, active: f.active,
    marginGap: commercials.targetMarginPct - commercials.actualMarginPct,
    overBudget: f.projectsOverBudget, onHold: f.onHold, totalProjects: f.projectsInFlight + 2,
    high: f.highRisks, siteCount: f.sites,
  })
  return {
    client,
    onboarded: false,
    sites: [],
    siteCount: f.sites,
    itLoadMW: f.itLoadMW,
    commercials,
    risk: {
      live: f.liveRisks, high: f.highRisks, weighted: f.weightedRisk, perSite, ...riskBand(perSite),
      byOwner: { CBRE: Math.round(f.liveRisks * 0.45), Shared: Math.round(f.liveRisks * 0.25), Client: f.liveRisks - Math.round(f.liveRisks * 0.45) - Math.round(f.liveRisks * 0.25) },
      top: [],
    },
    incidents: { total90d: f.incidents90d, sev1: f.sev1, sev2: Math.round((f.incidents90d - f.sev1) * 0.4), active: f.active, mttrMin: 0, recent: [] },
    projects: {
      capexBudget: f.capexBudget, capexSpent: f.capexSpent, opexBudget: f.opexBudget, opexSpent: f.opexSpent,
      inFlight: f.projectsInFlight, overBudget: f.projectsOverBudget, onHold: f.onHold,
      total: f.projectsInFlight + 2, list: [],
    },
    health,
  }
}

/* ------------------------------ scoring ---------------------------- */

interface HealthFactors {
  perSite: number
  sev1PerSite: number
  sev2PerSite: number
  active: number
  marginGap: number // target − actual, in margin points
  overBudget: number
  onHold: number
  totalProjects: number
  high: number
  siteCount: number
}

function scoreHealth(f: HealthFactors): ClientSnapshot['health'] {
  // Each penalty is 0 (clean) → 1 (worst plausible in the demo data).
  const risk = clamp01((f.perSite - 15) / 45)
  const incidents = clamp01(f.sev1PerSite * 0.5 + f.sev2PerSite * 0.15 + f.active * 0.15)
  const margin = clamp01(f.marginGap / 6)
  const delivery = clamp01(((f.overBudget + f.onHold) / Math.max(1, f.totalProjects)) * 2)

  const penalty =
    HEALTH_WEIGHTS.risk * risk + HEALTH_WEIGHTS.incidents * incidents +
    HEALTH_WEIGHTS.margin * margin + HEALTH_WEIGHTS.delivery * delivery
  const score = Math.round(100 * (1 - penalty))

  // Drivers, worst contribution first.
  const contributions: [number, string][] = [
    [HEALTH_WEIGHTS.risk * risk, `Weighted risk ${riskBand(f.perSite).band.toLowerCase()} — ${f.perSite} per site, ${f.high} high-scoring`],
    [HEALTH_WEIGHTS.incidents * incidents,
      f.sev1PerSite * f.siteCount >= 1
        ? `${Math.round(f.sev1PerSite * f.siteCount)} SEV1 outage${Math.round(f.sev1PerSite * f.siteCount) === 1 ? '' : 's'} in 90 days${f.active ? ` · ${f.active} active now` : ''}`
        : f.active ? `${f.active} incident${f.active === 1 ? '' : 's'} active now` : `${Math.round(f.sev2PerSite * f.siteCount)} SEV2 in 90 days, no outages`],
    [HEALTH_WEIGHTS.margin * margin,
      f.marginGap > 0.5 ? `Margin ${f.marginGap.toFixed(1)} pts under target` : `Margin on or above target`],
    [HEALTH_WEIGHTS.delivery * delivery,
      f.overBudget + f.onHold > 0
        ? `${f.overBudget} project${f.overBudget === 1 ? '' : 's'} over budget · ${f.onHold} on hold`
        : 'Projects on budget and moving'],
  ]
  const drivers = contributions.sort((a, b) => b[0] - a[0]).map(c => c[1])

  return { score, ...healthBand(score), drivers }
}
