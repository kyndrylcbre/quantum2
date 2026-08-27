import { hashSeed, mulberry32, pick, randFloat, randInt, weighted, type Rng } from './rng'
import { SITES } from './sites'
import type {
  Alarm, HandoverNote, HseEntry, Incident, Integration, MaintenanceEntry, MechEquipment,
  OpsProfile, Project, Rack, Risk, RoundInstance, SeriesPoint, ServiceLine, Site, Ticket,
} from './types'

export const TECHS = [
  'M. Okafor', 'J. Rivera', 'S. Lindqvist', 'A. Tanaka', 'P. Whelan', 'D. Kaur',
  'L. Moreau', 'C. Nguyen', 'R. Adeyemi', 'T. Björnsson', 'K. Marsh', 'E. Santos',
]
const CUSTOMERS = ['Core Compute', 'Payments', 'Storage Tier-1', 'Network Edge', 'AI/HPC', 'Colo Client A', 'Colo Client B']
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F']

/* ------------------------------ racks ------------------------------ */

export function racksFor(site: Site): Rack[] {
  const rng = mulberry32(hashSeed(site.id + ':racks'))
  const racks: Rack[] = []
  const perHall = Math.ceil(site.rackCount / site.halls)
  for (let h = 1; h <= site.halls; h++) {
    const inHall = Math.min(perHall, site.rackCount - racks.length)
    // squarer, denser block: ~sqrt aspect rather than 2 long rows
    const rows = Math.min(ROWS.length, Math.max(2, Math.round(Math.sqrt(inHall / 2))))
    for (let i = 0; i < inHall; i++) {
      const row = ROWS[i % rows]
      const slot = Math.floor(i / rows) + 1
      const capacityKw = pick(rng, [8, 10, 12, 17, 22])
      const util = randFloat(rng, 0.25, 0.93, 2)
      // skewed cool: most racks sit in the low 20s, a handful run hot
      const inlet = +(20.5 + rng() * rng() * 7.3).toFixed(1)
      const status =
        inlet > 27 ? 'critical' : inlet > 25.5 ? 'warning'
        : rng() < 0.015 ? 'offline' : 'nominal'
      racks.push({
        id: `${site.id}-h${h}-${row}${String(slot).padStart(2, '0')}`,
        siteId: site.id,
        hall: h,
        row,
        slot,
        name: `${row}-${String(slot).padStart(2, '0')}`,
        powerKw: +(capacityKw * util).toFixed(1),
        capacityKw,
        uUsed: randInt(rng, 10, 42),
        uTotal: 42,
        inletTempC: inlet,
        status,
        customer: pick(rng, CUSTOMERS),
      })
    }
  }
  return racks
}

/* --------------------------- mechanical ---------------------------- */

const EQUIP_VENDORS: Record<string, string[]> = {
  UPS: ['Vertiv', 'Schneider Galaxy', 'ABB', 'Eaton'],
  Chiller: ['Trane', 'Carrier', 'York', 'Daikin'],
  CRAH: ['Vertiv Liebert', 'Stulz', 'Schneider Uniflair'],
  CRAC: ['Vertiv Liebert', 'Stulz', 'Schneider Uniflair'],
  Generator: ['Caterpillar', 'Cummins', 'MTU'],
  PDU: ['Schneider', 'Vertiv', 'Eaton'],
  Switchgear: ['ABB', 'Siemens', 'Schneider'],
}

