import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

export const IconDashboard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>
)
export const IconMonitor = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>
)
export const IconBirdseye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v18M13 3v18M13 9h8M13 15h8"/></svg>
)
export const IconCapacity = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>
)
export const IconOps = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 4.5a3 3 0 010 7M21 20c0-2.5-1.5-4.6-3.7-5.5"/></svg>
)
export const IconTicket = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2a2.5 2.5 0 000 6v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2.5 2.5 0 000-6z"/><path d="M13 5v2M13 11v2M13 17v2"/></svg>
)
export const IconRounds = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
)
export const IconHSE = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>
)
export const IconRisk = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/></svg>
)
export const IconIncident = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>
)
export const IconAsset = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>
)
export const IconProject = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 5h18M3 5v14a2 2 0 002 2h14a2 2 0 002-2V5"/><path d="M7 12l3 3 6-6"/></svg>
)
export const IconIntegration = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.5 8L11 15M15.5 8L13 15M9 6h6"/></svg>
)
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
)
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/></svg>
)
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
)
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6"/></svg>
)
