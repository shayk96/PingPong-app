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

/**
 * Calculate leaderboard with rankings and rank changes
 * Uses stored wins/losses from player data
 */
export function useLeaderboard(
  players: User[],
  matches: Match[]
): LeaderboardEntry[] {
  return useMemo(() => {
    // Sort players by ELO rating
    const sortedPlayers = [...players].sort((a, b) => b.eloRating - a.eloRating)
    
    // Get the most recent match to determine rank changes
    const recentMatches = [...matches].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
    const lastMatch = recentMatches[0]

    // Create leaderboard entries using stored wins/losses
    const leaderboard: LeaderboardEntry[] = sortedPlayers.map((user, index) => {
      // Determine rank change based on last match
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
        rankChange
      }
    })

    return leaderboard
  }, [players, matches])
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

