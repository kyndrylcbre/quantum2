import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import {
  getEquipment, getHistory, siteById,
  type EquipKind, type MechEquipment,
} from '../data'
import { Badge, Card, equipTone, StatTile } from '../components/ui'
import { EmeraldButton } from '../emerald'

const KINDS: EquipKind[] = ['UPS', 'Generator', 'Switchgear', 'PDU', 'Chiller', 'CRAH', 'CRAC']
const THIS_YEAR = 2026

export function Assets() {
  const { siteId } = useApp()
  const { tickets, pull } = useData()
  const equipment = getEquipment(siteId)

  const [kindFilter, setKindFilter] = useState<'all' | EquipKind>('all')
  const [condFilter, setCondFilter] = useState<'all' | 'poor'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = equipment.find(e => e.id === selectedId) ?? null

  const visible = useMemo(
    () =>
      equipment
        .filter(e => kindFilter === 'all' || e.kind === kindFilter)
        .filter(e => condFilter === 'all' || e.conditionScore <= 2)
        .sort((a, b) => a.conditionScore - b.conditionScore || (b.installedYear < a.installedYear ? -1 : 1)),
    [equipment, kindFilter, condFilter],
  )

  const avgCondition = equipment.length
    ? equipment.reduce((s, e) => s + e.conditionScore, 0) / equipment.length
    : 0
  const avgAge = equipment.length
    ? equipment.reduce((s, e) => s + (THIS_YEAR - e.installedYear), 0) / equipment.length
    : 0
  const endOfLife = equipment.filter(e => e.conditionScore <= 2 || THIS_YEAR - e.installedYear > 12)

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>Assets</h1>
          <p className="subtitle">
            Asset registry with condition and maintenance history — the backbone for capital planning in the Projects module.
          </p>
        </div>
        <EmeraldButton variant="secondary" className="right" onClick={() => pull(siteId === 'all' ? 'SI7 CMMS' : siteById(siteId)?.cmms ?? 'CMMS', 'Refresh asset registry & histories')}>
          ⟳ Pull registry from CMMS
        </EmeraldButton>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Registered assets" value={equipment.length}
          sub={<span className="muted">major mechanical & electrical plant</span>} />
        <StatTile label="Avg condition" value={avgCondition.toFixed(1)} unit="/ 5"
          sub={<Badge tone={avgCondition >= 3.5 ? 'good' : 'warn'} dot={false}>{avgCondition >= 3.5 ? 'Healthy fleet' : 'Watch list growing'}</Badge>} />
        <StatTile label="Avg age" value={avgAge.toFixed(1)} unit="yrs"
          sub={<span className="muted">install years {Math.min(...equipment.map(e => e.installedYear))}–{Math.max(...equipment.map(e => e.installedYear))}</span>} />
        <StatTile label="Lifecycle flags" value={endOfLife.length}
          sub={<span className="muted">condition ≤ 2 or age &gt; 12 yrs</span>} />
      </div>

      <div className="filter-row">
        <select className="select" value={kindFilter} onChange={e => setKindFilter(e.target.value as 'all' | EquipKind)}>
          <option value="all">All types</option>
          {KINDS.map(k => <option key={k}>{k}</option>)}
        </select>
        <select className="select" value={condFilter} onChange={e => setCondFilter(e.target.value as 'all' | 'poor')}>
          <option value="all">Any condition</option>
          <option value="poor">Condition ≤ 2 (replacement candidates)</option>
        </select>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{visible.length} shown</span>
      </div>

      <div className="floor-wrap">
        <Card>
          <div className="table-scroll" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>{siteId === 'all' && <th>Site</th>}<th>Type</th><th>Vendor</th>
                  <th>Status</th><th className="num">Installed</th><th className="num">Age</th><th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(e => (
                  <tr key={e.id} className="clickable" onClick={() => setSelectedId(e.id)}>
                    <td><strong>{e.name}</strong> <span className="muted">H{e.hall}</span></td>
                    {siteId === 'all' && <td className="muted">{siteById(e.siteId)?.code}</td>}
                    <td>{e.kind}</td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{e.vendor}</td>
                    <td><Badge tone={equipTone[e.status]}>{e.status}</Badge></td>
                    <td className="num">{e.installedYear}</td>
                    <td className="num">{THIS_YEAR - e.installedYear}y</td>
                    <td>
                      <span style={{ color: e.conditionScore <= 2 ? 'var(--status-critical)' : 'var(--ink-2)' }}>
                        {'★'.repeat(e.conditionScore)}{'☆'.repeat(5 - e.conditionScore)}
                      </span>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={8} className="empty-note">No assets match</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <AssetDetail asset={selected} openTickets={selected ? tickets.filter(t => t.asset && selected.name.startsWith(t.asset.split('-')[0]) && t.siteId === selected.siteId && (t.status === 'Open' || t.status === 'In Progress')).length : 0} />
      </div>
    </div>
  )
}

function AssetDetail({ asset, openTickets }: { asset: MechEquipment | null; openTickets: number }) {
  if (!asset) {
    return (
      <Card title="Asset detail">
        <div className="empty-note" style={{ padding: 'var(--gap-lg)' }}>
          Select an asset to view its condition and maintenance history.
        </div>
      </Card>
    )
  }
  const history = getHistory(asset.id)
  const spend = history.reduce((s, h) => s + h.costUSD, 0)

  return (
    <Card title={asset.name} action={<Badge tone={equipTone[asset.status]}>{asset.status}</Badge>}>
      <dl className="detail-kv">
        <dt>Type</dt><dd>{asset.kind}</dd>
        <dt>Vendor</dt><dd>{asset.vendor}</dd>
        <dt>Site / hall</dt><dd>{siteById(asset.siteId)?.code} · H{asset.hall}</dd>
        <dt>Installed</dt><dd>{asset.installedYear} ({THIS_YEAR - asset.installedYear} yrs)</dd>
        <dt>Condition</dt><dd>{'★'.repeat(asset.conditionScore)}{'☆'.repeat(5 - asset.conditionScore)}</dd>
        <dt>Open work orders</dt><dd>{openTickets}</dd>
        <dt>Maint. spend (2yr)</dt><dd>${spend.toLocaleString()}</dd>
      </dl>

      {(asset.conditionScore <= 2 || THIS_YEAR - asset.installedYear > 12) && (
        <div style={{ marginTop: 12 }}>
          <Badge tone="serious" dot={false}>Lifecycle flag — candidate for capital plan</Badge>
        </div>
      )}

      <div className="card-title" style={{ marginTop: 16 }}><span>Maintenance history</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
        {history.map(h => (
          <div key={h.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            <div className="row">
              <Badge tone={h.type === 'PM' ? 'info' : 'warn'} dot={false}>{h.type}</Badge>
              <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{Math.round(h.daysAgo / 30)}mo ago · {h.by}</span>
              <span className="right mono" style={{ fontSize: 'var(--text-xs)' }}>${h.costUSD.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', marginTop: 3 }}>{h.note}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
