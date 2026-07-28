import { NavLink } from 'react-router-dom'
import { MODULES } from '../modules'
import { useApp } from '../context/AppContext'
import { SITES } from '../data'
import { EmeraldSelect } from '../emerald'

export function Sidebar() {
  const { siteId, setSiteId } = useApp()

  return (
    <aside className="sidebar sidebar--nav">
      <div className="side-site">
        <EmeraldSelect
          label="Site"
          block
          value={siteId}
          onChange={e => setSiteId(e.target.value)}
        >
          <option value="all">All sites — global ({SITES.length})</option>
          {SITES.map(s => (
            <option key={s.id} value={s.id}>{s.code} · {s.city}</option>
          ))}
        </EmeraldSelect>
      </div>

      <div className="nav-label">Modules</div>
      <nav aria-label="Modules">
        {MODULES.map(m => (
          <NavLink
            key={m.path}
            to={m.path}
            end={m.path === '/'}
            className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
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
