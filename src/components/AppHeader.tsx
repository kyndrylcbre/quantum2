import { useApp } from '../context/AppContext'
import { IconMoon, IconSun } from './Icons'
import { CbreLogo, EmeraldAvatar, EmeraldIconButton } from '../emerald'
import { NotificationsMenu } from './NotificationsMenu'

/** Emerald-canonical full-width App Header: brand lockup + global actions. */
export function AppHeader() {
  const { theme, toggleTheme } = useApp()

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <CbreLogo className="app-header__logo" />
        <span className="app-header__divider" />
        <span className="app-header__product">Quantum</span>
      </div>

      <div className="app-header__actions">
        <NotificationsMenu />
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
