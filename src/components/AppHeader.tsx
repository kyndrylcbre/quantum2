import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { IconBell, IconMoon, IconSun } from './Icons'
import { CbreLogo, EmeraldAvatar, EmeraldBadge, EmeraldIconButton } from '../emerald'

/** Emerald-canonical full-width App Header: brand lockup + global actions. */
export function AppHeader() {
  const { siteId, theme, toggleTheme } = useApp()
  const { alarms } = useData()
  const navigate = useNavigate()
  const unacked = scoped(alarms, siteId).filter(a => !a.acked && a.severity !== 'info').length

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <CbreLogo className="app-header__logo" />
        <span className="app-header__divider" />
        <span className="app-header__product">Quantum</span>
      </div>

      <div className="app-header__actions">
        <EmeraldBadge count={unacked}>
          <EmeraldIconButton
            className="on-dark"
            label={`${unacked} unacknowledged alarms — open Monitoring`}
            onClick={() => navigate('/monitoring')}
          >
            <IconBell />
          </EmeraldIconButton>
        </EmeraldBadge>
        <EmeraldIconButton
          className="on-dark"
          label="Toggle color theme"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <IconMoon /> : <IconSun />}
        </EmeraldIconButton>
        <div className="app-header__user">
          <EmeraldAvatar initials="BH" alt="Brad Hauser" />
          <div className="app-header__user-meta">
            <div className="n">Brad Hauser</div>
            <div className="r">Global Ops Admin</div>
          </div>
        </div>
      </div>
    </header>
  )
}
