import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

/** Persona the shell renders for. `ops` = the 13 operations modules; `executive` = the
    client-health interface for DCS leadership. Switched from the header user menu. */
export type Role = 'ops' | 'executive'

export const ROLE_META: Record<Role, { label: string; title: string; blurb: string }> = {
  ops: { label: 'Operations view', title: 'Global Ops Admin', blurb: 'All 13 modules, scoped by site' },
  executive: { label: 'Executive view', title: 'Executive · DCS Leadership', blurb: 'Client health across the DCS portfolio' },
}

interface AppState {
  siteId: string // 'all' or a site id
  setSiteId: (id: string) => void
  theme: Theme
  toggleTheme: () => void
  role: Role
  setRole: (r: Role) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [siteId, setSiteId] = useState<string>(() => localStorage.getItem('qtm.site') ?? 'all')
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('qtm.theme') as Theme) ?? 'light')
  const [role, setRole] = useState<Role>(() => (localStorage.getItem('qtm.role') as Role) ?? 'ops')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('qtm.theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('qtm.site', siteId)
  }, [siteId])

  useEffect(() => {
    localStorage.setItem('qtm.role', role)
  }, [role])

  const value = useMemo<AppState>(
    () => ({
      siteId,
      setSiteId,
      theme,
      toggleTheme: () => setTheme(t => (t === 'light' ? 'dark' : 'light')),
      role,
      setRole,
    }),
    [siteId, theme, role],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}
