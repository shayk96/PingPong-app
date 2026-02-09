/**
 * Weird Stats Generator
 * 
 * Mines cherry-picked, broadcast-style quirky stats from match data.
 * Each generator function tries to find something interesting and returns
 * a stat string (or null if nothing noteworthy is found).
 */

import type { Match, User } from '../types'

export interface WeirdStat {
  text: string
  emoji: string
}

type StatGenerator = (matches: Match[], players: User[]) => WeirdStat | null

// ============ Helpers ============

function getPlayerName(players: User[], id: string): string {
  return players.find(p => p.id === id)?.displayName || 'Unknown'
}

function getPlayerMatches(matches: Match[], playerId: string): Match[] {
  return matches.filter(m => m.winnerId === playerId || m.loserId === playerId)
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

// ============ Stat Generators ============

/**
 * "X has won their last Y games straight"
 */
const currentWinStreak: StatGenerator = (matches, players) => {
  const sorted = [...matches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  for (const player of players) {
    const playerMatches = sorted.filter(m => m.winnerId === player.id || m.loserId === player.id)
    if (playerMatches.length < 4) continue

    let streak = 0
    for (const m of playerMatches) {
      if (m.winnerId === player.id) streak++
      else break
    }

    if (streak >= 4) {
      return {
        text: `${player.displayName} has won ${streak} straight games`,
        emoji: '🔥'
      }
    }
  }
  return null
}

/**
 * "X is on a Y-game losing streak"
 */
const currentLossStreak: StatGenerator = (matches, players) => {
  const sorted = [...matches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  for (const player of players) {
    const playerMatches = sorted.filter(m => m.winnerId === player.id || m.loserId === player.id)
    if (playerMatches.length < 4) continue

    let streak = 0
    for (const m of playerMatches) {
      if (m.loserId === player.id) streak++
      else break
    }

    if (streak >= 4) {
      return {
        text: `${player.displayName} is on a ${streak}-game losing streak`,
        emoji: '📉'
      }
    }
  }
  return null
}

/**
 * "X is undefeated on [day]s" (min 3 games on that day)
 */
const undefeatedOnDay: StatGenerator = (matches, players) => {
  for (const player of players) {
    const playerMatches = matches.filter(m => m.winnerId === player.id || m.loserId === player.id)
    if (playerMatches.length < 5) continue

    const dayStats = new Map<string, { wins: number; total: number }>()

    for (const m of playerMatches) {
      const day = getDayName(m.createdAt)
      if (!dayStats.has(day)) dayStats.set(day, { wins: 0, total: 0 })
      const stat = dayStats.get(day)!
      stat.total++
      if (m.winnerId === player.id) stat.wins++
    }

    for (const [day, stat] of dayStats) {
      if (stat.total >= 3 && stat.wins === stat.total) {
        return {
          text: `${player.displayName} is undefeated on ${day}s (${stat.wins}-0)`,
          emoji: '📅'
        }
      }
    }
  }
  return null
}

/**
 * "X has a Y% win rate on [day]s" (notably high or low, min 4 games)
 */
const dayOfWeekWinRate: StatGenerator = (matches, players) => {
  let best: { player: string; day: string; rate: number; wins: number; total: number } | null = null

  for (const player of players) {
    const playerMatches = matches.filter(m => m.winnerId === player.id || m.loserId === player.id)
    if (playerMatches.length < 5) continue

    const dayStats = new Map<string, { wins: number; total: number }>()

    for (const m of playerMatches) {
      const day = getDayName(m.createdAt)
      if (!dayStats.has(day)) dayStats.set(day, { wins: 0, total: 0 })
      const stat = dayStats.get(day)!
      stat.total++
      if (m.winnerId === player.id) stat.wins++
    }

    for (const [day, stat] of dayStats) {
      if (stat.total >= 4) {
        const rate = Math.round((stat.wins / stat.total) * 100)
        if (rate >= 80 && (!best || rate > best.rate)) {
          best = { player: player.displayName, day, rate, wins: stat.wins, total: stat.total }
        }
      }
    }
  }

  if (best) {
    return {
      text: `${best.player} wins ${best.rate}% of games on ${best.day}s (${best.wins}/${best.total})`,
      emoji: '📊'
    }
  }
  return null
}

/**
 * "X has never lost to Y (W-0)"
 */
const perfectRecord: StatGenerator = (matches, players) => {
  for (const playerA of players) {
    for (const playerB of players) {
      if (playerA.id >= playerB.id) continue

      const h2h = matches.filter(m =>
        (m.playerAId === playerA.id && m.playerBId === playerB.id) ||
        (m.playerAId === playerB.id && m.playerBId === playerA.id)
      )

      if (h2h.length < 3) continue

      const aWins = h2h.filter(m => m.winnerId === playerA.id).length
      const bWins = h2h.filter(m => m.winnerId === playerB.id).length

      if (aWins === h2h.length) {
        return {
          text: `${playerA.displayName} has never lost to ${playerB.displayName} (${aWins}-0)`,
          emoji: '🛡️'
        }
      }
      if (bWins === h2h.length) {
        return {
          text: `${playerB.displayName} has never lost to ${playerA.displayName} (${bWins}-0)`,
          emoji: '🛡️'
        }
      }
    }
  }
  return null
}

/**
 * "X and Y are dead even at W-W"
 */
const deadEvenRivalry: StatGenerator = (matches, players) => {
  let bestTied: { a: string; b: string; wins: number } | null = null

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const h2h = matches.filter(m =>
        (m.playerAId === players[i].id && m.playerBId === players[j].id) ||
        (m.playerAId === players[j].id && m.playerBId === players[i].id)
      )
      if (h2h.length < 4) continue

      const aWins = h2h.filter(m => m.winnerId === players[i].id).length
      const bWins = h2h.filter(m => m.winnerId === players[j].id).length

      if (aWins === bWins && (!bestTied || aWins > bestTied.wins)) {
        bestTied = { a: players[i].displayName, b: players[j].displayName, wins: aWins }
      }
    }
  }

  if (bestTied) {
    return {
      text: `${bestTied.a} and ${bestTied.b} are dead even at ${bestTied.wins}-${bestTied.wins}`,
      emoji: '⚖️'
    }
  }
  return null
}

/**
 * "X has won Y deuce games in a row"
 */
const deuceStreak: StatGenerator = (matches, players) => {
  const sorted = [...matches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  for (const player of players) {
    const deuceMatches = sorted.filter(m => {
      const isInvolved = m.winnerId === player.id || m.loserId === player.id
      const isDeuceGame = Math.abs(m.playerAScore - m.playerBScore) === 2 &&
        Math.min(m.playerAScore, m.playerBScore) >= (m.matchType - 1)
      return isInvolved && isDeuceGame
    })

    if (deuceMatches.length < 3) continue

    let streak = 0
    for (const m of deuceMatches) {
      if (m.winnerId === player.id) streak++
      else break
    }

    if (streak >= 3) {
      return {
        text: `${player.displayName} has won ${streak} straight deuce games`,
        emoji: '😤'
      }
    }
  }
  return null
}

/**
 * "X wins by an average of Y points"
 */
const biggestDominator: StatGenerator = (matches, players) => {
  let best: { name: string; avg: number; count: number } | null = null

  for (const player of players) {
    const wins = matches.filter(m => m.winnerId === player.id)
    if (wins.length < 5) continue

    const totalMargin = wins.reduce((sum, m) => {
      return sum + Math.abs(m.playerAScore - m.playerBScore)
    }, 0)
    const avg = totalMargin / wins.length

    if (!best || avg > best.avg) {
      best = { name: player.displayName, avg: Math.round(avg * 10) / 10, count: wins.length }
    }
  }

  if (best && best.avg >= 4) {
    return {
      text: `${best.name} wins by an average of ${best.avg} points`,
      emoji: '💪'
    }
  }
  return null
}

/**
 * "X has gained Y ELO in their last Z matches"
 */
const recentEloSurge: StatGenerator = (matches, players) => {
  const sorted = [...matches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  let best: { name: string; gain: number; count: number } | null = null

  for (const player of players) {
    const recent = sorted
      .filter(m => m.winnerId === player.id || m.loserId === player.id)
      .slice(0, 10)

    if (recent.length < 4) continue

    const eloChange = recent.reduce((sum, m) => {
      if (m.winnerId === player.id) return sum + m.winnerEloDelta
      return sum + m.loserEloDelta
    }, 0)

    if (eloChange > 0 && (!best || eloChange > best.gain)) {
      best = { name: player.displayName, gain: Math.round(eloChange), count: recent.length }
    }
  }

  if (best && best.gain >= 30) {
    return {
      text: `${best.name} has gained ${best.gain} ELO in their last ${best.count} games`,
      emoji: '📈'
    }
  }
  return null
}

/**
 * "X and Y have played the most games together (Z matches)"
 */
const mostFrequentMatchup: StatGenerator = (matches, players) => {
  let best: { a: string; b: string; count: number } | null = null

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const h2h = matches.filter(m =>
        (m.playerAId === players[i].id && m.playerBId === players[j].id) ||
        (m.playerAId === players[j].id && m.playerBId === players[i].id)
      )
      if (!best || h2h.length > best.count) {
        best = { a: players[i].displayName, b: players[j].displayName, count: h2h.length }
      }
    }
  }

  if (best && best.count >= 5) {
    return {
      text: `${best.a} vs ${best.b} is the most played rivalry (${best.count} games)`,
      emoji: '⚔️'
    }
  }
  return null
}

/**
 * "X has won Y of their last Z first-to-21 games"
 */
const matchTypeSpecialist: StatGenerator = (matches, players) => {
  for (const player of players) {
    for (const type of [21, 11] as const) {
      const typeMatches = matches
        .filter(m =>
          (m.winnerId === player.id || m.loserId === player.id) &&
          m.matchType === type
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 8)

      if (typeMatches.length < 4) continue

      const wins = typeMatches.filter(m => m.winnerId === player.id).length
      const rate = wins / typeMatches.length

      if (rate >= 0.85) {
        return {
          text: `${player.displayName} has won ${wins} of their last ${typeMatches.length} first-to-${type} games`,
          emoji: type === 21 ? '🏅' : '⚡'
        }
      }
    }
  }
  return null
}

/**
 * "The last X games between A and B were all decided by 2 points"
 */
const alwaysClose: StatGenerator = (matches, players) => {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const h2h = matches
        .filter(m =>
          (m.playerAId === players[i].id && m.playerBId === players[j].id) ||
          (m.playerAId === players[j].id && m.playerBId === players[i].id)
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      if (h2h.length < 3) continue

      let closeCount = 0
      for (const m of h2h) {
        if (Math.abs(m.playerAScore - m.playerBScore) === 2 &&
          Math.min(m.playerAScore, m.playerBScore) >= (m.matchType - 1)) {
          closeCount++
        } else break
      }

      if (closeCount >= 3) {
        return {
          text: `The last ${closeCount} games between ${players[i].displayName} and ${players[j].displayName} all went to deuce`,
          emoji: '🤯'
        }
      }
    }
  }
  return null
}

