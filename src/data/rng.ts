/** Deterministic PRNG so dummy data is stable across reloads. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type Rng = () => number

export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)]

export const randInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min

export const randFloat = (rng: Rng, min: number, max: number, dp = 1): number =>
  +(rng() * (max - min) + min).toFixed(dp)

/** Weighted pick: entries of [value, weight]. */
export function weighted<T>(rng: Rng, entries: readonly [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [v, w] of entries) {
    roll -= w
    if (roll <= 0) return v
  }
  return entries[entries.length - 1][0]
}
