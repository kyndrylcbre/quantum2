import { useMemo, useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import {
  SITES, siteById, TECHS,
  type Ticket, type TicketPriority, type TicketSpace, type TicketStatus, type TicketType,
} from '../data'
import { Modal } from '../components/Modal'
import { Badge, Card, priorityTone, Segmented, StatTile, ticketTone } from '../components/ui'
import { EmeraldButton, EmeraldDropdown, EmeraldTextField } from '../emerald'

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
        <EmeraldButton className="right" onClick={() => setShowNew(true)}>+ New work order</EmeraldButton>
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
        <EmeraldDropdown
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'All types' },
            { value: 'Preventative', label: 'Preventative' },
            { value: 'Reactive', label: 'Reactive' },
            { value: 'Hands & Eyes', label: 'Hands & Eyes' },
            { value: 'Project Support', label: 'Project Support' },
          ]}
        />
        <EmeraldDropdown
          value={spaceFilter}
          onChange={setSpaceFilter}
          options={[
            { value: 'all', label: 'Whitespace + M&E + Facility' },
            { value: 'Whitespace', label: 'Whitespace' },
            { value: 'M&E', label: 'M&E' },
            { value: 'Facility', label: 'Facility' },
          ]}
        />
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
          <EmeraldButton key={tr.to} variant="secondary" size="sm"
            onClick={() => onUpdate({ status: tr.to, slaBreached: tr.to === 'Resolved' || tr.to === 'Closed' ? false : ticket.slaBreached }, `${tr.label} —`)}>
            {tr.label}
          </EmeraldButton>
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

      <div style={{ marginTop: 14 }}>
        <EmeraldDropdown
          label={`Assignee — pushes to ${ticket.source}`}
          block
          value={ticket.assignee}
          options={TECHS.map(t => ({ value: t, label: t }))}
          onChange={v => onUpdate({ assignee: v }, `Reassign to ${v} —`)}
        />
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
          <div className="full">
            <EmeraldTextField label="Title" block autoFocus value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <EmeraldDropdown label="Site" block value={form.siteId}
            options={SITES.map(s => ({ value: s.id, label: `${s.code} · ${s.name}` }))}
            onChange={v => setForm(f => ({ ...f, siteId: v }))} />
          <EmeraldDropdown label="Type" block value={form.type}
            options={[
              { value: 'Reactive', label: 'Reactive' },
              { value: 'Preventative', label: 'Preventative' },
              { value: 'Hands & Eyes', label: 'Hands & Eyes' },
              { value: 'Project Support', label: 'Project Support' },
            ]}
            onChange={v => setForm(f => ({ ...f, type: v as TicketType }))} />
          <EmeraldDropdown label="Space" block value={form.space}
            options={[
              { value: 'Whitespace', label: 'Whitespace' },
              { value: 'M&E', label: 'M&E' },
              { value: 'Facility', label: 'Facility' },
            ]}
            onChange={v => setForm(f => ({ ...f, space: v as TicketSpace }))} />
          <EmeraldDropdown label="Priority" block value={form.priority}
            options={['P1', 'P2', 'P3', 'P4'].map(p => ({ value: p, label: p }))}
            onChange={v => setForm(f => ({ ...f, priority: v as TicketPriority }))} />
          <div className="full">
            <EmeraldDropdown label="Assignee" block value={form.assignee}
              options={TECHS.map(t => ({ value: t, label: t }))}
              onChange={v => setForm(f => ({ ...f, assignee: v }))} />
          </div>
        </div>
        <p className="muted" style={{ marginTop: 14, fontSize: 'var(--text-xs)' }}>
          On save, Quantum pushes this work order to <strong>{cmms}</strong> (the site’s system of record) and tracks the returned reference.
        </p>
        <div className="modal-actions">
          <EmeraldButton type="button" variant="text" onClick={onClose}>Cancel</EmeraldButton>
          <EmeraldButton type="submit" disabled={!form.title.trim()}>Create &amp; push to {cmms?.split(' ')[0]}</EmeraldButton>
        </div>
      </form>
    </Modal>
  )
}
