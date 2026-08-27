import type { Site } from './types'

/** Ten imaginary sites with a realistic global spread and mixed vendor stacks. */
export const SITES: Site[] = [
  {
    id: 'ash1', code: 'QTM-ASH1', name: 'Ashvale Campus', city: 'Ashburn, VA', country: 'United States',
    region: 'Americas', tier: 'IV', capacityMW: 24, itLoadMW: 16.2, whitespaceSqft: 92000, halls: 3,
    rackCount: 72, designPUE: 1.32, currentPUE: 1.28, dcim: 'Nlyte', bms: 'Schneider EcoStruxure',
    cmms: 'ServiceNow FSM', fte: 34, monthlyOpexUSD: 1480000,
  },
  {
    id: 'phx1', code: 'QTM-PHX1', name: 'Sonoran Ridge', city: 'Phoenix, AZ', country: 'United States',
    region: 'Americas', tier: 'III', capacityMW: 12, itLoadMW: 8.9, whitespaceSqft: 54000, halls: 2,
    rackCount: 60, designPUE: 1.4, currentPUE: 1.45, dcim: 'Sunbird dcTrack', bms: 'Honeywell EBI',
    cmms: 'IBM Maximo', fte: 21, monthlyOpexUSD: 860000,
  },
  {
    id: 'tor1', code: 'QTM-TOR1', name: 'Lakeshore North', city: 'Toronto, ON', country: 'Canada',
    region: 'Americas', tier: 'III', capacityMW: 8, itLoadMW: 5.1, whitespaceSqft: 38000, halls: 2,
    rackCount: 48, designPUE: 1.35, currentPUE: 1.31, dcim: 'None (Quantum native)', bms: 'Johnson Controls Metasys',
    cmms: 'Corrigo', fte: 14, monthlyOpexUSD: 540000,
  },
  {
    id: 'sao1', code: 'QTM-SAO1', name: 'Vila Corridor', city: 'São Paulo', country: 'Brazil',
    region: 'Americas', tier: 'III', capacityMW: 6, itLoadMW: 4.4, whitespaceSqft: 29000, halls: 1,
    rackCount: 40, designPUE: 1.5, currentPUE: 1.58, dcim: 'Sunbird dcTrack', bms: 'Schneider EcoStruxure',
    cmms: 'ServiceNow FSM', fte: 12, monthlyOpexUSD: 410000,
  },
  {
    id: 'lon1', code: 'QTM-LON1', name: 'Thamesgate', city: 'Slough', country: 'United Kingdom',
    region: 'EMEA', tier: 'IV', capacityMW: 18, itLoadMW: 13.6, whitespaceSqft: 71000, halls: 3,
    rackCount: 66, designPUE: 1.28, currentPUE: 1.24, dcim: 'Nlyte', bms: 'Siemens Desigo CC',
    cmms: 'ServiceNow FSM', fte: 28, monthlyOpexUSD: 1210000,
  },
  {
    id: 'fra1', code: 'QTM-FRA1', name: 'Main Digital Park', city: 'Frankfurt', country: 'Germany',
    region: 'EMEA', tier: 'IV', capacityMW: 20, itLoadMW: 14.8, whitespaceSqft: 78000, halls: 3,
    rackCount: 68, designPUE: 1.25, currentPUE: 1.22, dcim: 'Nlyte', bms: 'Siemens Desigo CC',
    cmms: 'IBM Maximo', fte: 30, monthlyOpexUSD: 1330000,
  },
  {
    id: 'dub1', code: 'QTM-DUB1', name: 'Liffey West', city: 'Dublin', country: 'Ireland',
    region: 'EMEA', tier: 'III', capacityMW: 10, itLoadMW: 7.2, whitespaceSqft: 45000, halls: 2,
    rackCount: 54, designPUE: 1.3, currentPUE: 1.27, dcim: 'Sunbird dcTrack', bms: 'Schneider EcoStruxure',
    cmms: 'ServiceNow FSM', fte: 17, monthlyOpexUSD: 690000,
  },
  {
    id: 'sin1', code: 'QTM-SIN1', name: 'Straits Junction', city: 'Singapore', country: 'Singapore',
    region: 'APAC', tier: 'IV', capacityMW: 16, itLoadMW: 12.4, whitespaceSqft: 62000, halls: 2,
    rackCount: 64, designPUE: 1.38, currentPUE: 1.42, dcim: 'Nlyte', bms: 'Honeywell EBI',
    cmms: 'ServiceNow FSM', fte: 26, monthlyOpexUSD: 1120000,
  },
  {
    id: 'tok1', code: 'QTM-TOK1', name: 'Tama Heights', city: 'Tokyo', country: 'Japan',
    region: 'APAC', tier: 'III', capacityMW: 9, itLoadMW: 6.3, whitespaceSqft: 41000, halls: 2,
    rackCount: 50, designPUE: 1.42, currentPUE: 1.39, dcim: 'Sunbird dcTrack', bms: 'Johnson Controls Metasys',
    cmms: 'IBM Maximo', fte: 16, monthlyOpexUSD: 720000,
  },
  {
    id: 'syd1', code: 'QTM-SYD1', name: 'Botany Bay South', city: 'Sydney', country: 'Australia',
    region: 'APAC', tier: 'III', capacityMW: 7, itLoadMW: 4.9, whitespaceSqft: 33000, halls: 1,
    rackCount: 44, designPUE: 1.36, currentPUE: 1.33, dcim: 'None (Quantum native)', bms: 'Schneider EcoStruxure',
    cmms: 'Corrigo', fte: 13, monthlyOpexUSD: 490000,
  },
]

export const siteById = (id: string): Site | undefined => SITES.find(s => s.id === id)
