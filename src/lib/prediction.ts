/**
 * "For fun" score prediction: simulates a game to 11 (win by 2) point by point.
 * The per-point win chance is chosen so the simulated game matches the given
 * game-win probability; each won point is lucky at the player's historical rate.
 */

import type { Match } from '../types'

export interface PredictedGame {
  scoreA: number
  scoreB: number
  luckyA: number
  luckyB: number
}

function binomial(n: number, k: number): number {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/** Chance of winning a game to 11 (win by 2) when each point is won with probability q */
function gameWinProb(q: number): number {
  const p = 1 - q
  let win = 0
  for (let k = 0; k <= 9; k++) win += binomial(10 + k, k) * q ** 11 * p ** k
  const deuce = binomial(20, 10) * q ** 10 * p ** 10
  return win + deuce * (q * q) / (q * q + p * p)
}

/** Per-point win probability that yields the given game-win probability */
export function pointWinProb(gameProb: number): number {
  const target = Math.min(0.99, Math.max(0.01, gameProb))
  let lo = 0.01
  let hi = 0.99
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (gameWinProb(mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Share of a player's points that were lucky, counted from when lucky tracking began */
export function luckyRate(matches: Match[], playerId: string): number {
  const tracked = matches.filter(m => (m.playerALuckyPoints || 0) > 0 || (m.playerBLuckyPoints || 0) > 0)
  if (tracked.length === 0) return 0
  const start = Math.min(...tracked.map(m => m.createdAt.getTime()))
  let lucky = 0
  let points = 0
  for (const m of matches) {
    if (m.createdAt.getTime() < start) continue
    if (m.playerAId === playerId) {
      lucky += m.playerALuckyPoints || 0
      points += m.playerAScore
    } else if (m.playerBId === playerId) {
      lucky += m.playerBLuckyPoints || 0
      points += m.playerBScore
    }
  }
  return points > 0 ? lucky / points : 0
}

export function simulateGame(
  probA: number,
  luckyRateA: number,
  luckyRateB: number,
  random: () => number = Math.random
): PredictedGame {
  const q = pointWinProb(probA)
  const game: PredictedGame = { scoreA: 0, scoreB: 0, luckyA: 0, luckyB: 0 }
  while (
    (game.scoreA < 11 && game.scoreB < 11) ||
    Math.abs(game.scoreA - game.scoreB) < 2
  ) {
    if (random() < q) {
      game.scoreA++
      if (random() < luckyRateA) game.luckyA++
    } else {
      game.scoreB++
      if (random() < luckyRateB) game.luckyB++
    }
  }
  return game
}
