/**
 * Core type definitions for the Ping Pong Tracker app
 */

// User/Player types
export interface User {
  id: string
  email?: string
  displayName: string
  eloRating: number
  wins: number
  losses: number
  createdAt: Date
  lastPlayedAt?: Date
  seasonWins?: number[] // Season numbers this player has won
}

export interface UserStats {
  totalGames: number
  wins: number
  losses: number
  winRate: number
  currentStreak: number
  streakType: 'win' | 'loss' | 'none'
  opponentStats: OpponentStat[]
}

export interface OpponentStat {
  opponentId: string
  opponentName: string
  wins: number
  losses: number
}

// Match type: all games are first to 11
export type MatchType = 11

export interface Match {
  id: string
  playerAId: string
  playerBId: string
  playerAScore: number
  playerBScore: number
  winnerId: string
  loserId: string
  matchType: number
  winnerEloDelta: number
  loserEloDelta: number
  createdAt: Date
  createdBy: string
  seasonNumber?: number
}

// For creating a new match (without computed fields)
export interface NewMatchInput {
  playerAId: string
  playerBId: string
  playerAScore: number
  playerBScore: number
  matchType: MatchType
}

// Leaderboard entry with computed rank
export interface LeaderboardEntry {
  user: User
  rank: number
  wins: number
  losses: number
  previousRank?: number
  rankChange: number // positive = moved up, negative = moved down, 0 = no change
  isProvisional: boolean // true if player has < 5 games
  isInactive?: boolean // true if player hasn't played in 14+ days (hidden by default, show via button)
}

// Match with player details for display
export interface MatchWithPlayers extends Match {
  playerA: User
  playerB: User
  winner: User
  loser: User
}

// Validation result
export interface ValidationResult {
  isValid: boolean
  error?: string
}

// ELO calculation result
export interface EloResult {
  winnerDelta: number
  loserDelta: number
  newWinnerRating: number
  newLoserRating: number
}

// Season types
export interface SeasonStanding {
  playerId: string
  displayName: string
  eloRating: number
  wins: number
  losses: number
}

export interface Season {
  seasonNumber: number
  startedAt: Date
  endedAt: Date | null
  isActive: boolean
  winnerId: string | null
  winnerName: string | null
  finalStandings: SeasonStanding[]
}

