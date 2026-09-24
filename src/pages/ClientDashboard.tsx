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
import { axisTick, CHART_VARS, MiniLegend } from '../components/charts'
import { agoDays, FINANCE_SOURCE, marginTone, pct, riskScoreTone } from '../components/exec'
import { EmeraldButton, EmeraldNotification } from '../emerald'
import '../styles/executive.css'

const OWNERS: RiskOwner[] = ['CBRE', 'Shared', 'Client']
const SEVS = ['SEV1', 'SEV2', 'SEV3', 'SEV4'] as const
/** Demo "today" for contract-term progress — September 2026, fixed for determinism. */
const NOW_YEAR = 2026 + 8.5 / 12
const NOTICE_MONTHS: Record<string, number> = { 'Fixed fee': 12, 'Cost-plus': 6, GMP: 12 }
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

  const sevMix = SEVS.map(sev => ({
    sev,
    n: incidents.filter(i => ids.has(i.siteId) && i.startedDaysAgo <= 90 && i.severity === sev).length,
  }))
  const liveRisks = risks.filter(r => ids.has(r.siteId) && r.status !== 'Closed')
  const riskByCategory = [...liveRisks.reduce((m, r) => m.set(r.category, (m.get(r.category) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
  const termYears = c.termEnd - c.termStart
  const termPct = Math.max(0, Math.min(100, ((NOW_YEAR - c.termStart) / termYears) * 100))
  const noticeYear = c.termEnd - NOTICE_MONTHS[c.model] / 12
  const yearsToRenewal = c.termEnd - NOW_YEAR

  return (
    <div className="exec-page">
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
        <Card title="Contract & services" className="fill-col">
          <dl className="detail-kv">
            <dt>Model</dt><dd>{c.model}</dd>
            <dt>Term</dt><dd>{c.termStart}–{c.termEnd}</dd>
            <dt>Managed spend</dt><dd>{fmtUSD(c.managedSpendUSD)} / yr</dd>
            <dt>Mgmt fee</dt><dd>{fmtUSD(c.annualFeeUSD)} · {pct(c.feePct)}</dd>
            <dt>Margin target</dt><dd>{pct(c.targetMarginPct)}</dd>
            <dt>Financials</dt><dd className="muted" style={{ fontWeight: 400 }}>{FINANCE_SOURCE}</dd>
          </dl>

          <div className="card-title" style={{ marginTop: 14 }}><span>Term — year {Math.min(termYears, Math.floor(NOW_YEAR - c.termStart) + 1)} of {termYears}</span></div>
          <div className="term">
            <div className="term__track">
              <div className="term__fill" style={{ width: `${termPct}%` }} />
              <div className="term__notice" style={{ left: `${((noticeYear - c.termStart) / termYears) * 100}%` }} title={`Notice due ${Math.floor(noticeYear)}`} />
            </div>
            <div className="term__labels">
              <span>{c.termStart}</span>
              <span className="term__now" style={{ left: `${termPct}%` }}>today</span>
              <span>{c.termEnd}</span>
            </div>
          </div>
          <div className="exec-sub">
            {yearsToRenewal <= 1.5
              ? <><strong style={{ color: 'var(--status-warn)' }}>Renewal inside 18 months</strong> · notice period {NOTICE_MONTHS[c.model]} months, due {Math.floor(noticeYear)}</>
              : <>Renews {c.termEnd} · {yearsToRenewal.toFixed(1)} yrs remaining · notice period {NOTICE_MONTHS[c.model]} months, due {Math.floor(noticeYear)}</>}
          </div>

          <div className="push-bottom">
          <div className="card-title"><span>Services in scope — {client.services.length} of {SERVICE_LINES.length}</span></div>
          <ul className="svc-grid">
            {SERVICE_LINES.map(l => {
              const on = client.services.includes(l.key)
              return (
                <li key={l.key} className={on ? 'on' : 'off'} title={on ? l.blurb : `${l.key} — not in scope, cross-sell opportunity`}>
                  <span className="svc-mark" aria-hidden>{on ? '✓' : '–'}</span>
                  <span className="svc-name">{l.key}</span>
                </li>
              )
            })}
          </ul>
          <div className="exec-sub" style={{ marginTop: 8 }}>
            {client.services.length < SERVICE_LINES.length
              ? `Not in scope: ${SERVICE_LINES.filter(l => !client.services.includes(l.key)).map(l => l.key).join(', ')} — cross-sell white space.`
              : 'Full DCS service line in scope.'}
          </div>
          </div>
        </Card>

        {/* health & risk */}
        <Card title="Health drivers & risk" className="fill-col">
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
          {riskByCategory.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 14 }}><span>Where the risk sits — {liveRisks.length} live</span></div>
              <div className="bullets bullets--compact">
                {riskByCategory.map(([cat, n]) => (
                  <div key={cat} className="bullet bullet--compact">
                    <div className="bullet__label"><span className="bullet__name">{cat}</span></div>
                    <div className="bullet__track" aria-hidden><div className="bullet__fill" style={{ width: `${(n / liveRisks.length) * 100}%` }} /></div>
                    <div className="bullet__value"><span className="exec-num">{n}</span><span className="muted">{Math.round((n / liveRisks.length) * 100)}%</span></div>
                  </div>
                ))}
              </div>
            </>
          )}
          {s.risk.top.length > 0 && (
            <div className="push-bottom">
              <div className="card-title"><span>Top live risks</span></div>
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
            </div>
          )}
        </Card>

        {/* incidents & projects */}
        <Card title="Incidents & project spend" className="fill-col">
          <div className="owner-grid owner-grid--4" style={{ marginBottom: 12 }}>
            {sevMix.map(m => (
              <div key={m.sev} className={`owner-cell${m.n > 0 && (m.sev === 'SEV1' || m.sev === 'SEV2') ? ' owner-cell--hot' : ''}`}>
                <span className="owner-n">{m.n}</span>
                <span className="owner-l">{m.sev}</span>
                <span className="owner-w">90 days</span>
              </div>
            ))}
          </div>
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
          <div className="push-bottom">
            <div className="card-title"><span>Project spend — {s.projects.total} projects</span></div>
            <SpendBar label="Capex" spent={s.projects.capexSpent} budget={s.projects.capexBudget} color="var(--chart-1)" />
            <SpendBar label="Opex" spent={s.projects.opexSpent} budget={s.projects.opexBudget} color="var(--chart-3)" />
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <Badge tone="info" dot={false}>{s.projects.inFlight} in flight</Badge>
              {s.projects.overBudget > 0 && <Badge tone="critical" dot={false}>{s.projects.overBudget} over budget</Badge>}
              {s.projects.onHold > 0 && <Badge tone="serious" dot={false}>{s.projects.onHold} on hold</Badge>}
            </div>
          </div>
        </Card>
      </div>

      {s.onboarded && (
        <>
          <div className="grid cols-3 exec-row" style={{ marginBottom: 'var(--gap-md)' }}>
            <Card className="span-2 fill-col" title="IT load by site — 14 days (MW)">
              <div className="chart-fill">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={loadTrend} margin={{ top: 6, right: 12, bottom: 0, left: -14 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="t" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(0)} />
                    <Tooltip content={<ChartTip unit=" MW" />} cursor={{ stroke: 'var(--chart-ref)', strokeDasharray: '3 3' }} />
                    {s.sites.map((site, i) => (
                      <Line key={site.id} type="monotone" dataKey={site.code} stroke={CHART_VARS[i % CHART_VARS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
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
            <div className="site-cards">
              {siteRows.map(({ site, hot, crit, open, util }) => (
                <div key={site.id} className="site-card">
                  <div className="site-card__head">
                    <strong>{site.code}</strong>
                    <span className="muted">{site.name} · {site.city}</span>
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <Badge tone="neutral" dot={false}>{site.region}</Badge>
                    <Badge tone="neutral" dot={false}>Tier {site.tier}</Badge>
                    <Badge tone="neutral" dot={false}>{site.halls} hall{site.halls === 1 ? '' : 's'}</Badge>
                  </div>
                  <dl className="site-card__stats">
                    <div><dt>IT load</dt><dd>{site.itLoadMW.toFixed(1)} MW</dd></div>
                    <div><dt>Utilization</dt><dd>{util.toFixed(0)}%</dd></div>
                    <div><dt>PUE</dt><dd>{site.currentPUE.toFixed(2)}</dd></div>
                    <div><dt>Hot racks</dt><dd>{hot > 0 ? <Badge tone="warn" dot={false}>{hot}</Badge> : '0'}</dd></div>
                    <div><dt>Critical alarms</dt><dd>{crit > 0 ? <Badge tone="critical" dot={false}>{crit}</Badge> : '0'}</dd></div>
                    <div><dt>Open WOs</dt><dd>{open}</dd></div>
                  </dl>
                  <div className="site-sor">{site.dcim} · {site.bms} · {site.cmms}</div>
                </div>
              ))}
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