export function equipmentFor(site: Site): MechEquipment[] {
  const rng = mulberry32(hashSeed(site.id + ':equip'))
  const out: MechEquipment[] = []
  const add = (kind: MechEquipment['kind'], count: number, metricFn: (r: Rng) => string) => {
    for (let i = 1; i <= count; i++) {
      const status = weighted(rng, [
        ['online', 86], ['warning', 7], ['maintenance', 5], ['fault', 2],
      ] as const)
      out.push({
        id: `${site.id}-${kind.toLowerCase()}-${i}`,
        siteId: site.id,
        hall: ((i - 1) % site.halls) + 1,
        kind,
        name: `${kind === 'Switchgear' ? 'SWG' : kind === 'Generator' ? 'GEN' : kind.toUpperCase().slice(0, kind === 'Chiller' ? 2 : 4)}-${String(i).padStart(2, '0')}`,
        status,
        loadPct: status === 'maintenance' || status === 'fault' ? 0 : randInt(rng, 28, 88),
        metric: metricFn(rng),
        vendor: pick(rng, EQUIP_VENDORS[kind]),
        installedYear: randInt(rng, 2012, 2024),
        conditionScore: randInt(rng, 2, 5),
      })
    }
  }
  const scale = Math.max(1, Math.round(site.capacityMW / 6))
  add('UPS', 2 * scale, r => `${randInt(r, 250, 900)} kW`)
  add('Chiller', 1 + scale, r => `${randFloat(r, 5.5, 7.5)}°C CHWS`)
  add('CRAH', 4 * scale, r => `${randFloat(r, 17.5, 21.5)}°C supply`)
  add('CRAC', 2 * scale, r => `${randFloat(r, 17.5, 21.5)}°C supply`)
  add('Generator', scale, r => `${randInt(r, 92, 100)}% fuel`)
  add('PDU', 3 * scale, r => `${randInt(r, 120, 480)} kW`)
  add('Switchgear', 2, r => `${randFloat(r, 0.97, 1.0, 3)} pf`)
  return out
}

/* ------------------------------ alarms ----------------------------- */

const ALARM_POINTS: [string, string, Alarm['severity']][] = [
  ['Supply Air Temp High', 'CRAH', 'warning'],
  ['Return Air Temp High', 'CRAC', 'warning'],
  ['Rack Inlet Over Threshold', 'Rack', 'critical'],
  ['UPS On Battery', 'UPS', 'critical'],
  ['UPS Battery Weak', 'UPS', 'warning'],
  ['Chilled Water Supply High', 'Chiller', 'warning'],
  ['Humidity Low', 'CRAH', 'info'],
  ['Water Leak Detected', 'Leak sensor', 'critical'],
  ['Filter Differential Pressure', 'CRAH', 'info'],
  ['Generator Fuel Level Low', 'Generator', 'warning'],
  ['PDU Branch Circuit Overload', 'PDU', 'warning'],
  ['Comms Lost With Controller', 'BMS', 'warning'],
]

export function alarmsFor(site: Site): Alarm[] {
  const rng = mulberry32(hashSeed(site.id + ':alarms'))
  const n = randInt(rng, 6, 18)
  const alarms: Alarm[] = []
  for (let i = 0; i < n; i++) {
    const [point, kind, sev] = pick(rng, ALARM_POINTS)
    alarms.push({
      id: `${site.id}-alm-${i}`,
      siteId: site.id,
      severity: rng() < 0.12 && sev !== 'critical' ? 'critical' : sev,
      source: kind === 'Rack'
        ? `Rack ${pick(rng, ROWS)}-${String(randInt(rng, 1, 12)).padStart(2, '0')}`
        : `${kind}-${String(randInt(rng, 1, 8)).padStart(2, '0')}`,
      point,
      message: `${point} — threshold exceeded, value outside operating band`,
      system: kind === 'Rack' ? site.dcim : site.bms,
      minutesAgo: randInt(rng, 2, 2880),
      acked: rng() < 0.55,
    })
  }
  return alarms.sort((a, b) => a.minutesAgo - b.minutesAgo)
}

/* ----------------------------- tickets ----------------------------- */

const TICKET_TEMPLATES: [string, Ticket['type'], Ticket['space']][] = [
  ['Monthly UPS inspection and battery impedance test', 'Preventative', 'M&E'],
  ['Quarterly generator load bank test', 'Preventative', 'M&E'],
  ['CRAH filter replacement — Hall {h}', 'Preventative', 'M&E'],
  ['Chilled water loop chemical treatment', 'Preventative', 'M&E'],
  ['Thermal scan of switchgear and busway', 'Preventative', 'M&E'],
  ['Rack {r} PDU B-feed breaker trip investigation', 'Reactive', 'Whitespace'],
  ['Hot spot reported at row {row} — verify airflow', 'Reactive', 'Whitespace'],
  ['CRAH-{n} fan bearing noise', 'Reactive', 'M&E'],
  ['Replace failed door badge reader — Hall {h}', 'Reactive', 'Facility'],
  ['Water detection sensor fault under raised floor', 'Reactive', 'Whitespace'],
  ['Smart hands: swap failed drive in rack {r}', 'Hands & Eyes', 'Whitespace'],
  ['Smart hands: rack and stack 4 new servers, row {row}', 'Hands & Eyes', 'Whitespace'],
  ['Smart hands: cable trace and re-label patch panel', 'Hands & Eyes', 'Whitespace'],
  ['Remote hands: reboot switch and verify link lights', 'Hands & Eyes', 'Whitespace'],
  ['Decommission and remove 6 racks — migration wave 3', 'Project Support', 'Whitespace'],
  ['Support commissioning agent — new CRAH string', 'Project Support', 'M&E'],
]

