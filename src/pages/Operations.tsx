import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { useData } from '../context/DataContext'
import { getOps, getSites, siteById } from '../data'
import { Badge, Card, ChartTip, StatTile } from '../components/ui'
import { axisTick, ChartFrame, MiniLegend } from '../components/charts'
import { EmeraldButton } from '../emerald'

const fmtUSD = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1000).toFixed(0)}k`

export function Operations() {
  const { siteId } = useApp()
  const { pull } = useData()
  const sites = getSites(siteId)
  const profiles = getOps(siteId)

  const fte = profiles.reduce((s, p) => s + p.fteTechnical + p.fteManagement + p.fteSoft, 0)
  const monthly = profiles.reduce((s, p) => s + p.hardRaisedFloorUSD + p.hardMneUSD + p.softServicesUSD, 0)
  const loadMW = sites.reduce((s, x) => s + x.itLoadMW, 0)
  const costPerKw = monthly / (loadMW * 1000)
  const hardShare = profiles.reduce((s, p) => s + p.hardRaisedFloorUSD + p.hardMneUSD, 0) / monthly

  const costData = useMemo(
    () =>
      profiles.map(p => {
        const s = siteById(p.siteId)!
        return {
          label: s.code.replace('QTM-', ''),
          'Hard — raised floor': Math.round(p.hardRaisedFloorUSD / 1000),
          'Hard — M&E': Math.round(p.hardMneUSD / 1000),
          'Soft services': Math.round(p.softServicesUSD / 1000),
        }
      }),
    [profiles],
  )

  const services = profiles.flatMap(p => p.services.map(svc => ({ ...svc, siteId: p.siteId })))
  const svcRollup = useMemo(() => {
    const map = new Map<string, { service: string; category: string; space: string; frequency: string; total: number; sites: number; selfPerform: number }>()
    for (const s of services) {
      const cur = map.get(s.service) ?? { service: s.service, category: s.category, space: s.space, frequency: s.frequency, total: 0, sites: 0, selfPerform: 0 }
      cur.total += s.annualCostUSD
      cur.sites += 1
      if (s.delivery === 'Self-perform') cur.selfPerform += 1
      map.set(s.service, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [services])

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>Operations Mgmt</h1>
          <p className="subtitle">
            Cost to operate each facility — FTE, hard and soft services split across raised floor and M&E, with the scope of work behind it.
          </p>
        </div>
        <EmeraldButton variant="secondary" className="right" onClick={() => pull('Workday (FTE roster)', 'Refresh FTE roster & rates')}>
          ⟳ Pull roster from Workday
        </EmeraldButton>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Total FTE" value={fte}
          sub={<span className="muted">{profiles.reduce((s, p) => s + p.fteTechnical, 0)} technical · {profiles.reduce((s, p) => s + p.fteManagement, 0)} mgmt · {profiles.reduce((s, p) => s + p.fteSoft, 0)} soft</span>} />
        <StatTile label="Monthly cost to operate" value={fmtUSD(monthly)}
          sub={<span className="muted">{fmtUSD(monthly * 12)} annualized</span>} />
        <StatTile label="Cost per kW / month" value={`$${costPerKw.toFixed(0)}`}
          sub={<Badge tone={costPerKw < 15 ? 'good' : 'warn'} dot={false}>{costPerKw < 15 ? 'Within benchmark' : 'Above benchmark'}</Badge>} />
        <StatTile label="Hard : soft split" value={`${Math.round(hardShare * 100)} : ${Math.round((1 - hardShare) * 100)}`}
          sub={<span className="muted">hard services share of spend</span>} />
      </div>

      <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card className="span-2" title="Monthly service cost by site ($k)">
          <ChartFrame height={240}>
            <ResponsiveContainer>
              <BarChart data={costData} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip unit="k" />} cursor={{ fill: 'var(--surface-3)' }} />
                <Bar dataKey="Hard — raised floor" stackId="a" fill="var(--chart-1)" maxBarSize={40} stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="Hard — M&E" stackId="a" fill="var(--chart-2)" maxBarSize={40} stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="Soft services" stackId="a" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={40} stroke="var(--surface)" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <MiniLegend items={[
            { label: 'Hard — raised floor', color: 'var(--chart-1)' },
            { label: 'Hard — M&E', color: 'var(--chart-2)' },
            { label: 'Soft services', color: 'var(--chart-3)' },
          ]} />
        </Card>

        <Card title="FTE by site">
          <div className="table-scroll" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Site</th><th className="num">Tech</th><th className="num">Mgmt</th><th className="num">Soft</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {profiles.map(p => {
                  const s = siteById(p.siteId)!
                  return (
                    <tr key={p.siteId}>
                      <td><strong>{s.code.replace('QTM-', '')}</strong></td>
                      <td className="num">{p.fteTechnical}</td>
                      <td className="num">{p.fteManagement}</td>
                      <td className="num">{p.fteSoft}</td>
                      <td className="num"><strong>{p.fteTechnical + p.fteManagement + p.fteSoft}</strong></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title={siteId === 'all' ? 'Service matrix — portfolio rollup (annual)' : `Service matrix — ${sites[0].code} (annual)`}>
        <div className="table-scroll" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th><th>Category</th><th>Space</th><th>Frequency</th>
                <th>Delivery</th><th className="num">Annual cost</th>
              </tr>
            </thead>
            <tbody>
              {siteId === 'all'
                ? svcRollup.map(s => (
                  <tr key={s.service}>
                    <td><strong>{s.service}</strong></td>
                    <td><Badge tone={s.category === 'Hard' ? 'info' : 'neutral'} dot={false}>{s.category}</Badge></td>
                    <td>{s.space}</td>
                    <td className="muted">{s.frequency}</td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{s.selfPerform}/{s.sites} sites self-perform</td>
                    <td className="num">{fmtUSD(s.total)}</td>
                  </tr>
                ))
                : profiles[0]?.services.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.service}</strong></td>
                    <td><Badge tone={s.category === 'Hard' ? 'info' : 'neutral'} dot={false}>{s.category}</Badge></td>
                    <td>{s.space}</td>
                    <td className="muted">{s.frequency}</td>
                    <td>{s.delivery}</td>
                    <td className="num">{fmtUSD(s.annualCostUSD)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
