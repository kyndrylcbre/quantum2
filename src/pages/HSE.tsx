import { useMemo, useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { SITES, siteById, type HseCategory, type HseEntry, type HseKind } from '../data'
import { Modal } from '../components/Modal'
import { Badge, Card, Segmented, StatTile, type BadgeTone } from '../components/ui'
import { EmeraldButton, EmeraldCheckbox, EmeraldDropdown, EmeraldTextarea } from '../emerald'

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
        <EmeraldButton className="right" onClick={() => setShowNew(true)}>+ Log entry</EmeraldButton>
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
                      <EmeraldButton variant="secondary" size="sm" onClick={() => setClosing(e)}>
                        Close out
                      </EmeraldButton>
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
          <EmeraldDropdown label="Site" block value={form.siteId}
            options={SITES.map(s => ({ value: s.id, label: `${s.code} · ${s.name}` }))}
            onChange={v => setForm(f => ({ ...f, siteId: v }))} />
          <EmeraldDropdown label="Type" block value={form.kind}
            options={['Observation', 'Near Miss', 'Incident'].map(k => ({ value: k, label: k }))}
            onChange={v => setForm(f => ({ ...f, kind: v as HseKind }))} />
          <div className="full">
            <EmeraldDropdown label="Category" block value={form.category}
              options={CATEGORIES.map(c => ({ value: c, label: c }))}
              onChange={v => setForm(f => ({ ...f, category: v as HseCategory }))} />
          </div>
          <div className="full">
            <EmeraldTextarea label="What happened / what was observed" block autoFocus value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {form.kind === 'Incident' && (
            <div className="full">
              <EmeraldCheckbox
                label="OSHA-recordable injury or illness"
                checked={form.recordable}
                onChange={e => setForm(f => ({ ...f, recordable: e.target.checked }))}
              />
            </div>
          )}
        </div>
        <div className="modal-actions">
          <EmeraldButton type="button" variant="text" onClick={onClose}>Cancel</EmeraldButton>
          <EmeraldButton type="submit" disabled={!form.description.trim()}>Log entry</EmeraldButton>
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
      <EmeraldTextarea label="Corrective action taken" block autoFocus value={action}
        onChange={e => setAction(e.target.value)} />
      <div className="modal-actions">
        <EmeraldButton variant="text" onClick={onClose}>Cancel</EmeraldButton>
        <EmeraldButton disabled={!action.trim()} onClick={() => onSubmit(action.trim())}>
          Close entry
        </EmeraldButton>
      </div>
    </Modal>
  )
}
