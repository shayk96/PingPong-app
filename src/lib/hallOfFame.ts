/**
 * Hall of Fame — the all-time record book
 *
 * Answers every "who holds the record for X" question from raw match history:
 * streaks, ELO surges, lucky points, dominance and volume. Pure and React-free
 * so the page stays dumb rendering and the logic is easy to test.
 */

import type { Match, User } from '../types'
import { computePlayerStreaks } from './streaks'

export interface RecordHolder {
  playerId: string
  name: string
  /** Ranking key — always "higher is better" after normalisation */
  value: number
  /** Primary formatted figure, e.g. "+112" or "23%" */
  display: string
  /** Context line, e.g. "12 – 18 Jul · 9 games" */
  detail?: string
  /** The other player, for head-to-head records */
  opponentName?: string
  /** Matches behind the record, for drill-down */
  matchIds?: string[]
}

export type RecordGroup = 'streaks' | 'elo' | 'lucky' | 'dominance' | 'volume'

export interface RecordCategory {
  id: string
  group: RecordGroup
  emoji: string
  title: string
  description: string
  /** Ranked best-first, capped at TOP_N */
  holders: RecordHolder[]
  /** Records nobody wants — rendered in the wall-of-shame tone */
  negative?: boolean
}

export const RECORD_GROUPS: { id: RecordGroup; label: string; emoji: string }[] = [
  { id: 'streaks', label: 'Streaks', emoji: '🔥' },
  { id: 'elo', label: 'ELO', emoji: '📈' },
  { id: 'lucky', label: 'Lucky', emoji: '🍀' },
  { id: 'dominance', label: 'Dominance', emoji: '👑' },
  { id: 'volume', label: 'Volume', emoji: '🏓' },
]

const TOP_N = 5
/** Rate-based records need a sample size before they mean anything */
const MIN_GAMES_FOR_RATE = 5
const MIN_H2H_GAMES = 4

// ============ Date helpers ============

