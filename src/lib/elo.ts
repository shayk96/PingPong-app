/**
 * ELO Rating System Implementation (Enhanced)
 * 
 * The ELO rating system is a method for calculating the relative skill levels
 * of players in zero-sum games. Originally designed for chess, it works well
 * for ping pong matches.
 * 
 * Key concepts:
 * - Each player has a numerical rating (starting at 800)
 * - When players compete, ratings are updated based on the outcome
 * - Beating a higher-rated player rewards more points than beating a lower-rated one
 * - The K-factor determines how much ratings change per match
 * 
 * Enhancements:
 * - K-factor varies based on games played (new players have more volatile ratings)
 * - Score margin affects rating change (winning by more = more points)
 * 
 * Formula breakdown:
 * 1. Expected score: E = 1 / (1 + 10^((opponent_rating - player_rating) / 400))
 * 2. K-factor: Based on games played (40 for new, 32 standard, 24 experienced)
 * 3. Margin multiplier: 1 + (point_difference - 2) * 0.05
 * 4. New rating: R_new = R_old + K * margin_mult * (S - E)
 *    where S = 1 for win, 0 for loss
 */

import type { EloResult } from '../types'

// Minimum rating to prevent negative ratings
const MIN_RATING = 100

/**
 * Get K-factor based on number of games played
 * New players have more volatile ratings, experienced players are more stable
 * 
 * @param gamesPlayed - Total games played by the player
 * @returns K-factor value
 */
export function getKFactor(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 40  // New player - high volatility
  if (gamesPlayed < 30) return 32  // Intermediate - standard
  return 24                         // Experienced - more stable
}

/**
 * Calculate margin multiplier based on score difference
 * Winning by more points gives a bonus
 * 
 * @param winnerScore - Winner's score
 * @param loserScore - Loser's score
 * @returns Margin multiplier (1.0 to ~1.5)
 */
export function getMarginMultiplier(winnerScore: number, loserScore: number): number {
  const pointDifference = winnerScore - loserScore
  // Minimum difference is 2 (must win by 2 in ping pong)
  // Each additional point adds 0.05 to the multiplier
  // Example: win by 2 = 1.0, win by 6 = 1.2, win by 10 = 1.4, win by 11 = 1.45
  return 1 + Math.max(0, (pointDifference - 2)) * 0.05
}

/**
 * Calculate the expected score (probability of winning)
 * 
 * @param playerRating - The rating of the player
 * @param opponentRating - The rating of the opponent
 * @returns Expected score between 0 and 1
 */
function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
}

/**
 * Calculate ELO rating changes after a match (enhanced version)
 * 
 * @param winnerRating - Current rating of the winner
 * @param loserRating - Current rating of the loser
 * @param winnerGamesPlayed - Total games played by winner (optional, defaults to 30)
 * @param loserGamesPlayed - Total games played by loser (optional, defaults to 30)
 * @param winnerScore - Winner's score in this match (optional, for margin calc)
 * @param loserScore - Loser's score in this match (optional, for margin calc)
 * @returns Object containing rating deltas and new ratings
 * 
 * @example
 * // Equal players, close game (11-9)
 * calculateElo(1000, 1000, 5, 5, 11, 9)
 * // Returns: { winnerDelta: 20, loserDelta: -20, ... } (K=40 for new players, margin=1.0)
 * 
 * @example
 * // Equal players, dominant win (11-1)
 * calculateElo(1000, 1000, 5, 5, 11, 1)
 * // Returns: { winnerDelta: 29, loserDelta: -29, ... } (K=40, margin=1.45)
 */
export function calculateElo(
  winnerRating: number, 
  loserRating: number,
  winnerGamesPlayed: number = 30,
  loserGamesPlayed: number = 30,
  winnerScore?: number,
  loserScore?: number
): EloResult {
  // Calculate expected score for winner
  const expectedWinner = expectedScore(winnerRating, loserRating)
  
  // Get K-factors based on games played - use average for symmetric calculation
  const winnerK = getKFactor(winnerGamesPlayed)
  const loserK = getKFactor(loserGamesPlayed)
  const avgK = (winnerK + loserK) / 2
  
  // Get margin multiplier (if scores provided)
  const marginMult = (winnerScore !== undefined && loserScore !== undefined) 
    ? getMarginMultiplier(winnerScore, loserScore) 
    : 1.0
  
  // Calculate rating changes - SYMMETRIC: winner gains exactly what loser loses
  const delta = Math.round(avgK * marginMult * (1 - expectedWinner))
  const winnerDelta = delta
  const loserDelta = -delta
  
  // Calculate new ratings (with minimum floor)
  const newWinnerRating = Math.max(MIN_RATING, winnerRating + winnerDelta)
  const newLoserRating = Math.max(MIN_RATING, loserRating + loserDelta)
  
  return {
    winnerDelta,
    loserDelta,
    newWinnerRating,
    newLoserRating
  }
}

/**
 * Format ELO delta for display
 * 
 * @param delta - The rating change
 * @returns Formatted string with + or - prefix
 */
export function formatEloDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  return `${delta}`
}

/**
 * Get the rating tier as stars based on ELO
 * Adjusted for starting ELO of 800
 */
export function getRatingTier(rating: number): string {
  if (rating >= 1100) return '⭐⭐⭐⭐⭐'
  if (rating >= 1000) return '⭐⭐⭐⭐'
  if (rating >= 900) return '⭐⭐⭐'
  if (rating >= 850) return '⭐⭐'
  if (rating >= 800) return '⭐'
  return '☆'
}

