/* Agentic capital planner — deterministic, evidence-driven, pure functions.

   The "agent" here is a rules-based interpreter + scorer that reads the same data the
   modules already surface (CMMS asset registry & maintenance history, BMS alarms & equipment
   state, DCIM rack telemetry, the risk register, open work orders) and allocates spend across
   a multi-year envelope. It streams its reasoning as steps so the operator can see *why*.
   The `Planner` shape is intentionally the seam where a real Claude/MCP-backed planner slots
   in later: same inputs, same Recommendation/CapexPlan outputs. */
import { CLIENTS } from './clients'
import { REPLACEMENT_COST } from './generate'
import { SITES } from './sites'
import type {
  Alarm, CapexDecisionRecord, CapexIntervention, CapexPlanParams, CapexPriority, Client,
  EquipKind, MaintenanceEntry, MechEquipment, Project, Rack, Risk, Site, Ticket,
} from './types'

export const THIS_YEAR = 2026
export const DEFAULT_HORIZON = 5

/** Design life by asset class (years) — industry-typical, used for the age factor. */
export const EXPECTED_LIFE: Record<EquipKind, number> = {
  UPS: 13, Chiller: 20, CRAH: 15, CRAC: 15, Generator: 25, PDU: 18, Switchgear: 25,
}

export type FactorKey = 'condition' | 'age' | 'maintenance' | 'monitoring' | 'context'
export const FACTOR_WEIGHTS: Record<FactorKey, number> = {
  condition: 0.30, age: 0.20, maintenance: 0.20, monitoring: 0.20, context: 0.10,
}
export const FACTOR_META: Record<FactorKey, { label: string; source: string }> = {
  condition: { label: 'Condition score', source: 'CMMS registry' },
  age: { label: 'Age vs design life', source: 'CMMS registry' },
  maintenance: { label: 'Maintenance history', source: 'CMMS work history' },
  monitoring: { label: 'Alarms & equipment state', source: 'BMS / monitoring' },
  context: { label: 'Whitespace, risks & WOs', source: 'DCIM · risk register · tickets' },
}

/** Condition 1–5 → urgency contribution. Poor (2) counts heavily; good (4) barely registers. */
const CONDITION_SCORE: Record<number, number> = { 1: 1, 2: 0.95, 3: 0.55, 4: 0.2, 5: 0 }

const POWER_KINDS: EquipKind[] = ['UPS', 'Generator', 'Switchgear', 'PDU']
const COOLING_KINDS: EquipKind[] = ['Chiller', 'CRAH', 'CRAC']
const RISK_KINDS: Record<string, EquipKind[]> = {
  'Power resilience': POWER_KINDS,
  'Cooling resilience': COOLING_KINDS,
  'Single point of failure': ['Chiller', 'Switchgear', 'UPS'],
  'Water / leak': ['CRAH', 'Chiller'],
}

export interface EvidenceFactor {
  key: FactorKey
  label: string
  source: string
  score: number // 0..1
  weight: number
  detail: string
}

export interface Recommendation {
  asset: MechEquipment
  site: Site
  client?: Client
  urgency: number // 0..100 after priority adjustment
  baseUrgency: number
  factors: EvidenceFactor[]
  intervention: CapexIntervention
  costUSD: number
  naturalYear: number
  year: number
  deferredByEnvelope: number
  /** Live critical signal (fault state / unacknowledged critical alarm) pulled the item into the current year. */
  pulledForward: boolean
  evidence: string[]
  rationale: string
  alarms: Alarm[]
  history: MaintenanceEntry[]
  tickets: Ticket[]
  risks: Risk[]
  hallRacks: number
  hallHotRacks: number
  hallLoadPct: number
  alreadyPlanned?: Project
  decision?: CapexDecisionRecord
}

export interface PlanStep {
  id: string
  title: string
  detail: string
  system: string
  kind: 'interpret' | 'pull' | 'compute' | 'result'
}

export interface YearBucket {
  year: number
  total: number
  envelope: number | null
  over: number
  count: number
  byIntervention: Record<CapexIntervention, number>
}

export interface CapexPlan {
  params: CapexPlanParams
  scopeSites: Site[]
  recs: Recommendation[] // in plan (not Monitor, not dismissed), sorted year asc then urgency desc
  monitorOnly: Recommendation[]
  dismissed: Recommendation[]
  alreadyPlanned: Recommendation[]
  byYear: YearBucket[]
  totals: {
    assetsAssessed: number
    planned: number
    plannedCount: number
    overEnvelope: number
    signals: { alarms: number; cm: number; hotRacks: number; risks: number; tickets: number }
  }
  steps: PlanStep[]
  narrative: string
}

