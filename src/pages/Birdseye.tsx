import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  getEquipment, getRacks, getSites, SITES,
  type MechEquipment, type Rack,
} from '../data'
import { Badge, Card, equipTone, rackTone, Segmented } from '../components/ui'
import { MiniLegend } from '../components/charts'
import '../styles/birdseye.css'

type Overlay = 'status' | 'temp' | 'power'
type Selection = { kind: 'rack'; rack: Rack } | { kind: 'equip'; equip: MechEquipment } | null

/* sequential single-hue ramp (amber) for temp/power overlays */
function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('')
}
const RAMP_LO = '#fbe8c8'
const RAMP_HI = '#8a5a00'

const STATUS_FILL: Record<Rack['status'], string> = {
  nominal: 'var(--status-good)',
  warning: 'var(--status-warn)',
  critical: 'var(--status-critical)',
  offline: 'var(--status-neutral)',
}

const RACK_W = 30
const RACK_H = 20
const GAP = 5

export function Birdseye() {
  const { siteId, setSiteId } = useApp()

  if (siteId === 'all') {
    return (
      <div>
        <div className="page-header">
          <h1>Birdseye</h1>
          <p className="subtitle">Select a facility to open its raised-floor view.</p>
        </div>
        <div className="site-pick-grid">
          {SITES.map(s => {
            const hot = getRacks(s.id).filter(r => r.status === 'critical' || r.status === 'warning').length
            return (
              <section key={s.id} className="card" onClick={() => setSiteId(s.id)} role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSiteId(s.id)}>
                <div className="card-title"><span>{s.code}</span>{hot > 0 && <Badge tone="warn" dot={false}>{hot} hot</Badge>}</div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>{s.city} · {s.halls} hall{s.halls > 1 ? 's' : ''} · {s.rackCount} racks</div>
              </section>
            )
          })}
        </div>
      </div>
    )
  }

  return <FloorView key={siteId} siteId={siteId} />
}

