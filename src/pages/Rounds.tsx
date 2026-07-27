import { useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import { getSites, SITES, type RoundInstance, type ShiftName } from '../data'
import { Badge, Card, Segmented, StatTile } from '../components/ui'
import '../styles/birdseye.css'

export function Rounds() {
  const { siteId, setSiteId } = useApp()

  if (siteId === 'all') {
    return (
      <div>
        <div className="page-header">
          <h1>Rounds & Shifts</h1>
          <p className="subtitle">Rounds and handovers are managed per facility — select a site.</p>
        </div>
        <div className="site-pick-grid">
          {SITES.map(s => (
            <section key={s.id} className="card" onClick={() => setSiteId(s.id)} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setSiteId(s.id)}>
              <div className="card-title"><span>{s.code}</span></div>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>{s.city} · {s.fte} FTE on account</div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  return <SiteRounds key={siteId} siteId={siteId} />
}

function SiteRounds({ siteId }: { siteId: string }) {
  const site = getSites(siteId)[0]
  const { rounds: allRounds, handovers: allHandovers, recordReading, addHandover, ackHandover } = useData()
  const rounds = scoped(allRounds, siteId)
  const handovers = scoped(allHandovers, siteId)

  const [shift, setShift] = useState<ShiftName>('Day')
  const [note, setNote] = useState('')

  const shiftRounds = rounds.filter(r => r.shift === shift)
  const allPoints = rounds.flatMap(r => r.checkpoints)
  const doneCount = allPoints.filter(c => c.value != null).length

  const submitHandover = (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    addHandover(siteId, shift, note.trim())
    setNote('')
  }

  return (
    <div>
      <div className="page-header">
        <h1>Rounds & Shifts</h1>
        <p className="subtitle">{site.code} · {site.name} — readings log to {site.bms} history; handovers publish to the shift team.</p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="Today's rounds" value={rounds.length}
          sub={<span className="muted">{rounds.filter(r => r.checkpoints.every(c => c.value != null)).length} complete</span>} />
        <StatTile label="Readings captured" value={`${doneCount}/${allPoints.length}`}
          sub={
            <div className="util-bar" style={{ width: 120 }}>
              <div style={{ width: `${(doneCount / Math.max(1, allPoints.length)) * 100}%`, background: 'var(--status-good)' }} />
            </div>
          } />
        <StatTile label="Current shift" value={shift}
          sub={<span className="muted">07:00–19:00 day · 19:00–07:00 night</span>} />
        <StatTile label="Open handover items" value={handovers.filter(h => !h.acknowledged).length}
          sub={<span className="muted">{handovers.length} notes in the last 48h</span>} />
      </div>

      <div className="filter-row">
        <Segmented
          options={[{ value: 'Day', label: 'Day shift' }, { value: 'Night', label: 'Night shift' }] as const}
          value={shift}
          onChange={setShift}
        />
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
          {shiftRounds.map(r => <RoundCard key={r.id} round={r} onRecord={recordReading} />)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
          <Card title="Publish shift handover">
            <form onSubmit={submitHandover}>
              <div className="field">
                <textarea
                  value={note}
                  placeholder="What does the incoming shift need to know?"
                  onChange={e => setNote(e.target.value)}
                  aria-label="Handover note"
                />
              </div>
              <div className="modal-actions" style={{ marginTop: 10 }}>
                <button className="btn primary" type="submit" disabled={!note.trim()}>
                  Publish handover
                </button>
              </div>
            </form>
          </Card>

          <Card title="Handover log">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {handovers.map(h => (
                <div key={h.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <Badge tone={h.shift === 'Day' ? 'info' : 'neutral'} dot={false}>{h.shift}</Badge>
                    <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {h.author} · {h.hoursAgo === 0 ? 'just now' : `${h.hoursAgo}h ago`}
                    </span>
                    <span className="right">
                      {h.acknowledged
                        ? <Badge tone="good" dot={false}>Acked</Badge>
                        : <button className="btn" style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }} onClick={() => ackHandover(h.id)}>Acknowledge</button>}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{h.note}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function RoundCard({ round, onRecord }: {
  round: RoundInstance
  onRecord: (roundId: string, checkpointId: string, value: number) => void
}) {
  const done = round.checkpoints.filter(c => c.value != null).length
  const complete = done === round.checkpoints.length
  return (
    <Card
      title={`${round.name} — due ${round.dueBy}`}
      action={complete
        ? <Badge tone="good" dot={false}>Complete</Badge>
        : <Badge tone="warn" dot={false}>{done}/{round.checkpoints.length} recorded</Badge>}
    >
      <table className="data-table">
        <thead>
          <tr><th>Checkpoint</th><th className="num">Expected</th><th className="num">Reading</th></tr>
        </thead>
        <tbody>
          {round.checkpoints.map(c => (
            <tr key={c.id}>
              <td style={{ fontSize: 'var(--text-sm)' }}>{c.label}</td>
              <td className="num muted">{c.expected} {c.unit}</td>
              <td className="num">
                {c.value != null
                  ? <strong>{c.value} {c.unit}</strong>
                  : <ReadingInput unit={c.unit} onSave={v => onRecord(round.id, c.id, v)} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function ReadingInput({ unit, onSave }: { unit: string; onSave: (v: number) => void }) {
  const [val, setVal] = useState('')
  const save = () => {
    const n = Number(val)
    if (!Number.isNaN(n) && val.trim() !== '') onSave(n)
  }
  return (
    <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
      <input
        className="input reading-input"
        value={val}
        inputMode="decimal"
        placeholder={unit}
        aria-label={`Reading in ${unit}`}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
      />
      <button className="btn" style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }} onClick={save} disabled={!val.trim()}>
        Log
      </button>
    </span>
  )
}
