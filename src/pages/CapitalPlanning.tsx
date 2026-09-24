import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import {
  answerFollowUp, buildPlan, costBasisFor, defaultParams, FOLLOW_UPS, fmtUSD, getEquipment, getHistory,
  getRacks, getSites, interpretPrompt, THIS_YEAR,
  type CapexIntervention, type CapexPlan, type FollowUp, type PlanStep, type Recommendation,
} from '../data'
import { alarmTone, Badge, Card, ChartTip, equipTone, Segmented, StatTile, type BadgeTone } from '../components/ui'
import { axisTick, MiniLegend } from '../components/charts'
import { EmeraldButton, EmeraldChip, EmeraldSpinner, EmeraldSwitch, EmeraldTextarea } from '../emerald'
import '../styles/capital.css'

const STEP_MS = 520
const SUGGESTIONS = [
  'Build a 5-year plan within $3M per year',
  'Prioritise resilience — eliminate single points of failure first, $4M per year',
  'Maximise energy efficiency and PUE gains across the cooling plant',
  'What if the budget is cut 20%? Keep $2.5M per year',
  'Defer non-critical spend beyond 2027, $4M annually',
  'Plan UPS and generator replacements for Kyndryl',
]

const INTERVENTION_TONE: Record<CapexIntervention, BadgeTone> = {
  Replace: 'critical', Refurbish: 'serious', 'Extend life': 'warn', Monitor: 'neutral',
}
const STEP_TONE: Record<PlanStep['kind'], BadgeTone> = {
  interpret: 'info', pull: 'neutral', compute: 'info', result: 'good',
}
const STEP_LABEL: Record<PlanStep['kind'], string> = {
  interpret: 'prompt', pull: '← pull', compute: 'reason', result: 'done',
}

const urgencyTone = (u: number): BadgeTone =>
  u >= 80 ? 'critical' : u >= 65 ? 'serious' : u >= 50 ? 'warn' : 'info'
const fmtAgo = (min: number) => (min < 60 ? `${min}m ago` : min < 1440 ? `${Math.round(min / 60)}h ago` : `${Math.round(min / 1440)}d ago`)

