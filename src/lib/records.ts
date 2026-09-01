/**
 * Period-based ELO records
 *
 * Derives a player's best single day / week / month of ELO gain from raw match
 * history. Weeks run Sunday–Saturday to match the rest of the app.
 */

import type { Match } from '../types'

export interface PeriodRecord {
  /** Net ELO change accumulated in the period */
  delta: number
  start: Date
  end: Date
  games: number
  matchIds: string[]
}

export interface EloPeriodRecords {
  bestDay: PeriodRecord | null
  bestWeek: PeriodRecord | null
  bestMonth: PeriodRecord | null
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeek(d: Date): Date {
  const s = startOfDay(d)
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - s.getDay())
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

/**
 * Bucket a player's matches by period and return the bucket with the highest
 * net ELO change. Ties are broken by the earlier period.
 */
function bestByBucket(
  matches: Match[],
  playerId: string,
  bucketStart: (d: Date) => Date,
  bucketEnd: (start: Date) => Date,
): PeriodRecord | null {
  const buckets = new Map<number, { delta: number; games: number; matchIds: string[] }>()

  for (const m of matches) {
    const delta = m.winnerId === playerId ? m.winnerEloDelta : m.loserEloDelta
    const key = bucketStart(new Date(m.createdAt)).getTime()
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { delta: 0, games: 0, matchIds: [] }
      buckets.set(key, bucket)
    }
    bucket.delta += delta
    bucket.games++
    bucket.matchIds.push(m.id)
  }

  let best: PeriodRecord | null = null
  for (const [key, bucket] of buckets) {
    if (!best || bucket.delta > best.delta) {
      const start = new Date(key)
      best = {
        delta: bucket.delta,
        start,
        end: bucketEnd(start),
        games: bucket.games,
        matchIds: bucket.matchIds,
      }
    }
  }
  return best
}

/**
 * Compute a player's best day, week and month of ELO gain.
 */
export function computeEloPeriodRecords(matches: Match[], playerId: string): EloPeriodRecords {
  const involved = matches.filter(m => m.winnerId === playerId || m.loserId === playerId)

  return {
    bestDay: bestByBucket(involved, playerId, startOfDay, s => s),
    bestWeek: bestByBucket(involved, playerId, startOfWeek, s => addDays(s, 6)),
    bestMonth: bestByBucket(involved, playerId, startOfMonth, s => endOfMonth(s)),
  }
}
