import type { User } from '../types'

export interface RoomMatch {
  id: number
  playerA: User
  playerB: User
  status: 'pending' | 'playing' | 'done'
  result?: {
    scoreA: number
    scoreB: number
    winnerId: string
    loserId: string
  }
}

export type RoomMode = '3-player' | '4-player' | '5-plus'

export function getRoomMode(count: number): RoomMode {
  if (count === 3) return '3-player'
  if (count === 4) return '4-player'
  return '5-plus'
}

// Fisher-Yates shuffle
export function shufflePlayers(players: User[]): User[] {
  const arr = [...players]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// --- 3-player round ---
// Match 1: A vs B
// Match 2: Winner(1) vs C
// Match 3: Loser(1) vs C
export function generate3PlayerRound(players: User[]): RoomMatch[] {
  const [a, b, c] = players
  return [
    { id: 0, playerA: a, playerB: b, status: 'pending' },
    { id: 1, playerA: c, playerB: c, status: 'pending' }, // placeholder, resolved after match 0
    { id: 2, playerA: c, playerB: c, status: 'pending' }, // placeholder, resolved after match 0
  ]
}

export function resolve3PlayerMatch(
  matches: RoomMatch[],
  completedIndex: number,
  players: User[]
): RoomMatch[] {
  const updated = matches.map(m => ({ ...m }))
  const [, , c] = players

  if (completedIndex === 0) {
    const result = updated[0].result!
    const winner = result.winnerId === updated[0].playerA.id ? updated[0].playerA : updated[0].playerB
    const loser = result.winnerId === updated[0].playerA.id ? updated[0].playerB : updated[0].playerA
    updated[1] = { ...updated[1], playerA: winner, playerB: c }
    updated[2] = { ...updated[2], playerA: loser, playerB: c }
  }
  return updated
}

// --- 4-player round ---
// Match 0: A vs B
// Match 1: C vs D
// Match 2: Winner(0) vs Winner(1)
// Match 3: Loser(0) vs Loser(1)
// Match 4: 2-win player vs winner of match 3
// Match 5: remaining two
export function generate4PlayerRound(players: User[]): RoomMatch[] {
  const [a, b, c, d] = players
  const placeholder = players[0] // will be overwritten
  return [
    { id: 0, playerA: a, playerB: b, status: 'pending' },
    { id: 1, playerA: c, playerB: d, status: 'pending' },
    { id: 2, playerA: placeholder, playerB: placeholder, status: 'pending' },
    { id: 3, playerA: placeholder, playerB: placeholder, status: 'pending' },
    { id: 4, playerA: placeholder, playerB: placeholder, status: 'pending' },
    { id: 5, playerA: placeholder, playerB: placeholder, status: 'pending' },
  ]
}

export function resolve4PlayerMatch(
  matches: RoomMatch[],
  completedIndex: number
): RoomMatch[] {
  const updated = matches.map(m => ({ ...m }))

  const getWinner = (m: RoomMatch) =>
    m.result!.winnerId === m.playerA.id ? m.playerA : m.playerB
  const getLoser = (m: RoomMatch) =>
    m.result!.loserId === m.playerA.id ? m.playerA : m.playerB

  if (completedIndex === 0 && updated[1].status === 'done') {
    updated[2] = { ...updated[2], playerA: getWinner(updated[0]), playerB: getWinner(updated[1]) }
    updated[3] = { ...updated[3], playerA: getLoser(updated[0]), playerB: getLoser(updated[1]) }
  } else if (completedIndex === 1 && updated[0].status === 'done') {
    updated[2] = { ...updated[2], playerA: getWinner(updated[0]), playerB: getWinner(updated[1]) }
    updated[3] = { ...updated[3], playerA: getLoser(updated[0]), playerB: getLoser(updated[1]) }
  }

  if (completedIndex <= 3 && updated[2].status === 'done' && updated[3].status === 'done') {
    const twoWinPlayer = getWinner(updated[2]) // won match 0 or 1, then won match 2
    const winnerOfLosers = getWinner(updated[3])
    const loserOfWinners = getLoser(updated[2])
    const twoLossPlayer = getLoser(updated[3])
    updated[4] = { ...updated[4], playerA: twoWinPlayer, playerB: winnerOfLosers }
    updated[5] = { ...updated[5], playerA: loserOfWinners, playerB: twoLossPlayer }
  }

  return updated
}

// --- 5+ players ---
// Pair up players, odd one plays winner of game 1.
// Smart scheduling for subsequent rounds.

export interface PlayedPair {
  a: string
  b: string
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}

export function generate5PlusRound(
  players: User[],
  playedPairs: Set<string>,
  gamesPlayedCount: Map<string, number>
): RoomMatch[] {
  const sorted = smartShuffle(players, gamesPlayedCount)
  const paired = smartPair(sorted, playedPairs)
  const matches: RoomMatch[] = []

  paired.forEach(([a, b], i) => {
    matches.push({ id: i, playerA: a, playerB: b, status: 'pending' })
  })

  return matches
}

// Sort players so those who played least go first, with randomness among ties
function smartShuffle(players: User[], gamesPlayed: Map<string, number>): User[] {
  const arr = [...players]
  // Shuffle first to randomize among ties
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  // Stable sort by games played (ascending) — those who waited get priority
  arr.sort((a, b) => (gamesPlayed.get(a.id) || 0) - (gamesPlayed.get(b.id) || 0))
  return arr
}

// Pair players while avoiding repeat matchups when possible
function smartPair(
  sortedPlayers: User[],
  playedPairs: Set<string>
): [User, User][] {
  const pairs: [User, User][] = []
  const used = new Set<string>()

  // Greedy: take next unpaired player, find best partner
  for (const player of sortedPlayers) {
    if (used.has(player.id)) continue

    let bestPartner: User | null = null
    for (const candidate of sortedPlayers) {
      if (candidate.id === player.id || used.has(candidate.id)) continue
      const key = pairKey(player.id, candidate.id)
      if (!playedPairs.has(key)) {
        bestPartner = candidate
        break
      }
      if (!bestPartner) bestPartner = candidate
    }

    if (bestPartner) {
      pairs.push([player, bestPartner])
      used.add(player.id)
      used.add(bestPartner.id)
    }
  }

  return pairs
}

// After game 1 in a 5+ round with odd players, the leftover plays the winner
export function getOddPlayerMatch(
  players: User[],
  pairedPlayerIds: Set<string>,
  game1Winner: User,
  matchIdStart: number
): RoomMatch | null {
  const leftover = players.find(p => !pairedPlayerIds.has(p.id))
  if (!leftover) return null
  return {
    id: matchIdStart,
    playerA: leftover,
    playerB: game1Winner,
    status: 'pending',
  }
}

export function addPlayedPair(pairs: Set<string>, a: string, b: string): Set<string> {
  const next = new Set(pairs)
  next.add(pairKey(a, b))
  return next
}

export function totalMatchesInRound(playerCount: number, mode: RoomMode): number | null {
  if (mode === '3-player') return 3
  if (mode === '4-player') return 6
  // 5+: floor(N/2) pairs + possibly 1 odd-player match
  return Math.ceil(playerCount / 2)
}
