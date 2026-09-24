import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useData } from '../context/DataContext'
import {
  CLIENTS, HEALTH_WEIGHTS, OWNER_WEIGHT, SERVICE_LINES, snapshotsFor,
  type ClientSnapshot, type RiskOwner,
} from '../data'
import { Badge, Card, ChartTip, Segmented, sevTone, StatTile, type BadgeTone } from '../components/ui'
import { axisTick, ChartFrame, MiniLegend } from '../components/charts'
import { EmeraldButton } from '../emerald'
import '../styles/executive.css'

type SortKey = 'health' | 'risk' | 'fee' | 'name'
type ChartKey = 'margin' | 'fee'

const FINANCE_SOURCE = 'CBRE Vantage Analytics'
const OWNERS: RiskOwner[] = ['CBRE', 'Shared', 'Client']

const fmtUSD = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : `$${Math.round(n / 1000)}k`
const pct = (n: number) => `${n.toFixed(1)}%`
const agoDays = (d: number) => (d === 0 ? 'today' : `${d}d ago`)

const marginTone = (actual: number, target: number): BadgeTone =>
  actual >= target ? 'good' : target - actual <= 2 ? 'warn' : 'critical'

export function ExecutiveView() {
  const { risks, incidents, projects, pull } = useData()
  const snapshots = useMemo(
    () => snapshotsFor(CLIENTS, { risks, incidents, projects }),
    [risks, incidents, projects],
  )

  const [sort, setSort] = useState<SortKey>('health')
  const [chart, setChart] = useState<ChartKey>('margin')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const arr = [...snapshots]
    switch (sort) {
      case 'health': return arr.sort((a, b) => a.health.score - b.health.score)
      case 'risk': return arr.sort((a, b) => b.risk.perSite - a.risk.perSite)
      case 'fee': return arr.sort((a, b) => b.commercials.annualFeeUSD - a.commercials.annualFeeUSD)
      default: return arr.sort((a, b) => a.client.name.localeCompare(b.client.name))
    }
  }, [snapshots, sort])

  const selected = snapshots.find(s => s.client.id === selectedId) ?? sorted[0]

  /* ---- portfolio KPIs ---- */
  const managed = snapshots.reduce((s, x) => s + x.commercials.managedSpendUSD, 0)
  const fees = snapshots.reduce((s, x) => s + x.commercials.annualFeeUSD, 0)
  const blendedActual = snapshots.reduce((s, x) => s + x.commercials.actualMarginPct * x.commercials.managedSpendUSD, 0) / managed
  const blendedTarget = snapshots.reduce((s, x) => s + x.commercials.targetMarginPct * x.commercials.managedSpendUSD, 0) / managed
  const outages = snapshots.reduce((s, x) => s + x.incidents.sev1, 0)
  const atRisk = snapshots.filter(s => s.health.band === 'At risk').length
  const watch = snapshots.filter(s => s.health.band === 'Watch').length
  const siteCount = snapshots.reduce((s, x) => s + x.siteCount, 0)
  const mw = snapshots.reduce((s, x) => s + x.itLoadMW, 0)

  const chartData = useMemo(
    () => sorted.map(s => ({
      label: s.client.name.replace(' Technology', ''),
      Actual: s.commercials.actualMarginPct,
      Target: s.commercials.targetMarginPct,
      Fee: Math.round(s.commercials.annualFeeUSD / 1000),
    })),
    [sorted],
  )

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>Executive view</h1>
          <p className="subtitle">
            Client health across CBRE Data Center Solutions — {snapshots.length} accounts · {siteCount} sites · {mw.toFixed(0)} MW IT load · {fmtUSD(managed)} under management.
          </p>
        </div>
        <EmeraldButton variant="secondary" className="right"
          onClick={() => pull(FINANCE_SOURCE, 'Refresh contract fees & margins')}>
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
          sub={<span className="muted">SEV1 customer-impacting · {snapshots.reduce((s, x) => s + x.incidents.total90d, 0)} incidents total</span>} />
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
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>Select a client for account detail</span>
      </div>

      <Card className="exec-table-card">
        <div className="table-scroll">
          <table className="data-table exec-table">
            <thead>
              <tr>
                <th>Client</th>
                <th style={{ minWidth: 150 }}>Health</th>
                <th className="num">Weighted risk</th>
                <th className="num">Incidents · outages <span className="th-sub">90d</span></th>
                <th className="num">Project spend <span className="th-sub">spent / budget</span></th>
                <th className="num">Mgmt fee <span className="th-sub">annual</span></th>
                <th className="num">Margin <span className="th-sub">vs target</span></th>
                <th>Services</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => <ClientRow key={s.client.id} s={s} selected={s.client.id === selected?.client.id} onSelect={() => setSelectedId(s.client.id)} />)}
            </tbody>
          </table>
        </div>
        <div className="exec-footnote">
          <strong>Health</strong> = 100 − weighted penalties: weighted risk {Math.round(HEALTH_WEIGHTS.risk * 100)}% · incidents & outages {Math.round(HEALTH_WEIGHTS.incidents * 100)}% · margin vs target {Math.round(HEALTH_WEIGHTS.margin * 100)}% · project delivery {Math.round(HEALTH_WEIGHTS.delivery * 100)}%.
          {' '}<strong>Weighted risk</strong> = Σ likelihood × impact × ownership weight (CBRE {OWNER_WEIGHT.CBRE} · Shared {OWNER_WEIGHT.Shared} · Client {OWNER_WEIGHT.Client}) over live risks, per site.
          {' '}Financials from {FINANCE_SOURCE}; operational data live from each site’s CMMS/BMS/DCIM via Quantum.
        </div>
      </Card>

      <div className="grid cols-3" style={{ marginTop: 'var(--gap-md)' }}>
        {selected && <ClientDetail s={selected} />}

        <Card
          title={chart === 'margin' ? 'Margin — actual vs target (%)' : 'Annual management fee ($k)'}
          action={
            <Segmented
              options={[{ value: 'margin', label: 'Margin' }, { value: 'fee', label: 'Fee' }] as const}
              value={chart}
              onChange={setChart}
            />
          }
        >
          <ChartFrame height={250}>
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
                ) : (
                  <Bar dataKey="Fee" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={34} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          {chart === 'margin' && (
            <MiniLegend items={[
              { label: 'Actual margin', color: 'var(--chart-1)' },
              { label: 'Contract target', color: 'var(--chart-2)' },
            ]} />
          )}
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ClientRow({ s, selected, onSelect }: { s: ClientSnapshot; selected: boolean; onSelect: () => void }) {
  const c = s.commercials
  const delta = c.actualMarginPct - c.targetMarginPct
  return (
    <tr className={`clickable${selected ? ' selected' : ''}`} onClick={onSelect} aria-selected={selected}>
      <td>
        <div className="exec-client">
          <strong>{s.client.name}</strong>
          {!s.onboarded && <Badge tone="neutral" dot={false}>Not yet onboarded</Badge>}
        </div>
        <div className="exec-sub">{s.client.sector} · {s.siteCount} site{s.siteCount === 1 ? '' : 's'} · {s.itLoadMW.toFixed(1)} MW</div>
      </td>
      <td><HealthMeter s={s} /></td>
      <td className="num">
        <Badge tone={s.risk.tone} dot={false}>{s.risk.perSite} · {s.risk.band}</Badge>
        <div className="exec-sub">{s.risk.live} live · {s.risk.high} high</div>
      </td>
      <td className="num">
        <span className="exec-num">{s.incidents.total90d}</span>
        <div className="exec-sub row" style={{ justifyContent: 'flex-end', gap: 4 }}>
          {s.incidents.sev1 > 0
            ? <Badge tone="critical" dot={false}>{s.incidents.sev1} outage{s.incidents.sev1 === 1 ? '' : 's'}</Badge>
            : <span>no outages</span>}
          {s.incidents.active > 0 && <Badge tone="warn" dot={false}>{s.incidents.active} active</Badge>}
        </div>
      </td>
      <td className="num">
        <div><span className="exec-kind">Capex</span> {fmtUSD(s.projects.capexSpent)} <span className="muted">/ {fmtUSD(s.projects.capexBudget)}</span></div>
        <div><span className="exec-kind">Opex</span> {fmtUSD(s.projects.opexSpent)} <span className="muted">/ {fmtUSD(s.projects.opexBudget)}</span></div>
      </td>
      <td className="num">
        <span className="exec-num">{fmtUSD(c.annualFeeUSD)}</span>
        <div className="exec-sub">{pct(c.feePct)} · {c.model}</div>
      </td>
      <td className="num">
        <span className="exec-num">{pct(c.actualMarginPct)}</span>
        <div className="exec-sub">
          <Badge tone={marginTone(c.actualMarginPct, c.targetMarginPct)} dot={false}>
            {delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} vs {pct(c.targetMarginPct)}
          </Badge>
        </div>
      </td>
      <td><ServiceStrip services={s.client.services} /></td>
    </tr>
  )
}

function HealthMeter({ s }: { s: ClientSnapshot }) {
  const fill = `var(--status-${s.health.tone})`
  return (
    <div className="health" aria-label={`Health ${s.health.score} of 100 — ${s.health.band}`}>
      <div className="health__top">
        <Badge tone={s.health.tone} dot={false}>{s.health.band}</Badge>
        <span className="health__score">{s.health.score}</span>
      </div>
      <div className="health__meter"><div style={{ width: `${s.health.score}%`, background: fill }} /></div>
    </div>
  )
}

function ServiceStrip({ services }: { services: ClientSnapshot['client']['services'] }) {
  const on = new Set(services)
  return (
    <div className="svc-strip" role="img" aria-label={`Services: ${services.join(', ')}`}>
      {SERVICE_LINES.map(l => (
        <span
          key={l.key}
          className={`svc-cell${on.has(l.key) ? ' on' : ''}`}
          title={`${l.key} — ${on.has(l.key) ? 'in scope' : 'not in scope'}`}
        >
          {l.abbr}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ClientDetail({ s }: { s: ClientSnapshot }) {
  const c = s.commercials
  const svcCount = s.client.services.length
  return (
    <Card
      className="span-2"
      title={`${s.client.name} — account detail`}
      action={<Badge tone={s.health.tone} dot={false}>{s.health.band} · {s.health.score}</Badge>}
    >
      <div className="grid cols-3 exec-detail">
        {/* ---- contract & services ---- */}
        <div>
          <div className="card-title"><span>Contract</span></div>
          <dl className="detail-kv">
            <dt>Model</dt><dd>{c.model}</dd>
            <dt>Term</dt><dd>{c.termStart}–{c.termEnd}</dd>
            <dt>Managed spend</dt><dd>{fmtUSD(c.managedSpendUSD)} / yr</dd>
            <dt>Mgmt fee</dt><dd>{fmtUSD(c.annualFeeUSD)} · {pct(c.feePct)}</dd>
            <dt>Margin</dt>
            <dd><Badge tone={marginTone(c.actualMarginPct, c.targetMarginPct)} dot={false}>{pct(c.actualMarginPct)} vs {pct(c.targetMarginPct)}</Badge></dd>
            <dt>Account lead</dt><dd>{s.client.accountLead}</dd>
            <dt>Client HQ</dt><dd>{s.client.hq}</dd>
            <dt>Financials</dt><dd className="muted" style={{ fontWeight: 400 }}>{FINANCE_SOURCE}</dd>
          </dl>

          <div className="card-title" style={{ marginTop: 14 }}><span>Services in scope — {svcCount} of {SERVICE_LINES.length}</span></div>
          <ul className="svc-list">
            {SERVICE_LINES.map(l => {
              const on = s.client.services.includes(l.key)
              return (
                <li key={l.key} className={on ? 'on' : 'off'}>
                  <span className="svc-mark" aria-hidden>{on ? '✓' : '–'}</span>
                  <span className="svc-name">{l.key}</span>
                  <span className="svc-blurb">{on ? l.blurb : 'Not in scope'}</span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* ---- risk & incidents ---- */}
        <div>
          <div className="card-title"><span>Health drivers</span></div>
          <ol className="driver-list">
            {s.health.drivers.map(d => <li key={d}>{d}</li>)}
          </ol>

          <div className="card-title" style={{ marginTop: 14 }}><span>Weighted risk — {s.risk.weighted} total · {s.risk.perSite} per site</span></div>
          <div className="owner-grid">
            {OWNERS.map(o => (
              <div key={o} className="owner-cell">
                <span className="owner-n">{s.risk.byOwner[o]}</span>
                <span className="owner-l">{o}-owned</span>
                <span className="owner-w">× {OWNER_WEIGHT[o]}</span>
              </div>
            ))}
          </div>

          {s.risk.top.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 14 }}><span>Top live risks</span></div>
              <ul className="mini-list">
                {s.risk.top.map(r => {
                  const score = r.likelihood * r.impact
                  const tone: BadgeTone = score >= 16 ? 'critical' : score >= 10 ? 'serious' : score >= 5 ? 'warn' : 'good'
                  return (
                    <li key={r.id}>
                      <Badge tone={tone} dot={false}>{score}</Badge>
                      <span className="mini-body">
                        <span className="mini-title">{r.title}</span>
                        <span className="mini-meta">{siteCode(s, r.siteId)} · {r.owner} · {r.status}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <div className="card-title" style={{ marginTop: 14 }}>
            <span>Recent incidents{s.incidents.mttrMin > 0 ? ` · MTTR ${Math.round(s.incidents.mttrMin / 60 * 10) / 10}h` : ''}</span>
          </div>
          {s.incidents.recent.length === 0
            ? <div className="exec-empty">{s.onboarded ? 'No incidents on record' : `${s.incidents.total90d} incidents reported in 90 days — detail arrives once sites are onboarded to Quantum`}</div>
            : (
              <ul className="mini-list">
                {s.incidents.recent.map(i => (
                  <li key={i.id}>
                    <Badge tone={sevTone[i.severity]} dot={false}>{i.severity}</Badge>
                    <span className="mini-body">
                      <span className="mini-title">{i.title}</span>
                      <span className="mini-meta">{siteCode(s, i.siteId)} · {agoDays(i.startedDaysAgo)} · {i.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </div>

        {/* ---- projects & sites ---- */}
        <div>
          <div className="card-title"><span>Project spend — {s.projects.total} projects</span></div>
          <SpendBar label="Capex" spent={s.projects.capexSpent} budget={s.projects.capexBudget} color="var(--chart-1)" />
          <SpendBar label="Opex" spent={s.projects.opexSpent} budget={s.projects.opexBudget} color="var(--chart-3)" />
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <Badge tone="info" dot={false}>{s.projects.inFlight} in flight</Badge>
            {s.projects.overBudget > 0 && <Badge tone="critical" dot={false}>{s.projects.overBudget} over budget</Badge>}
            {s.projects.onHold > 0 && <Badge tone="serious" dot={false}>{s.projects.onHold} on hold</Badge>}
          </div>

          <div className="card-title" style={{ marginTop: 14 }}><span>Sites under contract — {s.siteCount}</span></div>
          {s.onboarded ? (
            <ul className="site-list">
              {s.sites.map(site => (
                <li key={site.id}>
                  <div className="site-line">
                    <strong>{site.code}</strong>
                    <span className="muted">{site.name} · {site.city}</span>
                    <span className="right mono" style={{ fontSize: 'var(--text-xs)' }}>Tier {site.tier} · {site.itLoadMW} MW</span>
                  </div>
                  <div className="site-sor">{site.dcim} · {site.bms} · {site.cmms}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="exec-empty">
              {s.siteCount} site{s.siteCount === 1 ? '' : 's'} on contract, not yet connected to Quantum. Metrics shown are the onboarding snapshot; systems of record will populate as integrations connect.
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function SpendBar({ label, spent, budget, color }: { label: string; spent: number; budget: number; color: string }) {
  const p = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  const over = spent > budget
  return (
    <div className="spend">
      <div className="spend__row">
        <span className="exec-kind">{label}</span>
        <span>{fmtUSD(spent)} <span className="muted">/ {fmtUSD(budget)}</span></span>
        <span className={`right${over ? ' spend__over' : ' muted'}`}>{over ? `over by ${fmtUSD(spent - budget)}` : `${p}%`}</span>
      </div>
      <div className="exec-bar"><div style={{ width: `${p}%`, background: over ? 'var(--status-critical)' : color }} /></div>
    </div>
  )
}

const siteCode = (s: ClientSnapshot, siteId: string) => s.sites.find(x => x.id === siteId)?.code ?? siteId
