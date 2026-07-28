import { NavLink } from 'react-router-dom'
import { MODULES } from '../modules'
import { useApp } from '../context/AppContext'
import { SITES } from '../data'
import { EmeraldDropdown } from '../emerald'

const SITE_OPTIONS = [
  { value: 'all', label: `All sites — global (${SITES.length})` },
  ...SITES.map(s => ({ value: s.id, label: `${s.code} · ${s.city}` })),
]

export function Sidebar() {
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
        <strong>Quantum 2.0</strong> · build 0.2<br />
        Dummy data — 10 pilot sites
      </div>
    </aside>
  )
}
