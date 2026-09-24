import type { Client, ServiceLineKey } from './types'

/** Fixed display order + abbreviations for the service matrix. */
export const SERVICE_LINES: { key: ServiceLineKey; abbr: string; blurb: string }[] = [
  { key: 'M&E', abbr: 'M&E', blurb: 'Mechanical & electrical critical-environment operations' },
  { key: 'Raised Floor', abbr: 'RF', blurb: 'Whitespace hands & eyes, rack & stack, technical cleaning' },
  { key: 'Projects', abbr: 'PRJ', blurb: 'Capex/opex project delivery and capital planning' },
  { key: 'E&S', abbr: 'E&S', blurb: 'Energy & sustainability — PUE, carbon, utility strategy' },
  { key: 'Space Planning', abbr: 'SP', blurb: 'Whitespace capacity and occupancy planning' },
  { key: 'Lease Admin', abbr: 'LA', blurb: 'Colo/lease administration and landlord management' },
]

/** CBRE Data Center Solutions client roster (demo). Add a client here and the executive view
    picks it up — map siteIds to Quantum sites for live-derived metrics, or leave empty for a
    deterministic synthetic footprint until the account is onboarded. */
export const CLIENTS: Client[] = [
  {
    id: 'kyndryl', name: 'Kyndryl', sector: 'IT services', hq: 'New York, NY',
    siteIds: ['ash1', 'tor1', 'sao1'],
    services: ['M&E', 'Raised Floor', 'Projects', 'E&S', 'Space Planning', 'Lease Admin'],
    accountLead: 'R. Adeyemi',
  },
  {
    id: 'meta', name: 'Meta', sector: 'Hyperscale', hq: 'Menlo Park, CA',
    siteIds: ['lon1', 'dub1'],
    services: ['M&E', 'Raised Floor', 'Projects'],
    accountLead: 'S. Lindqvist',
  },
  {
    id: 'nvidia', name: 'NVIDIA', sector: 'AI / HPC', hq: 'Santa Clara, CA',
    siteIds: ['sin1'],
    services: ['M&E', 'Raised Floor', 'Projects', 'E&S'],
    accountLead: 'A. Tanaka',
  },
  {
    id: 'google', name: 'Google', sector: 'Hyperscale', hq: 'Mountain View, CA',
    siteIds: ['fra1', 'tok1'],
    services: ['M&E', 'Projects', 'E&S', 'Space Planning'],
    accountLead: 'L. Moreau',
  },
  {
    id: 'amazon', name: 'Amazon', sector: 'Hyperscale', hq: 'Seattle, WA',
    siteIds: ['phx1'],
    services: ['M&E', 'Raised Floor', 'E&S'],
    accountLead: 'J. Rivera',
  },
  {
    id: 'dxc', name: 'DXC Technology', sector: 'IT services', hq: 'Ashburn, VA',
    siteIds: ['syd1'],
    services: ['M&E', 'Raised Floor', 'Space Planning', 'Lease Admin'],
    accountLead: 'P. Whelan',
  },
]

export const clientById = (id: string): Client | undefined => CLIENTS.find(c => c.id === id)
export const clientForSite = (siteId: string): Client | undefined =>
  CLIENTS.find(c => c.siteIds.includes(siteId))
