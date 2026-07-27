import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { SITES } from '../data'
import { IconBell, IconMoon, IconSun } from './Icons'

export function TopBar() {
  const { siteId, setSiteId, theme, toggleTheme } = useApp()
  const { alarms } = useData()
  const navigate = useNavigate()
  const unacked = scoped(alarms, siteId).filter(a => !a.acked && a.severity !== 'info').length

  return (
    <header className="topbar">
      <div className="site-select">
        <label htmlFor="site-picker">Site</label>
        <select
          id="site-picker"
          className="select"
          value={siteId}
          onChange={e => setSiteId(e.target.value)}
        >
          <option value="all">All sites — global portfolio ({SITES.length})</option>
          {SITES.map(s => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.name} — {s.city}
            </option>
          ))}
        </select>
      </div>

      <div className="right row">
        <button
          className="icon-btn"
          title={`${unacked} unacknowledged alarms`}
          aria-label={`${unacked} unacknowledged alarms — open Monitoring`}
          onClick={() => navigate('/monitoring')}
        >
          <IconBell />
          {unacked > 0 && <span className="count">{unacked}</span>}
        </button>
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          aria-label="Toggle color theme"
        >
          {theme === 'light' ? <IconMoon /> : <IconSun />}
        </button>
        <div className="row" style={{ gap: 10 }}>
          <div className="avatar">BH</div>
          <div className="user-meta">
            <div className="n">Brad Hauser</div>
            <div className="r">Global Ops Admin</div>
          </div>
        </div>
      </div>
    </header>
  )
}
