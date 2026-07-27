import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { siteById, type Incident, type IncidentSeverity, type IncidentStatus } from '../data'
import { Badge, Card, Segmented, sevTone, StatTile } from '../components/ui'

const SEV_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'SEV1', label: 'SEV1' },
  { value: 'SEV2', label: 'SEV2' },
  { value: 'SEV3', label: 'SEV3' },
  { value: 'SEV4', label: 'SEV4' },
] as const

const statusTone: Record<IncidentStatus, 'critical' | 'warn' | 'info' | 'neutral'> = {
  Active: 'critical', Monitoring: 'warn', 'RCA In Progress': 'info', Closed: 'neutral',
}

export function Incidents() {
  const { siteId } = useApp()
  const { incidents: allIncidents, updateIncident } = useData()
  const incidents = scoped(allIncidents, siteId)

  const [sevFilter, setSevFilter] = useState<'all' | IncidentSeverity>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = allIncidents.find(i => i.id === selectedId) ?? null

  const visible = useMemo(
    () =>
      incidents
        .filter(i => sevFilter === 'all' || i.severity === sevFilter)
        .sort((a, b) =>
          (a.status === 'Closed' ? 1 : 0) - (b.status === 'Closed' ? 1 : 0) ||
          a.severity.localeCompare(b.severity) ||
          a.startedDaysAgo - b.startedDaysAgo),
    [incidents, sevFilter],
  )

  const open = incidents.filter(i => i.status === 'Active' || i.status === 'Monitoring')
  const rcaBacklog = incidents.filter(i => i.status === 'RCA In Progress')
  const mttr = incidents.length
    ? Math.round(incidents.reduce((s, i) => s + i.durationMin, 0) / incidents.length)
    : 0

  return (
    <div>
      <div className="page-header">
        <h1>Incidents</h1>
        <p className="subtitle">
          SEV1–SEV4 incident management with severity-based notification and in-tool RCA authoring.
        </p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Open incidents" value={open.length}
          sub={open.length > 0
            ? <Badge tone="critical" dot={false}>{open.filter(i => i.severity === 'SEV1' || i.severity === 'SEV2').length} high severity</Badge>
            : <Badge tone="good" dot={false}>All clear</Badge>} />
        <StatTile label="RCA backlog" value={rcaBacklog.length}
          sub={<span className="muted">awaiting root-cause write-up</span>} />
        <StatTile label="Avg duration" value={mttr} unit="min"
          sub={<span className="muted">across {incidents.length} incidents</span>} />
        <StatTile label="RCA completion" value={`${incidents.length ? Math.round((incidents.filter(i => i.rcaComplete).length / incidents.length) * 100) : 0}%`}
          sub={<span className="muted">closed with full RCA</span>} />
      </div>

      <div className="filter-row">
        <Segmented options={SEV_OPTIONS} value={sevFilter} onChange={setSevFilter} />
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{visible.length} shown</span>
      </div>

      <div className="floor-wrap">
        <Card>
          <div className="table-scroll" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Sev</th><th>Title</th><th>Status</th><th>Commander</th><th>Started</th><th className="num">Duration</th></tr>
              </thead>
              <tbody>
                {visible.map(i => (
                  <tr key={i.id} className="clickable" onClick={() => setSelectedId(i.id)}>
                    <td className="mono">{i.id}</td>
                    <td><Badge tone={sevTone[i.severity]} dot={false}>{i.severity}</Badge></td>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</div>
                      {siteId === 'all' && <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{siteById(i.siteId)?.code}</div>}
                    </td>
                    <td><Badge tone={statusTone[i.status]}>{i.status}</Badge></td>
                    <td>{i.commander}</td>
                    <td className="muted">{i.startedDaysAgo === 0 ? 'today' : `${i.startedDaysAgo}d ago`}</td>
                    <td className="num">{i.durationMin}m</td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={7} className="empty-note">No incidents match</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <IncidentDetail
          incident={selected}
          onUpdate={(patch, action) => selected && updateIncident(selected.id, patch, action)}
        />
      </div>
    </div>
  )
}

function IncidentDetail({ incident, onUpdate }: {
  incident: Incident | null
  onUpdate: (patch: Partial<Incident>, action: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  if (!incident) {
    return (
      <Card title="Incident detail">
        <div className="empty-note" style={{ padding: 'var(--gap-lg)' }}>
          Select an incident to review notifications and author the RCA.
        </div>
      </Card>
    )
  }

  const rcaText = draft ?? incident.rcaText
  const transitions: { label: string; to: IncidentStatus }[] =
    incident.status === 'Active' ? [{ label: 'Move to monitoring', to: 'Monitoring' }]
    : incident.status === 'Monitoring' ? [{ label: 'Start RCA', to: 'RCA In Progress' }, { label: 'Reactivate', to: 'Active' }]
    : incident.status === 'RCA In Progress' ? [{ label: 'Close with RCA', to: 'Closed' }]
    : [{ label: 'Reopen', to: 'RCA In Progress' }]

  return (
    <Card title={incident.id} action={<Badge tone={sevTone[incident.severity]} dot={false}>{incident.severity}</Badge>}>
      <p style={{ fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{incident.title}</p>
      <p className="muted" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, marginBottom: 12 }}>{incident.summary}</p>

      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        {transitions.map(t => (
          <button
            key={t.to}
            className="btn"
            disabled={t.to === 'Closed' && !rcaText.trim()}
            title={t.to === 'Closed' && !rcaText.trim() ? 'RCA required before closing' : undefined}
            onClick={() => onUpdate(
              { status: t.to, rcaComplete: t.to === 'Closed', rcaText },
              `${t.label} —`,
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <dl className="detail-kv">
        <dt>Status</dt><dd><Badge tone={statusTone[incident.status]}>{incident.status}</Badge></dd>
        <dt>Commander</dt><dd>{incident.commander}</dd>
        <dt>Started</dt><dd>{incident.startedDaysAgo === 0 ? 'today' : `${incident.startedDaysAgo}d ago`}</dd>
        <dt>Duration</dt><dd>{incident.durationMin} min</dd>
      </dl>

      <div className="card-title" style={{ marginTop: 14 }}><span>Notified on declaration</span></div>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        {incident.notified.map(n => <Badge key={n} tone="neutral" dot={false}>{n}</Badge>)}
      </div>

      <div className="field">
        <label htmlFor="rca">Root cause analysis {incident.rcaComplete && '— complete'}</label>
        <textarea
          id="rca"
          style={{ minHeight: 140 }}
          value={rcaText}
          placeholder="Timeline, root cause, contributing factors, corrective actions…"
          onChange={e => setDraft(e.target.value)}
        />
      </div>
      {draft !== null && draft !== incident.rcaText && (
        <div className="modal-actions" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => setDraft(null)}>Discard</button>
          <button className="btn primary" onClick={() => { onUpdate({ rcaText: draft }, 'Save RCA draft —'); setDraft(null) }}>
            Save RCA
          </button>
        </div>
      )}
    </Card>
  )
}
