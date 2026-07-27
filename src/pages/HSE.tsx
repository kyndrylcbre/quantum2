import { useMemo, useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { SITES, siteById, type HseCategory, type HseEntry, type HseKind } from '../data'
import { Modal } from '../components/Modal'
import { Badge, Card, Segmented, StatTile, type BadgeTone } from '../components/ui'

const KIND_TONE: Record<HseKind, BadgeTone> = {
  Observation: 'info', 'Near Miss': 'warn', Incident: 'critical',
}
const CATEGORIES: HseCategory[] = [
  'Electrical safety', 'Slips / trips / falls', 'PPE compliance', 'Housekeeping',
  'Working at height', 'Manual handling', 'Chemical / COSHH', 'Contractor control',
]

export function HSE() {
  const { siteId } = useApp()
  const { hse: allHse, closeHse } = useData()
  const entries = scoped(allHse, siteId)

  const [kindFilter, setKindFilter] = useState<'all' | HseKind>('all')
  const [showNew, setShowNew] = useState(false)
  const [closing, setClosing] = useState<HseEntry | null>(null)

  const visible = useMemo(
    () =>
      entries
        .filter(e => kindFilter === 'all' || e.kind === kindFilter)
        .sort((a, b) => (a.status === 'Open' ? 0 : 1) - (b.status === 'Open' ? 0 : 1) || a.daysAgo - b.daysAgo),
    [entries, kindFilter],
  )

  const openCount = entries.filter(e => e.status === 'Open').length
  const recordables = entries.filter(e => e.recordable)
  const daysSinceRecordable = recordables.length ? Math.min(...recordables.map(e => e.daysAgo)) : 180
  const obsThisMonth = entries.filter(e => e.kind === 'Observation' && e.daysAgo <= 30).length

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>HSE</h1>
          <p className="subtitle">
            Health & safety observations, near misses, and incidents — recorded at the point of work.
          </p>
        </div>
        <button className="btn primary right" onClick={() => setShowNew(true)}>+ Log entry</button>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Days since recordable" value={daysSinceRecordable}
          sub={<Badge tone={daysSinceRecordable > 90 ? 'good' : 'warn'} dot={false}>{daysSinceRecordable > 90 ? 'Strong run' : 'Recent recordable'}</Badge>} />
        <StatTile label="Open entries" value={openCount}
          sub={<span className="muted">{entries.length} total in scope</span>} />
        <StatTile label="Observations — 30 days" value={obsThisMonth}
          sub={<span className="muted">leading-indicator reporting culture</span>} />
        <StatTile label="Recordable incidents" value={recordables.length}
          sub={<span className="muted">rolling 6 months</span>} />
      </div>

      <div className="filter-row">
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'Observation', label: 'Observations' },
            { value: 'Near Miss', label: 'Near misses' },
            { value: 'Incident', label: 'Incidents' },
          ] as const}
          value={kindFilter}
          onChange={setKindFilter}
        />
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{visible.length} shown</span>
      </div>

      <Card>
        <div className="table-scroll" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Type</th><th>Category</th><th>Description</th>
                <th>Reported by</th><th>When</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(e => (
                <tr key={e.id}>
                  <td className="mono">{e.id}</td>
                  <td>
                    <Badge tone={KIND_TONE[e.kind]} dot={false}>{e.kind}</Badge>
                    {e.recordable && <div style={{ marginTop: 3 }}><Badge tone="critical" dot={false}>Recordable</Badge></div>}
                  </td>
                  <td>{e.category}</td>
                  <td style={{ maxWidth: 380, fontSize: 'var(--text-sm)' }}>
                    {e.description}
                    {siteId === 'all' && <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{siteById(e.siteId)?.code}</div>}
                    {e.correctiveAction && (
                      <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 3 }}>
                        Action: {e.correctiveAction}
                      </div>
                    )}
                  </td>
                  <td>{e.reportedBy}</td>
                  <td className="muted">{e.daysAgo === 0 ? 'today' : `${e.daysAgo}d ago`}</td>
                  <td>
                    {e.status === 'Open'
                      ? <Badge tone="warn">Open</Badge>
                      : <Badge tone="good">Closed</Badge>}
                  </td>
                  <td>
                    {e.status === 'Open' && (
                      <button className="btn" style={{ padding: '3px 10px', fontSize: 'var(--text-xs)' }} onClick={() => setClosing(e)}>
                        Close out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={8} className="empty-note">No entries match</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {showNew && <NewHseModal defaultSite={siteId} onClose={() => setShowNew(false)} />}
      {closing && (
        <CloseHseModal
          entry={closing}
          onClose={() => setClosing(null)}
          onSubmit={action => { closeHse(closing.id, action); setClosing(null) }}
        />
      )}
    </div>
  )
}

function NewHseModal({ defaultSite, onClose }: { defaultSite: string; onClose: () => void }) {
  const { addHse } = useData()
  const [form, setForm] = useState({
    siteId: defaultSite === 'all' ? SITES[0].id : defaultSite,
    kind: 'Observation' as HseKind,
    category: CATEGORIES[0],
    description: '',
    recordable: false,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.description.trim()) return
    addHse({
      siteId: form.siteId,
      kind: form.kind,
      category: form.category,
      description: form.description.trim(),
      reportedBy: 'B. Hauser',
      recordable: form.kind === 'Incident' && form.recordable,
    })
    onClose()
  }

  return (
    <Modal title="Log HSE entry" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="hse-site">Site</label>
            <select id="hse-site" className="select" value={form.siteId}
              onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))}>
              {SITES.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="hse-kind">Type</label>
            <select id="hse-kind" className="select" value={form.kind}
              onChange={e => setForm(f => ({ ...f, kind: e.target.value as HseKind }))}>
              <option>Observation</option><option>Near Miss</option><option>Incident</option>
            </select>
          </div>
          <div className="field full">
            <label htmlFor="hse-cat">Category</label>
            <select id="hse-cat" className="select" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as HseCategory }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="hse-desc">What happened / what was observed</label>
            <textarea id="hse-desc" autoFocus value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {form.kind === 'Incident' && (
            <div className="field full row" style={{ gap: 8 }}>
              <input id="hse-rec" type="checkbox" checked={form.recordable}
                onChange={e => setForm(f => ({ ...f, recordable: e.target.checked }))} />
              <label htmlFor="hse-rec" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}>
                OSHA-recordable injury or illness
              </label>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!form.description.trim()}>Log entry</button>
        </div>
      </form>
    </Modal>
  )
}

function CloseHseModal({ entry, onClose, onSubmit }: {
  entry: HseEntry
  onClose: () => void
  onSubmit: (correctiveAction: string) => void
}) {
  const [action, setAction] = useState('')
  return (
    <Modal title={`Close out ${entry.id}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 12 }}>{entry.description}</p>
      <div className="field">
        <label htmlFor="hse-action">Corrective action taken</label>
        <textarea id="hse-action" autoFocus value={action} onChange={e => setAction(e.target.value)}
          placeholder="e.g. Area barricaded, toolbox talk delivered, permit checklist updated…" />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!action.trim()} onClick={() => onSubmit(action.trim())}>
          Close entry
        </button>
      </div>
    </Modal>
  )
}