export function CapitalPlanning() {
  const { siteId } = useApp()
  const {
    alarms, tickets, risks, projects, capexPlan, capexDecisions,
    setCapexPlan, decideCapex, clearCapexDecision, addProject, pull,
  } = useData()

  const params = useMemo(() => capexPlan ?? defaultParams(), [capexPlan])
  /* an explicit scope in the prompt overrides the global site selector */
  const scopeId = params.siteIds ? 'all' : siteId

  const plan = useMemo<CapexPlan>(() => buildPlan(params, {
    sites: getSites(scopeId),
    equipment: getEquipment(scopeId),
    alarms: scoped(alarms, scopeId),
    tickets: scoped(tickets, scopeId),
    risks: scoped(risks, scopeId),
    projects: scoped(projects, scopeId),
    racks: getRacks(scopeId),
    history: getHistory,
    decisions: capexDecisions,
  }), [params, scopeId, alarms, tickets, risks, projects, capexDecisions])

  /* ---- agent console ---- */
  const [prompt, setPrompt] = useState(capexPlan?.prompt ?? '')
  const [running, setRunning] = useState(false)
  /* full step detail streams while running; afterwards the log collapses to a receipt unless expanded */
  const [showReasoning, setShowReasoning] = useState(false)
  const [visibleSteps, setVisibleSteps] = useState(capexPlan ? plan.steps.length : 0)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), [])

  /* raise a pull sync event as each data-gathering step lands */
  useEffect(() => {
    if (!running) return
    const step = plan.steps[visibleSteps - 1]
    if (step?.kind === 'pull') pull(step.system, step.title)
  }, [visibleSteps, running]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = (text: string) => {
    const t = text.trim()
    if (!t || running) return
    timers.current.forEach(x => window.clearTimeout(x))
    timers.current = []
    setPrompt(t)
    setCapexPlan(interpretPrompt(t, Date.now()))
    setSelectedId(null)
    setChat([])
    setRunning(true)
    setShowReasoning(false)
    setVisibleSteps(0)
    const n = plan.steps.length
    for (let i = 0; i < n; i++) {
      timers.current.push(window.setTimeout(() => {
        setVisibleSteps(i + 1)
        if (i === n - 1) setRunning(false)
      }, STEP_MS * (i + 1)))
    }
  }

  const reset = () => {
    timers.current.forEach(x => window.clearTimeout(x))
    setRunning(false)
    setVisibleSteps(0)
    setPrompt('')
    setCapexPlan(null)
    setSelectedId(null)
    setChat([])
  }

  /* ---- table state ---- */
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [showMonitor, setShowMonitor] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chat, setChat] = useState<{ q: string; a: string }[]>([])

  const rows = useMemo(() => {
    const base = showMonitor ? [...plan.recs, ...plan.monitorOnly] : plan.recs
    return base.filter(r => yearFilter === 'all' || String(r.year) === yearFilter)
  }, [plan, yearFilter, showMonitor])

  const selected = [...plan.recs, ...plan.monitorOnly, ...plan.dismissed].find(r => r.asset.id === selectedId) ?? null

  const accept = (r: Recommendation) => {
    addProject({
      siteId: r.asset.siteId,
      name: `${r.intervention} — ${r.asset.name} (${r.asset.kind})`,
      type: r.intervention === 'Extend life' ? 'Opex' : 'Capex',
      category: r.intervention === 'Replace' ? 'Lifecycle replacement' : params.priority === 'efficiency' ? 'Efficiency' : 'Resilience',
      status: 'Proposed',
      budgetUSD: r.costUSD,
      targetYear: r.year,
      linkedAsset: r.asset.name,
      rationale: r.rationale,
    })
    decideCapex(r.asset.id, r.asset.name, 'accepted', r.year)
    if (selectedId === r.asset.id) setSelectedId(null)
  }
  const defer = (r: Recommendation) => decideCapex(r.asset.id, r.asset.name, 'deferred', Math.min(params.startYear + params.horizonYears - 1, r.year + 1))
  const dismiss = (r: Recommendation) => { decideCapex(r.asset.id, r.asset.name, 'dismissed'); if (selectedId === r.asset.id) setSelectedId(null) }

  const ask = (q: FollowUp) => {
    if (!selected) return
    const label = FOLLOW_UPS.find(f => f.key === q)!.label
    setChat(c => [...c, { q: label, a: answerFollowUp(selected, q, plan) }])
  }

  /* ---- derived display ---- */
  const envelope = plan.byYear[0]?.envelope ?? null
  const chartData = plan.byYear.map(b => ({
    label: String(b.year),
    Replace: Math.round(b.byIntervention.Replace / 1000),
    Refurbish: Math.round(b.byIntervention.Refurbish / 1000),
    'Extend life': Math.round(b.byIntervention['Extend life'] / 1000),
  }))
  const counts = {
    replace: plan.recs.filter(r => r.intervention === 'Replace').length,
    refurb: plan.recs.filter(r => r.intervention === 'Refurbish').length,
    extend: plan.recs.filter(r => r.intervention === 'Extend life').length,
  }
  const sig = plan.totals.signals
  const planDone = !running && visibleSteps >= plan.steps.length
  const scopeNote = params.siteIds
    ? `Scope from prompt: ${plan.scopeSites.map(s => s.code).join(', ')}`
    : siteId === 'all' ? `Scope: all ${plan.scopeSites.length} sites` : `Scope: ${plan.scopeSites[0]?.code}`

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>Capital Planning</h1>
          <p className="subtitle">
            Agentic capex planner — reads asset condition and maintenance history from the CMMS, alarms and equipment state from the BMS,
            whitespace telemetry from the DCIM and the risk register, then allocates spend across the horizon. Every recommendation shows its evidence.
          </p>
        </div>
        <EmeraldButton variant="secondary" className="right" onClick={() => pull('Quantum MCP Hub', 'Refresh planner evidence (CMMS · BMS · DCIM)')}>
          ⟳ Refresh evidence
        </EmeraldButton>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Assets assessed" value={plan.totals.assetsAssessed}
          sub={<span className="muted">{scopeNote}{params.kinds ? ` · ${params.kinds.join(', ')}` : ''}</span>} />
        <StatTile label="Capital actions" value={plan.totals.plannedCount}
          sub={<span className="muted">{counts.replace} replace · {counts.refurb} refurbish · {counts.extend} extend life</span>} />
        <StatTile label={`Plan total — ${params.horizonYears} yrs`} value={fmtUSD(plan.totals.planned)}
          sub={envelope != null
            ? (plan.totals.overEnvelope > 0
              ? <Badge tone="critical" dot={false}>{fmtUSD(plan.totals.overEnvelope)} over {fmtUSD(envelope)}/yr envelope</Badge>
              : <Badge tone="good" dot={false}>Within {fmtUSD(envelope)}/yr envelope</Badge>)
            : <span className="muted">no envelope set — natural years</span>} />
        <StatTile label="Evidence signals" value={sig.alarms + sig.cm + sig.hotRacks + sig.risks + sig.tickets}
          sub={<span className="muted">{sig.alarms} alarms · {sig.cm} CM · {sig.hotRacks} hot racks · {sig.risks} risks · {sig.tickets} WOs</span>} />
      </div>

      {/* ---- agent console + plan by year ---- */}
      <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card className="span-2 fill-col" title="Planner"
          action={<Badge tone={running ? 'warn' : capexPlan ? 'good' : 'neutral'} dot={running}>{running ? 'Planning…' : capexPlan ? 'Plan ready' : 'Baseline'}</Badge>}>
          <form className="agent-console" onSubmit={e => { e.preventDefault(); run(prompt) }}>
            <EmeraldTextarea
              label="Tell the planner what you need"
              block
              rows={2}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(prompt) } }}
              placeholder="e.g. Plan $4M per year over 5 years, prioritise resilience at ASH1"
            />
            <div className="agent-actions">
              <EmeraldButton type="submit" disabled={running || !prompt.trim()} loading={running}>Run planner</EmeraldButton>
              {(capexPlan || prompt) && <EmeraldButton type="button" variant="text" size="sm" onClick={reset}>Reset to baseline</EmeraldButton>}
              <span className="muted agent-hint">Enter to run · scope, budget, horizon, priority and asset classes are read from the prompt</span>
            </div>
          </form>
          <div className="agent-suggest">
            {SUGGESTIONS.map(s => (
              <EmeraldChip key={s} onClick={() => run(s)} disabled={running}>{s}</EmeraldChip>
            ))}
          </div>

          {visibleSteps === 0 && !running && (
            <div className="agent-baseline push-bottom">
              Showing the <strong>baseline plan</strong> — balanced weighting, no budget envelope, current site scope.
              Run a prompt to re-plan; the planner streams each step so you can see where the evidence came from.
            </div>
          )}

          {visibleSteps > 0 && (
            <>
              <div className="agent-log__head">
                <span>{running ? `Step ${visibleSteps} of ${plan.steps.length}` : `${plan.steps.length} steps · ${plan.steps.filter(x => x.kind === 'pull').length} pulls from site systems`}</span>
                {planDone && (
                  <EmeraldButton variant="text" size="sm" onClick={() => setShowReasoning(v => !v)}>
                    {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                  </EmeraldButton>
                )}
              </div>
              <ol className={`agent-log${planDone && !showReasoning ? ' agent-log--receipt' : ''}`} aria-live="polite">
                {plan.steps.slice(0, visibleSteps).map((s, i) => {
                  const active = running && i === visibleSteps - 1
                  const expanded = running || showReasoning
                  return (
                    <li key={s.id} className={`agent-step${active ? ' active' : ' done'}`}>
                      <span className="agent-step__mark" aria-hidden>{active ? <EmeraldSpinner size="sm" /> : '✓'}</span>
                      <div className="agent-step__body">
                        <div className="agent-step__head">
                          <span className="agent-step__title">{s.title}</span>
                          <Badge tone={STEP_TONE[s.kind]} dot={false}>{STEP_LABEL[s.kind]}</Badge>
                          <span className="agent-step__sys">{s.system}</span>
                        </div>
                        {!active && expanded && <div className="agent-step__detail">{s.detail}</div>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
          {planDone && visibleSteps > 0 && <div className="agent-narrative push-bottom">{plan.narrative}</div>}
        </Card>

        <Card title="Planned spend by year ($k)" className="fill-col">
          <div className="chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip unit="k" />} cursor={{ fill: 'var(--surface-3)' }} />
                {envelope != null && (
                  <ReferenceLine y={Math.round(envelope / 1000)} stroke="var(--chart-ref)" strokeDasharray="4 4"
                    label={{ value: 'Envelope', position: 'insideTopRight', fill: 'var(--chart-axis)', fontSize: 11 }} />
                )}
                <Bar dataKey="Replace" stackId="a" fill="var(--chart-1)" maxBarSize={40} stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="Refurbish" stackId="a" fill="var(--chart-2)" maxBarSize={40} stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="Extend life" stackId="a" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={40} stroke="var(--surface)" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <MiniLegend items={[
            { label: 'Replace', color: 'var(--chart-1)' },
            { label: 'Refurbish', color: 'var(--chart-2)' },
            { label: 'Extend life', color: 'var(--chart-3)' },
          ]} />
          <div className="year-strip">
            {plan.byYear.map(b => (
              <div key={b.year} className={`year-pill${b.over > 0 ? ' over' : ''}`}>
                <span className="year-pill__y">{b.year}</span>
                <span className="year-pill__v">{fmtUSD(b.total)}</span>
                <span className="year-pill__n">{b.count} item{b.count === 1 ? '' : 's'}{b.over > 0 ? ` · +${fmtUSD(b.over)}` : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---- recommendations ---- */}
      <div className="filter-row">
        <Segmented
          options={[{ value: 'all', label: 'All years' }, ...plan.byYear.map(b => ({ value: String(b.year), label: String(b.year) }))]}
          value={yearFilter}
          onChange={setYearFilter}
        />
        <EmeraldSwitch label="Include monitor-only assets" checked={showMonitor} onChange={e => setShowMonitor(e.target.checked)} />
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {rows.length} shown · {plan.alreadyPlanned.length} already in <Link to="/projects">Projects</Link>
          {plan.dismissed.length > 0 && <> · {plan.dismissed.length} dismissed</>}
        </span>
      </div>

      <Card>
        <div className="table-scroll" style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table className="data-table cap-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th style={{ minWidth: 150 }}>Urgency</th>
                <th>Evidence</th>
                <th>Action</th>
                <th className="num">Est. cost</th>
                <th className="num">Year</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.asset.id} className={`clickable${selectedId === r.asset.id ? ' selected' : ''}`} onClick={() => { setSelectedId(r.asset.id); setChat([]) }}>
                  <td>
                    <div className="cap-asset">
                      <strong>{r.asset.name}</strong>
                      <span className="muted">{r.asset.kind} · {r.asset.vendor}</span>
                    </div>
                    <div className="exec-sub">{r.site.code} · H{r.asset.hall}{r.client ? ` · ${r.client.name}` : ''}</div>
                  </td>
                  <td>
                    <div className="urgency">
                      <div className="urgency__top">
                        <Badge tone={urgencyTone(r.urgency)} dot={false}>{r.urgency}</Badge>
                        {r.urgency !== r.baseUrgency && <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>↑ {params.priority}</span>}
                      </div>
                      <div className="urgency__meter"><div style={{ width: `${r.urgency}%`, background: `var(--status-${urgencyTone(r.urgency)})` }} /></div>
                    </div>
                  </td>
                  <td>
                    <div className="ev-chips">
                      {r.evidence.length === 0 && <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>within expectations</span>}
                      {r.evidence.slice(0, 4).map(e => <span key={e} className="ev-chip">{e}</span>)}
                      {r.evidence.length > 4 && <span className="ev-chip more">+{r.evidence.length - 4}</span>}
                    </div>
                  </td>
                  <td><Badge tone={INTERVENTION_TONE[r.intervention]} dot={false}>{r.intervention}</Badge></td>
                  <td className="num">{r.costUSD > 0 ? fmtUSD(r.costUSD) : '—'}</td>
                  <td className="num">
                    {r.intervention === 'Monitor' ? <span className="muted">—</span> : (
                      <>
                        <span className="exec-num">{r.year}</span>
                        {r.pulledForward && <div className="exec-sub">critical signal</div>}
                        {r.deferredByEnvelope > 0 && <div className="exec-sub">+{r.deferredByEnvelope} yr · envelope</div>}
                        {r.decision?.decision === 'deferred' && <div className="exec-sub">deferred by you</div>}
                      </>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {r.intervention === 'Monitor' ? <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>PM only</span>
                      : r.decision?.decision === 'deferred' ? (
                        <div className="row" style={{ gap: 6 }}>
                          <Badge tone="info" dot={false}>Deferred → {r.decision.year}</Badge>
                          <EmeraldButton variant="text" size="sm" onClick={() => clearCapexDecision(r.asset.id)}>Undo</EmeraldButton>
                        </div>
                      ) : (
                        <div className="row cap-actions" style={{ gap: 4 }}>
                          <EmeraldButton size="sm" onClick={() => accept(r)} title="Raise as a proposed project in Autodesk Construction Cloud">Accept</EmeraldButton>
                          <EmeraldButton variant="secondary" size="sm" onClick={() => defer(r)}>Defer</EmeraldButton>
                          <EmeraldButton variant="text" size="sm" onClick={() => dismiss(r)}>Dismiss</EmeraldButton>
                        </div>
                      )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="empty-note">Nothing to plan in this view</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="exec-footnote">
          <strong>Urgency</strong> = condition 30% · age vs design life 20% · maintenance history 20% · BMS alarms &amp; equipment state 20% · whitespace telemetry, linked risks &amp; reactive WOs 10%
          {params.priority !== 'balanced' && <> · items matching the <strong>{params.priority}</strong> priority weighted ×1.18</>}.
          {' '}Accepting pushes a proposed project to Autodesk Construction Cloud and removes the asset from the open plan; Defer and Dismiss are recorded against the Quantum MCP Hub.
        </div>
      </Card>

      {selected && (
        <div style={{ marginTop: 'var(--gap-md)' }}>
          <RecommendationDetail
            r={selected} plan={plan} chat={chat} onAsk={ask}
            onAccept={() => accept(selected)} onDefer={() => defer(selected)} onDismiss={() => dismiss(selected)}
            onUndo={() => clearCapexDecision(selected.asset.id)}
          />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function RecommendationDetail({ r, plan, chat, onAsk, onAccept, onDefer, onDismiss, onUndo }: {
  r: Recommendation
  plan: CapexPlan
  chat: { q: string; a: string }[]
  onAsk: (q: FollowUp) => void
  onAccept: () => void
  onDefer: () => void
  onDismiss: () => void
  onUndo: () => void
}) {
  const age = THIS_YEAR - r.asset.installedYear
  const basis = costBasisFor(r.asset, r.site)
  const cmSpend = r.history.filter(h => h.type === 'CM').reduce((sum, h) => sum + h.costUSD, 0)
  return (
    <Card
      title={`${r.asset.name} · ${r.asset.kind} · ${r.site.code}${r.client ? ` · ${r.client.name}` : ''}`}
      action={<div className="row" style={{ gap: 6 }}>
        <Badge tone={equipTone[r.asset.status]}>{r.asset.status}</Badge>
        <Badge tone={urgencyTone(r.urgency)} dot={false}>Urgency {r.urgency}</Badge>
      </div>}
    >
      <div className="grid cols-3 exec-detail exec-detail--fill">
        {/* why */}
        <div>
          <div className="card-title"><span>Why — score breakdown</span></div>
          <div className="factor-list">
            {r.factors.map(f => {
              const pts = f.weight * f.score * 100
              return (
                <div key={f.key} className="factor">
                  <div className="factor__head">
                    <span className="factor__label">{f.label}</span>
                    <span className="factor__pts">{pts.toFixed(0)} <span className="muted">/ {Math.round(f.weight * 100)} pts</span></span>
                  </div>
                  <div className="exec-bar"><div style={{ width: `${f.score * 100}%`, background: 'var(--chart-1)' }} /></div>
                  <div className="factor__detail">{f.detail} <span className="factor__src">· {f.source}</span></div>
                </div>
              )
            })}
          </div>
          {r.urgency !== r.baseUrgency && (
            <div className="exec-sub" style={{ marginTop: 8 }}>Base {r.baseUrgency} → {r.urgency} after the <strong>{plan.params.priority}</strong> weighting.</div>
          )}
          <div className="push-bottom">
            <div className="card-title"><span>Whitespace telemetry — {r.site.dcim}</span></div>
            <div className="owner-grid">
              <div className="owner-cell"><span className="owner-n">{r.hallHotRacks}</span><span className="owner-l">hot racks</span><span className="owner-w">of {r.hallRacks} in H{r.asset.hall}</span></div>
              <div className="owner-cell"><span className="owner-n">{r.hallLoadPct}%</span><span className="owner-l">hall load</span><span className="owner-w">rack power / capacity</span></div>
              <div className="owner-cell"><span className="owner-n">{r.asset.loadPct || '—'}</span><span className="owner-l">unit load %</span><span className="owner-w">{r.asset.metric}</span></div>
            </div>
          </div>
        </div>

        {/* evidence */}
        <div>
          <div className="card-title"><span>BMS alarms — {r.site.bms}</span></div>
          {r.alarms.length === 0 ? <div className="exec-empty">No active alarms on this unit.</div> : (
            <ul className="mini-list">
              {r.alarms.map(a => (
                <li key={a.id}>
                  <Badge tone={alarmTone[a.severity]} dot={false}>{a.severity}</Badge>
                  <span className="mini-body">
                    <span className="mini-title">{a.point}</span>
                    <span className="mini-meta">{fmtAgo(a.minutesAgo)} · {a.acked ? 'acked' : 'unacknowledged'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="card-title" style={{ marginTop: 14 }}><span>Maintenance history — {r.site.cmms}</span></div>
          <ul className="mini-list">
            {r.history.map(h => (
              <li key={h.id}>
                <Badge tone={h.type === 'PM' ? 'info' : 'warn'} dot={false}>{h.type}</Badge>
                <span className="mini-body">
                  <span className="mini-title">{h.note}</span>
                  <span className="mini-meta">{Math.round(h.daysAgo / 30)} mo ago · {h.by} · ${h.costUSD.toLocaleString()}</span>
                </span>
              </li>
            ))}
          </ul>

          {(r.tickets.length > 0 || r.risks.length > 0) && (
            <>
              <div className="card-title" style={{ marginTop: 14 }}><span>Linked work orders &amp; risks</span></div>
              <ul className="mini-list">
                {r.tickets.map(t => (
                  <li key={t.id}>
                    <Badge tone="warn" dot={false}>{t.priority}</Badge>
                    <span className="mini-body"><span className="mini-title">{t.title}</span><span className="mini-meta">{t.id} · {t.status}</span></span>
                  </li>
                ))}
                {r.risks.map(k => (
                  <li key={k.id}>
                    <Badge tone="serious" dot={false}>{k.likelihood * k.impact}</Badge>
                    <span className="mini-body"><span className="mini-title">{k.title}</span><span className="mini-meta">{k.id} · {k.owner} · {k.status}</span></span>
                  </li>
                ))}
              </ul>
            </>
          )}

        </div>

        {/* recommendation + ask */}
        <div>
          <div className="card-title"><span>Recommendation</span></div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <Badge tone={INTERVENTION_TONE[r.intervention]} dot={false}>{r.intervention}</Badge>
            {r.intervention !== 'Monitor' && <Badge tone="neutral" dot={false}>{fmtUSD(r.costUSD)} · {r.year}</Badge>}
            <Badge tone="neutral" dot={false}>{age} yrs · installed {r.asset.installedYear}</Badge>
          </div>
          <p className="rationale">{r.rationale}</p>

          {r.intervention !== 'Monitor' && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {r.decision?.decision === 'deferred' || r.decision?.decision === 'dismissed' ? (
                <>
                  <Badge tone="info" dot={false}>{r.decision.decision === 'deferred' ? `Deferred → ${r.decision.year}` : 'Dismissed'}</Badge>
                  <EmeraldButton variant="text" size="sm" onClick={onUndo}>Undo</EmeraldButton>
                </>
              ) : (
                <>
                  <EmeraldButton size="sm" onClick={onAccept}>Accept → Autodesk</EmeraldButton>
                  <EmeraldButton variant="secondary" size="sm" onClick={onDefer}>Defer a year</EmeraldButton>
                  <EmeraldButton variant="text" size="sm" onClick={onDismiss}>Dismiss</EmeraldButton>
                </>
              )}
            </div>
          )}

          <div className="card-title"><span>Cost basis — {r.site.code}, Tier {r.site.tier}</span></div>
          <dl className="detail-kv cost-basis">
            <dt>Like-for-like replacement</dt><dd>{fmtUSD(basis.replace)}{basis.tierUplift > 0 && <span className="muted"> · incl. {Math.round(basis.tierUplift * 100)}% Tier IV uplift</span>}</dd>
            <dt>Refurbishment</dt><dd>{fmtUSD(basis.refurbish)} <span className="muted">· 35%</span></dd>
            <dt>Enhanced PM (extend life)</dt><dd>{fmtUSD(basis.extend)} <span className="muted">/ yr</span></dd>
            <dt>Corrective spend, 24 mo</dt><dd>{fmtUSD(cmSpend)}</dd>
          </dl>

          <div className="push-bottom">
          <div className="card-title"><span>Ask the planner</span></div>
          <div className="ask-chips">
            {FOLLOW_UPS.map(f => <EmeraldChip key={f.key} onClick={() => onAsk(f.key)}>{f.label}</EmeraldChip>)}
          </div>
          <div className="ask-thread">
            {chat.length === 0 && <div className="exec-empty">Pick a question — answers are grounded in this asset’s evidence.</div>}
            {chat.map((m, i) => (
              <div key={i} className="ask-pair">
                <div className="ask-q">{m.q}</div>
                <div className="ask-a">{m.a}</div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
