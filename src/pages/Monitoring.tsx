import { useMemo, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import {
  genSeries, getEquipment, getSites, HOUR_LABELS, siteById,
  type AlarmSeverity, type EquipKind,
} from '../data'
import { alarmTone, Badge, Card, ChartTip, equipTone, Segmented, StatTile } from '../components/ui'
import { axisTick, ChartFrame } from '../components/charts'

const SEV_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
] as const

const KIND_ORDER: EquipKind[] = ['UPS', 'Generator', 'Switchgear', 'PDU', 'Chiller', 'CRAH', 'CRAC']

function fmtAgo(min: number): string {
  if (min < 60) return `${min}m ago`
  if (min < 1440) return `${Math.round(min / 60)}h ago`
  return `${Math.round(min / 1440)}d ago`
}

export function Monitoring() {
  const { siteId } = useApp()
  const { alarms: allAlarms, ackAlarm } = useData()
  const sites = getSites(siteId)
  const equipment = getEquipment(siteId)
  const alarms = scoped(allAlarms, siteId)

  const [sevFilter, setSevFilter] = useState<'all' | AlarmSeverity>('all')
  const [kindFilter, setKindFilter] = useState<'all' | EquipKind>('all')

  const visibleAlarms = alarms.filter(a => sevFilter === 'all' || a.severity === sevFilter)
  const visibleEquip = useMemo(
    () =>
      [...equipment]
        .filter(e => kindFilter === 'all' || e.kind === kindFilter)
        .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name)),
    [equipment, kindFilter],
  )

  const faults = equipment.filter(e => e.status === 'fault').length
  const warnings = equipment.filter(e => e.status === 'warning').length
  const inMaint = equipment.filter(e => e.status === 'maintenance').length
  const unacked = alarms.filter(a => !a.acked).length

  /* 24h whitespace inlet temperature and IT power for the scope */
  const tempSeries = useMemo(() => {
    const base = siteId === 'all' ? 24.2 : 23 + (siteById(siteId)?.currentPUE ?? 1.3) * 1.2
    return genSeries(`${siteId}:inlet24`, 24, base, 1.6, HOUR_LABELS)
      .map(p => ({ t: p.label, 'Avg inlet temp': p.value }))
  }, [siteId])

  const powerSeries = useMemo(() => {
    const base = sites.reduce((s, x) => s + x.itLoadMW, 0)
    return genSeries(`${siteId}:pow24`, 24, base, base * 0.05, HOUR_LABELS, 2)
      .map(p => ({ t: p.label, 'IT load': p.value }))
  }, [siteId, sites])

  return (
    <div>
      <div className="page-header">
        <h1>Monitoring</h1>
        <p className="subtitle">
          BMS/BAS telemetry across whitespace and grayspace ·{' '}
          {siteId === 'all'
            ? 'aggregating Siemens, Schneider, Honeywell and JCI head-ends plus DCIM rack sensors'
            : `${sites[0].bms} + ${sites[0].dcim} at ${sites[0].code}`}
        </p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Monitored equipment" value={equipment.length}
          sub={<span className="muted">{sites.length} site{sites.length > 1 ? 's' : ''} in scope</span>} />
        <StatTile label="Active alarms" value={alarms.length}
          sub={<Badge tone={unacked > 0 ? 'warn' : 'good'} dot={false}>{unacked} unacknowledged</Badge>} />
        <StatTile label="Equipment faults" value={faults}
          sub={<span className="muted">{warnings} in warning state</span>} />
        <StatTile label="In maintenance" value={inMaint}
          sub={<span className="muted">planned windows active</span>} />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card title="Whitespace avg inlet temperature — 24h (°C)">
          <ChartFrame height={190}>
            <ResponsiveContainer>
              <LineChart data={tempSeries} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="t" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} minTickGap={38} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={axisTick} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip content={<ChartTip unit="°C" />} cursor={{ stroke: 'var(--chart-ref)', strokeDasharray: '3 3' }} />
                <Line type="monotone" dataKey="Avg inlet temp" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Card>
        <Card title="IT load — 24h (MW)">
          <ChartFrame height={190}>
            <ResponsiveContainer>
              <LineChart data={powerSeries} margin={{ top: 6, right: 12, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="t" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} minTickGap={38} />
                <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={axisTick} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip content={<ChartTip unit=" MW" />} cursor={{ stroke: 'var(--chart-ref)', strokeDasharray: '3 3' }} />
                <Line type="monotone" dataKey="IT load" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={`Alarm feed (${visibleAlarms.length})`}
          action={
            <Segmented options={SEV_OPTIONS} value={sevFilter} onChange={v => setSevFilter(v)} />
          }
        >
          <div className="table-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Severity</th><th>Source</th><th>Point</th><th>System</th><th>Age</th><th>Ack</th></tr>
              </thead>
              <tbody>
                {visibleAlarms.map(a => (
                  <tr key={a.id}>
                    <td><Badge tone={alarmTone[a.severity]}>{a.severity}</Badge></td>
                    <td>
                      <strong>{a.source}</strong>
                      {siteId === 'all' && <span className="muted"> · {siteById(a.siteId)?.code}</span>}
                    </td>
                    <td>{a.point}</td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{a.system}</td>
                    <td className="muted">{fmtAgo(a.minutesAgo)}</td>
                    <td>
                      {a.acked
                        ? <Badge tone="neutral" dot={false}>Acked</Badge>
                        : (
                          <button className="btn" style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }}
                            title={`Acknowledge in ${a.system}`}
                            onClick={() => ackAlarm(a.id)}>
                            Ack
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
                {visibleAlarms.length === 0 && (
                  <tr><td colSpan={6} className="empty-note">No alarms match the filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Equipment status (${visibleEquip.length})`}
          action={
            <select className="select" value={kindFilter} onChange={e => setKindFilter(e.target.value as 'all' | EquipKind)}>
              <option value="all">All types</option>
              {KIND_ORDER.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          }
        >
          <div className="table-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Asset</th><th>Type</th><th>Status</th><th className="num">Load</th><th>Reading</th><th>Vendor</th></tr>
              </thead>
              <tbody>
                {visibleEquip.map(e => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.name}</strong>
                      {siteId === 'all' && <span className="muted"> · {siteById(e.siteId)?.code}</span>}
                    </td>
                    <td>{e.kind}</td>
                    <td><Badge tone={equipTone[e.status]}>{e.status}</Badge></td>
                    <td className="num">{e.loadPct > 0 ? `${e.loadPct}%` : '—'}</td>
                    <td className="mono">{e.metric}</td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{e.vendor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