export interface PlannerInputs {
  sites: Site[]
  equipment: MechEquipment[]
  alarms: Alarm[]
  tickets: Ticket[]
  risks: Risk[]
  projects: Project[]
  racks: Rack[]
  history: (equipId: string) => MaintenanceEntry[]
  decisions: Record<string, CapexDecisionRecord>
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export const fmtUSD = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : `$${Math.round(n / 1000)}k`

/* ------------------------------------------------------------------ */
/* Prompt interpretation                                                */
/* ------------------------------------------------------------------ */

const CITY_TO_SITE: [RegExp, string][] = [
  [/ashburn|ash1/i, 'ash1'], [/phoenix|phx1/i, 'phx1'], [/toronto|tor1/i, 'tor1'],
  [/s[aã]o paulo|sao1/i, 'sao1'], [/slough|london|lon1/i, 'lon1'], [/frankfurt|fra1/i, 'fra1'],
  [/dublin|dub1/i, 'dub1'], [/singapore|sin1/i, 'sin1'], [/tokyo|tok1/i, 'tok1'], [/sydney|syd1/i, 'syd1'],
]

export function defaultParams(prompt = ''): CapexPlanParams {
  return {
    prompt, startYear: THIS_YEAR, horizonYears: DEFAULT_HORIZON, envelopePerYearUSD: null,
    budgetCutPct: 0, priority: 'balanced', deferNonCritical: false, siteIds: null, clientId: null,
    kinds: null, understood: [], runAt: 0,
  }
}

/** Deterministic interpretation of an operator prompt into plan parameters. */
export function interpretPrompt(prompt: string, runAt: number): CapexPlanParams {
  const p = defaultParams(prompt)
  p.runAt = runAt
  const text = prompt.toLowerCase()
  const understood: string[] = []

  /* horizon: "5-year", "over 3 years", "next 4 yrs", "through/by/until 2028" */
  const hz = text.match(/(\d+)\s*[- ]?\s*(?:year|yr)s?\b/)
  const endYear = text.match(/\b(?:by|through|until|to)\s+(20\d\d)\b/)
  if (endYear) p.horizonYears = Math.max(1, Math.min(10, Number(endYear[1]) - THIS_YEAR + 1))
  else if (hz && Number(hz[1]) >= 1 && Number(hz[1]) <= 10) p.horizonYears = Number(hz[1])
  understood.push(`${p.horizonYears}-year horizon, ${p.startYear}–${p.startYear + p.horizonYears - 1}`)

  /* budget: "$4M per year", "$12 million over 5 years", "3m annually", "$800k" */
  const money = text.match(/\$?\s*(\d+(?:\.\d+)?)\s*(m|mm|million|k|thousand)\b/)
  if (money) {
    const n = Number(money[1])
    const unit = money[2].startsWith('m') ? 1_000_000 : 1_000
    const amount = n * unit
    const perYear = /per\s*(?:year|annum)|annual|a\s+year|each\s+year|yearly|\/\s*yr/.test(text)
    p.envelopePerYearUSD = perYear ? amount : Math.round(amount / p.horizonYears)
    understood.push(perYear
      ? `${fmtUSD(amount)} envelope per year`
      : `${fmtUSD(amount)} total → ${fmtUSD(p.envelopePerYearUSD)} per year`)
  }

  /* budget cut: "cut 20%", "20% less", "reduce by 15%" */
  const cut = text.match(/(?:cut|reduc\w*|trim|less)\D{0,12}(\d{1,2})\s*%|(\d{1,2})\s*%\s*(?:cut|reduction|less|lower)/)
  if (cut) {
    p.budgetCutPct = Number(cut[1] ?? cut[2])
    understood.push(`envelope reduced ${p.budgetCutPct}%`)
  }

  /* priority */
  if (/resilien|redundan|single point|uptime|reliab|outage/.test(text)) p.priority = 'resilience'
  else if (/efficien|energy|pue|carbon|sustainab|decarbon/.test(text)) p.priority = 'efficiency'
  else if (/complian|audit|regulat|arc.?flash|code\b/.test(text)) p.priority = 'compliance'
  else if (/cheap|lowest cost|minimi[sz]e|saving|tight|stretch|afford/.test(text)) p.priority = 'cost'
  understood.push(`priority: ${p.priority}`)

  if (/defer|push out|hold off|postpone|beyond/.test(text)) {
    p.deferNonCritical = true
    understood.push('defer non-critical items one year')
  }

  /* scope: client names, site codes / cities */
  const client = CLIENTS.find(c => text.includes(c.name.toLowerCase().split(' ')[0]))
  if (client) {
    p.clientId = client.id
    p.siteIds = client.siteIds.length ? [...client.siteIds] : null
    understood.push(`scope: ${client.name} (${client.siteIds.map(id => SITES.find(s => s.id === id)?.code.replace('QTM-', '') ?? id).join(', ') || 'no Quantum sites mapped'})`)
  } else {
    const ids = CITY_TO_SITE.filter(([re]) => re.test(text)).map(([, id]) => id)
    if (ids.length) {
      p.siteIds = ids
      understood.push(`scope: ${ids.map(id => SITES.find(s => s.id === id)?.code).join(', ')}`)
    }
  }

  /* asset classes */
  const kinds = new Set<EquipKind>()
  if (/\bups\b|batter/.test(text)) kinds.add('UPS')
  if (/generator|gen[- ]?set/.test(text)) kinds.add('Generator')
  if (/switchgear|electrical distribution|breaker/.test(text)) kinds.add('Switchgear')
  if (/\bpdu/.test(text)) kinds.add('PDU')
  if (/chiller|chilled water|\bchw\b/.test(text)) kinds.add('Chiller')
  if (/crah|crac|air handler|air handling/.test(text)) { kinds.add('CRAH'); kinds.add('CRAC') }
  if (/\bcooling\b|\bhvac\b|mechanical plant/.test(text)) COOLING_KINDS.forEach(k => kinds.add(k))
  if (/\bpower\b|electrical plant|critical power/.test(text)) POWER_KINDS.forEach(k => kinds.add(k))
  if (kinds.size) {
    p.kinds = [...kinds]
    understood.push(`asset classes: ${p.kinds.join(', ')}`)
  }

  p.understood = understood
  return p
}

/* ------------------------------------------------------------------ */
/* Evidence & scoring                                                   */
/* ------------------------------------------------------------------ */

const ALARM_KIND: Record<string, EquipKind> = {
  UPS: 'UPS', CRAH: 'CRAH', CRAC: 'CRAC', Chiller: 'Chiller', Generator: 'Generator', PDU: 'PDU',
}
const TICKET_KIND: Record<string, EquipKind> = {
  UPS: 'UPS', CH: 'Chiller', CRAH: 'CRAH', CRAC: 'CRAC', GEN: 'Generator', PDU: 'PDU', SWG: 'Switchgear',
}

/** Map an alarm source like "CRAH-03" to an equipment id like "ash1-crah-3". */
function alarmAssetId(a: Alarm): string | null {
  const m = a.source.match(/^([A-Za-z]+)-(\d+)$/)
  if (!m) return null
  const kind = ALARM_KIND[m[1]]
  return kind ? `${a.siteId}-${kind.toLowerCase()}-${Number(m[2])}` : null
}
function ticketAssetId(t: Ticket): string | null {
  if (!t.asset) return null
  const m = t.asset.match(/^([A-Z]+)-(\d+)$/)
  if (!m) return null
  const kind = TICKET_KIND[m[1]]
  return kind ? `${t.siteId}-${kind.toLowerCase()}-${Number(m[2])}` : null
}

function priorityBoost(asset: MechEquipment, priority: CapexPriority, risks: Risk[], alarms: Alarm[]): number {
  const age = THIS_YEAR - asset.installedYear
  switch (priority) {
    case 'resilience':
      return (POWER_KINDS.includes(asset.kind) || asset.kind === 'Chiller') && (risks.length > 0 || alarms.some(a => a.severity === 'critical')) ? 1.18 : 1
    case 'efficiency':
      return (COOLING_KINDS.includes(asset.kind) || asset.kind === 'UPS') && age >= 8 ? 1.18 : 1
    case 'compliance':
      return asset.kind === 'Switchgear' || asset.kind === 'Generator' ? 1.18 : 1
    default:
      return 1
  }
}

function chooseIntervention(urgency: number, ageRatio: number, priority: CapexPriority): CapexIntervention {
  const bump = priority === 'cost' ? 10 : 0
  if (urgency >= 68 + bump) return 'Replace'
  if (urgency >= 50 + bump) return ageRatio >= 0.8 ? 'Replace' : 'Refurbish'
  if (urgency >= 42 + bump) return 'Extend life'
  return 'Monitor'
}

function costFor(asset: MechEquipment, site: Site, intervention: CapexIntervention): number {
  const base = (REPLACEMENT_COST[asset.kind] ?? 100_000) * (site.tier === 'IV' ? 1.12 : 1)
  const factor = intervention === 'Replace' ? 1 : intervention === 'Refurbish' ? 0.35 : intervention === 'Extend life' ? 0.08 : 0
  return Math.round(base * factor / 1000) * 1000
}

function naturalYearFor(urgency: number, critical: boolean, params: CapexPlanParams): number {
  if (critical && urgency >= 58) return params.startYear
  const offset = urgency >= 78 ? 0 : urgency >= 64 ? 1 : urgency >= 54 ? 2 : urgency >= 47 ? 3 : 4
  const deferred = params.deferNonCritical && urgency < 68 ? 1 : 0
  return params.startYear + Math.min(params.horizonYears - 1, offset + deferred)
}

function scoreAsset(asset: MechEquipment, site: Site, params: CapexPlanParams, inp: PlannerInputs): Recommendation {
  const history = inp.history(asset.id)
  const alarms = inp.alarms.filter(a => alarmAssetId(a) === asset.id)
  const tickets = inp.tickets.filter(t => ticketAssetId(t) === asset.id && t.type === 'Reactive')
  const risks = inp.risks.filter(r => r.siteId === asset.siteId && r.status !== 'Closed' && (RISK_KINDS[r.category] ?? []).includes(asset.kind))
  const hallRacks = inp.racks.filter(r => r.siteId === asset.siteId && r.hall === asset.hall)
  const hallHotRacks = hallRacks.filter(r => r.status === 'warning' || r.status === 'critical').length
  const hallLoadPct = hallRacks.length
    ? Math.round(100 * hallRacks.reduce((s, r) => s + r.powerKw, 0) / hallRacks.reduce((s, r) => s + r.capacityKw, 0))
    : 0
  const age = THIS_YEAR - asset.installedYear
  const ageRatio = age / EXPECTED_LIFE[asset.kind]
  const replacement = REPLACEMENT_COST[asset.kind] ?? 100_000

  /* factors */
  const cm = history.filter(h => h.type === 'CM')
  const cmSpend = cm.reduce((s, h) => s + h.costUSD, 0)
  const crit = alarms.filter(a => a.severity === 'critical').length
  const warn = alarms.filter(a => a.severity === 'warning').length
  const unacked = alarms.filter(a => !a.acked).length
  const statusScore = asset.status === 'fault' ? 0.5 : asset.status === 'warning' ? 0.35 : asset.status === 'maintenance' ? 0.1 : 0
  const isCooling = COOLING_KINDS.includes(asset.kind)
  const isPower = POWER_KINDS.includes(asset.kind)
  const hotShare = hallRacks.length ? hallHotRacks / hallRacks.length : 0

  const factors: EvidenceFactor[] = [
    {
      key: 'condition', ...FACTOR_META.condition, weight: FACTOR_WEIGHTS.condition,
      score: CONDITION_SCORE[asset.conditionScore] ?? 0,
      detail: `Condition ${asset.conditionScore}/5 · ${asset.vendor}`,
    },
    {
      key: 'age', ...FACTOR_META.age, weight: FACTOR_WEIGHTS.age,
      score: clamp01((ageRatio - 0.3) / 0.5),
      detail: `${age} yrs installed ${asset.installedYear} · ${Math.round(ageRatio * 100)}% of ${EXPECTED_LIFE[asset.kind]}-yr design life`,
    },
    {
      key: 'maintenance', ...FACTOR_META.maintenance, weight: FACTOR_WEIGHTS.maintenance,
      score: clamp01(0.5 * (history.length ? cm.length / history.length : 0) + 0.5 * clamp01(cmSpend / (0.06 * replacement))),
      detail: `${cm.length} corrective of ${history.length} visits · ${fmtUSD(cmSpend)} corrective spend (24 mo)`,
    },
    {
      key: 'monitoring', ...FACTOR_META.monitoring, weight: FACTOR_WEIGHTS.monitoring,
      score: clamp01(crit * 0.5 + warn * 0.3 + (alarms.length - crit - warn) * 0.1 + statusScore + (unacked ? 0.1 : 0)),
      detail: `${alarms.length} BMS alarm${alarms.length === 1 ? '' : 's'}${crit ? ` (${crit} critical)` : ''} · state ${asset.status}${asset.loadPct ? ` · ${asset.loadPct}% load` : ''}`,
    },
    {
      key: 'context', ...FACTOR_META.context, weight: FACTOR_WEIGHTS.context,
      score: clamp01((isCooling ? hotShare * 2.5 : 0) + (isPower && hallLoadPct > 70 ? 0.35 : 0) + Math.min(0.5, risks.length * 0.25) + Math.min(0.4, tickets.length * 0.2)),
      detail: `${hallHotRacks}/${hallRacks.length} hot racks in H${asset.hall} · ${hallLoadPct}% hall load · ${risks.length} linked risk${risks.length === 1 ? '' : 's'} · ${tickets.length} reactive WO${tickets.length === 1 ? '' : 's'}`,
    },
  ]

  const baseUrgency = Math.round(100 * factors.reduce((s, f) => s + f.weight * f.score, 0))
  const urgency = Math.min(100, Math.round(baseUrgency * priorityBoost(asset, params.priority, risks, alarms)))
  const intervention = chooseIntervention(urgency, ageRatio, params.priority)
  const costUSD = costFor(asset, site, intervention)
  const liveCritical = asset.status === 'fault' || alarms.some(a => a.severity === 'critical' && !a.acked)
  const naturalYear = naturalYearFor(urgency, liveCritical, params)
  const pulledForward = liveCritical && urgency >= 58 && intervention !== 'Monitor'

  const evidence: string[] = []
  if (asset.conditionScore <= 2) evidence.push(`Condition ${asset.conditionScore}/5`)
  if (ageRatio >= 0.85) evidence.push(`${age} yrs · ${Math.round(ageRatio * 100)}% of life`)
  if (cm.length >= 2) evidence.push(`${cm.length} CM · ${fmtUSD(cmSpend)}`)
  if (alarms.length) evidence.push(`${alarms.length} alarm${alarms.length === 1 ? '' : 's'}${crit ? ` · ${crit} crit` : ''}`)
  if (asset.status !== 'online') evidence.push(`State: ${asset.status}`)
  if (isCooling && hallHotRacks) evidence.push(`${hallHotRacks} hot rack${hallHotRacks === 1 ? '' : 's'} H${asset.hall}`)
  if (isPower && hallLoadPct > 75) evidence.push(`H${asset.hall} load ${hallLoadPct}%`)
  if (risks.length) evidence.push(`${risks.length} linked risk${risks.length === 1 ? '' : 's'}`)
  if (tickets.length) evidence.push(`${tickets.length} reactive WO${tickets.length === 1 ? '' : 's'}`)
  if (pulledForward) evidence.unshift('Live critical signal')

  const top = [...factors].sort((a, b) => b.weight * b.score - a.weight * a.score)[0]
  const rationale =
    intervention === 'Monitor'
      ? `${asset.name} is performing within expectations — condition ${asset.conditionScore}/5 at ${age} years with ${alarms.length} alarm${alarms.length === 1 ? '' : 's'}. Keep on the PM schedule and re-assess next cycle.`
      : `${intervention} ${asset.name} (${asset.kind}, ${asset.vendor}) in ${naturalYear}${pulledForward ? ' — pulled into the current year on a live critical signal' : ''}. Strongest signal: ${top.label.toLowerCase()} — ${top.detail}. ` +
        (evidence.length > 1 ? `Supporting: ${evidence.filter(e => !top.detail.includes(e)).slice(0, 3).join('; ')}. ` : '') +
        (params.priority !== 'balanced' && priorityBoost(asset, params.priority, risks, alarms) > 1 ? `Weighted up for the ${params.priority} priority. ` : '') +
        `Estimated ${fmtUSD(costUSD)} against a ${fmtUSD(replacement)} like-for-like replacement.`

  const alreadyPlanned = inp.projects.find(p => p.siteId === asset.siteId && p.linkedAsset === asset.name && p.status !== 'Complete')

  return {
    asset, site, client: CLIENTS.find(c => c.siteIds.includes(asset.siteId)),
    urgency, baseUrgency, factors, intervention, costUSD, naturalYear, year: naturalYear,
    deferredByEnvelope: 0, pulledForward, evidence, rationale, alarms, history, tickets, risks,
    hallRacks: hallRacks.length, hallHotRacks, hallLoadPct, alreadyPlanned,
    decision: inp.decisions[asset.id],
  }
}

/* ------------------------------------------------------------------ */
/* Plan assembly                                                        */
/* ------------------------------------------------------------------ */

const EMPTY_MIX = (): Record<CapexIntervention, number> => ({ Replace: 0, Refurbish: 0, 'Extend life': 0, Monitor: 0 })

export function buildPlan(params: CapexPlanParams, inp: PlannerInputs): CapexPlan {
  const scopeSites = params.siteIds ? inp.sites.filter(s => params.siteIds!.includes(s.id)) : inp.sites
  const scopeIds = new Set(scopeSites.map(s => s.id))
  const equipment = inp.equipment.filter(e => scopeIds.has(e.siteId) && (!params.kinds || params.kinds.includes(e.kind)))

  const all = equipment.map(e => scoreAsset(e, scopeSites.find(s => s.id === e.siteId)!, params, inp))

  const alreadyPlanned = all.filter(r => r.alreadyPlanned)
  const dismissed = all.filter(r => !r.alreadyPlanned && r.decision?.decision === 'dismissed')
  const candidates = all.filter(r => !r.alreadyPlanned && r.decision?.decision !== 'dismissed')
  const monitorOnly = candidates.filter(r => r.intervention === 'Monitor')
  const inPlan = candidates.filter(r => r.intervention !== 'Monitor')

  /* operator deferrals override the natural year */
  for (const r of inPlan) {
    if (r.decision?.decision === 'deferred' && r.decision.year) r.year = r.decision.year
  }

  /* envelope leveling: highest urgency fills each year first; overflow rolls forward */
  const envelope = params.envelopePerYearUSD == null ? null : Math.round(params.envelopePerYearUSD * (1 - params.budgetCutPct / 100))
  const lastYear = params.startYear + params.horizonYears - 1
  if (envelope != null) {
    for (let y = params.startYear; y < lastYear; y++) {
      const inYear = inPlan.filter(r => r.year === y && r.decision?.decision !== 'accepted').sort((a, b) => b.urgency - a.urgency)
      let spent = inPlan.filter(r => r.year === y && r.decision?.decision === 'accepted').reduce((s, r) => s + r.costUSD, 0)
      for (const r of inYear) {
        if (spent + r.costUSD > envelope && spent > 0 && !(r.pulledForward && y === params.startYear)) {
          r.year = y + 1
          r.deferredByEnvelope += 1
        } else {
          spent += r.costUSD
        }
      }
    }
  }

  const byYear: YearBucket[] = Array.from({ length: params.horizonYears }, (_, i) => {
    const year = params.startYear + i
    const rows = inPlan.filter(r => r.year === year)
    const total = rows.reduce((s, r) => s + r.costUSD, 0)
    const byIntervention = EMPTY_MIX()
    rows.forEach(r => { byIntervention[r.intervention] += r.costUSD })
    return { year, total, envelope, over: envelope != null ? Math.max(0, total - envelope) : 0, count: rows.length, byIntervention }
  })

  const recs = [...inPlan].sort((a, b) => a.year - b.year || b.urgency - a.urgency)
  const planned = recs.reduce((s, r) => s + r.costUSD, 0)
  const signals = {
    alarms: all.reduce((s, r) => s + r.alarms.length, 0),
    cm: all.reduce((s, r) => s + r.history.filter(h => h.type === 'CM').length, 0),
    hotRacks: new Set(inp.racks.filter(r => scopeIds.has(r.siteId) && (r.status === 'warning' || r.status === 'critical')).map(r => r.id)).size,
    risks: inp.risks.filter(r => scopeIds.has(r.siteId) && r.status !== 'Closed').length,
    tickets: all.reduce((s, r) => s + r.tickets.length, 0),
  }
  const totals = {
    assetsAssessed: all.length,
    planned,
    plannedCount: recs.length,
    overEnvelope: byYear.reduce((s, b) => s + b.over, 0),
    signals,
  }

  const client = params.clientId ? CLIENTS.find(c => c.id === params.clientId) : undefined
  const scopeLabel = client ? `${client.name} (${scopeSites.length} site${scopeSites.length === 1 ? '' : 's'})`
    : scopeSites.length === inp.sites.length && inp.sites.length > 1 ? `${scopeSites.length} sites` : scopeSites.map(s => s.code).join(', ')
  const replaceCount = recs.filter(r => r.intervention === 'Replace').length
  const firstYear = byYear[0]
  const narrative =
    `Assessed ${all.length} assets across ${scopeLabel}: ${recs.length} need capital action within the ${params.horizonYears}-year horizon ` +
    `(${replaceCount} replacements, ${recs.filter(r => r.intervention === 'Refurbish').length} refurbishments, ${recs.filter(r => r.intervention === 'Extend life').length} life-extensions), ` +
    `${monitorOnly.length} stay on PM only, ${alreadyPlanned.length} already have projects. Total ${fmtUSD(planned)}` +
    (envelope != null ? ` against a ${fmtUSD(envelope)}/yr envelope` : '') +
    `; ${firstYear.year} carries ${fmtUSD(firstYear.total)} across ${firstYear.count} item${firstYear.count === 1 ? '' : 's'}` +
    (totals.overEnvelope > 0 ? `, and ${fmtUSD(totals.overEnvelope)} spills past the envelope in the final year — raise the envelope or defer.` : '.') +
    (params.priority !== 'balanced' ? ` Scoring weighted for ${params.priority}.` : '')

  const steps = buildSteps(params, scopeSites, all, recs, byYear, envelope, signals, scopeLabel)

  return { params, scopeSites, recs, monitorOnly, dismissed, alreadyPlanned, byYear, totals, steps, narrative }
}

function buildSteps(
  params: CapexPlanParams, scopeSites: Site[], all: Recommendation[], recs: Recommendation[],
  byYear: YearBucket[], envelope: number | null, signals: CapexPlan['totals']['signals'], scopeLabel: string,
): PlanStep[] {
  const cmms = [...new Set(scopeSites.map(s => s.cmms))]
  const bms = [...new Set(scopeSites.map(s => s.bms))]
  const dcim = [...new Set(scopeSites.map(s => s.dcim).filter(d => !d.startsWith('None')))]
  const cmVisits = all.reduce((s, r) => s + r.history.length, 0)
  const matchedAlarmAssets = all.filter(r => r.alarms.length > 0).length
  const boosted = all.filter(r => r.urgency !== r.baseUrgency).length
  const spill = byYear.filter(b => b.over > 0)
  return [
    { id: 'interpret', kind: 'interpret', system: 'Quantum MCP Hub', title: 'Interpreting request',
      detail: params.understood.join(' · ') || 'No constraints given — balanced 5-year plan over the current site scope.' },
    { id: 'registry', kind: 'pull', system: cmms.join(' · '), title: 'Pulling asset registry',
      detail: `${all.length} major M&E assets across ${scopeLabel} — condition scores, install years, vendor.` },
    { id: 'history', kind: 'pull', system: cmms.join(' · '), title: 'Reading maintenance history',
      detail: `${cmVisits} maintenance visits, ${signals.cm} corrective · ${signals.tickets} reactive work orders tied to assets.` },
    { id: 'bms', kind: 'pull', system: bms.join(' · '), title: 'Correlating BMS alarms & equipment state',
      detail: `${signals.alarms} active alarms matched to ${matchedAlarmAssets} assets · ${all.filter(r => r.asset.status === 'fault').length} in fault, ${all.filter(r => r.asset.status === 'warning').length} in warning.` },
    { id: 'dcim', kind: 'pull', system: dcim.length ? dcim.join(' · ') : 'Quantum native telemetry', title: 'Checking whitespace telemetry',
      detail: `${signals.hotRacks} racks above thermal threshold — attributed to the CRAH/CRAC units serving each hall; hall electrical load applied to UPS/PDU.` },
    { id: 'risks', kind: 'compute', system: 'Quantum risk register', title: 'Cross-referencing risk register',
      detail: `${signals.risks} live risks in scope · ${all.filter(r => r.risks.length).length} assets linked by category (power, cooling, SPOF, leak).` },
    { id: 'score', kind: 'compute', system: 'Quantum MCP Hub', title: 'Scoring urgency',
      detail: `Condition 30% · age vs design life 20% · maintenance 20% · alarms & state 20% · whitespace/risk/WO context 10%` +
        (boosted ? ` · ${boosted} assets weighted up for ${params.priority}` : '') + '.' },
    { id: 'allocate', kind: 'compute', system: 'Quantum MCP Hub', title: 'Allocating spend across the horizon',
      detail: `${recs.filter(r => r.pulledForward).length} item${recs.filter(r => r.pulledForward).length === 1 ? '' : 's'} pulled into ${params.startYear} on live critical signals · ` + (envelope != null
        ? `${fmtUSD(envelope)}/yr envelope · ${recs.filter(r => r.deferredByEnvelope).length} item${recs.filter(r => r.deferredByEnvelope).length === 1 ? '' : 's'} rolled forward to fit` + (spill.length ? ` · ${fmtUSD(spill.reduce((s, b) => s + b.over, 0))} spills past ${spill[spill.length - 1].year}` : '') + '.'
        : `No envelope — items land on their natural year by urgency.${params.deferNonCritical ? ' Non-critical items pushed one year.' : ''}`) },
    { id: 'result', kind: 'result', system: 'Autodesk Construction Cloud', title: 'Plan ready',
      detail: `${recs.length} recommendations · ${fmtUSD(recs.reduce((s, r) => s + r.costUSD, 0))} over ${params.horizonYears} years. Accept items to raise them as proposed capex projects.` },
  ]
}

/* ------------------------------------------------------------------ */
/* "Ask the planner" — deterministic follow-ups on one recommendation   */
/* ------------------------------------------------------------------ */

export type FollowUp = 'why-now' | 'defer' | 'cheaper' | 'evidence'
export const FOLLOW_UPS: { key: FollowUp; label: string }[] = [
  { key: 'why-now', label: 'Why this year?' },
  { key: 'defer', label: 'What if we defer two years?' },
  { key: 'cheaper', label: 'Is there a cheaper option?' },
  { key: 'evidence', label: 'Show me the evidence trail' },
]

export function answerFollowUp(rec: Recommendation, q: FollowUp, plan: CapexPlan): string {
  const top = [...rec.factors].sort((a, b) => b.weight * b.score - a.weight * a.score)
  const age = THIS_YEAR - rec.asset.installedYear
  const replacement = (REPLACEMENT_COST[rec.asset.kind] ?? 100_000)
  switch (q) {
    case 'why-now':
      return `${rec.asset.name} scores ${rec.urgency}/100, which lands it in ${rec.naturalYear}` +
        (rec.year !== rec.naturalYear ? ` — it now sits in ${rec.year} because ${rec.decision?.decision === 'deferred' ? 'you deferred it' : `the ${fmtUSD(plan.params.envelopePerYearUSD ?? 0)}/yr envelope was already committed to higher-urgency items`}.` : '.') +
        ` The two biggest contributors are ${top[0].label.toLowerCase()} (${top[0].detail}) and ${top[1].label.toLowerCase()} (${top[1].detail}).` +
        (rec.alarms.some(a => a.severity === 'critical') ? ` A critical BMS alarm is currently active on this unit, which is why I would not push it later.` : '')
    case 'defer': {
      const cmRate = rec.history.filter(h => h.type === 'CM').reduce((s, h) => s + h.costUSD, 0) / 2
      const risk = rec.urgency >= 75 ? 'high' : rec.urgency >= 55 ? 'moderate' : 'low'
      return `Deferring to ${rec.year + 2} carries ${risk} risk. Expect roughly ${fmtUSD(cmRate * 2)} of additional corrective maintenance at the current run-rate` +
        (rec.risks.length ? `, and the linked register item “${rec.risks[0].title}” stays open` : '') +
        (rec.hallHotRacks ? `, while ${rec.hallHotRacks} rack${rec.hallHotRacks === 1 ? ' is' : 's are'} in H${rec.asset.hall} already above threshold` : '') +
        `. By then the unit would be ${age + 2} years old, ${Math.round(((age + 2) / EXPECTED_LIFE[rec.asset.kind]) * 100)}% of design life.` +
        (rec.urgency >= 75 ? ' I would keep it where it is and defer a lower-urgency item instead.' : ' That is a reasonable trade if the envelope is tight — use Defer on the row and I will re-level the plan.')
    }
    case 'cheaper': {
      const refurb = Math.round(replacement * 0.35 / 1000) * 1000
      const extend = Math.round(replacement * 0.08 / 1000) * 1000
      if (rec.intervention === 'Replace') {
        return `A refurbishment (controls, fans/bearings, batteries or major components) runs about ${fmtUSD(refurb)} versus ${fmtUSD(rec.costUSD)} to replace, and typically buys 3–5 years.` +
          (rec.asset.conditionScore <= 2 ? ` With condition at ${rec.asset.conditionScore}/5 I would not recommend it here — the refurbishment spend is likely to be stranded.` : ` Condition ${rec.asset.conditionScore}/5 makes that viable; re-run with a “minimise cost” prompt and I will re-score with refurbishment thresholds.`) +
          (rec.asset.kind === 'CRAH' || rec.asset.kind === 'CRAC' ? ' An EC-fan retrofit is the efficiency variant and pays back in under 3 years at current tariffs.' : '')
      }
      return `This is already the lower-cost route (${rec.intervention}, ${fmtUSD(rec.costUSD)}). The next step down is enhanced PM at roughly ${fmtUSD(extend)}/yr, which manages the risk but does not reset the asset’s age.`
    }
    case 'evidence':
      return [
        `CMMS (${rec.site.cmms}): condition ${rec.asset.conditionScore}/5, installed ${rec.asset.installedYear}, ${rec.history.length} maintenance visits (${rec.history.filter(h => h.type === 'CM').length} corrective), ${rec.tickets.length} reactive WOs.`,
        `BMS (${rec.site.bms}): ${rec.alarms.length} active alarm${rec.alarms.length === 1 ? '' : 's'}${rec.alarms.length ? ` — ${rec.alarms.slice(0, 2).map(a => a.point).join(', ')}` : ''}; equipment state ${rec.asset.status}, reading ${rec.asset.metric}.`,
        `DCIM (${rec.site.dcim}): ${rec.hallHotRacks} of ${rec.hallRacks} racks in H${rec.asset.hall} above thermal threshold, hall load ${rec.hallLoadPct}%.`,
        `Risk register: ${rec.risks.length ? rec.risks.map(r => `${r.id} ${r.title}`).join('; ') : 'no linked live risks'}.`,
      ].join(' ')
  }
}
