import { useMemo, useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import {
  SITES, siteById, TECHS,
  type Ticket, type TicketPriority, type TicketSpace, type TicketStatus, type TicketType,
} from '../data'
import { Modal } from '../components/Modal'
import { Badge, Card, priorityTone, Segmented, StatTile, ticketTone } from '../components/ui'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'closed', label: 'Closed' },
] as const

const isActive = (s: TicketStatus) => s === 'Open' || s === 'In Progress' || s === 'On Hold'

export function Ticketing() {
  const { siteId } = useApp()
  const { tickets: allTickets, updateTicket } = useData()
  const tickets = scoped(allTickets, siteId)

  const [statusView, setStatusView] = useState<'active' | 'all' | 'closed'>('active')
  const [typeFilter, setTypeFilter] = useState<'all' | TicketType>('all')
  const [spaceFilter, setSpaceFilter] = useState<'all' | TicketSpace>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const selected = allTickets.find(t => t.id === selectedId) ?? null

  const visible = useMemo(
    () =>
      tickets
        .filter(t =>
          statusView === 'all' ? true : statusView === 'active' ? isActive(t.status) : !isActive(t.status))
        .filter(t => typeFilter === 'all' || t.type === typeFilter)
        .filter(t => spaceFilter === 'all' || t.space === spaceFilter)
        .sort((a, b) =>
          (a.priority > b.priority ? 1 : a.priority < b.priority ? -1 : 0) || a.dueInDays - b.dueInDays),
    [tickets, statusView, typeFilter, spaceFilter],
  )

  const active = tickets.filter(t => isActive(t.status))
  const breaches = tickets.filter(t => t.slaBreached).length
  const pmShare = tickets.length ? Math.round((tickets.filter(t => t.type === 'Preventative').length / tickets.length) * 100) : 0
  const handsEyes = active.filter(t => t.type === 'Hands & Eyes').length

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>Ticketing</h1>
          <p className="subtitle">
            Bi-directional work order sync with each site’s CMMS of record — create, update, and close from Quantum.
          </p>
        </div>
        <button className="btn primary right" onClick={() => setShowNew(true)}>+ New work order</button>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Active work orders" value={active.length}
          sub={<span className="muted">{tickets.length} total in scope</span>} />
        <StatTile label="SLA breaches" value={breaches}
          sub={breaches > 0 ? <Badge tone="critical" dot={false}>Needs attention</Badge> : <Badge tone="good" dot={false}>Clean</Badge>} />
        <StatTile label="PM share" value={`${pmShare}%`}
          sub={<span className="muted">of all work orders</span>} />
        <StatTile label="Hands & eyes queue" value={handsEyes}
          sub={<span className="muted">customer-requested whitespace work</span>} />
      </div>

      <div className="filter-row">
        <Segmented options={STATUS_OPTIONS} value={statusView} onChange={setStatusView} />
        <select className="select" value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | TicketType)}>
          <option value="all">All types</option>
          <option>Preventative</option>
          <option>Reactive</option>
          <option>Hands & Eyes</option>
          <option>Project Support</option>
        </select>
        <select className="select" value={spaceFilter} onChange={e => setSpaceFilter(e.target.value as 'all' | TicketSpace)}>
          <option value="all">Whitespace + M&E + Facility</option>
          <option>Whitespace</option>
          <option>M&E</option>
          <option>Facility</option>
        </select>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{visible.length} shown</span>
      </div>

      <div className="floor-wrap">
        <Card>
          <div className="table-scroll" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Priority</th><th>Title</th><th>Type</th><th>Space</th>
                  <th>Status</th><th>Assignee</th><th>Due</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(t => (
                  <tr key={t.id} className="clickable" onClick={() => setSelectedId(t.id)}>
                    <td className="mono">{t.id}</td>
                    <td><Badge tone={priorityTone[t.priority]} dot={false}>{t.priority}</Badge></td>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      {siteId === 'all' && <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{siteById(t.siteId)?.code}</div>}
                    </td>
                    <td>{t.type}</td>
                    <td>{t.space}</td>
                    <td><Badge tone={ticketTone[t.status]}>{t.status}</Badge></td>
                    <td>{t.assignee}</td>
                    <td>
                      {t.slaBreached
                        ? <Badge tone="critical" dot={false}>{Math.abs(t.dueInDays)}d overdue</Badge>
                        : isActive(t.status)
                          ? <span className="muted">{t.dueInDays}d</span>
                          : <span className="muted">—</span>}
                    </td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t.source}</td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={9} className="empty-note">No work orders match the filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <TicketDetail
          ticket={selected}
          allSites={siteId === 'all'}
          onUpdate={(patch, action) => selected && updateTicket(selected.id, patch, action)}
        />
      </div>

      {showNew && <NewTicketModal defaultSite={siteId} onClose={() => setShowNew(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TicketDetail({ ticket, allSites, onUpdate }: {
  ticket: Ticket | null
  allSites: boolean
  onUpdate: (patch: Partial<Ticket>, action: string) => void
}) {
  if (!ticket) {
    return (
      <Card title="Work order detail">
        <div className="empty-note" style={{ padding: 'var(--gap-lg)' }}>
          Select a work order — status changes and reassignments push straight back to the source CMMS.
        </div>
      </Card>
    )
  }
  const site = siteById(ticket.siteId)

  const transitions: { label: string; to: TicketStatus }[] =
    ticket.status === 'Open' ? [{ label: 'Start work', to: 'In Progress' }, { label: 'Put on hold', to: 'On Hold' }]
    : ticket.status === 'In Progress' ? [{ label: 'Resolve', to: 'Resolved' }, { label: 'Put on hold', to: 'On Hold' }]
    : ticket.status === 'On Hold' ? [{ label: 'Resume', to: 'In Progress' }]
    : ticket.status === 'Resolved' ? [{ label: 'Close', to: 'Closed' }, { label: 'Reopen', to: 'Open' }]
    : [{ label: 'Reopen', to: 'Open' }]

  return (
    <Card title={ticket.id} action={<Badge tone={ticketTone[ticket.status]}>{ticket.status}</Badge>}>
      <p style={{ fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>{ticket.title}</p>

      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        {transitions.map(tr => (
          <button key={tr.to} className="btn" onClick={() => onUpdate({ status: tr.to, slaBreached: tr.to === 'Resolved' || tr.to === 'Closed' ? false : ticket.slaBreached }, `${tr.label} —`)}>
            {tr.label}
          </button>
        ))}
      </div>

      <dl className="detail-kv">
        {allSites && (<><dt>Site</dt><dd>{site?.code}</dd></>)}
        <dt>Priority</dt><dd><Badge tone={priorityTone[ticket.priority]} dot={false}>{ticket.priority}</Badge></dd>
        <dt>Type</dt><dd>{ticket.type}</dd>
        <dt>Space</dt><dd>{ticket.space}</dd>
        {ticket.asset && (<><dt>Asset</dt><dd className="mono">{ticket.asset}</dd></>)}
        <dt>Requested by</dt><dd>{ticket.requestedBy}</dd>
        <dt>Created</dt><dd>{ticket.createdDaysAgo === 0 ? 'today' : `${ticket.createdDaysAgo}d ago`}</dd>
        <dt>SLA</dt>
        <dd>
          {ticket.slaBreached
            ? <Badge tone="critical" dot={false}>{Math.abs(ticket.dueInDays)}d overdue</Badge>
            : <Badge tone="good" dot={false}>Within SLA</Badge>}
        </dd>
        <dt>System of record</dt><dd>{ticket.source}</dd>
      </dl>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="assignee">Assignee — pushes to {ticket.source}</label>
        <select
          id="assignee"
          className="select"
          value={ticket.assignee}
          onChange={e => onUpdate({ assignee: e.target.value }, `Reassign to ${e.target.value} —`)}
        >
          {TECHS.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function NewTicketModal({ defaultSite, onClose }: { defaultSite: string; onClose: () => void }) {
  const { createTicket } = useData()
  const [form, setForm] = useState({
    siteId: defaultSite === 'all' ? SITES[0].id : defaultSite,
    title: '',
    type: 'Reactive' as TicketType,
    space: 'Whitespace' as TicketSpace,
    priority: 'P3' as TicketPriority,
    assignee: TECHS[0],
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    createTicket({
      siteId: form.siteId,
      title: form.title.trim(),
      type: form.type,
      space: form.space,
      priority: form.priority,
      status: 'Open',
      assignee: form.assignee,
      requestedBy: 'B. Hauser (Quantum)',
      dueInDays: form.priority === 'P1' ? 1 : form.priority === 'P2' ? 3 : form.priority === 'P3' ? 7 : 14,
    })
    onClose()
  }

  const cmms = siteById(form.siteId)?.cmms

  return (
    <Modal title="New work order" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="nt-title">Title</label>
            <input id="nt-title" className="input" autoFocus value={form.title}
              placeholder="e.g. Smart hands: swap failed PSU in rack C-04"
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="nt-site">Site</label>
            <select id="nt-site" className="select" value={form.siteId}
              onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))}>
              {SITES.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-type">Type</label>
            <select id="nt-type" className="select" value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as TicketType }))}>
              <option>Reactive</option><option>Preventative</option>
              <option>Hands & Eyes</option><option>Project Support</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-space">Space</label>
            <select id="nt-space" className="select" value={form.space}
              onChange={e => setForm(f => ({ ...f, space: e.target.value as TicketSpace }))}>
              <option>Whitespace</option><option>M&E</option><option>Facility</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-priority">Priority</label>
            <select id="nt-priority" className="select" value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}>
              <option>P1</option><option>P2</option><option>P3</option><option>P4</option>
            </select>
          </div>
          <div className="field full">
            <label htmlFor="nt-assignee">Assignee</label>
            <select id="nt-assignee" className="select" value={form.assignee}
              onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}>
              {TECHS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 14, fontSize: 'var(--text-xs)' }}>
          On save, Quantum pushes this work order to <strong>{cmms}</strong> (the site’s system of record) and tracks the returned reference.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!form.title.trim()}>Create & push to {cmms?.split(' ')[0]}</button>
        </div>
      </form>
    </Modal>
  )
}
