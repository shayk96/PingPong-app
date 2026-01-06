/**
 * Match Validation Logic
 * 
 * Ensures matches are valid according to ping pong rules:
 * - Proper scoring (first to 11 or 21)
 * - Win by 2 rule (deuce handling)
 * - Different players
 */

import type { NewMatchInput, ValidationResult } from '../types'

/**
 * Validate a new match input
 * 
 * Rules:
 * 1. Players must be different (can't play against yourself)
 * 2. Match type must be 11 or 21
 * 3. Winner must reach exactly the target score (or target + 1 in deuce)
 * 4. Loser must have fewer points than winner
 * 5. Win by 2 rule: if loser has target-1 points, winner needs target+1
 * 
 * @param input - The match data to validate
 * @returns Validation result with isValid flag and optional error message
 */
export function validateMatch(input: NewMatchInput): ValidationResult {
  const { playerAId, playerBId, playerAScore, playerBScore, matchType } = input

  // Rule 1: Different players
  if (playerAId === playerBId) {
    return {
      isValid: false,
      error: 'A player cannot play against themselves'
    }
  }

  // Rule 2: Valid match type
  if (matchType !== 11 && matchType !== 21) {
    return {
      isValid: false,
      error: 'Match type must be 11 or 21'
    }
  }

  // Rule 3: Scores must be non-negative
  if (playerAScore < 0 || playerBScore < 0) {
    return {
      isValid: false,
      error: 'Scores cannot be negative'
    }
  }

  // Determine winner and loser scores
  const winnerScore = Math.max(playerAScore, playerBScore)
  const loserScore = Math.min(playerAScore, playerBScore)

  // Rule 4: Someone must win (can't be a tie)
  if (playerAScore === playerBScore) {
    return {
      isValid: false,
      error: 'Match cannot end in a tie'
    }
  }

  // Rule 5: Winner must reach the target score
  // Standard win: exactly matchType points (e.g., 11-8)
  // Deuce win: matchType + 1 or more, with exactly 2 point margin (e.g., 12-10, 13-11)
  
  const isStandardWin = winnerScore === matchType && loserScore < matchType - 1
  const isDeuceWin = winnerScore >= matchType && 
                     loserScore >= matchType - 1 && 
                     winnerScore - loserScore === 2

  if (!isStandardWin && !isDeuceWin) {
    // Provide helpful error message based on the issue
    if (winnerScore < matchType) {
      return {
        isValid: false,
        error: `Winner must reach at least ${matchType} points`
      }
    }
    
    if (winnerScore > matchType && loserScore < matchType - 1) {
      return {
        isValid: false,
        error: `Invalid score. Standard game should end at ${matchType} points`
      }
    }
    
    if (loserScore >= matchType - 1 && winnerScore - loserScore !== 2) {
      return {
        isValid: false,
        error: 'In deuce, winner must win by exactly 2 points'
      }
    }

    return {
      isValid: false,
      error: 'Invalid score combination'
    }
  }

  return { isValid: true }
}

/**
 * Validate score as user types
 * Provides real-time feedback without being too strict
 */
export function validateScoreInput(score: string): { isValid: boolean; value: number } {
  // Empty is valid (user is typing)
  if (score === '') {
    return { isValid: true, value: 0 }
  }

  const num = parseInt(score, 10)
  
  // Must be a valid number
  if (isNaN(num)) {
    return { isValid: false, value: 0 }
  }

  // Must be non-negative
  if (num < 0) {
    return { isValid: false, value: 0 }
  }

  // Reasonable upper bound (no one scores 100 points in ping pong)
  if (num > 30) {
    return { isValid: false, value: 30 }
  }

  return { isValid: true, value: num }
}

/**
 * Get example valid scores for a match type
 * Used in UI hints
 */
export function getScoreExamples(matchType: 11 | 21): string[] {
  if (matchType === 11) {
    return ['11-8', '11-9', '12-10', '13-11']
  }
  return ['21-18', '21-19', '22-20', '23-21']
}

