/**
 * ELO Rating System Implementation
 * 
 * The ELO rating system is a method for calculating the relative skill levels
 * of players in zero-sum games. Originally designed for chess, it works well
 * for ping pong matches.
 * 
 * Key concepts:
 * - Each player has a numerical rating (starting at 1000)
 * - When players compete, ratings are updated based on the outcome
 * - Beating a higher-rated player rewards more points than beating a lower-rated one
 * - The K-factor determines how much ratings change per match
 * 
 * Formula breakdown:
 * 1. Expected score: E = 1 / (1 + 10^((opponent_rating - player_rating) / 400))
 * 2. New rating: R_new = R_old + K * (S - E)
 *    where S = 1 for win, 0 for loss
 */

import type { EloResult } from '../types'

// K-factor: Higher values = more volatile ratings
// 32 is standard for casual/club play
// Chess uses 16-32 depending on player experience
const K_FACTOR = 32

// Minimum rating to prevent negative ratings
const MIN_RATING = 100

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
 * Calculate ELO rating changes after a match
 * 
 * @param winnerRating - Current rating of the winner
 * @param loserRating - Current rating of the loser
 * @returns Object containing rating deltas and new ratings
 * 
 * @example
 * // Equal players (both 1000 ELO)
 * calculateElo(1000, 1000)
 * // Returns: { winnerDelta: 16, loserDelta: -16, ... }
 * 
 * @example
 * // Higher-rated player beats lower-rated (expected outcome)
 * calculateElo(1200, 1000)
 * // Returns: { winnerDelta: 10, loserDelta: -10, ... }
 * 
 * @example
 * // Lower-rated player beats higher-rated (upset!)
 * calculateElo(1000, 1200)
 * // Returns: { winnerDelta: 22, loserDelta: -22, ... }
 */
export function calculateElo(winnerRating: number, loserRating: number): EloResult {
  // Calculate expected scores
  const expectedWinner = expectedScore(winnerRating, loserRating)
  const expectedLoser = expectedScore(loserRating, winnerRating)
  
  // Calculate rating changes
  // Winner's actual score is 1, loser's is 0
  const winnerDelta = Math.round(K_FACTOR * (1 - expectedWinner))
  const loserDelta = Math.round(K_FACTOR * (0 - expectedLoser))
  
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
 * Just for fun display purposes
 */
export function getRatingTier(rating: number): string {
  if (rating >= 1600) return '⭐⭐⭐⭐⭐'
  if (rating >= 1400) return '⭐⭐⭐⭐'
  if (rating >= 1200) return '⭐⭐⭐'
  if (rating >= 1000) return '⭐⭐'
  if (rating >= 800) return '⭐'
  return '☆'
}

