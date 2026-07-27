import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  seedAlarms, seedHandovers, seedHse, seedIncidents, seedProjects, seedRisks,
  seedRounds, seedTickets, siteById,
} from '../data'
import type {
  Alarm, HandoverNote, HseEntry, Incident, Project, Risk, RoundInstance,
  ShiftName, SyncEvent, Ticket,
} from '../data'

/** Scope any siteId-carrying collection to the global site selector. */
export function scoped<T extends { siteId: string }>(arr: T[], siteId: string): T[] {
  return siteId === 'all' ? arr : arr.filter(x => x.siteId === siteId)
}

interface DataState {
  tickets: Ticket[]
  incidents: Incident[]
  alarms: Alarm[]
  rounds: RoundInstance[]
  handovers: HandoverNote[]
  hse: HseEntry[]
  risks: Risk[]
  projects: Project[]
  syncEvents: SyncEvent[]

  createTicket: (input: Omit<Ticket, 'id' | 'createdDaysAgo' | 'slaBreached' | 'source'>) => string
  updateTicket: (id: string, patch: Partial<Ticket>, action: string) => void
  ackAlarm: (id: string) => void
  updateIncident: (id: string, patch: Partial<Incident>, action: string) => void
  recordReading: (roundId: string, checkpointId: string, value: number) => void
  addHandover: (siteId: string, shift: ShiftName, note: string) => void
  ackHandover: (id: string) => void
  addHse: (input: Omit<HseEntry, 'id' | 'daysAgo' | 'status' | 'correctiveAction'>) => void
  closeHse: (id: string, correctiveAction: string) => void
  addRisk: (input: Omit<Risk, 'id' | 'raisedDaysAgo' | 'reviewInDays'>) => void
  updateRisk: (id: string, patch: Partial<Risk>, action: string) => void
  addProject: (input: Omit<Project, 'id' | 'spentUSD' | 'completionPct' | 'source'>) => void
  updateProject: (id: string, patch: Partial<Project>, action: string) => void
  /** Generic pull, e.g. re-sync from a DCIM. */
  pull: (system: string, action: string) => void
}

