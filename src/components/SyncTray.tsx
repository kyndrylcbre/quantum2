import { useEffect, useState } from 'react'
import { useData } from '../context/DataContext'

const SHOW_MS = 4500

/** Bottom-right toast tray showing live push/pull activity against external systems. */
export function SyncTray() {
  const { syncEvents } = useData()
  const [now, setNow] = useState(() => Date.now())

  const visible = syncEvents.filter(e => e.status === 'pushing' || now - e.at < SHOW_MS).slice(0, 4)

  useEffect(() => {
    if (visible.length === 0) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [visible.length])

  if (visible.length === 0) return null

  return (
    <div className="sync-tray" role="status" aria-live="polite">
      {visible.map(e => (
        <div key={e.id} className={`sync-toast ${e.status}`}>
          <span className={`sync-spinner ${e.status}`} aria-hidden />
          <div className="sync-body">
            <div className="sync-action">{e.action}</div>
            <div className="sync-meta">
              {e.direction === 'push' ? '→' : '←'} {e.system} · {e.status === 'pushing' ? 'syncing…' : 'confirmed'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
