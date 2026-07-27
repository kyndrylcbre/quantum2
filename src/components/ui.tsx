import type { ReactNode } from 'react'

/* ---------------- Card ---------------- */
export function Card({ title, action, children, className = '' }: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {title != null && (
        <div className="card-title">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/* ---------------- StatTile ---------------- */
export function StatTile({ label, value, unit, sub }: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
}) {
  return (
    <section className="card stat-tile">
      <div className="card-title"><span>{label}</span></div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </section>
  )
}

/* ---------------- Badge ---------------- */
export type BadgeTone = 'good' | 'warn' | 'serious' | 'critical' | 'info' | 'neutral'

export function Badge({ tone, children, dot = true }: {
  tone: BadgeTone
  children: ReactNode
  dot?: boolean
}) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="dot" aria-hidden />}
      {children}
    </span>
  )
}

/* ---------------- Segmented control ---------------- */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
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