function FloorView({ siteId }: { siteId: string }) {
  const [hall, setHall] = useState(1)
  const [overlay, setOverlay] = useState<Overlay>('status')
  const [sel, setSel] = useState<Selection>(null)

  const site = getSites(siteId)[0]
  const racks = getRacks(siteId).filter(r => r.hall === hall)
  const equipment = getEquipment(siteId).filter(e => e.hall === hall)

  const rows = useMemo(() => [...new Set(racks.map(r => r.row))].sort(), [racks])
  const maxSlot = Math.max(...racks.map(r => r.slot), 1)

  const cracs = equipment.filter(e => e.kind === 'CRAH' || e.kind === 'CRAC')
  const power = equipment.filter(e => e.kind === 'UPS' || e.kind === 'PDU' || e.kind === 'Switchgear')
  const plant = equipment.filter(e => e.kind === 'Chiller' || e.kind === 'Generator')

  /* ---- adaptive geometry: strips wrap and the canvas grows to fit ---- */
  const SIDE_W = 74 // left grayspace strip (UPS/PDU/SWG)
  const originX = SIDE_W + 44
  const floorW = Math.max(originX + maxSlot * (RACK_W + GAP) + 24, originX + 380)

  const COOL_W = 52
  const coolCols = Math.max(1, Math.floor((floorW - originX - 16) / (COOL_W + 8)))
  const coolRows = Math.max(1, Math.ceil(cracs.length / coolCols))
  const PLANT_H = 30 + coolRows * 38 // top grayspace strip (CRAH/CRAC along wall)

  const originY = PLANT_H + 46
  // extra aisle gap after every 2 rows (cold/hot aisle pairs)
  const rowY = (ri: number) => originY + ri * (RACK_H + GAP) + Math.floor(ri / 2) * 14

  const PLANT_UNIT_W = 56
  const plantCols = Math.max(1, Math.floor((floorW - originX - 16) / (PLANT_UNIT_W + 8)))
  const plantRowsN = Math.max(1, Math.ceil(plant.length / plantCols))

  const powerBottom = PLANT_H + 42 + power.length * 38 + 14
  const rackBottom = rowY(rows.length) + 8
  const plantY = Math.max(powerBottom, rackBottom) + 24
  const floorH = plantY + plantRowsN * 30 + 14

  const rackFill = (r: Rack): string => {
    if (overlay === 'status') return STATUS_FILL[r.status]
    if (overlay === 'temp') return lerpHex(RAMP_LO, RAMP_HI, (r.inletTempC - 20) / 8)
    return lerpHex(RAMP_LO, RAMP_HI, r.powerKw / r.capacityKw)
  }

  const legend =
    overlay === 'status'
      ? [
          { label: 'Nominal', color: 'var(--status-good)' },
          { label: 'Warning', color: 'var(--status-warn)' },
          { label: 'Critical', color: 'var(--status-critical)' },
          { label: 'Offline', color: 'var(--status-neutral)' },
        ]
      : overlay === 'temp'
        ? [
            { label: '20°C', color: RAMP_LO },
            { label: '24°C', color: lerpHex(RAMP_LO, RAMP_HI, 0.5) },
            { label: '28°C', color: RAMP_HI },
          ]
        : [
            { label: '0% load', color: RAMP_LO },
            { label: '50%', color: lerpHex(RAMP_LO, RAMP_HI, 0.5) },
            { label: '100%', color: RAMP_HI },
          ]

  return (
    <div>
      <div className="page-header">
        <h1>Birdseye</h1>
        <p className="subtitle">
          {site.code} · {site.name} — raised floor and major mechanical plant · layout source: {site.dcim}
        </p>
      </div>

      <div className="filter-row">
        <Segmented
          options={Array.from({ length: site.halls }, (_, i) => ({ value: String(i + 1), label: `Hall ${i + 1}` }))}
          value={String(hall)}
          onChange={v => { setHall(Number(v)); setSel(null) }}
        />
        <div className="spacer" />
        <Segmented
          options={[
            { value: 'status', label: 'Status' },
            { value: 'temp', label: 'Inlet temp' },
            { value: 'power', label: 'Power' },
          ] as const}
          value={overlay}
          onChange={v => setOverlay(v)}
        />
      </div>

      <div className="floor-wrap">
        <Card title={`Hall ${hall} — ${racks.length} racks`} action={<MiniLegend items={legend} />}>
          <svg className="floor-svg" viewBox={`0 0 ${floorW} ${floorH}`} role="img"
            aria-label={`Floor plan of hall ${hall}`}>

            {/* grayspace: cooling wall (top) */}
            <rect x={originX - 10} y={12} width={floorW - originX - 8} height={PLANT_H - 4} className="zone-box" rx={6} />
            <text x={originX} y={26} className="zone-label">Cooling — CRAH / CRAC</text>
            {cracs.map((e, i) => {
              const x = originX + (i % coolCols) * (COOL_W + 8)
              const y = 34 + Math.floor(i / coolCols) * 38
              return (
                <g key={e.id} onClick={() => setSel({ kind: 'equip', equip: e })}>
                  <rect x={x} y={y} width={COOL_W} height={30} rx={4}
                    className={`equip${sel?.kind === 'equip' && sel.equip.id === e.id ? ' selected' : ''}`}
                    fill={`var(--status-${e.status === 'online' ? 'good' : e.status === 'warning' ? 'warn' : e.status === 'fault' ? 'critical' : 'info'}-soft)`} />
                  <text x={x + COOL_W / 2} y={y + 18} textAnchor="middle" className="equip-label">{e.name}</text>
                </g>
              )
            })}

            {/* grayspace: power wall (left) */}
            <rect x={10} y={PLANT_H + 16} width={SIDE_W} height={power.length * 38 + 36} className="zone-box" rx={6} />
            <text x={16} y={PLANT_H + 32} className="zone-label">Power</text>
            {power.map((e, i) => {
              const y = PLANT_H + 42 + i * 38
              return (
                <g key={e.id} onClick={() => setSel({ kind: 'equip', equip: e })}>
                  <rect x={18} y={y} width={SIDE_W - 16} height={30} rx={4}
                    className={`equip${sel?.kind === 'equip' && sel.equip.id === e.id ? ' selected' : ''}`}
                    fill={`var(--status-${e.status === 'online' ? 'good' : e.status === 'warning' ? 'warn' : e.status === 'fault' ? 'critical' : 'info'}-soft)`} />
                  <text x={18 + (SIDE_W - 16) / 2} y={y + 18} textAnchor="middle" className="equip-label">{e.name}</text>
                </g>
              )
            })}

            {/* whitespace: rack grid */}
            {rows.map((row, ri) => (
              <g key={row}>
                <text x={originX - 18} y={rowY(ri) + RACK_H / 2 + 3} className="row-label" textAnchor="middle">{row}</text>
                {racks.filter(r => r.row === row).map(r => (
                  <rect
                    key={r.id}
                    x={originX + (r.slot - 1) * (RACK_W + GAP)}
                    y={rowY(ri)}
                    width={RACK_W}
                    height={RACK_H}
                    rx={3}
                    className={`rack${sel?.kind === 'rack' && sel.rack.id === r.id ? ' selected' : ''}`}
                    fill={rackFill(r)}
                    onClick={() => setSel({ kind: 'rack', rack: r })}
                  >
                    <title>{`${r.name} · ${r.customer} · ${r.powerKw}/${r.capacityKw} kW · ${r.inletTempC}°C`}</title>
                  </rect>
                ))}
              </g>
            ))}

            {/* grayspace: external plant (bottom) */}
            <text x={originX} y={plantY - 8} className="zone-label">External plant</text>
            {plant.map((e, i) => {
              const x = originX + (i % plantCols) * (PLANT_UNIT_W + 8)
              const y = plantY + Math.floor(i / plantCols) * 30
              return (
                <g key={e.id} onClick={() => setSel({ kind: 'equip', equip: e })}>
                  <rect x={x} y={y} width={PLANT_UNIT_W} height={22} rx={4}
                    className={`equip${sel?.kind === 'equip' && sel.equip.id === e.id ? ' selected' : ''}`}
                    fill={`var(--status-${e.status === 'online' ? 'good' : e.status === 'warning' ? 'warn' : e.status === 'fault' ? 'critical' : 'info'}-soft)`} />
                  <text x={x + PLANT_UNIT_W / 2} y={y + 15} textAnchor="middle" className="equip-label">{e.name}</text>
                </g>
              )
            })}
          </svg>
        </Card>

        <DetailPanel sel={sel} />
      </div>
    </div>
  )
}

