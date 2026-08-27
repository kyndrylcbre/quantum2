import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { scoped, useData } from '../context/DataContext'
import {
  getEquipment, getHistory, REPLACEMENT_COST, siteById,
  type MechEquipment, type Project, type ProjectStatus,
} from '../data'
import { Badge, Card, ChartTip, Segmented, StatTile, type BadgeTone } from '../components/ui'
import { axisTick, ChartFrame, MiniLegend } from '../components/charts'
import { EmeraldButton } from '../emerald'

const THIS_YEAR = 2026
const YEARS = [2026, 2027, 2028, 2029, 2030]

const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  Proposed: 'neutral', Approved: 'info', 'In Flight': 'warn', 'On Hold': 'serious', Complete: 'good',
}

const fmtUSD = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`

interface Candidate {
  asset: MechEquipment
  cost: number
  year: number
  reason: string
  maintSpend: number
}

export function Projects() {
  const { siteId } = useApp()
  const { projects: allProjects, addProject, updateProject } = useData()
  const projects = scoped(allProjects, siteId)
  const equipment = getEquipment(siteId)

  const [view, setView] = useState<'active' | 'all'>('active')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = allProjects.find(p => p.id === selectedId) ?? null

  /* ---- capital-plan candidates derived from the asset registry ---- */
  const candidates = useMemo<Candidate[]>(() => {
    const linked = new Set(projects.filter(p => p.linkedAsset).map(p => `${p.siteId}:${p.linkedAsset}`))
    return equipment
      .filter(e => e.conditionScore <= 2 || THIS_YEAR - e.installedYear > 12)
      .filter(e => !linked.has(`${e.siteId}:${e.name}`))
      .map(e => {
        const maintSpend = getHistory(e.id).reduce((s, h) => s + h.costUSD, 0)
        const age = THIS_YEAR - e.installedYear
        return {
          asset: e,
          cost: REPLACEMENT_COST[e.kind] ?? 100_000,
          year: e.conditionScore <= 2 ? THIS_YEAR : Math.max(THIS_YEAR, e.installedYear + 15),
          reason: e.conditionScore <= 2
            ? `Condition ${e.conditionScore}/5 · $${(maintSpend / 1000).toFixed(0)}k maintenance in 2 yrs`
            : `${age} yrs old — past 12-yr lifecycle threshold`,
          maintSpend,
        }
      })
      .sort((a, b) => a.year - b.year || b.maintSpend - a.maintSpend)
  }, [equipment, projects])

  const visible = useMemo(
    () =>
      projects
        .filter(p => view === 'all' || (p.status !== 'Complete'))
        .sort((a, b) => a.targetYear - b.targetYear || b.budgetUSD - a.budgetUSD),
    [projects, view],
  )

  const inFlight = projects.filter(p => p.status === 'In Flight')
  const capexActive = projects.filter(p => p.type === 'Capex' && p.status !== 'Complete')
  const forecast = useMemo(
    () =>
      YEARS.map(y => ({
        label: String(y),
        Committed: Math.round(projects.filter(p => p.status !== 'Complete' && p.targetYear === y).reduce((s, p) => s + p.budgetUSD, 0) / 1000),
        'Asset-derived': Math.round(candidates.filter(c => c.year === y).reduce((s, c) => s + c.cost, 0) / 1000),
      })),
    [projects, candidates],
  )
  const fiveYear = forecast.reduce((s, f) => s + f.Committed + f['Asset-derived'], 0) * 1000

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <p className="subtitle">
          Opex/capex delivery synced with Autodesk Construction Cloud — plus capital planning generated from assets, maintenance history, and monitoring.
        </p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 'var(--gap-md)' }}>
        <StatTile label="In flight" value={inFlight.length}
          sub={<span className="muted">{fmtUSD(inFlight.reduce((s, p) => s + p.budgetUSD, 0))} committed</span>} />
        <StatTile label="Active capex" value={fmtUSD(capexActive.reduce((s, p) => s + p.budgetUSD, 0))}
          sub={<span className="muted">{capexActive.length} projects</span>} />
        <StatTile label="Capital candidates" value={candidates.length}
          sub={<span className="muted">from asset lifecycle flags</span>} />
        <StatTile label="5-year capital outlook" value={fmtUSD(fiveYear)}
          sub={<span className="muted">committed + asset-derived</span>} />
      </div>

      <div className="grid cols-3" style={{ marginBottom: 'var(--gap-md)' }}>
        <Card className="span-2" title="Five-year capital forecast ($k)">
          <ChartFrame height={230}>
            <ResponsiveContainer>
              <BarChart data={forecast} margin={{ top: 6, right: 12, bottom: 0, left: -2 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip unit="k" />} cursor={{ fill: 'var(--surface-3)' }} />
                <Bar dataKey="Committed" stackId="a" fill="var(--chart-1)" maxBarSize={44} stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="Asset-derived" stackId="a" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={44} stroke="var(--surface)" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <MiniLegend items={[
            { label: 'Committed projects', color: 'var(--chart-1)' },
            { label: 'Asset-derived candidates', color: 'var(--chart-3)' },
          ]} />
        </Card>

        <Card title={`Capital plan candidates (${candidates.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto' }}>
            {candidates.slice(0, 12).map(c => (
              <div key={c.asset.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div className="row">
                  <strong style={{ fontSize: 'var(--text-sm)' }}>
                    {c.asset.name} · {c.asset.kind}
                    {siteId === 'all' && <span className="muted"> · {siteById(c.asset.siteId)?.code}</span>}
                  </strong>
                  <span className="right mono" style={{ fontSize: 'var(--text-xs)' }}>{fmtUSD(c.cost)} · {c.year}</span>
                </div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)', margin: '3px 0 7px' }}>{c.reason}</div>
                <EmeraldButton variant="secondary" size="sm"
                  onClick={() => addProject({
                    siteId: c.asset.siteId,
                    name: `${c.asset.kind} replacement — ${c.asset.name}`,
                    type: 'Capex',
                    category: 'Lifecycle replacement',
                    status: 'Proposed',
                    budgetUSD: c.cost,
                    targetYear: c.year,
                    linkedAsset: c.asset.name,
                    rationale: c.reason,
                  })}>
                  Promote to project → Autodesk
                </EmeraldButton>
              </div>
            ))}
            {candidates.length === 0 && <div className="empty-note">No lifecycle flags in scope</div>}
          </div>
        </Card>
      </div>

      <div className="filter-row">
        <Segmented
          options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All' }] as const}
          value={view}
          onChange={setView}
        />
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{visible.length} shown</span>
      </div>

      <div className="floor-wrap">
        <Card>
          <div className="table-scroll" style={{ maxHeight: 480, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Project</th><th>Type</th><th>Category</th><th>Status</th>
                  <th className="num">Budget</th><th style={{ width: 130 }}>Progress</th><th className="num">Target</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => (
                  <tr key={p.id} className="clickable" onClick={() => setSelectedId(p.id)}>
                    <td className="mono">{p.id}</td>
                    <td style={{ maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {siteId === 'all' && <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{siteById(p.siteId)?.code}</div>}
                    </td>
                    <td><Badge tone={p.type === 'Capex' ? 'info' : 'neutral'} dot={false}>{p.type}</Badge></td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{p.category}</td>
                    <td><Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge></td>
                    <td className="num">{fmtUSD(p.budgetUSD)}</td>
                    <td>
                      <div className="util-bar">
                        <div style={{ width: `${p.completionPct}%`, background: 'var(--chart-1)' }} />
                      </div>
                    </td>
                    <td className="num">{p.targetYear}</td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>{p.source}</td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={9} className="empty-note">No projects match</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <ProjectDetail
          project={selected}
          onUpdate={(patch, action) => selected && updateProject(selected.id, patch, action)}
        />
      </div>
    </div>
  )
}

function ProjectDetail({ project, onUpdate }: {
  project: Project | null
  onUpdate: (patch: Partial<Project>, action: string) => void
}) {
  if (!project) {
    return (
      <Card title="Project detail">
        <div className="empty-note" style={{ padding: 'var(--gap-lg)' }}>
          Select a project — approvals and status changes push back to Autodesk Construction Cloud.
        </div>
      </Card>
    )
  }

  const transitions: { label: string; to: ProjectStatus }[] =
    project.status === 'Proposed' ? [{ label: 'Approve', to: 'Approved' }]
    : project.status === 'Approved' ? [{ label: 'Start delivery', to: 'In Flight' }]
    : project.status === 'In Flight' ? [{ label: 'Mark complete', to: 'Complete' }, { label: 'Put on hold', to: 'On Hold' }]
    : project.status === 'On Hold' ? [{ label: 'Resume', to: 'In Flight' }]
    : []

  return (
    <Card title={project.id} action={<Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>}>
      <p style={{ fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>{project.name}</p>
      <p className="muted" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, marginBottom: 12 }}>{project.rationale}</p>

      {transitions.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
          {transitions.map(t => (
            <EmeraldButton key={t.to} variant="secondary" size="sm"
              onClick={() => onUpdate({ status: t.to, completionPct: t.to === 'Complete' ? 100 : project.completionPct }, `${t.label} —`)}>
              {t.label}
            </EmeraldButton>
          ))}
        </div>
      )}

      <dl className="detail-kv">
        <dt>Site</dt><dd>{siteById(project.siteId)?.code}</dd>
        <dt>Type</dt><dd>{project.type}</dd>
        <dt>Category</dt><dd>{project.category}</dd>
        <dt>Budget</dt><dd>{fmtUSD(project.budgetUSD)}</dd>
        <dt>Spent</dt><dd>{fmtUSD(project.spentUSD)}</dd>
        <dt>Target year</dt><dd>{project.targetYear}</dd>
        {project.linkedAsset && (<><dt>Linked asset</dt><dd className="mono">{project.linkedAsset}</dd></>)}
        <dt>System of record</dt><dd>{project.source}</dd>
      </dl>

      <div className="card-title" style={{ marginTop: 14 }}><span>Delivery — {project.completionPct}%</span></div>
      <div className="util-bar">
        <div style={{ width: `${project.completionPct}%`, background: 'var(--chart-1)' }} />
      </div>
      {project.spentUSD > project.budgetUSD && (
        <div style={{ marginTop: 10 }}>
          <Badge tone="critical" dot={false}>Over budget by {fmtUSD(project.spentUSD - project.budgetUSD)}</Badge>
        </div>
      )}
    </Card>
  )
}
