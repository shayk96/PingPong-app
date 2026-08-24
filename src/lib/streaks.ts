/**
 * Streak & head-to-head analytics
 *
 * Pure, dependency-free helpers for deriving winning/losing streaks and
 * rich head-to-head statistics from raw match history. Kept separate from
 * React so the logic is easy to test and reuse.
 */

import type { Match, StreakRecord } from '../types'

export interface CurrentStreak {
  type: 'win' | 'loss' | 'none'
  length: number
}

export interface PlayerStreaks {
  current: CurrentStreak
  longestWin: StreakRecord
  longestLoss: StreakRecord
}

const emptyRecord = (): StreakRecord => ({ length: 0, startDate: null, endDate: null, matchIds: [] })

function sortAsc(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/**
 * Compute the longest win/loss streaks and the current streak for a player,
 * scoped to whatever match list is passed in (all matches, or head-to-head).
 */
export function computePlayerStreaks(matches: Match[], playerId: string): PlayerStreaks {
  const involved = sortAsc(
    matches.filter(m => m.winnerId === playerId || m.loserId === playerId)
  )

  let longestWin: StreakRecord = emptyRecord()
  let longestLoss: StreakRecord = emptyRecord()

  let runType: 'win' | 'loss' | null = null
  let runLen = 0
  let runStart: Date | null = null
  let runEnd: Date | null = null
  let runIds: string[] = []

  const flush = () => {
    if (runType === 'win' && runLen > longestWin.length) {
      longestWin = { length: runLen, startDate: runStart, endDate: runEnd, matchIds: [...runIds] }
    } else if (runType === 'loss' && runLen > longestLoss.length) {
      longestLoss = { length: runLen, startDate: runStart, endDate: runEnd, matchIds: [...runIds] }
    }
  }

  for (const m of involved) {
    const type: 'win' | 'loss' = m.winnerId === playerId ? 'win' : 'loss'
    const date = new Date(m.createdAt)
    if (type === runType) {
      runLen++
      runEnd = date
      runIds.push(m.id)
    } else {
      flush()
      runType = type
      runLen = 1
      runStart = date
      runEnd = date
      runIds = [m.id]
    }
  }
  flush()

  const current: CurrentStreak = runType && runLen > 0
    ? { type: runType, length: runLen }
    : { type: 'none', length: 0 }

  return { current, longestWin, longestLoss }
}

/**
 * Compute every player's CURRENT streak in a single pass over all matches.
 * Efficient for the leaderboard (avoids per-player filtering).
 */
export function computeCurrentStreaks(matches: Match[]): Map<string, CurrentStreak> {
  const map = new Map<string, CurrentStreak>()
  for (const m of sortAsc(matches)) {
    const w = map.get(m.winnerId)
    if (w && w.type === 'win') w.length++
    else map.set(m.winnerId, { type: 'win', length: 1 })

    const l = map.get(m.loserId)
    if (l && l.type === 'loss') l.length++
    else map.set(m.loserId, { type: 'loss', length: 1 })
  }
  return map
}

// ============ Head-to-head ============

export interface H2HSide {
  playerId: string
  name: string
  wins: number
  longestWinStreak: StreakRecord
  biggestWin: { margin: number; playerScore: number; opponentScore: number; date: Date } | null
  totalLucky: number
  avgLucky: number
  perfectWins: number // 11-0 wins
  avgWinMargin: number
}

export interface H2HStats {
  total: number
  closeMatches: number
  closeWinsA: number
  closeWinsB: number
  avgTotalPoints: number
  lastMeeting: Date | null
  a: H2HSide
  b: H2HSide
}

function luckyFor(m: Match, playerId: string): number {
  return m.playerAId === playerId ? (m.playerALuckyPoints ?? 0) : (m.playerBLuckyPoints ?? 0)
}

function scoreFor(m: Match, playerId: string): number {
  return m.playerAId === playerId ? m.playerAScore : m.playerBScore
}

/** A match is "close" if won by 2 at deuce (both reached matchType-1). */
function isCloseMatch(m: Match): boolean {
  const hi = Math.max(m.playerAScore, m.playerBScore)
  const lo = Math.min(m.playerAScore, m.playerBScore)
  return hi - lo === 2 && lo >= m.matchType - 1
}

function buildSide(pairMatches: Match[], playerId: string, name: string): H2HSide {
  const wins = pairMatches.filter(m => m.winnerId === playerId)
  const streaks = computePlayerStreaks(pairMatches, playerId)

  let biggestWin: H2HSide['biggestWin'] = null
  let marginSum = 0
  let perfectWins = 0
  for (const m of wins) {
    const ps = scoreFor(m, playerId)
    const os = m.playerAId === playerId ? m.playerBScore : m.playerAScore
    const margin = ps - os
    marginSum += margin
    if (ps === 11 && os === 0) perfectWins++
    if (!biggestWin || margin > biggestWin.margin) {
      biggestWin = { margin, playerScore: ps, opponentScore: os, date: new Date(m.createdAt) }
    }
  }

  const totalLucky = pairMatches.reduce((s, m) => s + luckyFor(m, playerId), 0)

  return {
    playerId,
    name,
    wins: wins.length,
    longestWinStreak: streaks.longestWin,
    biggestWin,
    totalLucky,
    avgLucky: pairMatches.length > 0 ? Math.round((totalLucky / pairMatches.length) * 100) / 100 : 0,
    perfectWins,
    avgWinMargin: wins.length > 0 ? Math.round((marginSum / wins.length) * 10) / 10 : 0,
  }
}

/**
 * Compute the full head-to-head breakdown between two players from the given
 * match pool (typically all matches). `aId` is usually the profile owner.
 */
export function computeH2HStats(
  matches: Match[],
  aId: string,
  aName: string,
  bId: string,
  bName: string,
): H2HStats {
  const pairMatches = sortAsc(
    matches.filter(m =>
      (m.playerAId === aId && m.playerBId === bId) ||
      (m.playerAId === bId && m.playerBId === aId)
    )
  )

  const closeMatches = pairMatches.filter(isCloseMatch)
  const totalPoints = pairMatches.reduce((s, m) => s + m.playerAScore + m.playerBScore, 0)

  return {
    total: pairMatches.length,
    closeMatches: closeMatches.length,
    closeWinsA: closeMatches.filter(m => m.winnerId === aId).length,
    closeWinsB: closeMatches.filter(m => m.winnerId === bId).length,
    avgTotalPoints: pairMatches.length > 0 ? Math.round((totalPoints / pairMatches.length) * 10) / 10 : 0,
    lastMeeting: pairMatches.length > 0 ? new Date(pairMatches[pairMatches.length - 1].createdAt) : null,
    a: buildSide(pairMatches, aId, aName),
    b: buildSide(pairMatches, bId, bName),
  }
}
