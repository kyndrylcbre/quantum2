import { useApp } from '../context/AppContext'
import { IconMoon, IconSun } from './Icons'
import { CbreLogo, EmeraldIconButton } from '../emerald'
import { NotificationsMenu } from './NotificationsMenu'
import { UserMenu } from './UserMenu'

/** Emerald-canonical full-width App Header: brand lockup + global actions. */
export function AppHeader() {
  const { theme, toggleTheme, role } = useApp()

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <CbreLogo className="app-header__logo" />
        <span className="app-header__divider" />
        <span className="app-header__product">Quantum</span>
        {role === 'executive' && <span className="app-header__mode">Executive view</span>}
      </div>

      <div className="app-header__actions">
        {role === 'ops' && <NotificationsMenu />}
        <EmeraldIconButton
          className="on-dark"
          label="Toggle color theme"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <IconMoon /> : <IconSun />}
        </EmeraldIconButton>
        <UserMenu />
      </div>
    </header>
  )
}
