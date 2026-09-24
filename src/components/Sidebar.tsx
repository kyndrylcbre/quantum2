import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { MODULES } from '../modules'
import { useApp } from '../context/AppContext'
import { useData } from '../context/DataContext'
import { CLIENTS, SITES, snapshotsFor } from '../data'
import { EmeraldDropdown } from '../emerald'
import { IconExecutive } from './Icons'

const SITE_OPTIONS = [
  { value: 'all', label: `All sites — global (${SITES.length})` },
  ...SITES.map(s => ({ value: s.id, label: `${s.code} · ${s.city}` })),
]

export function Sidebar() {
  const { role } = useApp()
  return role === 'executive' ? <ExecutiveSidebar /> : <OperationsSidebar />
}

/** Executive persona: organization summary + one entry per DCS account, worst health first. */
function ExecutiveSidebar() {
  const { risks, incidents, projects } = useData()
  const snapshots = useMemo(
    () => snapshotsFor(CLIENTS, { risks, incidents, projects }).sort((a, b) => a.health.score - b.health.score),
    [risks, incidents, projects],
  )
  const attention = snapshots.filter(s => s.health.band !== 'Healthy').length

  return (
    <aside className="sidebar sidebar--nav">
      <div className="nav-label">Executive</div>
      <nav aria-label="Executive">
        <NavLink to="/executive" end className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
          <IconExecutive />
          <span>Summary</span>
          {attention > 0 && <span className="side-count" title={`${attention} accounts need attention`}>{attention}</span>}
        </NavLink>
      </nav>

      <div className="nav-label">Clients · {CLIENTS.length}</div>
      <nav aria-label="Clients" className="side-clients">
        {snapshots.map(s => (
          <NavLink
            key={s.client.id}
            to={`/executive/${s.client.id}`}
            className={({ isActive }) => `side-link side-client${isActive ? ' active' : ''}`}
          >
            <span className="side-client__body">
              <span className="side-client__name">{s.client.name}</span>
              <span className="side-client__meta">{s.client.sector} · {s.siteCount} site{s.siteCount === 1 ? '' : 's'}</span>
            </span>
            <span className={`side-client__health ${s.health.tone}`} title={`Health ${s.health.score} — ${s.health.band}`}>
              {s.health.score}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="side-footer">
        <strong>Quantum 2.0</strong> · build 0.3<br />
        Dummy data — {CLIENTS.length} clients · {SITES.length} sites
      </div>
    </aside>
  )
}

function OperationsSidebar() {
  const { siteId, setSiteId } = useApp()
  return (
    <aside className="sidebar sidebar--nav">
      <div className="side-site">
        <EmeraldDropdown
          label="Site"
          block
          value={siteId}
          options={SITE_OPTIONS}
          onChange={setSiteId}
        />
      </div>

      <div className="nav-label">Modules</div>
      <nav aria-label="Modules">
        {MODULES.map(m => (
          <NavLink
            key={m.path}
            to={m.path}
            end={m.path === '/'}
            className={({ isActive }) =>
              `side-link${isActive ? ' active' : ''}${m.path === '/integrations' ? ' side-link--spotlight' : ''}`}
          >
            <m.icon />
            <span>{m.name}</span>
            {!m.built && <span className="chunk-pill">C{m.chunk}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="side-footer">
        <strong>Quantum 2.0</strong> · build 0.3<br />
        Dummy data — 10 pilot sites
      </div>
    </aside>
  )
}