export function ticketsFor(site: Site): Ticket[] {
  const rng = mulberry32(hashSeed(site.id + ':tickets'))
  const n = randInt(rng, 24, 48)
  const tickets: Ticket[] = []
  for (let i = 0; i < n; i++) {
    const [tpl, type, space] = pick(rng, TICKET_TEMPLATES)
    const title = tpl
      .replace('{h}', String(randInt(rng, 1, site.halls)))
      .replace('{r}', `${pick(rng, ROWS)}-${String(randInt(rng, 1, 12)).padStart(2, '0')}`)
      .replace('{row}', pick(rng, ROWS))
      .replace('{n}', String(randInt(rng, 1, 8)).padStart(2, '0'))
    const status = weighted(rng, [
      ['Open', 22], ['In Progress', 26], ['On Hold', 8], ['Resolved', 22], ['Closed', 22],
    ] as const)
    const priority = weighted(rng, [['P1', 4], ['P2', 16], ['P3', 48], ['P4', 32]] as const)
    const dueInDays = randInt(rng, -6, 21)
    tickets.push({
      id: `TKT-${10000 + hashSeed(site.id) % 800 + i}`,
      siteId: site.id,
      title,
      type,
      space,
      priority,
      status,
      assignee: pick(rng, TECHS),
      requestedBy: type === 'Hands & Eyes' ? pick(rng, CUSTOMERS) : 'Site Ops',
      source: site.cmms,
      createdDaysAgo: randInt(rng, 0, 45),
      dueInDays,
      slaBreached: dueInDays < 0 && status !== 'Resolved' && status !== 'Closed',
      asset: space === 'M&E' ? `${pick(rng, ['UPS', 'CH', 'CRAH', 'GEN', 'PDU'])}-${String(randInt(rng, 1, 8)).padStart(2, '0')}` : undefined,
    })
  }
  return tickets.sort((a, b) => a.createdDaysAgo - b.createdDaysAgo)
}

/* ---------------------------- incidents ---------------------------- */

const INCIDENT_TEMPLATES: [string, Incident['severity'], string][] = [
  ['Utility feed disturbance — ride-through on UPS', 'SEV2', 'Utility sag detected; UPS carried load, generators started and synchronized. No IT impact.'],
  ['Single CRAH failure in Hall 2', 'SEV3', 'CRAH fan VFD fault. N+1 redundancy held supply temps within SLA. Unit isolated for repair.'],
  ['Chilled water leak in gallery', 'SEV2', 'Pinhole leak on CHW return flange. Isolated, spill contained, no whitespace impact.'],
  ['Loss of redundancy on UPS string B', 'SEV2', 'UPS module fault reduced redundancy to N. Load transferred, vendor dispatched.'],
  ['Rack-level dual PDU trip', 'SEV1', 'Both feeds to rack tripped during breaker coordination fault. Customer workload failed over.'],
  ['BMS controller offline — Hall 1 monitoring gap', 'SEV3', 'Comms loss to field controller. Manual rounds increased until controller replaced.'],
  ['Fire alarm activation — dust from construction', 'SEV3', 'VESDA alert in build zone. No fire. Hot works permits reviewed.'],
  ['Brief humidity excursion', 'SEV4', 'Humidity below band for 40 min after economizer transition. No equipment impact.'],
]

