import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { SITES } from '../data'
import { IconBell, IconMoon, IconSun } from './Icons'
import { EmeraldAvatar, EmeraldBadge, EmeraldIconButton } from '../emerald'

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
        <EmeraldBadge count={unacked}>
          <EmeraldIconButton
            label={`${unacked} unacknowledged alarms — open Monitoring`}
            onClick={() => navigate('/monitoring')}
          >
            <IconBell />
          </EmeraldIconButton>
        </EmeraldBadge>
        <EmeraldIconButton
          label="Toggle color theme"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <IconMoon /> : <IconSun />}
        </EmeraldIconButton>
        <div className="row" style={{ gap: 10 }}>
          <EmeraldAvatar initials="BH" alt="Brad Hauser" />
          <div className="user-meta">
            <div className="n">Brad Hauser</div>
            <div className="r">Global Ops Admin</div>
          </div>
        </div>
      </div>
    </header>
  )
}
