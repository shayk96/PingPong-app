/**
 * Custom hook for calculating player statistics
 * All stats are derived from match history - no denormalization
 */

import { useMemo } from 'react'
import type { Match, User, UserStats, OpponentStat, LeaderboardEntry } from '../types'

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

    return {
      totalGames,
      wins,
      losses,
      winRate,
      currentStreak,
      streakType,
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
export function isPlayerInactive(lastPlayedAt: Date | undefined): boolean {
  if (!lastPlayedAt) return false
  
  const now = new Date()
  const daysSinceLastPlayed = Math.floor((now.getTime() - new Date(lastPlayedAt).getTime()) / (1000 * 60 * 60 * 24))
  
  return daysSinceLastPlayed > INACTIVITY_GRACE_DAYS
}

/**
 * Calculate leaderboard with rankings and rank changes
 * Uses stored wins/losses from player data
 * Players with < 5 games are marked as provisional and shown at the bottom
 * Inactive players (no games in 14+ days) are hidden unless includeInactive is true
 */
export function useLeaderboard(
  players: User[],
  matches: Match[],
  includeInactive: boolean = false
): LeaderboardEntry[] {
  return useMemo(() => {
    const playersToRank = includeInactive
      ? [...players]
      : players.filter(p => !isPlayerInactive(p.lastPlayedAt))

    // Separate established and provisional (and when including inactive, inactive go at bottom)
    const establishedPlayers = playersToRank.filter(p => (p.wins + p.losses) >= MIN_GAMES_FOR_RANKING && !isPlayerInactive(p.lastPlayedAt))
    const provisionalPlayers = playersToRank.filter(p => (p.wins + p.losses) < MIN_GAMES_FOR_RANKING && !isPlayerInactive(p.lastPlayedAt))
    const inactivePlayers = includeInactive ? playersToRank.filter(p => isPlayerInactive(p.lastPlayedAt)) : []

    establishedPlayers.sort((a, b) => b.eloRating - a.eloRating)
    provisionalPlayers.sort((a, b) => b.eloRating - a.eloRating)
    inactivePlayers.sort((a, b) => b.eloRating - a.eloRating)

    const sortedPlayers = [...establishedPlayers, ...provisionalPlayers, ...inactivePlayers]

    const recentMatches = [...matches].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
    const lastMatch = recentMatches[0]

    const leaderboard: LeaderboardEntry[] = sortedPlayers.map((user, index) => {
      const totalGames = (user.wins || 0) + (user.losses || 0)
      const isProvisional = totalGames < MIN_GAMES_FOR_RANKING
      const inactive = isPlayerInactive(user.lastPlayedAt)

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
        rank: index + 1,
        wins: user.wins || 0,
        losses: user.losses || 0,
        rankChange,
        isProvisional,
        isInactive: inactive || undefined
      }
    })

    return leaderboard
  }, [players, matches, includeInactive])
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