export function incidentsFor(site: Site): Incident[] {
  const rng = mulberry32(hashSeed(site.id + ':incidents'))
  const n = randInt(rng, 2, 6)
  const out: Incident[] = []
  for (let i = 0; i < n; i++) {
    const [title, sev, summary] = pick(rng, INCIDENT_TEMPLATES)
    const startedDaysAgo = randInt(rng, 0, 120)
    const status: Incident['status'] =
      startedDaysAgo < 2 ? (rng() < 0.5 ? 'Active' : 'Monitoring')
      : startedDaysAgo < 21 ? (rng() < 0.6 ? 'RCA In Progress' : 'Closed')
      : 'Closed'
    const notified =
      sev === 'SEV1' ? ['Client NOC', 'CBRE Account Lead', 'Site Manager', 'Regional Director', 'Client Exec Sponsor']
      : sev === 'SEV2' ? ['Client NOC', 'CBRE Account Lead', 'Site Manager', 'Regional Director']
      : sev === 'SEV3' ? ['Client NOC', 'Site Manager']
      : ['Site Manager']
    out.push({
      id: `INC-2026-${String(hashSeed(site.id + i) % 900 + 100)}`,
      siteId: site.id,
      severity: sev,
      title,
      status,
      startedDaysAgo,
      durationMin: randInt(rng, 12, 480),
      rcaComplete: status === 'Closed',
      summary,
      commander: pick(rng, TECHS),
      notified,
      rcaText: status === 'Closed'
        ? `Root cause: ${summary}\n\nContributing factors: procedure gap identified during review; monitoring threshold tuned.\n\nCorrective actions:\n1. Updated MOP and re-briefed shift teams.\n2. Vendor inspection completed and part replaced.\n3. Added condition-based alert to Monitoring.`
        : '',
    })
  }
  return out.sort((a, b) => a.startedDaysAgo - b.startedDaysAgo)
}

/* --------------------------- rounds & shifts ----------------------- */

export function roundsFor(site: Site): RoundInstance[] {
  const rng = mulberry32(hashSeed(site.id + ':rounds'))
  const mk = (shift: RoundInstance['shift'], name: string, dueBy: string, pts: [string, string, string][]): RoundInstance => ({
    id: `${site.id}-${shift}-${name}`.replace(/\s/g, '-').toLowerCase(),
    siteId: site.id,
    shift,
    name,
    dueBy,
    checkpoints: pts.map(([label, unit, expected], i) => ({
      id: `${site.id}-${shift}-${name}-${i}`.replace(/\s/g, '-').toLowerCase(),
      label,
      unit,
      expected,
      // day-shift early checkpoints may already be recorded
      value: shift === 'Day' && rng() < 0.45 ? randFloat(rng, Number(expected.split('–')[0]), Number(expected.split('–')[1])) : null,
    })),
  })
  const gray: [string, string, string][] = [
    ['UPS-01 output load', 'kW', '250–900'],
    ['UPS-01 battery room temp', '°C', '20–25'],
    ['Chiller CH-01 CHWS temp', '°C', '5.5–7.5'],
    ['Chiller CH-01 loop pressure', 'bar', '2.5–4'],
    ['Generator GEN-01 fuel level', '%', '92–100'],
    ['Switchgear SWG-01 power factor', 'pf', '0.95–1'],
  ]
  const white: [string, string, string][] = [
    ['Hall 1 avg cold aisle temp', '°C', '20–24'],
    ['Hall 1 relative humidity', '%RH', '40–60'],
    ['Hall 1 underfloor pressure', 'Pa', '10–25'],
    ['CRAH-01 supply air temp', '°C', '17.5–21.5'],
    ['CRAH-02 supply air temp', '°C', '17.5–21.5'],
  ]
  return [
    mk('Day', 'Grayspace round 1 of 2', '10:00', gray),
    mk('Day', 'Whitespace round 1 of 2', '11:00', white),
    mk('Day', 'Grayspace round 2 of 2', '16:00', gray),
    mk('Night', 'Whitespace round 2 of 2', '22:00', white),
    mk('Night', 'Grayspace night round', '03:00', gray),
  ]
}

export function handoversFor(site: Site): HandoverNote[] {
  const rng = mulberry32(hashSeed(site.id + ':handover'))
  const notes = [
    'CRAH-03 filter change carried over to day shift — parts staged in dock.',
    'Vendor on site 09:00 for UPS battery impedance test, escort booked.',
    'Hot aisle containment door in row D sticking, ticket raised.',
    'Client walkthrough scheduled 14:00 — hall 1 housekeeping completed.',
    'Generator weekly run completed, no exceptions.',
    'Leak sensor LS-12 replaced and verified during night shift.',
    'Badge reader hall 2 intermittent — security notified, watch for tailgating.',
  ]
  return Array.from({ length: 4 }, (_, i) => ({
    id: `${site.id}-ho-${i}`,
    siteId: site.id,
    shift: i % 2 === 0 ? 'Night' : 'Day',
    author: pick(rng, TECHS),
    hoursAgo: 6 + i * 12,
    note: pick(rng, notes),
    acknowledged: i > 0,
  }))
}

