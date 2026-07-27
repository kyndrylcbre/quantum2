import { Badge } from '../components/ui'
import type { ModuleDef } from '../modules'

/** Placeholder page for modules scheduled in a later chunk. */
export function Stub({ mod }: { mod: ModuleDef }) {
  return (
    <div>
      <div className="page-header">
        <h1>{mod.name}</h1>
        <p className="subtitle">{mod.blurb}</p>
      </div>

      <section className="card" style={{ maxWidth: 640 }}>
        <div className="card-title"><span>Status</span></div>
        <div className="row" style={{ marginBottom: 12 }}>
          <Badge tone="info">Scheduled — Chunk {mod.chunk}</Badge>
        </div>
        <p style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
          This module is stubbed in the navigation so the full platform shape is visible
          from day one. The dummy-data layer already models the entities it will need,
          so buildout is a matter of UI + integration wiring.
        </p>
        {mod.integrates.length > 0 && (
          <>
            <div className="card-title" style={{ marginTop: 16 }}><span>Planned integrations</span></div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {mod.integrates.map(name => (
                <Badge key={name} tone="neutral" dot={false}>{name}</Badge>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
