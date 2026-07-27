import type { ReactNode } from 'react'

export const CHART_VARS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'] as const

/** Fixed hue assignment for known entities — color follows the entity, never rank. */
export const REGION_COLOR: Record<string, string> = {
  Americas: 'var(--chart-1)',
  EMEA: 'var(--chart-2)',
  APAC: 'var(--chart-3)',
}

export function MiniLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 12, fontSize: 'var(--text-xs)', color: 'var(--ink-2)' }}>
      {items.map(i => (
        <span key={i.label} className="row" style={{ gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: i.color, display: 'inline-block' }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export function ChartFrame({ height = 220, children }: { height?: number; children: ReactNode }) {
  return <div style={{ width: '100%', height }}>{children}</div>
}

export const axisTick = { fontSize: 11, fill: 'var(--chart-axis)' }