/* --------------------------- operations ---------------------------- */

const SERVICE_CATALOG: [string, ServiceLine['category'], ServiceLine['space'], string][] = [
  ['Critical environment technicians (shift cover)', 'Hard', 'M&E', '24×7'],
  ['Electrical maintenance (UPS, switchgear, gens)', 'Hard', 'M&E', 'Per OEM plan'],
  ['Mechanical maintenance (chillers, CRAH/CRAC)', 'Hard', 'M&E', 'Per OEM plan'],
  ['Whitespace hands & eyes', 'Hard', 'Raised Floor', 'On demand'],
  ['Rack & stack / cabling', 'Hard', 'Raised Floor', 'On demand'],
  ['BMS monitoring & alarm response', 'Hard', 'M&E', '24×7'],
  ['Fire systems inspection & testing', 'Hard', 'Facility', 'Monthly'],
  ['Water treatment', 'Hard', 'M&E', 'Monthly'],
  ['Technical cleaning (subfloor, plenum)', 'Soft', 'Raised Floor', 'Quarterly'],
  ['Janitorial & waste', 'Soft', 'Facility', 'Daily'],
  ['Security staffing', 'Soft', 'Facility', '24×7'],
  ['Landscaping & externals', 'Soft', 'Facility', 'Monthly'],
  ['Pest control', 'Soft', 'Facility', 'Monthly'],
]

export function opsFor(site: Site): OpsProfile {
  const rng = mulberry32(hashSeed(site.id + ':ops'))
  const scale = site.capacityMW / 10
  const services: ServiceLine[] = SERVICE_CATALOG.map(([service, category, space, frequency], i) => ({
    id: `${site.id}-svc-${i}`,
    service,
    category,
    space,
    delivery: category === 'Hard' && rng() < 0.6 ? 'Self-perform' : 'Vendor',
    frequency,
    annualCostUSD: Math.round((category === 'Hard' ? randInt(rng, 90, 480) : randInt(rng, 40, 220)) * scale) * 1000,
  }))
  const fteTechnical = Math.max(6, Math.round(site.fte * 0.62))
  const fteManagement = Math.max(2, Math.round(site.fte * 0.12))
  return {
    siteId: site.id,
    fteTechnical,
    fteManagement,
    fteSoft: Math.max(3, site.fte - fteTechnical - fteManagement),
    hardRaisedFloorUSD: Math.round(site.monthlyOpexUSD * randFloat(rng, 0.16, 0.24, 2)),
    hardMneUSD: Math.round(site.monthlyOpexUSD * randFloat(rng, 0.42, 0.52, 2)),
    softServicesUSD: Math.round(site.monthlyOpexUSD * randFloat(rng, 0.14, 0.2, 2)),
    services,
  }
}

/* ----------------------- asset maintenance ------------------------- */

const PM_NOTES = [
  'Scheduled PM completed — all checks within tolerance.',
  'Filters replaced, coils cleaned, belts inspected.',
  'Firmware updated and alarm test passed.',
  'Torque check and thermal scan — no exceptions.',
]
const CM_NOTES = [
  'Fan bearing replaced after vibration alert.',
  'Control board swapped under warranty.',
  'Refrigerant top-up and leak test.',
  'Breaker replaced after nuisance tripping.',
]

export function historyFor(equip: MechEquipment): MaintenanceEntry[] {
  const rng = mulberry32(hashSeed(equip.id + ':hist'))
  const n = randInt(rng, 2, 5)
  return Array.from({ length: n }, (_, i) => {
    const isPM = rng() < 0.65
    return {
      id: `${equip.id}-hist-${i}`,
      daysAgo: randInt(rng, 10, 700),
      type: (isPM ? 'PM' : 'CM') as MaintenanceEntry['type'],
      note: pick(rng, isPM ? PM_NOTES : CM_NOTES),
      costUSD: isPM ? randInt(rng, 300, 2200) : randInt(rng, 900, 14000),
      by: pick(rng, TECHS),
    }
  }).sort((a, b) => a.daysAgo - b.daysAgo)
}

/* ------------------------------- HSE ------------------------------- */

