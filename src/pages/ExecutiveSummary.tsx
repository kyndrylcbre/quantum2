import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useData } from '../context/DataContext'
import {
  buildPlan, CLIENTS, defaultParams, fmtUSD, getEquipment, getHistory, getRacks, HEALTH_WEIGHTS,
  OWNER_WEIGHT, SERVICE_LINES, SITES, snapshotsFor, type ClientSnapshot, type Region,
} from '../data'
import { Badge, Card, ChartTip, Segmented, StatTile, type BadgeTone } from '../components/ui'
import { axisTick, ChartFrame, MiniLegend } from '../components/charts'
import { FINANCE_SOURCE, marginTone, pct, ServiceStrip } from '../components/exec'
import { EmeraldButton } from '../emerald'
import '../styles/executive.css'

type SortKey = 'health' | 'risk' | 'fee' | 'name'
type ChartKey = 'margin' | 'fee'
const REGIONS: Region[] = ['Americas', 'EMEA', 'APAC']

interface Attention { key: string; tone: BadgeTone; tag: string; title: string; meta: string; clientId: string; rank: number }

export function ExecutiveSummary() {
  const navigate = useNavigate()
  const { risks, incidents, projects, alarms, tickets, capexDecisions, pull } = useData()
  const snapshots = useMemo(() => snapshotsFor(CLIENTS, { risks, incidents, projects }), [risks, incidents, projects])

  const [sort, setSort] = useState<SortKey>('health')
  const [chart, setChart] = useState<ChartKey>('margin')

  const sorted = useMemo(() => {
    const arr = [...snapshots]
    switch (sort) {
      case 'health': return arr.sort((a, b) => a.health.score - b.health.score)
      case 'risk': return arr.sort((a, b) => b.risk.perSite - a.risk.perSite)
      case 'fee': return arr.sort((a, b) => b.commercials.annualFeeUSD - a.commercials.annualFeeUSD)
      default: return arr.sort((a, b) => a.client.name.localeCompare(b.client.name))
    }
  }, [snapshots, sort])

  /* ---- commercial / health roll-up ---- */
  const managed = snapshots.reduce((s, x) => s + x.commercials.managedSpendUSD, 0)
  const fees = snapshots.reduce((s, x) => s + x.commercials.annualFeeUSD, 0)
  const blendedActual = snapshots.reduce((s, x) => s + x.commercials.actualMarginPct * x.commercials.managedSpendUSD, 0) / managed
  const blendedTarget = snapshots.reduce((s, x) => s + x.commercials.targetMarginPct * x.commercials.managedSpendUSD, 0) / managed
  const outages = snapshots.reduce((s, x) => s + x.incidents.sev1, 0)
  const incidents90 = snapshots.reduce((s, x) => s + x.incidents.total90d, 0)
  const atRisk = snapshots.filter(s => s.health.band === 'At risk').length
  const watch = snapshots.filter(s => s.health.band === 'Watch').length
  const siteCount = snapshots.reduce((s, x) => s + x.siteCount, 0)

  /* ---- operational roll-up (all Quantum sites) ---- */
  const itLoad = SITES.reduce((s, x) => s + x.itLoadMW, 0)
  const capacity = SITES.reduce((s, x) => s + x.capacityMW, 0)
  const pue = SITES.reduce((s, x) => s + x.currentPUE * x.itLoadMW, 0) / itLoad
  const liveRisks = risks.filter(r => r.status !== 'Closed')
  const highRisks = liveRisks.filter(r => r.likelihood * r.impact >= 10).length
  const weightedRisk = Math.round(liveRisks.reduce((s, r) => s + r.likelihood * r.impact * OWNER_WEIGHT[r.owner], 0))
  const openWOs = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length
  const slaBreaches = tickets.filter(t => t.slaBreached).length

  const outlook = useMemo(() => buildPlan(defaultParams(), {
    sites: SITES, equipment: getEquipment('all'), alarms, tickets, risks, projects,
    racks: getRacks('all'), history: getHistory, decisions: capexDecisions,
  }), [alarms, tickets, risks, projects, capexDecisions])

  /* ---- attention feed ---- */
  const attention = useMemo<Attention[]>(() => {
    const out: Attention[] = []
    for (const s of snapshots) {
      const id = s.client.id
      if (s.health.band !== 'Healthy') {
        out.push({ key: `${id}-health`, tone: s.health.tone, tag: s.health.band, title: `${s.client.name} — health ${s.health.score}`, meta: s.health.drivers[0], clientId: id, rank: s.health.band === 'At risk' ? 0 : 2 })
      }
      if (s.incidents.sev1 > 0) {
        out.push({ key: `${id}-outage`, tone: 'critical', tag: 'Outage', title: `${s.client.name} — ${s.incidents.sev1} SEV1 in 90 days`, meta: s.incidents.recent.find(i => i.severity === 'SEV1')?.title ?? 'Customer-impacting incident', clientId: id, rank: 1 })
      }
      const gap = s.commercials.targetMarginPct - s.commercials.actualMarginPct
      if (gap > 2) {
        out.push({ key: `${id}-margin`, tone: 'serious', tag: 'Margin', title: `${s.client.name} — ${gap.toFixed(1)} pts under target`, meta: `${pct(s.commercials.actualMarginPct)} actual vs ${pct(s.commercials.targetMarginPct)} · ${s.commercials.model}`, clientId: id, rank: 3 })
      }
      if (s.incidents.active > 0) {
        out.push({ key: `${id}-active`, tone: 'warn', tag: 'Active', title: `${s.client.name} — ${s.incidents.active} incident${s.incidents.active === 1 ? '' : 's'} active now`, meta: s.incidents.recent[0]?.title ?? '', clientId: id, rank: 1 })
      }
    }
    return out.sort((a, b) => a.rank - b.rank).slice(0, 8)
  }, [snapshots])

  const chartData = useMemo(() => sorted.map(s => ({
    label: s.client.name.replace(' Technology', ''),
    Actual: s.commercials.actualMarginPct,
    Target: s.commercials.targetMarginPct,
    Fee: Math.round(s.commercials.annualFeeUSD / 1000),
  })), [sorted])

  const regionRows = REGIONS.map(region => {
    const sites = SITES.filter(s => s.region === region)
    const ids = new Set(sites.map(s => s.id))
    const clients = CLIENTS.filter(c => c.siteIds.some(id => ids.has(id))).length
    return { region, sites: sites.length, mw: sites.reduce((s, x) => s + x.itLoadMW, 0), clients }
  })

  const open = (id: string) => navigate(`/executive/${id}`)

  return (
    <div className="exec-page">
      <div className="page-header row">
        <div>
          <h1>Executive summary</h1>
          <p className="subtitle">
            CBRE Data Center Solutions — {snapshots.length} accounts · {siteCount} sites · {itLoad.toFixed(0)} MW IT load · {fmtUSD(managed)} under management.
          </p>
        </div>
        <EmeraldButton variant="secondary" className="right" onClick={() => pull(FINANCE_SOURCE, 'Refresh contract fees & margins')}>
          ⟳ Pull financials from Vantage
        </EmeraldButton>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Accounts needing attention" value={atRisk + watch}
          sub={atRisk > 0
            ? <Badge tone="critical" dot={false}>{atRisk} at risk · {watch} watch</Badge>
            : watch > 0 ? <Badge tone="warn" dot={false}>{watch} on watch</Badge>
            : <Badge tone="good" dot={false}>Portfolio healthy</Badge>} />
        <StatTile label="Annual management fees" value={fmtUSD(fees)}
          sub={<span className="muted">{pct((fees / managed) * 100)} blended rate on {fmtUSD(managed)} managed spend</span>} />
        <StatTile label="Blended margin" value={pct(blendedActual)}
          sub={<Badge tone={marginTone(blendedActual, blendedTarget)} dot={false}>
            {blendedActual >= blendedTarget ? '+' : '−'}{Math.abs(blendedActual - blendedTarget).toFixed(1)} pts vs {pct(blendedTarget)} target
          </Badge>} />
        <StatTile label="Outages — 90 days" value={outages}
          sub={<span className="muted">SEV1 customer-impacting · {incidents90} incidents total</span>} />
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="IT load" value={itLoad.toFixed(1)} unit="MW"
          sub={<span className="muted">{((itLoad / capacity) * 100).toFixed(0)}% of {capacity} MW design · PUE {pue.toFixed(2)}</span>} />
        <StatTile label="Live risks" value={liveRisks.length}
          sub={<span className="muted">{highRisks} high-scoring · weighted {weightedRisk}</span>} />
        <StatTile label="Open work orders" value={openWOs}
          sub={slaBreaches > 0 ? <Badge tone="critical" dot={false}>{slaBreaches} SLA breach{slaBreaches === 1 ? '' : 'es'}</Badge> : <Badge tone="good" dot={false}>SLA clean</Badge>} />
        <StatTile label="Capital outlook — 5 yrs" value={fmtUSD(outlook.totals.planned)}
          sub={<span className="muted">{outlook.totals.plannedCount} actions · {fmtUSD(outlook.byYear[0]?.total ?? 0)} in {outlook.byYear[0]?.year} · planner baseline</span>} />
      </div>

      <div className="grid cols-3 exec-row" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card className="span-2" title="What needs attention">
          {attention.length === 0 && <div className="exec-empty">Nothing outstanding — every account is healthy, on margin and outage-free.</div>}
          <ul className="attention-list">
            {attention.map(a => (
              <li key={a.key}>
                <button type="button" className="attention-item" onClick={() => open(a.clientId)}>
                  <Badge tone={a.tone} dot={false}>{a.tag}</Badge>
                  <span className="attention-body">
                    <span className="attention-title">{a.title}</span>
                    <span className="attention-meta">{a.meta}</span>
                  </span>
                  <span className="attention-go" aria-hidden>→</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={chart === 'margin' ? 'Margin vs target (%)' : 'Annual fee ($k)'}
          action={<Segmented options={[{ value: 'margin', label: 'Margin' }, { value: 'fee', label: 'Fee' }] as const} value={chart} onChange={setChart} />}
        >
          <ChartFrame height={230}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} interval={0} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={chart === 'margin' ? [0, 20] : undefined} />
                <Tooltip content={<ChartTip unit={chart === 'margin' ? '%' : 'k'} />} cursor={{ fill: 'var(--surface-3)' }} />
                {chart === 'margin' ? (
                  <>
                    <Bar dataKey="Actual" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="Target" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  </>
                ) : <Bar dataKey="Fee" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={34} />}
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          {chart === 'margin' && <MiniLegend items={[{ label: 'Actual margin', color: 'var(--chart-1)' }, { label: 'Contract target', color: 'var(--chart-2)' }]} />}
        </Card>
      </div>

      <div className="filter-row">
        <Segmented
          options={[
            { value: 'health', label: 'Health — worst first' },
            { value: 'risk', label: 'Weighted risk' },
            { value: 'fee', label: 'Mgmt fee' },
            { value: 'name', label: 'A–Z' },
          ] as const}
          value={sort}
          onChange={setSort}
        />
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>Select an account to open its dashboard</span>
      </div>

      <div className="scorecards">
        {sorted.map(s => <Scorecard key={s.client.id} s={s} onOpen={() => open(s.client.id)} />)}
      </div>
      <div className="exec-footnote" style={{ borderTop: 'none', marginTop: 6 }}>
        <strong>Health</strong> = 100 − weighted penalties: weighted risk {Math.round(HEALTH_WEIGHTS.risk * 100)}% · incidents & outages {Math.round(HEALTH_WEIGHTS.incidents * 100)}% · margin vs target {Math.round(HEALTH_WEIGHTS.margin * 100)}% · project delivery {Math.round(HEALTH_WEIGHTS.delivery * 100)}%.
        {' '}<strong>Weighted risk</strong> = Σ likelihood × impact × ownership weight (CBRE {OWNER_WEIGHT.CBRE} · Shared {OWNER_WEIGHT.Shared} · Client {OWNER_WEIGHT.Client}) over live risks, per site.
        {' '}Financials from {FINANCE_SOURCE}; operational data live from each site’s CMMS/BMS/DCIM via Quantum.
      </div>

      <div className="grid cols-3 exec-row" style={{ marginTop: 'var(--gap-md)' }}>
        <Card className="span-2" title="Service coverage — where each account buys from DCS">
          <div className="table-scroll">
            <table className="data-table svc-matrix">
              <thead>
                <tr>
                  <th>Client</th>
                  {SERVICE_LINES.map(l => <th key={l.key} title={`${l.key} — ${l.blurb}`} aria-label={l.key}>{l.abbr}</th>)}
                  <th className="num">Scope</th>
                </tr>
              </thead>
              <tbody>
                {[...snapshots].sort((a, b) => b.client.services.length - a.client.services.length).map(s => (
                  <tr key={s.client.id} className="clickable" onClick={() => open(s.client.id)}>
                    <td><strong>{s.client.name}</strong></td>
                    {SERVICE_LINES.map(l => {
                      const on = s.client.services.includes(l.key)
                      return <td key={l.key} className={on ? 'on' : 'off'} aria-label={`${l.key}: ${on ? 'in scope' : 'not in scope'}`}>{on ? '✓' : '–'}</td>
                    })}
                    <td className="num">{s.client.services.length} / {SERVICE_LINES.length}</td>
                  </tr>
                ))}
                <tr className="svc-matrix__total">
                  <td>Accounts buying</td>
                  {SERVICE_LINES.map(l => {
                    const n = snapshots.filter(s => s.client.services.includes(l.key)).length
                    return <td key={l.key} className="num">{n} / {snapshots.length}</td>
                  })}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="exec-sub" style={{ marginTop: 8 }}>
            {SERVICE_LINES.map(l => `${l.abbr} ${l.key}`).join(' · ')}. Gaps are cross-sell white space — Lease Admin and Space Planning have the most headroom across the roster.
          </div>
        </Card>

        <Card title="Footprint by region">
          <table className="data-table">
            <thead><tr><th>Region</th><th className="num">Sites</th><th className="num">IT load</th><th className="num">Accounts</th></tr></thead>
            <tbody>
              {regionRows.map(r => (
                <tr key={r.region}>
                  <td><strong>{r.region}</strong></td>
                  <td className="num">{r.sites}</td>
                  <td className="num">{r.mw.toFixed(1)} MW</td>
                  <td className="num">{r.clients}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="exec-sub" style={{ marginTop: 10 }}>
            {snapshots.filter(s => !s.onboarded).length > 0
              ? `${snapshots.filter(s => !s.onboarded).length} account(s) not yet connected to Quantum — shown from onboarding snapshots.`
              : 'Every account’s footprint is connected to Quantum — all metrics are live from site systems of record.'}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Scorecard({ s, onOpen }: { s: ClientSnapshot; onOpen: () => void }) {
  const c = s.commercials
  const delta = c.actualMarginPct - c.targetMarginPct
  return (
    <button type="button" className="scorecard" onClick={onOpen} aria-label={`Open ${s.client.name} dashboard`}>
      <div className="scorecard__head">
        <div className="scorecard__id">
          <span className="scorecard__name">{s.client.name}</span>
          <span className="scorecard__meta">
            {s.client.sector} · {s.siteCount} site{s.siteCount === 1 ? '' : 's'} · {s.itLoadMW.toFixed(1)} MW{!s.onboarded && ' · not yet onboarded'}
          </span>
        </div>
        <Badge tone={s.health.tone} dot={false}>{s.health.band} · {s.health.score}</Badge>
      </div>
      <div className="health__meter"><div style={{ width: `${s.health.score}%`, background: `var(--status-${s.health.tone})` }} /></div>

      <dl className="scorecard__stats">
        <div>
          <dt>Weighted risk</dt>
          <dd><Badge tone={s.risk.tone} dot={false}>{s.risk.perSite} · {s.risk.band}</Badge> <span className="muted">{s.risk.live} live</span></dd>
        </div>
        <div>
          <dt>Incidents · 90d</dt>
          <dd>
            <span className="exec-num">{s.incidents.total90d}</span>{' '}
            {s.incidents.sev1 > 0
              ? <Badge tone="critical" dot={false}>{s.incidents.sev1} outage{s.incidents.sev1 === 1 ? '' : 's'}</Badge>
              : <span className="muted">no outages</span>}
            {s.incidents.active > 0 && <> <Badge tone="warn" dot={false}>{s.incidents.active} active</Badge></>}
          </dd>
        </div>
        <div>
          <dt>Mgmt fee</dt>
          <dd><span className="exec-num">{fmtUSD(c.annualFeeUSD)}</span> <span className="muted">{pct(c.feePct)} · {c.model}</span></dd>
        </div>
        <div>
          <dt>Margin</dt>
          <dd>
            <span className="exec-num">{pct(c.actualMarginPct)}</span>{' '}
            <Badge tone={marginTone(c.actualMarginPct, c.targetMarginPct)} dot={false}>{delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} vs {pct(c.targetMarginPct)}</Badge>
          </dd>
        </div>
      </dl>

      <div className="scorecard__spend">
        <span><span className="exec-kind">Capex</span> {fmtUSD(s.projects.capexSpent)} <span className="muted">/ {fmtUSD(s.projects.capexBudget)}</span></span>
        <span><span className="exec-kind">Opex</span> {fmtUSD(s.projects.opexSpent)} <span className="muted">/ {fmtUSD(s.projects.opexBudget)}</span></span>
      </div>

      <div className="scorecard__foot">
        <ServiceStrip services={s.client.services} />
        <span className="scorecard__go">Open dashboard →</span>
      </div>
    </button>
  )
}
