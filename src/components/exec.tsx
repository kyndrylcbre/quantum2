/* Shared executive-view helpers: formatting, tones, health meter, service strip. */
import { SERVICE_LINES, type ClientSnapshot, type ServiceLineKey } from '../data'
import { Badge, type BadgeTone } from './ui'

export const FINANCE_SOURCE = 'CBRE Vantage Analytics'
export const pct = (n: number) => `${n.toFixed(1)}%`
export const agoDays = (d: number) => (d === 0 ? 'today' : `${d}d ago`)
export const marginTone = (actual: number, target: number): BadgeTone =>
  actual >= target ? 'good' : target - actual <= 2 ? 'warn' : 'critical'
export const riskScoreTone = (score: number): BadgeTone =>
  score >= 16 ? 'critical' : score >= 10 ? 'serious' : score >= 5 ? 'warn' : 'good'

export function HealthMeter({ s }: { s: ClientSnapshot }) {
  return (
    <div className="health" aria-label={`Health ${s.health.score} of 100 — ${s.health.band}`}>
      <div className="health__top">
        <Badge tone={s.health.tone} dot={false}>{s.health.band}</Badge>
        <span className="health__score">{s.health.score}</span>
      </div>
      <div className="health__meter"><div style={{ width: `${s.health.score}%`, background: `var(--status-${s.health.tone})` }} /></div>
    </div>
  )
}

export function ServiceStrip({ services }: { services: ServiceLineKey[] }) {
  const on = new Set(services)
  return (
    <div className="svc-strip" role="img" aria-label={`Services: ${services.join(', ')}`}>
      {SERVICE_LINES.map(l => (
        <span key={l.key} className={`svc-cell${on.has(l.key) ? ' on' : ''}`}
          title={`${l.key} — ${on.has(l.key) ? 'in scope' : 'not in scope'}`}>
          {l.abbr}
        </span>
      ))}
    </div>
  )
}