const HSE_TEMPLATES: [HseEntry['kind'], HseEntry['category'], string][] = [
  ['Observation', 'Housekeeping', 'Packaging left in hot aisle after rack & stack — removed and vendor briefed.'],
  ['Observation', 'PPE compliance', 'Contractor observed without arc-flash PPE near open switchgear panel.'],
  ['Observation', 'Contractor control', 'Vendor working without signed permit displayed at point of work.'],
  ['Observation', 'Electrical safety', 'Temporary extension lead run across gallery walkway.'],
  ['Near Miss', 'Slips / trips / falls', 'Lifted floor tile left unattended and unbarricaded in whitespace.'],
  ['Near Miss', 'Working at height', 'Ladder used on uneven surface during cable tray work.'],
  ['Near Miss', 'Manual handling', 'Two-person server lift attempted solo — stopped before injury.'],
  ['Incident', 'Slips / trips / falls', 'Technician slipped on condensation near CRAH; bruising, first-aid case.'],
  ['Incident', 'Manual handling', 'Back strain reported after moving UPS batteries without trolley.'],
  ['Incident', 'Chemical / COSHH', 'Minor splash during water treatment dosing; eye wash used, no injury.'],
]

export function hseFor(site: Site): HseEntry[] {
  const rng = mulberry32(hashSeed(site.id + ':hse'))
  const n = randInt(rng, 5, 12)
  return Array.from({ length: n }, (_, i) => {
    const [kind, category, description] = pick(rng, HSE_TEMPLATES)
    const daysAgo = randInt(rng, 0, 180)
    const closed = daysAgo > 14 || rng() < 0.4
    return {
      id: `HSE-${hashSeed(site.id + i) % 9000 + 1000}`,
      siteId: site.id,
      kind,
      category,
      description,
      reportedBy: pick(rng, TECHS),
      daysAgo,
      status: (closed ? 'Closed' : 'Open') as HseEntry['status'],
      recordable: kind === 'Incident' && rng() < 0.4,
      correctiveAction: closed
        ? 'Toolbox talk delivered; area inspected; control added to permit checklist.'
        : '',
    }
  }).sort((a, b) => a.daysAgo - b.daysAgo)
}

/* ------------------------------ risks ------------------------------ */

const RISK_TEMPLATES: [string, Risk['category'], string][] = [
  ['Single chilled water header serves both halls', 'Single point of failure', 'Design study for header cross-connect; interim: spool piece staged on site.'],
  ['UPS batteries beyond 80% design life', 'Power resilience', 'Replacement programmed in capital plan; quarterly impedance testing meanwhile.'],
  ['Generator fuel contract has 48h refill SLA', 'Power resilience', 'Negotiate 24h SLA or add on-site storage; monitor levels via BMS.'],
  ['VESDA coverage gap in new build zone', 'Fire protection', 'Interim smoke detection installed; permanent design change submitted.'],
  ['Legacy BMS controllers out of vendor support', 'Cooling resilience', 'Spares purchased; migration to supported platform scoped.'],
  ['Tailgating possible at dock door during deliveries', 'Physical security', 'Additional camera + interlock proposal with client security team.'],
  ['Water treatment records incomplete for audit', 'Compliance', 'Vendor contract amended to include digital log submission.'],
  ['Night shift single-person coverage', 'Staffing', 'Lone-worker device issued; recruitment for additional tech approved.'],
  ['Leak detection absent under CRAH condensate lines', 'Water / leak', 'Extend leak-detection loop; included in minor works plan.'],
]

export function risksFor(site: Site): Risk[] {
  const rng = mulberry32(hashSeed(site.id + ':risks'))
  const n = randInt(rng, 4, 8)
  const picked = new Set<number>()
  return Array.from({ length: n }, (_, i) => {
    let idx = randInt(rng, 0, RISK_TEMPLATES.length - 1)
    while (picked.has(idx)) idx = (idx + 1) % RISK_TEMPLATES.length
    picked.add(idx)
    const [title, category, mitigation] = RISK_TEMPLATES[idx]
    return {
      id: `RSK-${hashSeed(site.id + i) % 900 + 100}`,
      siteId: site.id,
      title,
      category,
      likelihood: randInt(rng, 1, 4),
      impact: randInt(rng, 2, 5),
      owner: weighted(rng, [['CBRE', 45], ['Client', 30], ['Shared', 25]] as const),
      status: weighted(rng, [['Open', 30], ['Mitigating', 40], ['Accepted', 20], ['Closed', 10]] as const),
      mitigation,
      raisedDaysAgo: randInt(rng, 5, 400),
      reviewInDays: randInt(rng, -10, 90),
    }
  })
}

