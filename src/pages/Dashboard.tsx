import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import {
  DAY_LABELS_14, genSeries, getRacks, getSites,
  HOUR_LABELS, SITES, type Region, type SeriesPoint,
} from '../data'
import { Badge, Card, ChartTip, sevTone, StatTile } from '../components/ui'
import { axisTick, ChartFrame, MiniLegend, REGION_COLOR } from '../components/charts'
import { EmeraldNotification } from '../emerald'
import { useNavigate } from 'react-router-dom'

const REGIONS: Region[] = ['Americas', 'EMEA', 'APAC']

export function Dashboard() {
  const { siteId } = useApp()
  const navigate = useNavigate()
  const sites = getSites(siteId)
  const scopeLabel = siteId === 'all'
    ? 'Global portfolio — 10 sites'
    : `${sites[0].code} · ${sites[0].name}, ${sites[0].city}`

  const data = useData()
  const tickets = scoped(data.tickets, siteId)
  const alarms = scoped(data.alarms, siteId)
  const incidents = scoped(data.incidents, siteId)
  const racks = getRacks(siteId)

  const itLoad = sites.reduce((s, x) => s + x.itLoadMW, 0)
  const capacity = sites.reduce((s, x) => s + x.capacityMW, 0)
  const pue = sites.reduce((s, x) => s + x.currentPUE * x.itLoadMW, 0) / itLoad
  const openTickets = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length
  const slaBreaches = tickets.filter(t => t.slaBreached).length
  const activeIncidents = incidents.filter(i => i.status === 'Active' || i.status === 'Monitoring').length
  const criticalAlarms = alarms.filter(a => a.severity === 'critical' && !a.acked).length
  const hotRacks = racks.filter(r => r.status === 'critical' || r.status === 'warning').length

  /* --- IT load trend: by region (all) or single site (14d) --- */
  const loadTrend = useMemo<SeriesPoint[]>(() => {
    if (siteId === 'all') {
      const perRegion = REGIONS.map(region => {
        const base = SITES.filter(s => s.region === region).reduce((s, x) => s + x.itLoadMW, 0)
        return { region, series: genSeries(`region:${region}:load`, 14, base, base * 0.06, DAY_LABELS_14) }
      })
      return DAY_LABELS_14.map((t, i) => {
        const row: SeriesPoint = { t }
        perRegion.forEach(r => { row[r.region] = r.series[i].value })
        return row
      })
    }
    const s = sites[0]
    return genSeries(`${s.id}:load14`, 14, s.itLoadMW, s.itLoadMW * 0.08, DAY_LABELS_14, 2)
      .map(p => ({ t: p.label, [s.code]: p.value }))
  }, [siteId, sites])

  const loadSeries = siteId === 'all'
    ? REGIONS.map(r => ({ key: r, color: REGION_COLOR[r] }))
    : [{ key: sites[0].code, color: 'var(--chart-1)' }]

  /* --- PUE trend (own chart — never a second axis on the load chart) --- */
  const pueTrend = useMemo(() => {
    const labels = siteId === 'all' ? DAY_LABELS_14 : HOUR_LABELS
    return genSeries(`${siteId}:pue`, labels.length, pue, 0.05, labels, 3)
      .map(p => ({ t: p.label, PUE: p.value }))
  }, [siteId, pue])

  /* --- open tickets by site (magnitude → single hue) --- */
  const ticketsBySite = useMemo(
    () =>
      SITES.map(s => ({
        site: s.code.replace('QTM-', ''),
        Open: data.tickets.filter(t => t.siteId === s.id && (t.status === 'Open' || t.status === 'In Progress')).length,
      })),
    [data.tickets],
  )

  const recentIncidents = [...incidents]
    .sort((a, b) => a.startedDaysAgo - b.startedDaysAgo)
    .slice(0, 6)

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">{scopeLabel}</p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile
          label="IT load"
          value={itLoad.toFixed(1)}
          unit="MW"
          sub={<span className="muted">{((itLoad / capacity) * 100).toFixed(0)}% of {capacity.toFixed(0)} MW design</span>}
        />
        <StatTile
          label="Portfolio PUE"
          value={pue.toFixed(2)}
          sub={<Badge tone={pue <= 1.35 ? 'good' : 'warn'} dot={false}>{pue <= 1.35 ? 'On target' : 'Above target'}</Badge>}
        />
        <StatTile
          label="Open work orders"
          value={openTickets}
          sub={
            slaBreaches > 0
              ? <Badge tone="critical" dot={false}>▲ {slaBreaches} SLA breach{slaBreaches > 1 ? 'es' : ''}</Badge>
              : <Badge tone="good" dot={false}>SLA clean</Badge>
          }
        />
        <StatTile
          label="Active incidents"
          value={activeIncidents}
          sub={<span className="muted">{incidents.filter(i => i.status === 'RCA In Progress').length} RCA in progress</span>}
        />
      </div>

      <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card className="span-2" title={siteId === 'all' ? 'IT load trend by region — 14 days (MW)' : 'IT load trend — 14 days (MW)'}>
          <ChartFrame>
            <ResponsiveContainer>
              <LineChart data={loadTrend} margin={{ top: 6, right: 12, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="t" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={axisTick} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(0)} />
                <Tooltip content={<ChartTip unit=" MW" />} cursor={{ stroke: 'var(--chart-ref)', strokeDasharray: '3 3' }} />
                {loadSeries.map(s => (
                  <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color}
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          {loadSeries.length > 1 && (
            <MiniLegend items={loadSeries.map(s => ({ label: s.key, color: s.color }))} />
          )}
        </Card>

        <Card title={`PUE trend — ${siteId === 'all' ? '14 days' : '24 hours'}`}>
          <ChartFrame>
            <ResponsiveContainer>
              <LineChart data={pueTrend} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="t" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }}
                  interval="preserveStartEnd" minTickGap={40} />
                <YAxis domain={['dataMin - 0.05', 'dataMax + 0.05']} tick={axisTick} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(2)} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--chart-ref)', strokeDasharray: '3 3' }} />
                <Line type="monotone" dataKey="PUE" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Card>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card className="span-2" title="Open work orders by site">
          <ChartFrame height={210}>
            <ResponsiveContainer>
              <BarChart data={ticketsBySite} margin={{ top: 6, right: 12, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="site" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-3)' }} />
                <Bar dataKey="Open" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Card>

        <Card
          title="Recent incidents"
          action={<Link to="/incidents" className="muted" style={{ fontSize: 'var(--text-xs)' }}>View all</Link>}
        >
          {recentIncidents.length === 0 && <div className="empty-note">No incidents in scope</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentIncidents.map(inc => (
              <div key={inc.id} className="row" style={{ alignItems: 'flex-start' }}>
                <Badge tone={sevTone[inc.severity]} dot={false}>{inc.severity}</Badge>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inc.title}
                  </div>
                  <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                    {SITES.find(s => s.id === inc.siteId)?.code} · {inc.startedDaysAgo === 0 ? 'today' : `${inc.startedDaysAgo}d ago`} · {inc.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title={siteId === 'all' ? 'Site health summary' : 'Site detail'}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th><th>Region</th><th>Tier</th>
                <th className="num">IT load</th><th className="num">Utilization</th>
                <th className="num">PUE</th>
                <th className="num">Hot racks</th>
                <th className="num">Critical alarms</th>
                <th className="num">Open WOs</th>
                <th>Systems of record</th>
              </tr>
            </thead>
            <tbody>
              {sites.map(s => {
                const sAlarms = data.alarms.filter(a => a.siteId === s.id && a.severity === 'critical' && !a.acked).length
                const sHot = getRacks(s.id).filter(r => r.status !== 'nominal' && r.status !== 'offline').length
                const sOpen = data.tickets.filter(t => t.siteId === s.id && (t.status === 'Open' || t.status === 'In Progress')).length
                const util = (s.itLoadMW / s.capacityMW) * 100
                return (
                  <tr key={s.id}>
                    <td><strong>{s.code}</strong> <span className="muted">{s.name}</span></td>
                    <td>{s.region}</td>
                    <td>{s.tier}</td>
                    <td className="num">{s.itLoadMW.toFixed(1)} MW</td>
                    <td className="num">{util.toFixed(0)}%</td>
                    <td className="num">{s.currentPUE.toFixed(2)}</td>
                    <td className="num">{sHot > 0 ? <Badge tone="warn" dot={false}>{sHot}</Badge> : '0'}</td>
                    <td className="num">{sAlarms > 0 ? <Badge tone="critical" dot={false}>{sAlarms}</Badge> : '0'}</td>
                    <td className="num">{sOpen}</td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{s.dcim} · {s.bms.split(' ')[0]} · {s.cmms.split(' ')[0]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {hotRacks > 0 && (
        <div style={{ marginTop: 'var(--gap-md)' }}>
          <EmeraldNotification
            status="warning"
            title="Attention needed"
            actionLabel="Open Monitoring"
            onAction={() => navigate('/monitoring')}
          >
            {criticalAlarms} unacknowledged critical alarm{criticalAlarms === 1 ? '' : 's'} and {hotRacks} rack
            {hotRacks === 1 ? '' : 's'} above thermal threshold in scope — review Monitoring and Site View.
          </EmeraldNotification>
        </div>
      )}
    </div>
  )
}
