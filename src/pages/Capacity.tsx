import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { useData } from '../context/DataContext'
import { getRacks, getSites, SITES, siteById, type Rack } from '../data'
import { Badge, Card, ChartTip, StatTile } from '../components/ui'
import { axisTick, ChartFrame, MiniLegend } from '../components/charts'

export function Capacity() {
  const { siteId } = useApp()
  const { pull } = useData()
  const sites = getSites(siteId)
  const racks = getRacks(siteId)

  const designMW = sites.reduce((s, x) => s + x.capacityMW, 0)
  const loadMW = sites.reduce((s, x) => s + x.itLoadMW, 0)
  const utilization = (loadMW / designMW) * 100

  /* stranded capacity: rack has power headroom but no U space, or vice versa */
  const strandedPower = racks.filter(r => r.uUsed / r.uTotal > 0.9 && r.powerKw / r.capacityKw < 0.55)
  const strandedSpace = racks.filter(r => r.powerKw / r.capacityKw > 0.85 && r.uUsed / r.uTotal < 0.55)

  /* headroom by site (all) or by hall (single site) */
  const headroomData = useMemo(() => {
    if (siteId === 'all') {
      return SITES.map(s => ({
        label: s.code.replace('QTM-', ''),
        'IT load': +s.itLoadMW.toFixed(1),
        Headroom: +(s.capacityMW - s.itLoadMW).toFixed(1),
      }))
    }
    const site = sites[0]
    return Array.from({ length: site.halls }, (_, h) => {
      const hallRacks = racks.filter(r => r.hall === h + 1)
      const used = hallRacks.reduce((s, r) => s + r.powerKw, 0) / 1000
      const cap = hallRacks.reduce((s, r) => s + r.capacityKw, 0) / 1000
      return {
        label: `Hall ${h + 1}`,
        'IT load': +used.toFixed(2),
        Headroom: +Math.max(0, cap - used).toFixed(2),
      }
    })
  }, [siteId, sites, racks])

  /* naive rebalance suggestions: hottest racks paired with coolest in same site+hall */
  const suggestions = useMemo(() => {
    const out: { from: Rack; to: Rack; moveKw: number }[] = []
    for (const s of sites) {
      const sr = racks.filter(r => r.siteId === s.id)
      const hot = sr.filter(r => r.powerKw / r.capacityKw > 0.85).sort((a, b) => b.powerKw / b.capacityKw - a.powerKw / a.capacityKw)
      const cold = sr.filter(r => r.powerKw / r.capacityKw < 0.45 && r.uUsed < 36).sort((a, b) => a.powerKw / a.capacityKw - b.powerKw / b.capacityKw)
      hot.slice(0, 3).forEach((h, i) => {
        const target = cold.find(c => c.hall === h.hall) ?? cold[i]
        if (target) out.push({ from: h, to: target, moveKw: +Math.min(h.powerKw - h.capacityKw * 0.7, target.capacityKw * 0.6 - target.powerKw).toFixed(1) })
      })
    }
    return out.filter(s => s.moveKw > 0.5).slice(0, 8)
  }, [sites, racks])

  const dcimName = siteId === 'all' ? 'connected DCIMs' : sites[0].dcim
  const hasDcim = siteId === 'all' || sites[0].dcim !== 'None (Quantum native)'

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>Capacity Planning</h1>
          <p className="subtitle">
            Rack load balancing with push/pull sync — {hasDcim
              ? `plan here or in the DCIM; changes reconcile both ways (${dcimName})`
              : 'this site has no client DCIM, so Quantum is the system of record'}
          </p>
        </div>
        {hasDcim && (
          <button className="btn right" onClick={() => pull(siteId === 'all' ? 'Nlyte DCIM' : sites[0].dcim, 'Refresh rack inventory & load')}>
            ⟳ Pull latest from {siteId === 'all' ? 'DCIMs' : dcimName.split(' ')[0]}
          </button>
        )}
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Design capacity" value={designMW.toFixed(0)} unit="MW"
          sub={<span className="muted">{sites.length} site{sites.length > 1 ? 's' : ''} in scope</span>} />
        <StatTile label="Committed IT load" value={loadMW.toFixed(1)} unit="MW"
          sub={<Badge tone={utilization > 85 ? 'warn' : 'good'} dot={false}>{utilization.toFixed(0)}% utilized</Badge>} />
        <StatTile label="Stranded power" value={strandedPower.length} unit="racks"
          sub={<span className="muted">U-space full, power idle</span>} />
        <StatTile label="Stranded space" value={strandedSpace.length} unit="racks"
          sub={<span className="muted">power full, U-space idle</span>} />
      </div>

      <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card className="span-2" title={siteId === 'all' ? 'Power headroom by site (MW)' : 'Power headroom by hall (MW)'}>
          <ChartFrame height={230}>
            <ResponsiveContainer>
              <BarChart data={headroomData} margin={{ top: 6, right: 12, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip unit=" MW" />} cursor={{ fill: 'var(--surface-3)' }} />
                <Bar dataKey="IT load" stackId="a" fill="var(--chart-1)" maxBarSize={38} stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="Headroom" stackId="a" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={38} stroke="var(--surface)" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <MiniLegend items={[
            { label: 'IT load', color: 'var(--chart-1)' },
            { label: 'Headroom', color: 'var(--chart-2)' },
          ]} />
        </Card>

        <Card title="Rebalance suggestions">
          {suggestions.length === 0 && <div className="empty-note">No overloaded racks in scope</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  Move ~{s.moveKw} kW: {s.from.name} → {s.to.name}
                  {siteId === 'all' && <span className="muted"> · {siteById(s.from.siteId)?.code}</span>}
                </div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)', margin: '3px 0 7px' }}>
                  {s.from.name} at {Math.round((s.from.powerKw / s.from.capacityKw) * 100)}% power · {s.to.name} at {Math.round((s.to.powerKw / s.to.capacityKw) * 100)}%
                </div>
                <button className="btn" style={{ fontSize: 'var(--text-xs)', padding: '3px 10px' }}
                  onClick={() => pull(siteById(s.from.siteId)?.dcim ?? 'DCIM', `Push move plan ${s.from.name} → ${s.to.name}`)}>
                  Push plan to DCIM
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Highest-loaded racks">
        <div className="table-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rack</th>{siteId === 'all' && <th>Site</th>}<th>Customer</th>
                <th className="num">Power</th><th style={{ width: 140 }}>Power util</th>
                <th className="num">U used</th><th style={{ width: 140 }}>U util</th>
              </tr>
            </thead>
            <tbody>
              {[...racks]
                .sort((a, b) => b.powerKw / b.capacityKw - a.powerKw / a.capacityKw)
                .slice(0, 20)
                .map(r => {
                  const pu = (r.powerKw / r.capacityKw) * 100
                  const uu = (r.uUsed / r.uTotal) * 100
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong> <span className="muted">H{r.hall}</span></td>
                      {siteId === 'all' && <td className="muted">{siteById(r.siteId)?.code}</td>}
                      <td>{r.customer}</td>
                      <td className="num">{r.powerKw} / {r.capacityKw} kW</td>
                      <td>
                        <div className="util-bar">
                          <div style={{ width: `${pu}%`, background: pu > 85 ? 'var(--status-critical)' : pu > 70 ? 'var(--status-warn)' : 'var(--status-good)' }} />
                        </div>
                      </td>
                      <td className="num">{r.uUsed} / {r.uTotal}</td>
                      <td>
                        <div className="util-bar">
                          <div style={{ width: `${uu}%`, background: 'var(--chart-2)' }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