/* ----------------------------- projects ---------------------------- */

const PROJECT_TEMPLATES: [string, Project['type'], Project['category'], string][] = [
  ['UPS string B battery replacement', 'Capex', 'Lifecycle replacement', 'Batteries at end of design life per asset registry.'],
  ['CRAH EC-fan retrofit — Hall 1', 'Capex', 'Efficiency', 'Fan energy reduction ~28%; PUE improvement modelled at 0.03.'],
  ['Hot aisle containment — Hall 2', 'Capex', 'Efficiency', 'Thermal survey shows recirculation at row ends.'],
  ['Generator control panel upgrade', 'Capex', 'Lifecycle replacement', 'Obsolete controls; vendor support ends this year.'],
  ['Arc-flash study refresh', 'Opex', 'Compliance', 'Five-year refresh due across switchboards.'],
  ['Client cage build-out — 40 racks', 'Capex', 'Client fit-out', 'Client expansion committed; power reservation confirmed.'],
  ['Leak detection extension', 'Opex', 'Resilience', 'Coverage gap under condensate lines per risk register.'],
  ['BMS controller migration', 'Capex', 'Lifecycle replacement', 'Out-of-support controllers per risk register.'],
]

export function projectsFor(site: Site): Project[] {
  const rng = mulberry32(hashSeed(site.id + ':projects'))
  const n = randInt(rng, 3, 6)
  return Array.from({ length: n }, (_, i) => {
    const [name, type, category, rationale] = pick(rng, PROJECT_TEMPLATES)
    const status = weighted(rng, [
      ['Proposed', 20], ['Approved', 20], ['In Flight', 35], ['On Hold', 10], ['Complete', 15],
    ] as const)
    const budget = (type === 'Capex' ? randInt(rng, 120, 1400) : randInt(rng, 30, 220)) * 1000
    const completion = status === 'Complete' ? 100 : status === 'In Flight' ? randInt(rng, 15, 85) : status === 'On Hold' ? randInt(rng, 10, 60) : 0
    return {
      id: `PRJ-${hashSeed(site.id + i) % 900 + 100}`,
      siteId: site.id,
      name,
      type,
      category,
      status,
      budgetUSD: budget,
      spentUSD: Math.round(budget * (completion / 100) * randFloat(rng, 0.8, 1.1, 2)),
      completionPct: completion,
      targetYear: status === 'Complete' ? 2025 : pick(rng, [2026, 2026, 2027, 2028]),
      source: rng() < 0.78 ? 'Autodesk Construction Cloud' : 'MS Project',
      linkedAsset: category === 'Lifecycle replacement' ? `${pick(rng, ['UPS', 'CH', 'CRAH', 'GEN'])}-${String(randInt(rng, 1, 6)).padStart(2, '0')}` : undefined,
      rationale,
    }
  })
}

/** Replacement cost model for capital-plan candidates (USD). */
export const REPLACEMENT_COST: Record<string, number> = {
  UPS: 420_000, Chiller: 650_000, CRAH: 90_000, CRAC: 80_000,
  Generator: 780_000, PDU: 65_000, Switchgear: 310_000,
}

/* --------------------------- integrations -------------------------- */

