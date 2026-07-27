export type Region = 'Americas' | 'EMEA' | 'APAC'

export interface Site {
  id: string
  code: string // e.g. QTM-ASH1
  name: string
  city: string
  country: string
  region: Region
  tier: 'III' | 'IV'
  capacityMW: number
  itLoadMW: number
  whitespaceSqft: number
  halls: number
  rackCount: number
  designPUE: number
  currentPUE: number
  dcim: 'Nlyte' | 'Sunbird dcTrack' | 'None (Quantum native)'
  bms: 'Siemens Desigo CC' | 'Schneider EcoStruxure' | 'Honeywell EBI' | 'Johnson Controls Metasys'
  cmms: 'IBM Maximo' | 'ServiceNow FSM' | 'SI7 (CBRE)' | 'Corrigo'
  fte: number
  monthlyOpexUSD: number
}

export type RackStatus = 'nominal' | 'warning' | 'critical' | 'offline'

export interface Rack {
  id: string
  siteId: string
  hall: number
  row: string // A..F
  slot: number // position within row
  name: string // e.g. A-01
  powerKw: number
  capacityKw: number
  uUsed: number
  uTotal: number
  inletTempC: number
  status: RackStatus
  customer: string
}

export type EquipKind = 'UPS' | 'Chiller' | 'CRAH' | 'CRAC' | 'Generator' | 'PDU' | 'Switchgear'
export type EquipStatus = 'online' | 'warning' | 'fault' | 'maintenance'

export interface MechEquipment {
  id: string
  siteId: string
  hall: number
  kind: EquipKind
  name: string // e.g. UPS-A, CH-01
  status: EquipStatus
  loadPct: number
  metric: string // e.g. "412 kW", "6.2°C CHWS"
  vendor: string
  installedYear: number
  conditionScore: number // 1-5
}

export type AlarmSeverity = 'critical' | 'warning' | 'info'

export interface Alarm {
  id: string
  siteId: string
  severity: AlarmSeverity
  source: string // equipment or rack name
  point: string // e.g. "Supply Air Temp"
  message: string
  system: string // originating BMS/DCIM
  minutesAgo: number
  acked: boolean
}

export type TicketType = 'Preventative' | 'Reactive' | 'Hands & Eyes' | 'Project Support'
export type TicketSpace = 'Whitespace' | 'M&E' | 'Facility'
export type TicketStatus = 'Open' | 'In Progress' | 'On Hold' | 'Resolved' | 'Closed'
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4'

export interface Ticket {
  id: string // TKT-10234
  siteId: string
  title: string
  type: TicketType
  space: TicketSpace
  priority: TicketPriority
  status: TicketStatus
  assignee: string
  requestedBy: string
  source: string // CMMS of record
  createdDaysAgo: number
  dueInDays: number // negative = overdue
  slaBreached: boolean
  asset?: string
}

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'
export type IncidentStatus = 'Active' | 'Monitoring' | 'RCA In Progress' | 'Closed'

export interface Incident {
  id: string // INC-2026-014
  siteId: string
  severity: IncidentSeverity
  title: string
  status: IncidentStatus
  startedDaysAgo: number
  durationMin: number
  rcaComplete: boolean
  summary: string
  commander: string
  notified: string[] // distribution per severity matrix
  rcaText: string
}

/* ----- rounds & shifts ----- */
export type ShiftName = 'Day' | 'Night'

export interface RoundCheckpoint {
  id: string
  label: string // e.g. "UPS-01 output load"
  unit: string
  expected: string // display band, e.g. "18–24"
  value: number | null // recorded reading
}

export interface RoundInstance {
  id: string
  siteId: string
  shift: ShiftName
  name: string // e.g. "Grayspace round 1 of 2"
  dueBy: string // "10:00"
  checkpoints: RoundCheckpoint[]
}

export interface HandoverNote {
  id: string
  siteId: string
  shift: ShiftName
  author: string
  hoursAgo: number
  note: string
  acknowledged: boolean
}

/* ----- operations mgmt ----- */
export interface ServiceLine {
  id: string
  service: string
  category: 'Hard' | 'Soft'
  space: 'Raised Floor' | 'M&E' | 'Facility'
  delivery: 'Self-perform' | 'Vendor'
  frequency: string
  annualCostUSD: number
}

export interface OpsProfile {
  siteId: string
  fteTechnical: number
  fteManagement: number
  fteSoft: number
  hardRaisedFloorUSD: number // monthly
  hardMneUSD: number
  softServicesUSD: number
  services: ServiceLine[]
}

/* ----- assets ----- */
export interface MaintenanceEntry {
  id: string
  daysAgo: number
  type: 'PM' | 'CM'
  note: string
  costUSD: number
  by: string
}

/* ----- push-pull sync ----- */
export type SyncStatus = 'pushing' | 'confirmed' | 'failed'

export interface SyncEvent {
  id: number
  system: string // e.g. "IBM Maximo"
  direction: 'push' | 'pull'
  action: string // e.g. "Create WO TKT-10412"
  status: SyncStatus
  at: number // ms timestamp
}

export type IntegrationStatus = 'Connected' | 'Degraded' | 'Error' | 'Pending'

export interface Integration {
  id: string
  name: string
  vendor: string
  category: 'DCIM' | 'BMS/BAS' | 'CMMS' | 'ITSM' | 'Project Mgmt' | 'Finance' | 'HR'
  protocol: 'REST API' | 'MCP' | 'BACnet Gateway' | 'Webhook' | 'SFTP'
  scope: string // "All sites" or site codes
  internal: boolean // CBRE-internal vs client/external
  status: IntegrationStatus
  lastSyncMin: number
  latencyMs: number
  eventsToday: number
}

export interface SeriesPoint {
  t: string // label
  [key: string]: string | number
}
