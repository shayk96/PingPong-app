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

// Match types
export type MatchType = 11 | 21

export interface Match {
  id: string
  playerAId: string
  playerBId: string
  playerAScore: number
  playerBScore: number
  winnerId: string
  loserId: string
  matchType: MatchType
  winnerEloDelta: number
  loserEloDelta: number
  createdAt: Date
  createdBy: string
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

