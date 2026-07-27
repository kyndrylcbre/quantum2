/* Shared UI primitives. Card / Badge / Segmented / StatTile are now thin
   wrappers over the recreated Emerald component library (src/emerald), so the
   whole app renders Emerald-spec components. Tone maps and ChartTip live here. */
import type { ReactNode } from 'react'
import {
  EmeraldCard, EmeraldTag, EmeraldSegmented, type EmeraldTagTone,
} from '../emerald'

/* ---------------- Card ---------------- */
export function Card({ title, action, children, className = '' }: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return <EmeraldCard title={title} action={action} className={className}>{children}</EmeraldCard>
}

/* ---------------- StatTile ---------------- */
export function StatTile({ label, value, unit, sub }: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
}) {
  return (
    <section className="em-card stat-tile">
      <div className="em-card__title"><span>{label}</span></div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </section>
  )
}

/* ---------------- Badge (Emerald StatusTag) ---------------- */
export type BadgeTone = EmeraldTagTone

export function Badge({ tone, children, dot = true }: {
  tone: BadgeTone
  children: ReactNode
  dot?: boolean
}) {
  return <EmeraldTag tone={tone} dot={dot}>{children}</EmeraldTag>
}

/* ---------------- Segmented (Emerald button-group) ---------------- */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return <EmeraldSegmented options={options} value={value} onChange={onChange} />
}

/* ---------------- Recharts tooltip ---------------- */
export function ChartTip({ active, payload, label, unit = '' }: {
  active?: boolean
  payload?: { name: string; value: number | string; color?: string }[]
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="tip-title">{label}</div>
      {payload.map(p => (
        <div className="tip-row" key={p.name}>
          <span className="swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="val">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{unit}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------------- tone helpers ---------------- */
export const equipTone: Record<string, BadgeTone> = {
  online: 'good', warning: 'warn', fault: 'critical', maintenance: 'info',
}
export const alarmTone: Record<string, BadgeTone> = {
  critical: 'critical', warning: 'warn', info: 'info',
}
export const ticketTone: Record<string, BadgeTone> = {
  Open: 'info', 'In Progress': 'warn', 'On Hold': 'neutral', Resolved: 'good', Closed: 'neutral',
}
export const priorityTone: Record<string, BadgeTone> = {
  P1: 'critical', P2: 'serious', P3: 'warn', P4: 'neutral',
}
export const sevTone: Record<string, BadgeTone> = {
  SEV1: 'critical', SEV2: 'serious', SEV3: 'warn', SEV4: 'neutral',
}
export const integrationTone: Record<string, BadgeTone> = {
  Connected: 'good', Degraded: 'warn', Error: 'critical', Pending: 'neutral',
}
export const rackTone: Record<string, BadgeTone> = {
  nominal: 'good', warning: 'warn', critical: 'critical', offline: 'neutral',
}
