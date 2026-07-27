import { SITES } from './sites'
import {
  alarmsFor, equipmentFor, handoversFor, historyFor, incidentsFor, integrations,
  opsFor, racksFor, roundsFor, ticketsFor,
} from './generate'
import type {
  Alarm, HandoverNote, Incident, Integration, MaintenanceEntry, MechEquipment,
  OpsProfile, Rack, RoundInstance, Site, Ticket,
} from './types'

export * from './types'
export { SITES, siteById } from './sites'
export { genSeries, mergedSeries, HOUR_LABELS, DAY_LABELS_14, MONTH_LABELS, TECHS } from './generate'

/* Memoized, deterministic store — generated once per session.
   Mutable entities (tickets, incidents, alarms, rounds, handovers) are seeded
   from here into DataContext; the rest is read directly. */
const store = (() => {
  const racks = new Map<string, Rack[]>()
  const equipment = new Map<string, MechEquipment[]>()
  const alarms = new Map<string, Alarm[]>()
  const tickets = new Map<string, Ticket[]>()
  const incidents = new Map<string, Incident[]>()
  const rounds = new Map<string, RoundInstance[]>()
  const handovers = new Map<string, HandoverNote[]>()
  const ops = new Map<string, OpsProfile>()
  const history = new Map<string, MaintenanceEntry[]>()
  for (const s of SITES) {
    racks.set(s.id, racksFor(s))
    equipment.set(s.id, equipmentFor(s))
    alarms.set(s.id, alarmsFor(s))
    tickets.set(s.id, ticketsFor(s))
    incidents.set(s.id, incidentsFor(s))
    rounds.set(s.id, roundsFor(s))
    handovers.set(s.id, handoversFor(s))
    ops.set(s.id, opsFor(s))
    for (const e of equipment.get(s.id)!) history.set(e.id, historyFor(e))
  }
  return { racks, equipment, alarms, tickets, incidents, rounds, handovers, ops, history, integrations: integrations() }
})()

/** siteId of 'all' means every site. */
const forScope = <T,>(map: Map<string, T[]>, siteId: string): T[] =>
  siteId === 'all' ? SITES.flatMap(s => map.get(s.id) ?? []) : map.get(siteId) ?? []

export const getSites = (siteId: string): Site[] =>
  siteId === 'all' ? SITES : SITES.filter(s => s.id === siteId)

export const getRacks = (siteId: string): Rack[] => forScope(store.racks, siteId)
export const getEquipment = (siteId: string): MechEquipment[] => forScope(store.equipment, siteId)
export const getIntegrations = (): Integration[] => store.integrations
export const getOps = (siteId: string): OpsProfile[] =>
  siteId === 'all' ? SITES.map(s => store.ops.get(s.id)!) : [store.ops.get(siteId)!].filter(Boolean)
export const getHistory = (equipId: string): MaintenanceEntry[] => store.history.get(equipId) ?? []

/* seeds for the mutable store */
export const seedAlarms = (): Alarm[] => SITES.flatMap(s => store.alarms.get(s.id)!)
export const seedTickets = (): Ticket[] => SITES.flatMap(s => store.tickets.get(s.id)!)
export const seedIncidents = (): Incident[] => SITES.flatMap(s => store.incidents.get(s.id)!)
export const seedRounds = (): RoundInstance[] => SITES.flatMap(s => store.rounds.get(s.id)!)
export const seedHandovers = (): HandoverNote[] => SITES.flatMap(s => store.handovers.get(s.id)!)

/* legacy read accessors kept for pages that only display (scoped from context now for mutable sets) */
export const getAlarms = (siteId: string): Alarm[] => forScope(store.alarms, siteId)
export const getTickets = (siteId: string): Ticket[] => forScope(store.tickets, siteId)
export const getIncidents = (siteId: string): Incident[] => forScope(store.incidents, siteId)
