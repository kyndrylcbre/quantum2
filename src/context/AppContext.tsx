import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
export type Layout = 'sidebar' | 'appheader'

interface AppState {
  siteId: string // 'all' or a site id
  setSiteId: (id: string) => void
  theme: Theme
  toggleTheme: () => void
  layout: Layout
  setLayout: (l: Layout) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [siteId, setSiteId] = useState<string>(() => localStorage.getItem('qtm.site') ?? 'all')
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('qtm.theme') as Theme) ?? 'light')
  const [layout, setLayout] = useState<Layout>(() => (localStorage.getItem('qtm.layout') as Layout) ?? 'sidebar')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('qtm.theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('qtm.site', siteId)
  }, [siteId])

  useEffect(() => {
    localStorage.setItem('qtm.layout', layout)
  }, [layout])

  const value = useMemo<AppState>(
    () => ({
      siteId,
      setSiteId,
      theme,
      toggleTheme: () => setTheme(t => (t === 'light' ? 'dark' : 'light')),
      layout,
      setLayout,
    }),
    [siteId, theme, layout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}
