import { NavLink } from 'react-router-dom'
import { MODULES } from '../modules'
import { CbreLogo } from '../emerald'

/** `variant="nav"` renders the module nav only (brand lives in the App Header). */
export function Sidebar({ variant = 'full' }: { variant?: 'full' | 'nav' }) {
  return (
    <aside className={`sidebar${variant === 'nav' ? ' sidebar--nav' : ''}`}>
      {variant === 'full' && (
        <div className="brand">
          <CbreLogo className="brand-cbre" />
          <div className="brand-divider" />
          <div className="name">Quantum</div>
        </div>
      )}

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