function DetailPanel({ sel }: { sel: Selection }) {
  if (!sel) {
    return (
      <Card title="Details">
        <div className="empty-note" style={{ padding: 'var(--gap-lg)' }}>
          Click a rack or a piece of mechanical plant to inspect it.
        </div>
      </Card>
    )
  }

  if (sel.kind === 'rack') {
    const r = sel.rack
    const util = Math.round((r.powerKw / r.capacityKw) * 100)
    return (
      <Card title={`Rack ${r.name}`} action={<Badge tone={rackTone[r.status]}>{r.status}</Badge>}>
        <dl className="detail-kv">
          <dt>Customer</dt><dd>{r.customer}</dd>
          <dt>Hall / Row</dt><dd>{r.hall} / {r.row}</dd>
          <dt>Inlet temp</dt><dd>{r.inletTempC.toFixed(1)}°C</dd>
          <dt>Power draw</dt><dd>{r.powerKw} / {r.capacityKw} kW</dd>
          <dt>U space</dt><dd>{r.uUsed} / {r.uTotal} U</dd>
        </dl>
        <div className="card-title" style={{ marginTop: 14 }}><span>Power utilization — {util}%</span></div>
        <div className="util-bar">
          <div style={{ width: `${util}%`, background: util > 85 ? 'var(--status-critical)' : util > 70 ? 'var(--status-warn)' : 'var(--status-good)' }} />
        </div>
        <div className="card-title" style={{ marginTop: 14 }}><span>U-space utilization — {Math.round((r.uUsed / r.uTotal) * 100)}%</span></div>
        <div className="util-bar">
          <div style={{ width: `${(r.uUsed / r.uTotal) * 100}%`, background: 'var(--chart-2)' }} />
        </div>
      </Card>
    )
  }

  const e = sel.equip
  return (
    <Card title={e.name} action={<Badge tone={equipTone[e.status]}>{e.status}</Badge>}>
      <dl className="detail-kv">
        <dt>Type</dt><dd>{e.kind}</dd>
        <dt>Vendor</dt><dd>{e.vendor}</dd>
        <dt>Hall</dt><dd>{e.hall}</dd>
        <dt>Live reading</dt><dd className="mono">{e.metric}</dd>
        <dt>Installed</dt><dd>{e.installedYear}</dd>
        <dt>Condition</dt><dd>{'★'.repeat(e.conditionScore)}{'☆'.repeat(5 - e.conditionScore)}</dd>
      </dl>
      {e.loadPct > 0 && (
        <>
          <div className="card-title" style={{ marginTop: 14 }}><span>Load — {e.loadPct}%</span></div>
          <div className="util-bar">
            <div style={{ width: `${e.loadPct}%`, background: e.loadPct > 85 ? 'var(--status-critical)' : 'var(--status-good)' }} />
          </div>
        </>
      )}
    </Card>
  )
}
