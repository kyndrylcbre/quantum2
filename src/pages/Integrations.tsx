import { useData } from '../context/DataContext'
import { getIntegrations } from '../data'
import { Badge, Card, integrationTone, StatTile } from '../components/ui'

function fmtSync(min: number): string {
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (min < 1440) return `${Math.round(min / 60)}h ago`
  return `${Math.round(min / 1440)}d ago`
}

export function Integrations() {
  const integrations = getIntegrations()
  const { syncEvents } = useData()
  const connected = integrations.filter(i => i.status === 'Connected').length
  const issues = integrations.filter(i => i.status === 'Degraded' || i.status === 'Error').length
  const events = integrations.reduce((s, i) => s + i.eventsToday, 0)

  return (
    <div>
      <div className="page-header">
        <h1>Integrations</h1>
        <p className="subtitle">
          Every API/MCP connection Quantum runs on — CBRE-internal systems and client-side platforms. Integration-first by design.
        </p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Connections" value={integrations.length}
          sub={<span className="muted">{integrations.filter(i => i.internal).length} internal · {integrations.filter(i => !i.internal).length} client/external</span>} />
        <StatTile label="Healthy" value={connected}
          sub={<Badge tone="good" dot={false}>{Math.round((connected / integrations.length) * 100)}% uptime</Badge>} />
        <StatTile label="Needs attention" value={issues}
          sub={issues > 0 ? <Badge tone="warn" dot={false}>Degraded or in error</Badge> : <Badge tone="good" dot={false}>All clear</Badge>} />
        <StatTile label="Events today" value={events.toLocaleString()}
          sub={<span className="muted">telemetry, tickets, syncs</span>} />
      </div>

      {syncEvents.length > 0 && (
        <Card title="Live push/pull activity — this session" className="span-2">
          <div className="table-scroll" style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 'var(--gap-md)' }}>
            <table className="data-table">
              <thead>
                <tr><th>Direction</th><th>Action</th><th>System</th><th>Status</th></tr>
              </thead>
              <tbody>
                {syncEvents.map(e => (
                  <tr key={e.id}>
                    <td><Badge tone={e.direction === 'push' ? 'info' : 'neutral'} dot={false}>{e.direction === 'push' ? '→ push' : '← pull'}</Badge></td>
                    <td>{e.action}</td>
                    <td className="muted">{e.system}</td>
                    <td>
                      {e.status === 'pushing'
                        ? <Badge tone="warn">syncing</Badge>
                        : <Badge tone="good">confirmed</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Connection registry">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>System</th><th>Category</th><th>Protocol</th><th>Scope</th>
                <th>Ownership</th><th>Status</th><th>Last sync</th>
                <th className="num">Latency</th><th className="num">Events today</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map(i => (
                <tr key={i.id}>
                  <td><strong>{i.name}</strong> <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{i.vendor}</span></td>
                  <td>{i.category}</td>
                  <td><Badge tone={i.protocol === 'MCP' ? 'info' : 'neutral'} dot={false}>{i.protocol}</Badge></td>
                  <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{i.scope}</td>
                  <td>{i.internal ? 'CBRE internal' : 'Client / external'}</td>
                  <td><Badge tone={integrationTone[i.status]}>{i.status}</Badge></td>
                  <td className="muted">{i.status === 'Pending' ? '—' : fmtSync(i.lastSyncMin)}</td>
                  <td className="num">{i.status === 'Pending' ? '—' : `${i.latencyMs} ms`}</td>
                  <td className="num">{i.eventsToday.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
