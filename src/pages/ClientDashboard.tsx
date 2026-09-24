import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useData } from '../context/DataContext'
import {
  buildPlan, clientById, DAY_LABELS_14, defaultParams, fmtUSD, getEquipment, getHistory, getRacks,
  mergedSeries, OWNER_WEIGHT, SERVICE_LINES, snapshotFor, type Client, type RiskOwner,
} from '../data'
import { Badge, Card, ChartTip, sevTone, StatTile, type BadgeTone } from '../components/ui'
import { axisTick, CHART_VARS, ChartFrame, MiniLegend } from '../components/charts'
import { agoDays, FINANCE_SOURCE, marginTone, pct, riskScoreTone } from '../components/exec'
import { EmeraldButton, EmeraldNotification } from '../emerald'
import '../styles/executive.css'

const OWNERS: RiskOwner[] = ['CBRE', 'Shared', 'Client']
const INTERVENTION_TONE: Record<string, BadgeTone> = {
  Replace: 'critical', Refurbish: 'serious', 'Extend life': 'warn', Monitor: 'neutral',
}

export function ClientDashboard() {
  const { clientId } = useParams()
  const client = clientById(clientId ?? '')
  if (!client) return <Navigate to="/executive" replace />
  return <Dashboard client={client} />
}

function Dashboard({ client }: { client: Client }) {
  const { risks, incidents, projects, alarms, tickets, capexDecisions, pull } = useData()
  const s = useMemo(() => snapshotFor(client, { risks, incidents, projects }), [client, risks, incidents, projects])
  const c = s.commercials
  const ids = useMemo(() => new Set(s.sites.map(x => x.id)), [s.sites])

  const outlook = useMemo(() => s.onboarded ? buildPlan({ ...defaultParams(), siteIds: s.sites.map(x => x.id) }, {
    sites: s.sites,
    equipment: getEquipment('all').filter(e => ids.has(e.siteId)),
    alarms: alarms.filter(a => ids.has(a.siteId)),
    tickets: tickets.filter(t => ids.has(t.siteId)),
    risks: risks.filter(r => ids.has(r.siteId)),
    projects: projects.filter(p => ids.has(p.siteId)),
    racks: getRacks('all').filter(r => ids.has(r.siteId)),
    history: getHistory,
    decisions: capexDecisions,
  }) : null, [s, ids, alarms, tickets, risks, projects, capexDecisions])

  const loadTrend = useMemo(
    () => s.onboarded ? mergedSeries(s.sites, x => ({ base: x.itLoadMW, variance: x.itLoadMW * 0.08 }), DAY_LABELS_14, 2) : [],
    [s.sites, s.onboarded],
  )

  const siteRows = s.sites.map(site => {
    const racks = getRacks(site.id)
    return {
      site,
      hot: racks.filter(r => r.status === 'warning' || r.status === 'critical').length,
      crit: alarms.filter(a => a.siteId === site.id && a.severity === 'critical' && !a.acked).length,
      open: tickets.filter(t => t.siteId === site.id && (t.status === 'Open' || t.status === 'In Progress')).length,
      util: (site.itLoadMW / site.capacityMW) * 100,
    }
  })

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{client.name}</h1>
          <p className="subtitle">
            {client.sector} · HQ {client.hq} · account lead {client.accountLead} · {c.model} contract {c.termStart}–{c.termEnd}
            {s.onboarded ? ` · ${s.siteCount} Quantum site${s.siteCount === 1 ? '' : 's'} · ${s.itLoadMW.toFixed(1)} MW` : ` · ${s.siteCount} site${s.siteCount === 1 ? '' : 's'} on contract`}
          </p>
        </div>
        <div className="row right" style={{ gap: 10 }}>
          <Badge tone={s.health.tone} dot={false}>{s.health.band} · {s.health.score}</Badge>
          <EmeraldButton variant="secondary" onClick={() => pull(FINANCE_SOURCE, `Refresh ${client.name} fees & margins`)}>
            ⟳ Pull financials
          </EmeraldButton>
        </div>
      </div>

      {!s.onboarded && (
        <div style={{ marginBottom: 'var(--gap-md)' }}>
          <EmeraldNotification status="info" title="Footprint not yet connected to Quantum">
            {client.name}’s sites have not been onboarded, so this dashboard shows the onboarding snapshot. Risk, incident and
            spend detail will populate from the site systems of record as the integrations connect.
          </EmeraldNotification>
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Health" value={s.health.score} unit="/ 100"
          sub={<Badge tone={s.health.tone} dot={false}>{s.health.band}</Badge>} />
        <StatTile label="Weighted risk" value={s.risk.perSite} unit="per site"
          sub={<span className="row" style={{ gap: 6 }}><Badge tone={s.risk.tone} dot={false}>{s.risk.band}</Badge><span className="muted">{s.risk.live} live · {s.risk.high} high</span></span>} />
        <StatTile label="Incidents — 90 days" value={s.incidents.total90d}
          sub={<span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {s.incidents.sev1 > 0 ? <Badge tone="critical" dot={false}>{s.incidents.sev1} outage{s.incidents.sev1 === 1 ? '' : 's'}</Badge> : <Badge tone="good" dot={false}>No outages</Badge>}
            {s.incidents.active > 0 && <Badge tone="warn" dot={false}>{s.incidents.active} active</Badge>}
            {s.incidents.mttrMin > 0 && <span className="muted">MTTR {(s.incidents.mttrMin / 60).toFixed(1)}h</span>}
          </span>} />
        <StatTile label="Margin" value={pct(c.actualMarginPct)}
          sub={<span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Badge tone={marginTone(c.actualMarginPct, c.targetMarginPct)} dot={false}>{c.actualMarginPct >= c.targetMarginPct ? '+' : '−'}{Math.abs(c.actualMarginPct - c.targetMarginPct).toFixed(1)} vs {pct(c.targetMarginPct)}</Badge>
            <span className="muted">fee {fmtUSD(c.annualFeeUSD)} · {pct(c.feePct)}</span>
          </span>} />
      </div>

      <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
        {/* contract & services */}
        <Card title="Contract & services">
          <dl className="detail-kv">
            <dt>Model</dt><dd>{c.model}</dd>
            <dt>Term</dt><dd>{c.termStart}–{c.termEnd}</dd>
            <dt>Managed spend</dt><dd>{fmtUSD(c.managedSpendUSD)} / yr</dd>
            <dt>Mgmt fee</dt><dd>{fmtUSD(c.annualFeeUSD)} · {pct(c.feePct)}</dd>
            <dt>Margin target</dt><dd>{pct(c.targetMarginPct)}</dd>
            <dt>Financials</dt><dd className="muted" style={{ fontWeight: 400 }}>{FINANCE_SOURCE}</dd>
          </dl>
          <div className="card-title" style={{ marginTop: 14 }}><span>Services in scope — {client.services.length} of {SERVICE_LINES.length}</span></div>
          <ul className="svc-list">
            {SERVICE_LINES.map(l => {
              const on = client.services.includes(l.key)
              return (
                <li key={l.key} className={on ? 'on' : 'off'}>
                  <span className="svc-mark" aria-hidden>{on ? '✓' : '–'}</span>
                  <span className="svc-name">{l.key}</span>
                  <span className="svc-blurb">{on ? l.blurb : 'Not in scope — cross-sell opportunity'}</span>
                </li>
              )
            })}
          </ul>
        </Card>

        {/* health & risk */}
        <Card title="Health drivers & risk">
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
                {s.risk.top.map(r => (
                  <li key={r.id}>
                    <Badge tone={riskScoreTone(r.likelihood * r.impact)} dot={false}>{r.likelihood * r.impact}</Badge>
                    <span className="mini-body">
                      <span className="mini-title">{r.title}</span>
                      <span className="mini-meta">{s.sites.find(x => x.id === r.siteId)?.code} · {r.owner} · {r.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* incidents & projects */}
        <Card title="Incidents & project spend">
          {s.incidents.recent.length === 0
            ? <div className="exec-empty">{s.onboarded ? 'No incidents on record for this account.' : `${s.incidents.total90d} incidents reported in 90 days — detail arrives with onboarding.`}</div>
            : (
              <ul className="mini-list">
                {s.incidents.recent.map(i => (
                  <li key={i.id}>
                    <Badge tone={sevTone[i.severity]} dot={false}>{i.severity}</Badge>
                    <span className="mini-body">
                      <span className="mini-title">{i.title}</span>
                      <span className="mini-meta">{s.sites.find(x => x.id === i.siteId)?.code} · {agoDays(i.startedDaysAgo)} · {i.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          <div className="card-title" style={{ marginTop: 14 }}><span>Project spend — {s.projects.total} projects</span></div>
          <SpendBar label="Capex" spent={s.projects.capexSpent} budget={s.projects.capexBudget} color="var(--chart-1)" />
          <SpendBar label="Opex" spent={s.projects.opexSpent} budget={s.projects.opexBudget} color="var(--chart-3)" />
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <Badge tone="info" dot={false}>{s.projects.inFlight} in flight</Badge>
            {s.projects.overBudget > 0 && <Badge tone="critical" dot={false}>{s.projects.overBudget} over budget</Badge>}
            {s.projects.onHold > 0 && <Badge tone="serious" dot={false}>{s.projects.onHold} on hold</Badge>}
          </div>
        </Card>
      </div>

      {s.onboarded && (
        <>
          <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
            <Card className="span-2" title="IT load by site — 14 days (MW)">
              <ChartFrame height={220}>
                <ResponsiveContainer>
                  <LineChart data={loadTrend} margin={{ top: 6, right: 12, bottom: 0, left: -14 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="t" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(0)} />
                    <Tooltip content={<ChartTip unit=" MW" />} cursor={{ stroke: 'var(--chart-ref)', strokeDasharray: '3 3' }} />
                    {s.sites.map((site, i) => (
                      <Line key={site.id} type="monotone" dataKey={site.code} stroke={CHART_VARS[i % CHART_VARS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartFrame>
              <MiniLegend items={s.sites.map((site, i) => ({ label: site.code, color: CHART_VARS[i % CHART_VARS.length] }))} />
            </Card>

            <Card title="Capital outlook — planner, 5 yrs">
              {outlook && (
                <>
                  <div className="outlook-head">
                    <span className="outlook-total">{fmtUSD(outlook.totals.planned)}</span>
                    <span className="muted">{outlook.totals.plannedCount} actions · {outlook.recs.filter(r => r.intervention === 'Replace').length} replacements · {fmtUSD(outlook.byYear[0]?.total ?? 0)} in {outlook.byYear[0]?.year}</span>
                  </div>
                  <div className="card-title" style={{ marginTop: 10 }}><span>Top recommendations</span></div>
                  <ul className="mini-list">
                    {[...outlook.recs].sort((a, b) => b.urgency - a.urgency).slice(0, 4).map(r => (
                      <li key={r.asset.id}>
                        <Badge tone={INTERVENTION_TONE[r.intervention]} dot={false}>{r.intervention}</Badge>
                        <span className="mini-body">
                          <span className="mini-title">{r.asset.name} · {r.asset.kind} · {r.site.code}</span>
                          <span className="mini-meta">urgency {r.urgency} · {fmtUSD(r.costUSD)} · {r.year}{r.evidence[0] ? ` · ${r.evidence[0]}` : ''}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="exec-sub" style={{ marginTop: 8 }}>Balanced baseline from asset condition, maintenance history, BMS alarms and whitespace telemetry. Operations → Capital Planning for the prompt-driven plan.</div>
                </>
              )}
            </Card>
          </div>

          <Card title={`Sites under contract — ${s.siteCount}`}>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Site</th><th>Region</th><th>Tier</th>
                    <th className="num">IT load</th><th className="num">Utilization</th><th className="num">PUE</th>
                    <th className="num">Hot racks</th><th className="num">Critical alarms</th><th className="num">Open WOs</th>
                    <th>Systems of record</th>
                  </tr>
                </thead>
                <tbody>
                  {siteRows.map(({ site, hot, crit, open, util }) => (
                    <tr key={site.id}>
                      <td><strong>{site.code}</strong> <span className="muted">{site.name} · {site.city}</span></td>
                      <td>{site.region}</td>
                      <td>{site.tier}</td>
                      <td className="num">{site.itLoadMW.toFixed(1)} MW</td>
                      <td className="num">{util.toFixed(0)}%</td>
                      <td className="num">{site.currentPUE.toFixed(2)}</td>
                      <td className="num">{hot > 0 ? <Badge tone="warn" dot={false}>{hot}</Badge> : '0'}</td>
                      <td className="num">{crit > 0 ? <Badge tone="critical" dot={false}>{crit}</Badge> : '0'}</td>
                      <td className="num">{open}</td>
                      <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{site.dcim} · {site.bms} · {site.cmms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
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