/**
 * "X hasn't lost since [date]"
 */
const unbeatenSince: StatGenerator = (matches, players) => {
  const sorted = [...matches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  for (const player of players) {
    const playerMatches = sorted.filter(m => m.winnerId === player.id || m.loserId === player.id)
    if (playerMatches.length < 5) continue

    let streak = 0
    for (const m of playerMatches) {
      if (m.winnerId === player.id) streak++
      else break
    }

    if (streak >= 5) {
      const oldestWin = playerMatches[streak - 1]
      const date = oldestWin.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return {
        text: `${player.displayName} hasn't lost since ${date} (${streak} games)`,
        emoji: '👑'
      }
    }
  }
  return null
}

/**
 * "X allows only Y points per game on average"
 */
const stingiestDefender: StatGenerator = (matches, players) => {
  let best: { name: string; avg: number; count: number } | null = null

  for (const player of players) {
    const playerMatches = matches.filter(m => m.winnerId === player.id || m.loserId === player.id)
    if (playerMatches.length < 5) continue

    const totalPointsAllowed = playerMatches.reduce((sum, m) => {
      if (m.playerAId === player.id) return sum + m.playerBScore
      return sum + m.playerAScore
    }, 0)

    const avg = totalPointsAllowed / playerMatches.length

    if (!best || avg < best.avg) {
      best = { name: player.displayName, avg: Math.round(avg * 10) / 10, count: playerMatches.length }
    }
  }

  if (best && best.avg <= 8) {
    return {
      text: `${best.name} allows only ${best.avg} points per game on average`,
      emoji: '🧱'
    }
  }
  return null
}

/**
 * "There have been X deuce games out of Y total (Z%)"
 */
const deuceRate: StatGenerator = (matches) => {
  if (matches.length < 10) return null

  const deuceGames = matches.filter(m => {
    const minScore = Math.min(m.playerAScore, m.playerBScore)
    return Math.abs(m.playerAScore - m.playerBScore) === 2 && minScore >= (m.matchType - 1)
  })

  const rate = Math.round((deuceGames.length / matches.length) * 100)

  if (rate >= 25) {
    return {
      text: `${rate}% of all games go to deuce (${deuceGames.length} out of ${matches.length})`,
      emoji: '🎯'
    }
  }
  return null
}

// ============ Main Export ============

const allGenerators: StatGenerator[] = [
  unbeatenSince,
  currentWinStreak,
  currentLossStreak,
  alwaysClose,
  deuceStreak,
  perfectRecord,
  undefeatedOnDay,
  deadEvenRivalry,
  recentEloSurge,
  matchTypeSpecialist,
  dayOfWeekWinRate,
  biggestDominator,
  mostFrequentMatchup,
  stingiestDefender,
  deuceRate,
]

/**
 * Generate a list of weird/cherry-picked stats from match data.
 * Returns all stats that pass the threshold, shuffled for variety.
 */
export function generateWeirdStats(matches: Match[], players: User[]): WeirdStat[] {
  if (matches.length < 3 || players.length < 2) return []

  // Ensure dates are Date objects
  const processedMatches = matches.map(m => ({
    ...m,
    createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)
  }))

  const stats: WeirdStat[] = []

  for (const generator of allGenerators) {
    try {
      const stat = generator(processedMatches, players)
      if (stat) stats.push(stat)
    } catch {
      // Skip failed generators silently
    }
  }

  // Shuffle using Fisher-Yates
  for (let i = stats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [stats[i], stats[j]] = [stats[j], stats[i]]
  }

  return stats
}
