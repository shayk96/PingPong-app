/**
 * Season helpers
 *
 * Final standings, podium badges and season-scoped match filtering. A season's
 * ranking only counts players with enough games that season — the same rule
 * the server uses to crown the champion.
 */

import type { Match, Season, User } from '../types'

export const MIN_SEASON_GAMES = 5

export type SeasonFilterValue = 'all' | number

export type PodiumRank = 1 | 2 | 3

export const PODIUM_MEDALS: Record<PodiumRank, string> = { 1: '🏆', 2: '🥈', 3: '🥉' }

export interface SeasonPlacement {
  playerId: string
  displayName: string
  eloRating: number
  wins: number
  losses: number
  games: number
  /** 1-based rank among eligible players; null if provisional */
  rank: number | null
}

export interface SeasonBadge {
  rank: PodiumRank
  seasonNumber: number
}

/** True if the player has left and takes no part in the given season */
export function isRetiredIn(player: User, seasonNumber: number | undefined): boolean {
  return player.retiredFromSeason != null && seasonNumber !== undefined && seasonNumber >= player.retiredFromSeason
}

export function matchSeason(m: Match): number {
  return m.seasonNumber ?? 1
}

export function filterBySeason<T extends Match>(matches: T[], season: SeasonFilterValue): T[] {
  return season === 'all' ? matches : matches.filter(m => matchSeason(m) === season)
}

/** Ranked players first (by final ELO), then provisional ones. */
export function seasonStandings(season: Season): SeasonPlacement[] {
  const rows = season.finalStandings.map(s => ({
    playerId: s.playerId,
    displayName: s.displayName,
    eloRating: s.eloRating,
    wins: s.wins,
    losses: s.losses,
    games: s.wins + s.losses,
  }))

  const ranked = rows
    .filter(r => r.games >= MIN_SEASON_GAMES)
    .sort((a, b) => b.eloRating - a.eloRating)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  const provisional = rows
    .filter(r => r.games > 0 && r.games < MIN_SEASON_GAMES)
    .sort((a, b) => b.eloRating - a.eloRating)
    .map(r => ({ ...r, rank: null }))

  return [...ranked, ...provisional]
}

/**
 * Badges carried into the current season: the podium of the most recently
 * completed season. They roll over automatically when the next season ends.
 */
export function lastSeasonBadges(pastSeasons: Season[]): Map<string, SeasonBadge> {
  const map = new Map<string, SeasonBadge>()
  const last = [...pastSeasons].sort((a, b) => b.seasonNumber - a.seasonNumber)[0]
  if (!last) return map
  for (const p of seasonStandings(last)) {
    if (p.rank !== null && p.rank <= 3) {
      map.set(p.playerId, { rank: p.rank as PodiumRank, seasonNumber: last.seasonNumber })
    }
  }
  return map
}

/** Every season number known from the season list or the matches themselves, ascending. */
export function knownSeasonNumbers(seasons: Season[], matches: Match[]): number[] {
  const set = new Set<number>(seasons.map(s => s.seasonNumber))
  for (const m of matches) set.add(matchSeason(m))
  return [...set].sort((a, b) => a - b)
}
