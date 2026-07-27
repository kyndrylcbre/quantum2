import { NavLink } from 'react-router-dom'
import { MODULES } from '../modules'
import { CbreLogo } from '../emerald'

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <CbreLogo className="brand-cbre" />
        <div className="brand-divider" />
        <div className="word">
          <div className="name">Quantum</div>
        </div>
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
        <strong>Quantum 2.0</strong> · build 0.1<br />
        Dummy data — 10 pilot sites
      </div>
    </aside>
  )
}
