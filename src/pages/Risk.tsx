import { useMemo, useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { SITES, siteById, type Risk, type RiskCategory, type RiskOwner, type RiskStatus } from '../data'
import { Modal } from '../components/Modal'
import { Badge, Card, StatTile, type BadgeTone } from '../components/ui'

const CATEGORIES: RiskCategory[] = [
  'Power resilience', 'Cooling resilience', 'Fire protection', 'Water / leak',
  'Physical security', 'Compliance', 'Single point of failure', 'Staffing',
]
const STATUS_TONE: Record<RiskStatus, BadgeTone> = {
  Open: 'critical', Mitigating: 'warn', Accepted: 'info', Closed: 'neutral',
}
const OWNER_TONE: Record<RiskOwner, BadgeTone> = {
  CBRE: 'good', Client: 'info', Shared: 'neutral',
}

const scoreBand = (score: number): { label: string; tone: BadgeTone } =>
  score >= 16 ? { label: 'Critical', tone: 'critical' }
  : score >= 10 ? { label: 'High', tone: 'serious' }
  : score >= 5 ? { label: 'Medium', tone: 'warn' }
  : { label: 'Low', tone: 'good' }

const cellBg = (score: number): string =>
  score >= 16 ? 'var(--status-critical-soft)'
  : score >= 10 ? 'var(--status-serious-soft)'
  : score >= 5 ? 'var(--status-warn-soft)'
  : 'var(--status-good-soft)'

export function Risk() {
  const { siteId } = useApp()
  const { risks: allRisks, updateRisk } = useData()
  const risks = scoped(allRisks, siteId)

  const [cell, setCell] = useState<{ l: number; i: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const selected = allRisks.find(r => r.id === selectedId) ?? null

  const live = risks.filter(r => r.status !== 'Closed')
  const visible = useMemo(
    () =>
      (cell ? live.filter(r => r.likelihood === cell.l && r.impact === cell.i) : live)
        .sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact),
    [live, cell],
  )

  const high = live.filter(r => r.likelihood * r.impact >= 10)
  const reviewsDue = live.filter(r => r.reviewInDays < 0)

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>Risk Mgmt</h1>
          <p className="subtitle">
            Living risk register — who owns each risk (CBRE, client, or shared) and what's being done about it.
          </p>
        </div>
        <button className="btn primary right" onClick={() => setShowNew(true)}>+ Register risk</button>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Live risks" value={live.length}
          sub={<span className="muted">{risks.length - live.length} closed</span>} />
        <StatTile label="High & critical" value={high.length}
          sub={high.length > 0 ? <Badge tone="serious" dot={false}>Score ≥ 10</Badge> : <Badge tone="good" dot={false}>None</Badge>} />
        <StatTile label="Reviews overdue" value={reviewsDue.length}
          sub={<span className="muted">register review cadence: quarterly</span>} />
        <StatTile label="Client-owned" value={live.filter(r => r.owner === 'Client').length}
          sub={<span className="muted">{live.filter(r => r.owner === 'CBRE').length} CBRE · {live.filter(r => r.owner === 'Shared').length} shared</span>} />
      </div>

      <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card title="Likelihood × impact — live risks">
          <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: 4, fontSize: 'var(--text-xs)' }}>
            {[5, 4, 3, 2, 1].map(impact => (
              <RowCells key={impact} impact={impact} live={live} cell={cell} setCell={setCell} />
            ))}
            <div />
            {[1, 2, 3, 4, 5].map(l => (
              <div key={l} style={{ textAlign: 'center', color: 'var(--ink-3)', paddingTop: 4 }}>{l}</div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>likelihood →, impact ↑</span>
            {cell && (
              <button className="btn" style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }} onClick={() => setCell(null)}>
                Clear filter
              </button>
            )}
          </div>
        </Card>

        <Card className="span-2" title={`Register ${cell ? `— L${cell.l} × I${cell.i}` : ''} (${visible.length})`}>
          <div className="table-scroll" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Risk</th><th>Category</th><th className="num">Score</th><th>Owner</th><th>Status</th><th>Review</th></tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  const score = r.likelihood * r.impact
                  const band = scoreBand(score)
                  return (
                    <tr key={r.id} className="clickable" onClick={() => setSelectedId(r.id)}>
                      <td className="mono">{r.id}</td>
                      <td style={{ maxWidth: 300 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                        {siteId === 'all' && <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{siteById(r.siteId)?.code}</div>}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{r.category}</td>
                      <td className="num"><Badge tone={band.tone} dot={false}>{score}</Badge></td>
                      <td><Badge tone={OWNER_TONE[r.owner]} dot={false}>{r.owner}</Badge></td>
                      <td><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                      <td>
                        {r.reviewInDays < 0
                          ? <Badge tone="critical" dot={false}>{Math.abs(r.reviewInDays)}d overdue</Badge>
                          : <span className="muted">{r.reviewInDays}d</span>}
                      </td>
                    </tr>
                  )
                })}
                {visible.length === 0 && <tr><td colSpan={7} className="empty-note">No live risks in this cell</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {selected && (
        <RiskDetail
          risk={selected}
          onUpdate={(patch, action) => updateRisk(selected.id, patch, action)}
          onDismiss={() => setSelectedId(null)}
        />
      )}

      {showNew && <NewRiskModal defaultSite={siteId} onClose={() => setShowNew(false)} />}
    </div>
  )
}

