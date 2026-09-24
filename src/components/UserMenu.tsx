import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLE_META, useApp, type Role } from '../context/AppContext'
import { EmeraldAvatar } from '../emerald'
import { IconChevron, IconExecutive, IconOps } from './Icons'

const ROLE_ORDER: Role[] = ['ops', 'executive']
const ROLE_ICON: Record<Role, typeof IconOps> = { ops: IconOps, executive: IconExecutive }
const HOME: Record<Role, string> = { ops: '/', executive: '/executive' }

/** Header user chip → popover for switching the interface persona (role). */
export function UserMenu() {
  const { role, setRole } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const choose = (r: Role) => {
    setOpen(false)
    if (r === role) return
    setRole(r)
    navigate(HOME[r])
  }

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="app-header__user"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account and view options"
        onClick={() => setOpen(o => !o)}
      >
        <EmeraldAvatar initials="BH" alt="Brad Hauser" />
        <span className="app-header__user-meta">
          <span className="n">Brad Hauser</span>
          <span className="r">{ROLE_META[role].title}</span>
        </span>
        <IconChevron className={`user-menu__chev${open ? ' open' : ''}`} width={14} height={14} />
      </button>

      {open && (
        <div className="user-menu__pop" role="menu" aria-label="View as">
          <div className="user-menu__head">
            <EmeraldAvatar initials="BH" alt="" size="lg" />
            <div>
              <div className="user-menu__name">Brad Hauser</div>
              <div className="user-menu__mail">brad.hauser@cbre.com</div>
            </div>
          </div>
          <div className="user-menu__label">View as</div>
          {ROLE_ORDER.map(r => {
            const Icon = ROLE_ICON[r]
            const on = r === role
            return (
              <button
                key={r}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                className={`user-menu__opt${on ? ' on' : ''}`}
                onClick={() => choose(r)}
              >
                <Icon />
                <span className="user-menu__opt-body">
                  <span className="user-menu__opt-title">{ROLE_META[r].label}</span>
                  <span className="user-menu__opt-blurb">{ROLE_META[r].blurb}</span>
                </span>
                {on && (
                  <svg className="user-menu__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 6" /></svg>
                )}
              </button>
            )
          })}
          <div className="user-menu__foot">Role switching is a demo shortcut — production maps roles from CBRE SSO groups.</div>
        </div>
      )}
    </div>
  )
}