export function integrations(): Integration[] {
  const rng = mulberry32(hashSeed('integrations'))
  const defs: Omit<Integration, 'status' | 'lastSyncMin' | 'latencyMs' | 'eventsToday'>[] = [
    { id: 'int-nlyte', name: 'Nlyte DCIM', vendor: 'Nlyte', category: 'DCIM', protocol: 'REST API', scope: 'ASH1 · LON1 · FRA1 · SIN1', internal: false },
    { id: 'int-sunbird', name: 'Sunbird dcTrack', vendor: 'Sunbird', category: 'DCIM', protocol: 'REST API', scope: 'PHX1 · SAO1 · DUB1 · TOK1', internal: false },
    { id: 'int-desigo', name: 'Siemens Desigo CC', vendor: 'Siemens', category: 'BMS/BAS', protocol: 'BACnet Gateway', scope: 'LON1 · FRA1', internal: false },
    { id: 'int-ecostruxure', name: 'Schneider EcoStruxure', vendor: 'Schneider Electric', category: 'BMS/BAS', protocol: 'REST API', scope: 'ASH1 · SAO1 · DUB1 · SYD1', internal: false },
    { id: 'int-ebi', name: 'Honeywell EBI', vendor: 'Honeywell', category: 'BMS/BAS', protocol: 'BACnet Gateway', scope: 'PHX1 · SIN1', internal: false },
    { id: 'int-metasys', name: 'JCI Metasys', vendor: 'Johnson Controls', category: 'BMS/BAS', protocol: 'BACnet Gateway', scope: 'TOR1 · TOK1', internal: false },
    { id: 'int-servicenow', name: 'ServiceNow FSM', vendor: 'ServiceNow', category: 'CMMS', protocol: 'MCP', scope: 'ASH1 · SAO1 · LON1 · DUB1 · SIN1', internal: false },
    { id: 'int-maximo', name: 'IBM Maximo', vendor: 'IBM', category: 'CMMS', protocol: 'REST API', scope: 'PHX1 · FRA1 · TOK1', internal: false },
    { id: 'int-corrigo', name: 'Corrigo', vendor: 'JLL Technologies', category: 'CMMS', protocol: 'REST API', scope: 'TOR1 · SYD1', internal: false },
    { id: 'int-autodesk', name: 'Autodesk Construction Cloud', vendor: 'Autodesk', category: 'Project Mgmt', protocol: 'REST API', scope: 'All sites', internal: false },
    { id: 'int-kahua', name: 'Kahua', vendor: 'Kahua', category: 'Project Mgmt', protocol: 'REST API', scope: 'CBRE-delivered projects', internal: true },
    { id: 'int-vantage', name: 'CBRE Vantage Analytics', vendor: 'CBRE', category: 'Finance', protocol: 'SFTP', scope: 'All sites', internal: true },
    { id: 'int-workday', name: 'Workday (FTE roster)', vendor: 'Workday', category: 'HR', protocol: 'REST API', scope: 'All sites', internal: true },
    { id: 'int-claude', name: 'Quantum MCP Hub', vendor: 'CBRE', category: 'ITSM', protocol: 'MCP', scope: 'All sites', internal: true },
  ]
  return defs.map(d => {
    const status = weighted(rng, [
      ['Connected', 72], ['Degraded', 14], ['Error', 7], ['Pending', 7],
    ] as const)
    return {
      ...d,
      status,
      lastSyncMin: status === 'Connected' ? randInt(rng, 0, 14) : status === 'Degraded' ? randInt(rng, 20, 240) : randInt(rng, 240, 4320),
      latencyMs: randInt(rng, 80, 1400),
      eventsToday: status === 'Pending' ? 0 : randInt(rng, 120, 42000),
    }
  })
}

/* --------------------------- time series --------------------------- */

/** Deterministic 24h (hourly) or 14d (daily) series for a metric. */
export function genSeries(
  seedKey: string,
  points: number,
  base: number,
  variance: number,
  labels: string[],
  dp = 1,
): { label: string; value: number }[] {
  const rng = mulberry32(hashSeed(seedKey))
  let v = base + (rng() - 0.5) * variance
  const out: { label: string; value: number }[] = []
  for (let i = 0; i < points; i++) {
    v += (rng() - 0.5) * variance * 0.55
    v = Math.max(base - variance, Math.min(base + variance, v))
    out.push({ label: labels[i] ?? String(i), value: +v.toFixed(dp) })
  }
  return out
}

export const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
export const DAY_LABELS_14 = Array.from({ length: 14 }, (_, i) => `D-${13 - i}`)
export const MONTH_LABELS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']

/** Multi-site series merged into recharts-friendly rows. */
export function mergedSeries(
  sites: Site[],
  metric: (s: Site) => { base: number; variance: number },
  labels: string[],
  dp = 1,
): SeriesPoint[] {
  const per = sites.map(s => {
    const m = metric(s)
    return { site: s, series: genSeries(`${s.id}:${labels.length}:${m.base}`, labels.length, m.base, m.variance, labels, dp) }
  })
  return labels.map((label, i) => {
    const row: SeriesPoint = { t: label }
    per.forEach(({ site, series }) => { row[site.code] = series[i].value })
    return row
  })
}