function RowCells({ impact, live, cell, setCell }: {
  impact: number
  live: Risk[]
  cell: { l: number; i: number } | null
  setCell: (c: { l: number; i: number } | null) => void
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-3)', paddingRight: 4 }}>{impact}</div>
      {[1, 2, 3, 4, 5].map(l => {
        const count = live.filter(r => r.likelihood === l && r.impact === impact).length
        const isSel = cell?.l === l && cell?.i === impact
        return (
          <button
            key={l}
            onClick={() => setCell(isSel ? null : { l, i: impact })}
            aria-label={`Likelihood ${l}, impact ${impact}: ${count} risks`}
            style={{
              aspectRatio: '1.6', border: isSel ? '2px solid var(--focus-ring)' : '1px solid var(--border)',
              borderRadius: 4, background: cellBg(l * impact), display: 'grid', placeItems: 'center',
              fontWeight: 700, color: 'var(--ink)', cursor: 'pointer', fontSize: 'var(--text-sm)',
            }}
          >
            {count > 0 ? count : ''}
          </button>
        )
      })}
    </>
  )
}

function RiskDetail({ risk, onUpdate, onDismiss }: {
  risk: Risk
  onUpdate: (patch: Partial<Risk>, action: string) => void
  onDismiss: () => void
}) {
  const score = risk.likelihood * risk.impact
  const band = scoreBand(score)
  const transitions: { label: string; to: RiskStatus }[] =
    risk.status === 'Open' ? [{ label: 'Start mitigating', to: 'Mitigating' }, { label: 'Accept risk', to: 'Accepted' }]
    : risk.status === 'Mitigating' ? [{ label: 'Close risk', to: 'Closed' }, { label: 'Accept residual', to: 'Accepted' }]
    : risk.status === 'Accepted' ? [{ label: 'Reopen', to: 'Open' }]
    : [{ label: 'Reopen', to: 'Open' }]

  return (
    <Card title={`${risk.id} — ${risk.title}`} action={<button className="btn" onClick={onDismiss}>✕</button>}>
      <div className="grid cols-3">
        <div>
          <dl className="detail-kv">
            <dt>Site</dt><dd>{siteById(risk.siteId)?.code}</dd>
            <dt>Category</dt><dd>{risk.category}</dd>
            <dt>Score</dt><dd><Badge tone={band.tone} dot={false}>{score} — {band.label}</Badge></dd>
            <dt>Owner</dt><dd><Badge tone={OWNER_TONE[risk.owner]} dot={false}>{risk.owner}</Badge></dd>
            <dt>Status</dt><dd><Badge tone={STATUS_TONE[risk.status]}>{risk.status}</Badge></dd>
            <dt>Raised</dt><dd>{risk.raisedDaysAgo === 0 ? 'today' : `${risk.raisedDaysAgo}d ago`}</dd>
          </dl>
        </div>
        <div className="span-2">
          <div className="card-title"><span>Mitigation plan</span></div>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, marginBottom: 12 }}>{risk.mitigation}</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {transitions.map(t => (
              <button key={t.to} className="btn" onClick={() => onUpdate({ status: t.to }, `${t.label} —`)}>
                {t.label}
              </button>
            ))}
            <button className="btn" onClick={() => onUpdate({ reviewInDays: 90 }, 'Mark reviewed —')}>
              Mark reviewed (next in 90d)
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function NewRiskModal({ defaultSite, onClose }: { defaultSite: string; onClose: () => void }) {
  const { addRisk } = useData()
  const [form, setForm] = useState({
    siteId: defaultSite === 'all' ? SITES[0].id : defaultSite,
    title: '',
    category: CATEGORIES[0],
    likelihood: 3,
    impact: 3,
    owner: 'CBRE' as RiskOwner,
    mitigation: '',
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    addRisk({
      siteId: form.siteId,
      title: form.title.trim(),
      category: form.category,
      likelihood: form.likelihood,
      impact: form.impact,
      owner: form.owner,
      status: 'Open',
      mitigation: form.mitigation.trim() || 'Mitigation to be defined at next risk review.',
    })
    onClose()
  }

  return (
    <Modal title="Register new risk" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="rk-title">Risk description</label>
            <input id="rk-title" className="input" autoFocus value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="rk-site">Site</label>
            <select id="rk-site" className="select" value={form.siteId}
              onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))}>
              {SITES.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rk-cat">Category</label>
            <select id="rk-cat" className="select" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as RiskCategory }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rk-like">Likelihood (1–5)</label>
            <select id="rk-like" className="select" value={form.likelihood}
              onChange={e => setForm(f => ({ ...f, likelihood: Number(e.target.value) }))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rk-imp">Impact (1–5)</label>
            <select id="rk-imp" className="select" value={form.impact}
              onChange={e => setForm(f => ({ ...f, impact: Number(e.target.value) }))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="rk-owner">Risk owner</label>
            <select id="rk-owner" className="select" value={form.owner}
              onChange={e => setForm(f => ({ ...f, owner: e.target.value as RiskOwner }))}>
              <option>CBRE</option><option>Client</option><option>Shared</option>
            </select>
          </div>
          <div className="field full">
            <label htmlFor="rk-mit">Mitigation plan</label>
            <textarea id="rk-mit" value={form.mitigation}
              onChange={e => setForm(f => ({ ...f, mitigation: e.target.value }))} />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!form.title.trim()}>Register risk</button>
        </div>
      </form>
    </Modal>
  )
}
