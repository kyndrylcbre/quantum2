import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { DataProvider } from './context/DataContext'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
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
}

export default function App() {
  return (
    <AppProvider>
      <DataProvider>
        <HashRouter>
          <div className="app-shell">
            <Sidebar />
            <div className="app-main">
              <TopBar />
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
                  <Route path="*" element={<Stub mod={MODULES[0]} />} />
                </Routes>
              </main>
            </div>
          </div>
          <SyncTray />
        </HashRouter>
      </DataProvider>
    </AppProvider>
  )
}
