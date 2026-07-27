import { NavLink } from 'react-router-dom'
import { MODULES } from '../modules'

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 4l10.4 6v12L16 28 5.6 22V10L16 4z" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
    </svg>
  )
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo"><LogoMark /></div>
        <div className="word">
          <div className="name">Quantum</div>
          <div className="tag">CBRE Data Center Ops</div>
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
