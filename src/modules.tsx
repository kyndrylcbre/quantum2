import type { ComponentType, SVGProps } from 'react'
import {
  IconAsset, IconBirdseye, IconCapacity, IconDashboard, IconHSE, IconIncident,
  IconIntegration, IconMonitor, IconOps, IconProject, IconRisk, IconRounds, IconTicket,
} from './components/Icons'

export interface ModuleDef {
  path: string
  name: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  chunk: 1 | 2 | 3
  built: boolean
  blurb: string
  integrates: string[]
}

export const MODULES: ModuleDef[] = [
  { path: '/', name: 'Dashboard', icon: IconDashboard, chunk: 1, built: true,
    blurb: 'Portfolio-level reporting and analytics across every module.', integrates: [] },
  { path: '/monitoring', name: 'Monitoring', icon: IconMonitor, chunk: 1, built: true,
    blurb: 'BMS/BAS sensor telemetry across whitespace and grayspace with a live alarm feed.',
    integrates: ['Siemens Desigo CC', 'Schneider EcoStruxure', 'Honeywell EBI', 'Nlyte', 'Sunbird'] },
  { path: '/birdseye', name: 'Birdseye', icon: IconBirdseye, chunk: 1, built: true,
    blurb: 'Interactive 2D raised-floor view — racks plus major mechanical plant.',
    integrates: ['Nlyte', 'Sunbird dcTrack'] },
  { path: '/capacity', name: 'Capacity Planning', icon: IconCapacity, chunk: 2, built: true,
    blurb: 'Rack load balancing with push/pull DCIM sync where a full DCIM is in place.',
    integrates: ['Nlyte', 'Sunbird dcTrack'] },
  { path: '/operations', name: 'Operations Mgmt', icon: IconOps, chunk: 2, built: true,
    blurb: 'Per-site service matrix: FTE headcounts, hard/soft service cost split across raised floor and M&E.',
    integrates: ['Workday', 'CBRE Vantage'] },
  { path: '/ticketing', name: 'Ticketing', icon: IconTicket, chunk: 1, built: true,
    blurb: 'PM and reactive work orders plus whitespace hands & eyes, synced with each site’s CMMS.',
    integrates: ['SI7', 'IBM Maximo', 'ServiceNow', 'Corrigo'] },
  { path: '/rounds', name: 'Rounds & Shifts', icon: IconRounds, chunk: 2, built: true,
    blurb: 'Shift handovers, scheduled rounds, and readings capture.', integrates: [] },
  { path: '/hse', name: 'HSE', icon: IconHSE, chunk: 3, built: true,
    blurb: 'Health & safety observations and incident recording.', integrates: [] },
  { path: '/risk', name: 'Risk Mgmt', icon: IconRisk, chunk: 3, built: true,
    blurb: 'Living risk register with client/CBRE ownership visibility.', integrates: [] },
  { path: '/incidents', name: 'Incidents', icon: IconIncident, chunk: 2, built: true,
    blurb: 'SEV1–SEV4 incident notifications with in-tool RCA authoring.',
    integrates: ['ServiceNow', 'PagerDuty'] },
  { path: '/assets', name: 'Assets', icon: IconAsset, chunk: 2, built: true,
    blurb: 'Asset registry per site with condition and maintenance history.',
    integrates: ['SI7', 'IBM Maximo'] },
  { path: '/projects', name: 'Projects', icon: IconProject, chunk: 3, built: true,
    blurb: 'Opex/capex project tracking and capital planning fed by assets, tickets, and monitoring for true lifecycle management.',
    integrates: ['Kahua', 'MS Project'] },
  { path: '/integrations', name: 'Integrations', icon: IconIntegration, chunk: 1, built: true,
    blurb: 'Live status of every API/MCP connection, internal and client-side.', integrates: [] },
]
