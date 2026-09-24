import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { DataProvider } from './context/DataContext'
import { Sidebar } from './components/Sidebar'
import { AppHeader } from './components/AppHeader'
import { SyncTray } from './components/SyncTray'
import { MODULES } from './modules'
import { Stub } from './pages/Stub'
import { Dashboard } from './pages/Dashboard'
import { Monitoring } from './pages/Monitoring'
import { Birdseye } from './pages/Birdseye'
import { Ticketing } from './pages/Ticketing'
import { Integrations } from './pages/Integrations'
import { Capacity } from './pages/Capacity'
import { Operations } from './pages/Operations'
import { Rounds } from './pages/Rounds'
import { Incidents } from './pages/Incidents'
import { Assets } from './pages/Assets'
import { HSE } from './pages/HSE'
import { Risk } from './pages/Risk'
import { Projects } from './pages/Projects'
import { ExecutiveSummary } from './pages/ExecutiveSummary'
import { ClientDashboard } from './pages/ClientDashboard'
import { CapitalPlanning } from './pages/CapitalPlanning'

const BUILT: Record<string, React.ComponentType> = {
  '/': Dashboard,
  '/monitoring': Monitoring,
  '/birdseye': Birdseye,
  '/ticketing': Ticketing,
  '/integrations': Integrations,
  '/capacity': Capacity,
  '/operations': Operations,
  '/rounds': Rounds,
  '/incidents': Incidents,
  '/assets': Assets,
  '/hse': HSE,
  '/risk': Risk,
  '/projects': Projects,
  '/capital': CapitalPlanning,
}

/** Route table depends on the active persona: executives get the client-health interface only;
    operations gets the 13 modules. Unknown paths bounce to that persona's home. */
function Routed() {
  const { role } = useApp()

  if (role === 'executive') {
    return (
      <main className="app-content">
        <Routes>
          <Route path="/executive" element={<ExecutiveSummary />} />
          <Route path="/executive/:clientId" element={<ClientDashboard />} />
          <Route path="*" element={<Navigate to="/executive" replace />} />
        </Routes>
      </main>
    )
  }

  return (
    <main className="app-content">
      <Routes>
        {MODULES.map(m => {
          const Built = BUILT[m.path]
          return (
            <Route
              key={m.path}
              path={m.path}
              element={Built ? <Built /> : <Stub mod={m} />}
            />
          )
        })}
        <Route path="/executive/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Stub mod={MODULES[0]} />} />
      </Routes>
    </main>
  )
}

export default function App() {
  return (
    <AppProvider>
      <DataProvider>
        <HashRouter>
          <div className="app-shell-h">
            <AppHeader />
            <div className="app-body">
              <Sidebar />
              <Routed />
            </div>
          </div>
          <SyncTray />
        </HashRouter>
      </DataProvider>
    </AppProvider>
  )
}
