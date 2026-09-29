/**
 * Custom hook for calculating player statistics
 * All stats are derived from match history - no denormalization
 */

import { useMemo } from 'react'
import type { Match, User, UserStats, OpponentStat, LeaderboardEntry } from '../types'
import { computePlayerStreaks } from '../lib/streaks'
import { isRetiredIn } from '../lib/seasons'

/**
 * Calculate comprehensive stats for a single player
 */
export function usePlayerStats(
  playerId: string,
  matches: Match[],
  players: User[]
): UserStats {
  return useMemo(() => {
    // Filter matches involving this player
    const playerMatches = matches.filter(
      (m) => m.winnerId === playerId || m.loserId === playerId
    )

    // Count wins and losses
    const wins = playerMatches.filter((m) => m.winnerId === playerId).length
    const losses = playerMatches.filter((m) => m.loserId === playerId).length
    const totalGames = wins + losses
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0

    // Calculate current streak (sorted by date, most recent first)
    const sortedMatches = [...playerMatches].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
    
    let currentStreak = 0
    let streakType: 'win' | 'loss' | 'none' = 'none'
    
    if (sortedMatches.length > 0) {
      const firstResult = sortedMatches[0].winnerId === playerId ? 'win' : 'loss'
      streakType = firstResult
      
      for (const match of sortedMatches) {
        const isWin = match.winnerId === playerId
        if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
          currentStreak++
        } else {
          break
        }
      }
    }

    // Calculate per-opponent stats
    const opponentMap = new Map<string, { wins: number; losses: number }>()
    
    for (const match of playerMatches) {
      const opponentId = match.winnerId === playerId ? match.loserId : match.winnerId
      const isWin = match.winnerId === playerId
      
      if (!opponentMap.has(opponentId)) {
        opponentMap.set(opponentId, { wins: 0, losses: 0 })
      }
      
      const stats = opponentMap.get(opponentId)!
      if (isWin) {
        stats.wins++
      } else {
        stats.losses++
      }
    }

    const opponentStats: OpponentStat[] = Array.from(opponentMap.entries()).map(
      ([opponentId, stats]) => {
        const opponent = players.find((p) => p.id === opponentId)
        return {
          opponentId,
          opponentName: opponent?.displayName || 'Unknown Player',
          wins: stats.wins,
          losses: stats.losses
        }
      }
    )

    // Sort opponent stats by total games played
    opponentStats.sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))

    // Longest all-time win/loss streaks (with the dates they occurred)
    const streaks = computePlayerStreaks(playerMatches, playerId)

    return {
      totalGames,
      wins,
      losses,
      winRate,
      currentStreak,
      streakType,
      longestWinStreak: streaks.longestWin,
      longestLossStreak: streaks.longestLoss,
      opponentStats
    }
  }, [playerId, matches, players])
}

// Minimum games required for established ranking
const MIN_GAMES_FOR_RANKING = 5

// Inactivity settings (must match server)
const INACTIVITY_GRACE_DAYS = 14

/**
 * Check if player is inactive (hasn't played in more than grace period)
 */
export function isPlayerInactive(_lastPlayedAt: Date | undefined, totalGames?: number): boolean {
  return (totalGames ?? 0) < MIN_GAMES_FOR_RANKING
}

/**
 * Calculate leaderboard with rankings and rank changes
 * Given a season, W/L and provisional status (< 5 games) are counted within that
 * season — ELO resets each season, so all-time records would not match the rating.
 * Only established players get a numbered rank.
 * Inactive players (< 5 games on record, or none yet this season) are hidden unless
 * includeInactive is true. Players retired as of the season are always left out.
 */
export function useLeaderboard(
  players: User[],
  matches: Match[],
  includeInactive: boolean = false,
  seasonNumber?: number
): LeaderboardEntry[] {
  return useMemo(() => {
    const seasonRecord = new Map<string, { wins: number; losses: number }>()
    if (seasonNumber !== undefined) {
      for (const m of matches) {
        if ((m.seasonNumber ?? 1) !== seasonNumber) continue
        const w = seasonRecord.get(m.winnerId) ?? { wins: 0, losses: 0 }
        w.wins++
        seasonRecord.set(m.winnerId, w)
        const l = seasonRecord.get(m.loserId) ?? { wins: 0, losses: 0 }
        l.losses++
        seasonRecord.set(m.loserId, l)
      }
    }
    const recordOf = (user: User) =>
      seasonNumber !== undefined
        ? seasonRecord.get(user.id) ?? { wins: 0, losses: 0 }
        : { wins: user.wins || 0, losses: user.losses || 0 }

    // Inactive: fewer than 5 games on record, or (within a season) no games this season yet
    const inactiveIds = new Set(
      players
        .filter(p => {
          const allTime = (p.wins || 0) + (p.losses || 0)
          if (isPlayerInactive(p.lastPlayedAt, allTime)) return true
          if (seasonNumber === undefined) return false
          const r = recordOf(p)
          return r.wins + r.losses === 0
        })
        .map(p => p.id)
    )

    const playersToRank = players.filter(
      p => !isRetiredIn(p, seasonNumber) && (includeInactive || !inactiveIds.has(p.id))
    )

    const sortedPlayers = [...playersToRank].sort((a, b) => b.eloRating - a.eloRating)

    const recentMatches = [...matches].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
    const lastMatch = recentMatches[0]

    let establishedRank = 0
    const leaderboard: LeaderboardEntry[] = sortedPlayers.map((user) => {
      const record = recordOf(user)
      const isProvisional = record.wins + record.losses < MIN_GAMES_FOR_RANKING
      const inactive = inactiveIds.has(user.id)
      if (!isProvisional) establishedRank++

      let rankChange = 0
      if (lastMatch) {
        if (user.id === lastMatch.winnerId) {
          rankChange = lastMatch.winnerEloDelta > 20 ? 1 : 0
        } else if (user.id === lastMatch.loserId) {
          rankChange = lastMatch.loserEloDelta < -20 ? -1 : 0
        }
      }

      return {
        user,
        rank: isProvisional ? 0 : establishedRank,
        wins: record.wins,
        losses: record.losses,
        rankChange,
        isProvisional,
        isInactive: inactive || undefined
      }
    })

    return leaderboard
  }, [players, matches, includeInactive, seasonNumber])
}

/**
 * Get recent matches with player details
 */
export function useRecentMatchesWithPlayers(
  matches: Match[],
  players: User[],
  limitCount: number = 10
) {
  return useMemo(() => {
    const playerMap = new Map(players.map((p) => [p.id, p]))
    
    const recentMatches = [...matches]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limitCount)
      .map((match) => ({
        ...match,
        playerA: playerMap.get(match.playerAId),
        playerB: playerMap.get(match.playerBId),
        winner: playerMap.get(match.winnerId),
        loser: playerMap.get(match.loserId)
      }))
      .filter((m) => m.playerA && m.playerB) // Filter out matches with deleted players

    return recentMatches
  }, [matches, players, limitCount])
}