function asDate(m: Match): Date {
  return m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Weeks run Sunday–Saturday, matching the rest of the app */
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

function fmtDay(d: Date | null): string {
  if (!d) return ''
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return d.toLocaleDateString('en-GB', opts)
}

function fmtRange(a: Date | null, b: Date | null): string {
  if (!a || !b) return ''
  if (startOfDay(a).getTime() === startOfDay(b).getTime()) return fmtDay(a)
  return `${fmtDay(a)} – ${fmtDay(b)}`
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function signed(n: number): string {
  const r = Math.round(n)
  return r > 0 ? `+${r}` : `${r}`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// ============ Match helpers ============

function scoreFor(m: Match, id: string): number {
  return m.playerAId === id ? m.playerAScore : m.playerBScore
}

function scoreAgainst(m: Match, id: string): number {
  return m.playerAId === id ? m.playerBScore : m.playerAScore
}

function luckyFor(m: Match, id: string): number {
  return m.playerAId === id ? (m.playerALuckyPoints ?? 0) : (m.playerBLuckyPoints ?? 0)
}

function luckyAgainst(m: Match, id: string): number {
  return m.playerAId === id ? (m.playerBLuckyPoints ?? 0) : (m.playerALuckyPoints ?? 0)
}

function eloFor(m: Match, id: string): number {
  return m.winnerId === id ? m.winnerEloDelta : m.loserEloDelta
}

function opponentOf(m: Match, id: string): string {
  return m.playerAId === id ? m.playerBId : m.playerAId
}

/** Won by 2 at deuce — both players reached matchType - 1 */
function isDeuce(m: Match): boolean {
  const hi = Math.max(m.playerAScore, m.playerBScore)
  const lo = Math.min(m.playerAScore, m.playerBScore)
  return hi - lo === 2 && lo >= m.matchType - 1
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Lucky points were introduced partway through the app's life. Rates are only
 * meaningful from the first match that recorded any, otherwise every early
 * game drags averages toward zero.
 */
function luckyTrackingStart(matches: Match[]): number | null {
  let earliest: number | null = null
  for (const m of matches) {
    if ((m.playerALuckyPoints ?? 0) > 0 || (m.playerBLuckyPoints ?? 0) > 0) {
      const t = asDate(m).getTime()
      if (earliest === null || t < earliest) earliest = t
    }
  }
  return earliest
}

// ============ Period buckets ============

interface Bucket {
  start: Date
  end: Date
  elo: number
  lucky: number
  games: number
  matchIds: string[]
}

type Granularity = 'day' | 'week' | 'month'

function bucketize(playerMatches: Match[], playerId: string, gran: Granularity): Bucket[] {
  const toStart = gran === 'day' ? startOfDay : gran === 'week' ? startOfWeek : startOfMonth
  const toEnd = gran === 'day' ? (s: Date) => s : gran === 'week' ? (s: Date) => addDays(s, 6) : endOfMonth

  const map = new Map<number, Bucket>()
  for (const m of playerMatches) {
    const start = toStart(asDate(m))
    const key = start.getTime()
    let b = map.get(key)
    if (!b) {
      b = { start, end: toEnd(start), elo: 0, lucky: 0, games: 0, matchIds: [] }
      map.set(key, b)
    }
    b.elo += eloFor(m, playerId)
    b.lucky += luckyFor(m, playerId)
    b.games++
    b.matchIds.push(m.id)
  }
  return [...map.values()]
}

function bucketLabel(b: Bucket, gran: Granularity): string {
  if (gran === 'day') return fmtDay(b.start)
  if (gran === 'month') return fmtMonth(b.start)
  return fmtRange(b.start, b.end)
}

// ============ Engine ============

/**
 * Compute the full record book.
 *
 * @param matches      the pool records are mined from (may be date-filtered)
 * @param players      roster, used for display names
 * @param allMatches   full history, needed to reconstruct absolute ELO ratings
 */
export function computeHallOfFame(
  matches: Match[],
  players: User[],
  allMatches: Match[] = matches,
): RecordCategory[] {
  const sorted = [...matches].sort((a, b) => asDate(a).getTime() - asDate(b).getTime())
  if (sorted.length === 0) return []

  const nameOf = new Map(players.map(p => [p.id, p.displayName]))
  const name = (id: string) => nameOf.get(id) ?? 'Unknown'

  // Index by player and by matchup
  const byPlayer = new Map<string, Match[]>()
  const byPair = new Map<string, Match[]>()
  for (const m of sorted) {
    for (const id of [m.playerAId, m.playerBId]) {
      const list = byPlayer.get(id)
      if (list) list.push(m)
      else byPlayer.set(id, [m])
    }
    const key = pairKey(m.playerAId, m.playerBId)
    const pl = byPair.get(key)
    if (pl) pl.push(m)
    else byPair.set(key, [m])
  }
  const playerIds = [...byPlayer.keys()]

  const periods = new Map<string, Record<Granularity, Bucket[]>>()
  for (const id of playerIds) {
    const pm = byPlayer.get(id)!
    periods.set(id, {
      day: bucketize(pm, id, 'day'),
      week: bucketize(pm, id, 'week'),
      month: bucketize(pm, id, 'month'),
    })
  }

  const luckyStart = luckyTrackingStart(sorted)
  const inLuckyEra = (m: Match) => luckyStart !== null && asDate(m).getTime() >= luckyStart

  const cats: RecordCategory[] = []

  /** Rank holders best-first and keep the podium. */
  const rank = (holders: RecordHolder[], minValue = 0) =>
    holders.filter(h => h.value > minValue).sort((a, b) => b.value - a.value).slice(0, TOP_N)

  const push = (cat: RecordCategory) => {
    if (cat.holders.length > 0) cats.push(cat)
  }

  /** Per-player best (or worst) period, for the day/week/month records. */
  const bucketHolders = (
    gran: Granularity,
    metric: (b: Bucket) => number,
    format: (b: Bucket, v: number) => string,
    pick: 'max' | 'min' = 'max',
  ): RecordHolder[] => {
    const holders: RecordHolder[] = []
    for (const id of playerIds) {
      let chosen: Bucket | null = null
      for (const b of periods.get(id)![gran]) {
        if (!chosen) chosen = b
        else if (pick === 'max' ? metric(b) > metric(chosen) : metric(b) < metric(chosen)) chosen = b
      }
      if (!chosen) continue
      const raw = metric(chosen)
      holders.push({
        playerId: id,
        name: name(id),
        value: pick === 'max' ? raw : -raw,
        display: format(chosen, raw),
        detail: `${bucketLabel(chosen, gran)} · ${plural(chosen.games, 'game')}`,
        matchIds: chosen.matchIds,
      })
    }
    return holders
  }

  // ---------- Streaks ----------

  const streaksById = new Map(playerIds.map(id => [id, computePlayerStreaks(byPlayer.get(id)!, id)]))

  push({
    id: 'longest-win-streak',
    group: 'streaks',
    emoji: '🔥',
    title: 'Longest Win Streak',
    description: 'Most consecutive wins ever put together',
    holders: rank(
      playerIds.map(id => {
        const s = streaksById.get(id)!.longestWin
        return {
          playerId: id,
          name: name(id),
          value: s.length,
          display: `${s.length}`,
          detail: fmtRange(s.startDate, s.endDate),
          matchIds: s.matchIds,
        }
      }),
      1,
    ),
  })

  push({
    id: 'longest-loss-streak',
    group: 'streaks',
    emoji: '🧊',
    title: 'Longest Losing Streak',
    description: 'The coldest run anyone has survived',
    negative: true,
    holders: rank(
      playerIds.map(id => {
        const s = streaksById.get(id)!.longestLoss
        return {
          playerId: id,
          name: name(id),
          value: s.length,
          display: `${s.length}`,
          detail: fmtRange(s.startDate, s.endDate),
          matchIds: s.matchIds,
        }
      }),
      1,
    ),
  })

  // Longest run of wins over one specific opponent — best entry per player
  const h2hStreakBest = new Map<string, RecordHolder>()
  for (const pm of byPair.values()) {
    const [aId, bId] = [pm[0].playerAId, pm[0].playerBId]
    for (const [id, oppId] of [[aId, bId], [bId, aId]]) {
      const s = computePlayerStreaks(pm, id).longestWin
      const current = h2hStreakBest.get(id)
      if (s.length > 1 && (!current || s.length > current.value)) {
        h2hStreakBest.set(id, {
          playerId: id,
          name: name(id),
          value: s.length,
          display: `${s.length}`,
          detail: `vs ${name(oppId)} · ${fmtRange(s.startDate, s.endDate)}`,
          opponentName: name(oppId),
          matchIds: s.matchIds,
        })
      }
    }
  }
  push({
    id: 'h2h-win-streak',
    group: 'streaks',
    emoji: '⚔️',
    title: 'Longest Streak vs One Player',
    description: 'Most wins in a row over the same opponent',
    holders: rank([...h2hStreakBest.values()], 1),
  })

  // Streaks still running right now
  push({
    id: 'active-streak',
    group: 'streaks',
    emoji: '⚡',
    title: 'Hottest Right Now',
    description: 'Win streaks still alive today',
    holders: rank(
      playerIds.flatMap(id => {
        const cur = streaksById.get(id)!.current
        if (cur.type !== 'win') return []
        const tail = byPlayer.get(id)!.slice(-cur.length)
        return [{
          playerId: id,
          name: name(id),
          value: cur.length,
          display: `${cur.length}`,
          detail: `since ${fmtDay(asDate(tail[0]))}`,
          matchIds: tail.map(m => m.id),
        }]
      }),
      1,
    ),
  })

  // ---------- ELO ----------

  push({
    id: 'elo-day',
    group: 'elo',
    emoji: '📈',
    title: 'Best Day',
    description: 'Most ELO gained in a single day',
    holders: rank(bucketHolders('day', b => b.elo, (_, v) => signed(v))),
  })

  push({
    id: 'elo-week',
    group: 'elo',
    emoji: '📈',
    title: 'Best Week',
    description: 'Most ELO gained in one week (Sun–Sat)',
    holders: rank(bucketHolders('week', b => b.elo, (_, v) => signed(v))),
  })

  push({
    id: 'elo-month',
    group: 'elo',
    emoji: '📈',
    title: 'Best Month',
    description: 'Most ELO gained in a calendar month',
    holders: rank(bucketHolders('month', b => b.elo, (_, v) => signed(v))),
  })

  push({
    id: 'elo-worst-day',
    group: 'elo',
    emoji: '📉',
    title: 'Worst Day',
    description: 'Most ELO surrendered in a single day',
    negative: true,
    holders: rank(bucketHolders('day', b => b.elo, (_, v) => signed(v), 'min')),
  })

  // Peak rating ever held. Deltas alone give no absolute rating, so walk each
  // player's full history backwards from their current rating.
  const rangeIds = new Set(sorted.map(m => m.id))
  const peakHolders: RecordHolder[] = []
  for (const player of players) {
    const history = allMatches
      .filter(m => m.playerAId === player.id || m.playerBId === player.id)
      .sort((a, b) => asDate(b).getTime() - asDate(a).getTime())
    if (history.length === 0) continue

    let rating = player.eloRating
    let peak: { rating: number; match: Match } | null = null
    for (const m of history) {
      if (rangeIds.has(m.id) && (!peak || rating > peak.rating)) peak = { rating, match: m }
      rating -= eloFor(m, player.id)
    }
    if (!peak) continue
    peakHolders.push({
      playerId: player.id,
      name: player.displayName,
      value: peak.rating,
      display: `${Math.round(peak.rating)}`,
      detail: `${fmtDay(asDate(peak.match))} · now ${Math.round(player.eloRating)}`,
      matchIds: [peak.match.id],
    })
  }
  push({
    id: 'peak-elo',
    group: 'elo',
    emoji: '👑',
    title: 'Highest Rating Ever',
    description: 'Peak ELO reached at any point',
    holders: rank(peakHolders),
  })

  // Biggest ELO swing from one game
  const bestSingle = new Map<string, RecordHolder>()
  for (const m of sorted) {
    const gain = m.winnerEloDelta
    const current = bestSingle.get(m.winnerId)
    if (!current || gain > current.value) {
      bestSingle.set(m.winnerId, {
        playerId: m.winnerId,
        name: name(m.winnerId),
        value: gain,
        display: signed(gain),
        detail: `beat ${name(m.loserId)} · ${fmtDay(asDate(m))}`,
        opponentName: name(m.loserId),
        matchIds: [m.id],
      })
    }
  }
  push({
    id: 'single-match-gain',
    group: 'elo',
    emoji: '💥',
    title: 'Biggest Single Win',
    description: 'Most ELO taken from one match',
    holders: rank([...bestSingle.values()]),
  })

  // ---------- Lucky ----------

  if (luckyStart !== null) {
    // Share of a player's own points that were lucky
    push({
      id: 'lucky-share',
      group: 'lucky',
      emoji: '🍀',
      title: 'Luckiest Player',
      description: `Share of all points scored that were lucky (min ${MIN_GAMES_FOR_RATE} games)`,
      holders: rank(
        playerIds.flatMap(id => {
          const era = byPlayer.get(id)!.filter(inLuckyEra)
          if (era.length < MIN_GAMES_FOR_RATE) return []
          const lucky = era.reduce((s, m) => s + luckyFor(m, id), 0)
          const points = era.reduce((s, m) => s + scoreFor(m, id), 0)
          if (points === 0) return []
          const pct = (lucky / points) * 100
          return [{
            playerId: id,
            name: name(id),
            value: pct,
            display: `${pct.toFixed(1)}%`,
            detail: `${lucky} lucky of ${points} points · ${plural(era.length, 'game')}`,
            matchIds: era.filter(m => luckyFor(m, id) > 0).map(m => m.id),
          }]
        }),
      ),
    })

    push({
      id: 'lucky-per-game',
      group: 'lucky',
      emoji: '🎰',
      title: 'Most Lucky Per Game',
      description: `Average lucky points per game (min ${MIN_GAMES_FOR_RATE} games)`,
      holders: rank(
        playerIds.flatMap(id => {
          const era = byPlayer.get(id)!.filter(inLuckyEra)
          if (era.length < MIN_GAMES_FOR_RATE) return []
          const lucky = era.reduce((s, m) => s + luckyFor(m, id), 0)
          const avg = lucky / era.length
          return [{
            playerId: id,
            name: name(id),
            value: avg,
            display: avg.toFixed(2),
            detail: `${lucky} lucky over ${plural(era.length, 'game')}`,
            matchIds: era.filter(m => luckyFor(m, id) > 0).map(m => m.id),
          }]
        }),
      ),
    })

    push({
      id: 'lucky-day',
      group: 'lucky',
      emoji: '🍀',
      title: 'Luckiest Day',
      description: 'Most lucky points collected in one day',
      holders: rank(bucketHolders('day', b => b.lucky, (_, v) => `${v}`)),
    })

    push({
      id: 'lucky-week',
      group: 'lucky',
      emoji: '🍀',
      title: 'Luckiest Week',
      description: 'Most lucky points in one week (Sun–Sat)',
      holders: rank(bucketHolders('week', b => b.lucky, (_, v) => `${v}`)),
    })

    push({
      id: 'lucky-month',
      group: 'lucky',
      emoji: '🍀',
      title: 'Luckiest Month',
      description: 'Most lucky points in a calendar month',
      holders: rank(bucketHolders('month', b => b.lucky, (_, v) => `${v}`)),
    })

    // Single-game lucky high score
    const luckyGame = new Map<string, RecordHolder>()
    for (const m of sorted) {
      for (const id of [m.playerAId, m.playerBId]) {
        const lucky = luckyFor(m, id)
        const current = luckyGame.get(id)
        if (lucky > 0 && (!current || lucky > current.value)) {
          luckyGame.set(id, {
            playerId: id,
            name: name(id),
            value: lucky,
            display: `${lucky}`,
            detail: `vs ${name(opponentOf(m, id))} · ${scoreFor(m, id)}–${scoreAgainst(m, id)} · ${fmtDay(asDate(m))}`,
            opponentName: name(opponentOf(m, id)),
            matchIds: [m.id],
          })
        }
      }
    }
    push({
      id: 'lucky-game',
      group: 'lucky',
      emoji: '🎯',
      title: 'Luckiest Single Game',
      description: 'Most lucky points in one match',
      holders: rank([...luckyGame.values()]),
    })

    push({
      id: 'unlucky-conceded',
      group: 'lucky',
      emoji: '😤',
      title: 'Most Lucky Conceded',
      description: `Lucky points handed to opponents per game (min ${MIN_GAMES_FOR_RATE} games)`,
      negative: true,
      holders: rank(
        playerIds.flatMap(id => {
          const era = byPlayer.get(id)!.filter(inLuckyEra)
          if (era.length < MIN_GAMES_FOR_RATE) return []
          const conceded = era.reduce((s, m) => s + luckyAgainst(m, id), 0)
          const avg = conceded / era.length
          return [{
            playerId: id,
            name: name(id),
            value: avg,
            display: avg.toFixed(2),
            detail: `${conceded} conceded over ${plural(era.length, 'game')}`,
            matchIds: era.filter(m => luckyAgainst(m, id) > 0).map(m => m.id),
          }]
        }),
      ),
    })
  }

  // ---------- Dominance ----------

  const perfectWins = new Map<string, string[]>()
  const perfectLosses = new Map<string, string[]>()
  for (const m of sorted) {
    const hi = Math.max(m.playerAScore, m.playerBScore)
    const lo = Math.min(m.playerAScore, m.playerBScore)
    if (hi === m.matchType && lo === 0) {
      perfectWins.set(m.winnerId, [...(perfectWins.get(m.winnerId) ?? []), m.id])
      perfectLosses.set(m.loserId, [...(perfectLosses.get(m.loserId) ?? []), m.id])
    }
  }

  push({
    id: 'perfect-wins',
    group: 'dominance',
    emoji: '🔫',
    title: 'Most 11–0 Wins',
    description: 'Total shutouts delivered',
    holders: rank(
      [...perfectWins.entries()].map(([id, ids]) => ({
        playerId: id,
        name: name(id),
        value: ids.length,
        display: `${ids.length}`,
        detail: plural(ids.length, 'shutout'),
        matchIds: ids,
      })),
    ),
  })

  push({
    id: 'perfect-losses',
    group: 'dominance',
    emoji: '💀',
    title: 'Most 11–0 Defeats',
    description: 'Total shutouts suffered',
    negative: true,
    holders: rank(
      [...perfectLosses.entries()].map(([id, ids]) => ({
        playerId: id,
        name: name(id),
        value: ids.length,
        display: `${ids.length}`,
        detail: plural(ids.length, 'blanking'),
        matchIds: ids,
      })),
    ),
  })

  push({
    id: 'win-rate',
    group: 'dominance',
    emoji: '🏆',
    title: 'Best Win Rate',
    description: `Share of games won (min ${MIN_GAMES_FOR_RATE} games)`,
    holders: rank(
      playerIds.flatMap(id => {
        const pm = byPlayer.get(id)!
        if (pm.length < MIN_GAMES_FOR_RATE) return []
        const wins = pm.filter(m => m.winnerId === id).length
        const pct = (wins / pm.length) * 100
        return [{
          playerId: id,
          name: name(id),
          value: pct,
          display: `${Math.round(pct)}%`,
          detail: `${wins}W ${pm.length - wins}L`,
          matchIds: pm.map(m => m.id),
        }]
      }),
    ),
  })

  push({
    id: 'avg-margin',
    group: 'dominance',
    emoji: '💪',
    title: 'Biggest Average Win',
    description: `Average points margin in wins (min ${MIN_GAMES_FOR_RATE} wins)`,
    holders: rank(
      playerIds.flatMap(id => {
        const wins = byPlayer.get(id)!.filter(m => m.winnerId === id)
        if (wins.length < MIN_GAMES_FOR_RATE) return []
        const margin = wins.reduce((s, m) => s + scoreFor(m, id) - scoreAgainst(m, id), 0) / wins.length
        return [{
          playerId: id,
          name: name(id),
          value: margin,
          display: `+${margin.toFixed(1)}`,
          detail: `across ${plural(wins.length, 'win')}`,
          matchIds: wins.map(m => m.id),
        }]
      }),
    ),
  })

  // Fewest points conceded per game — lowest wins, so rank on the negated value
  push({
    id: 'stingiest',
    group: 'dominance',
    emoji: '🧱',
    title: 'Stingiest Defence',
    description: `Fewest points conceded per game (min ${MIN_GAMES_FOR_RATE} games)`,
    holders: rank(
      playerIds.flatMap(id => {
        const pm = byPlayer.get(id)!
        if (pm.length < MIN_GAMES_FOR_RATE) return []
        const avg = pm.reduce((s, m) => s + scoreAgainst(m, id), 0) / pm.length
        return [{
          playerId: id,
          name: name(id),
          value: -avg,
          display: avg.toFixed(1),
          detail: `over ${plural(pm.length, 'game')}`,
          matchIds: pm.map(m => m.id),
        }]
      }),
      -Infinity,
    ),
  })

  push({
    id: 'deuce-wins',
    group: 'dominance',
    emoji: '😅',
    title: 'Clutch King',
    description: 'Most deuce games won',
    holders: rank(
      playerIds.flatMap(id => {
        const deuces = byPlayer.get(id)!.filter(isDeuce)
        const wins = deuces.filter(m => m.winnerId === id)
        if (wins.length === 0) return []
        return [{
          playerId: id,
          name: name(id),
          value: wins.length,
          display: `${wins.length}`,
          detail: `${wins.length} of ${plural(deuces.length, 'deuce game')}`,
          matchIds: wins.map(m => m.id),
        }]
      }),
    ),
  })

  // Most lopsided head-to-head — best entry per player
  const dominantH2H = new Map<string, RecordHolder>()
  for (const pm of byPair.values()) {
    if (pm.length < MIN_H2H_GAMES) continue
    const [aId, bId] = [pm[0].playerAId, pm[0].playerBId]
    for (const [id, oppId] of [[aId, bId], [bId, aId]]) {
      const wins = pm.filter(m => m.winnerId === id).length
      const pct = (wins / pm.length) * 100
      // Win rate first, more games breaks the tie
      const value = pct + pm.length / 1000
      const current = dominantH2H.get(id)
      if (pct > 50 && (!current || value > current.value)) {
        dominantH2H.set(id, {
          playerId: id,
          name: name(id),
          value,
          display: `${wins}–${pm.length - wins}`,
          detail: `vs ${name(oppId)} · ${Math.round(pct)}% win rate`,
          opponentName: name(oppId),
          matchIds: pm.map(m => m.id),
        })
      }
    }
  }
  push({
    id: 'dominant-h2h',
    group: 'dominance',
    emoji: '🥊',
    title: 'Most One-Sided Matchup',
    description: `Best record against a single opponent (min ${MIN_H2H_GAMES} games)`,
    holders: rank([...dominantH2H.values()]),
  })

  // ---------- Volume ----------

  push({
    id: 'most-games',
    group: 'volume',
    emoji: '🏓',
    title: 'Most Games Played',
    description: 'The people who actually show up',
    holders: rank(
      playerIds.map(id => {
        const pm = byPlayer.get(id)!
        const wins = pm.filter(m => m.winnerId === id).length
        return {
          playerId: id,
          name: name(id),
          value: pm.length,
          display: `${pm.length}`,
          detail: `${wins}W ${pm.length - wins}L`,
          matchIds: pm.map(m => m.id),
        }
      }),
    ),
  })

  push({
    id: 'most-wins',
    group: 'volume',
    emoji: '🏅',
    title: 'Most Wins',
    description: 'Total victories on the board',
    holders: rank(
      playerIds.map(id => {
        const wins = byPlayer.get(id)!.filter(m => m.winnerId === id)
        return {
          playerId: id,
          name: name(id),
          value: wins.length,
          display: `${wins.length}`,
          detail: `from ${plural(byPlayer.get(id)!.length, 'game')}`,
          matchIds: wins.map(m => m.id),
        }
      }),
    ),
  })

  push({
    id: 'most-points',
    group: 'volume',
    emoji: '🎱',
    title: 'Most Points Scored',
    description: 'Every rally won, all-time',
    holders: rank(
      playerIds.map(id => {
        const pm = byPlayer.get(id)!
        const points = pm.reduce((s, m) => s + scoreFor(m, id), 0)
        return {
          playerId: id,
          name: name(id),
          value: points,
          display: `${points}`,
          detail: `${(points / pm.length).toFixed(1)} per game`,
          matchIds: pm.map(m => m.id),
        }
      }),
    ),
  })

  push({
    id: 'games-in-day',
    group: 'volume',
    emoji: '🥵',
    title: 'Busiest Day',
    description: 'Most games played by one person in a day',
    holders: rank(bucketHolders('day', b => b.games, (_, v) => `${v}`)),
  })

  // Most played matchup — one entry per rivalry, credited to the leader
  const rivalries: RecordHolder[] = []
  for (const pm of byPair.values()) {
    const [aId, bId] = [pm[0].playerAId, pm[0].playerBId]
    const aWins = pm.filter(m => m.winnerId === aId).length
    const leader = aWins >= pm.length - aWins ? aId : bId
    const other = leader === aId ? bId : aId
    const leaderWins = leader === aId ? aWins : pm.length - aWins
    rivalries.push({
      playerId: leader,
      name: name(leader),
      value: pm.length,
      display: `${pm.length}`,
      detail: `vs ${name(other)} · leads ${leaderWins}–${pm.length - leaderWins}`,
      opponentName: name(other),
      matchIds: pm.map(m => m.id),
    })
  }
  push({
    id: 'biggest-rivalry',
    group: 'volume',
    emoji: '⚔️',
    title: 'Most Played Rivalry',
    description: 'The matchups that keep coming back',
    holders: rank(rivalries, 1),
  })

  return cats
}