const Ctx = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>(seedTickets)
  const [incidents, setIncidents] = useState<Incident[]>(seedIncidents)
  const [alarms, setAlarms] = useState<Alarm[]>(seedAlarms)
  const [rounds, setRounds] = useState<RoundInstance[]>(seedRounds)
  const [handovers, setHandovers] = useState<HandoverNote[]>(seedHandovers)
  const [hse, setHse] = useState<HseEntry[]>(seedHse)
  const [risks, setRisks] = useState<Risk[]>(seedRisks)
  const [projects, setProjects] = useState<Project[]>(seedProjects)
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([])
  const nextSync = useRef(1)
  const nextTicket = useRef(20000)
  const nextEntity = useRef(9000)

  /** Register a push/pull against an external system; confirms after a short latency. */
  const sync = useCallback((system: string, direction: 'push' | 'pull', action: string) => {
    const id = nextSync.current++
    setSyncEvents(ev => [{ id, system, direction, action, status: 'pushing' as const, at: Date.now() }, ...ev].slice(0, 60))
    window.setTimeout(() => {
      setSyncEvents(ev => ev.map(e => (e.id === id ? { ...e, status: 'confirmed' } : e)))
    }, 900 + Math.min(1600, action.length * 18))
  }, [])

  const createTicket = useCallback<DataState['createTicket']>(input => {
    const id = `TKT-${nextTicket.current++}`
    const source = siteById(input.siteId)?.cmms ?? 'SI7 (CBRE)'
    setTickets(ts => [{ ...input, id, source, createdDaysAgo: 0, slaBreached: false }, ...ts])
    sync(source, 'push', `Create WO ${id}`)
    return id
  }, [sync])

  const updateTicket = useCallback<DataState['updateTicket']>((id, patch, action) => {
    setTickets(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)))
    const t = tickets.find(x => x.id === id)
    sync(t?.source ?? 'CMMS', 'push', `${action} ${id}`)
  }, [sync, tickets])

  const ackAlarm = useCallback((id: string) => {
    setAlarms(as => as.map(a => (a.id === id ? { ...a, acked: true } : a)))
    const a = alarms.find(x => x.id === id)
    sync(a?.system ?? 'BMS', 'push', `Acknowledge alarm — ${a?.point ?? id}`)
  }, [sync, alarms])

  const updateIncident = useCallback<DataState['updateIncident']>((id, patch, action) => {
    setIncidents(is => is.map(i => (i.id === id ? { ...i, ...patch } : i)))
    sync('Quantum MCP Hub', 'push', `${action} ${id}`)
  }, [sync])

  const recordReading = useCallback((roundId: string, checkpointId: string, value: number) => {
    let siteId = ''
    setRounds(rs => rs.map(r => {
      if (r.id !== roundId) return r
      siteId = r.siteId
      return { ...r, checkpoints: r.checkpoints.map(c => (c.id === checkpointId ? { ...c, value } : c)) }
    }))
    const site = siteById(siteId)
    sync(site?.bms ?? 'BMS', 'push', `Log reading — ${checkpointId.split('-').slice(-1)[0]}`)
  }, [sync])

  const addHandover = useCallback((siteId: string, shift: ShiftName, note: string) => {
    setHandovers(hs => [{
      id: `ho-${Date.now()}`, siteId, shift, author: 'B. Hauser', hoursAgo: 0, note, acknowledged: false,
    }, ...hs])
    sync('Quantum MCP Hub', 'push', 'Publish shift handover')
  }, [sync])

  const ackHandover = useCallback((id: string) => {
    setHandovers(hs => hs.map(h => (h.id === id ? { ...h, acknowledged: true } : h)))
  }, [])

  const pull = useCallback((system: string, action: string) => sync(system, 'pull', action), [sync])

  const addHse = useCallback<DataState['addHse']>(input => {
    const id = `HSE-${nextEntity.current++}`
    setHse(hs => [{ ...input, id, daysAgo: 0, status: 'Open', correctiveAction: '' }, ...hs])
    sync('Quantum MCP Hub', 'push', `Log HSE ${input.kind.toLowerCase()} ${id}`)
  }, [sync])

  const closeHse = useCallback((id: string, correctiveAction: string) => {
    setHse(hs => hs.map(h => (h.id === id ? { ...h, status: 'Closed', correctiveAction } : h)))
    sync('Quantum MCP Hub', 'push', `Close HSE entry ${id}`)
  }, [sync])

  const addRisk = useCallback<DataState['addRisk']>(input => {
    const id = `RSK-${nextEntity.current++}`
    setRisks(rs => [{ ...input, id, raisedDaysAgo: 0, reviewInDays: 90 }, ...rs])
    sync('Quantum MCP Hub', 'push', `Register risk ${id}`)
  }, [sync])

  const updateRisk = useCallback<DataState['updateRisk']>((id, patch, action) => {
    setRisks(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
    sync('Quantum MCP Hub', 'push', `${action} ${id}`)
  }, [sync])

  const addProject = useCallback<DataState['addProject']>(input => {
    const id = `PRJ-${nextEntity.current++}`
    setProjects(ps => [{ ...input, id, spentUSD: 0, completionPct: 0, source: 'Kahua' }, ...ps])
    sync('Kahua (Projects)', 'push', `Create project ${id}`)
  }, [sync])

  const updateProject = useCallback<DataState['updateProject']>((id, patch, action) => {
    setProjects(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)))
    sync('Kahua (Projects)', 'push', `${action} ${id}`)
  }, [sync])

  const value = useMemo<DataState>(() => ({
    tickets, incidents, alarms, rounds, handovers, hse, risks, projects, syncEvents,
    createTicket, updateTicket, ackAlarm, updateIncident, recordReading, addHandover, ackHandover,
    addHse, closeHse, addRisk, updateRisk, addProject, updateProject, pull,
  }), [tickets, incidents, alarms, rounds, handovers, hse, risks, projects, syncEvents,
    createTicket, updateTicket, ackAlarm, updateIncident, recordReading, addHandover, ackHandover,
    addHse, closeHse, addRisk, updateRisk, addProject, updateProject, pull])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData outside DataProvider')
  return ctx
}
