import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { siteById } from '../data'
import { EmeraldBadge, EmeraldIconButton } from '../emerald'
import { Badge, type BadgeTone } from './ui'
import { IconBell } from './Icons'

interface Notif {
  id: string
  tone: BadgeTone
  tag: string
  title: string
  site?: string
  meta: string
  to: string
  rank: number // lower = more urgent, shown first
}

function agoMin(min: number): string {
  if (min < 60) return `${min}m ago`
  if (min < 1440) return `${Math.round(min / 60)}h ago`
  return `${Math.round(min / 1440)}d ago`
}
const agoDays = (d: number) => (d === 0 ? 'today' : `${d}d ago`)

export function NotificationsMenu() {
  const { siteId } = useApp()
  const { alarms, incidents, tickets } = useData()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const notifs = useMemo<Notif[]>(() => {
    const all = siteId === 'all'
    const list: Notif[] = []

    for (const i of scoped(incidents, siteId)) {
      if (i.status !== 'Active' && i.status !== 'Monitoring') continue
      list.push({
        id: `inc-${i.id}`,
        tone: i.severity === 'SEV1' ? 'critical' : i.severity === 'SEV2' ? 'serious' : 'warn',
        tag: i.severity,
        title: i.title,
        site: all ? siteById(i.siteId)?.code : undefined,
        meta: `${i.status} · ${agoDays(i.startedDaysAgo)}`,
        to: '/incidents',
        rank: i.severity === 'SEV1' ? 0 : i.severity === 'SEV2' ? 1 : 2,
      })
    }

    for (const a of scoped(alarms, siteId)) {
      if (a.acked || a.severity === 'info') continue
      list.push({
        id: `alm-${a.id}`,
        tone: a.severity === 'critical' ? 'critical' : 'warn',
        tag: a.severity === 'critical' ? 'Critical' : 'Warning',
        title: a.point,
        site: all ? siteById(a.siteId)?.code : undefined,
        meta: `${a.source} · ${a.system} · ${agoMin(a.minutesAgo)}`,
        to: '/monitoring',
        rank: a.severity === 'critical' ? 1 : 4,
      })
    }

    for (const t of scoped(tickets, siteId)) {
      if (!t.slaBreached) continue
      list.push({
        id: `tkt-${t.id}`,
        tone: 'critical',
        tag: 'SLA breach',
        title: t.title,
        site: all ? siteById(t.siteId)?.code : undefined,
        meta: `${t.id} · ${Math.abs(t.dueInDays)}d overdue · ${t.assignee}`,
        to: '/ticketing',
        rank: 3,
      })
    }

    return list.sort((a, b) => a.rank - b.rank).slice(0, 20)
  }, [siteId, alarms, incidents, tickets])

  const go = (to: string) => { setOpen(false); navigate(to) }

  return (
    <div className="notif" ref={ref}>
      <EmeraldBadge count={notifs.length}>
        <EmeraldIconButton
          className="on-dark"
          label={`${notifs.length} notifications`}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          <IconBell />
        </EmeraldIconButton>
      </EmeraldBadge>

      {open && (
        <div className="notif-menu" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <span>Notifications</span>
            <span className="notif-count">{notifs.length}</span>
          </div>
          <div className="notif-list">
            {notifs.length === 0 && (
              <div className="notif-empty">You’re all caught up — no active alerts in scope.</div>
            )}
            {notifs.map(n => (
              <button key={n.id} className="notif-item" onClick={() => go(n.to)}>
                <span className="notif-item__tag"><Badge tone={n.tone} dot={false}>{n.tag}</Badge></span>
                <span className="notif-item__body">
                  <span className="notif-item__title">{n.title}</span>
                  <span className="notif-item__meta">
                    {n.site && <strong>{n.site} · </strong>}{n.meta}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button className="notif-foot" onClick={() => go('/monitoring')}>
            Open Monitoring →
          </button>
        </div>
      )}
    </div>
  )
}
