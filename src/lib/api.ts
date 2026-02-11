/**
 * API client for communicating with the backend server
 */

// In production, use relative URL (same origin), in development use localhost
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')

// ============ Players ============

export async function fetchPlayers() {
  const res = await fetch(`${API_URL}/players`)
  if (!res.ok) throw new Error('Failed to fetch players')
  return res.json()
}

export async function createPlayer(displayName: string) {
  const res = await fetch(`${API_URL}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName })
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to create player')
  }
  return res.json()
}

export async function deletePlayer(playerId: string, password: string) {
  const res = await fetch(`${API_URL}/players/${playerId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete player')
  }
  return res.json()
}

// ============ Matches ============

export async function fetchMatches() {
  const res = await fetch(`${API_URL}/matches`)
  if (!res.ok) throw new Error('Failed to fetch matches')
  return res.json()
}

export async function createMatch(data: {
  playerAId: string
  playerBId: string
  playerAScore: number
  playerBScore: number
  matchType: number
}) {
  const res = await fetch(`${API_URL}/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to create match')
  }
  return res.json()
}

export async function undoMatch(matchId: string) {
  const res = await fetch(`${API_URL}/matches/${matchId}/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to undo match')
  }
  return res.json()
}

export async function deleteMatch(matchId: string) {
  const res = await fetch(`${API_URL}/matches/${matchId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete match')
  }
  return res.json()
}

// ============ ELO History ============

export interface EloHistoryEntry {
  playerId: string
  eloRating: number
  matchId: string | null
  timestamp: string
}

export async function fetchEloHistory(playerIds?: string[]): Promise<EloHistoryEntry[]> {
  const url = playerIds && playerIds.length > 0
    ? `${API_URL}/elo-history?playerIds=${playerIds.join(',')}`
    : `${API_URL}/elo-history`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch ELO history')
  return res.json()
}

// ============ Health Check ============

export async function checkHealth() {
  try {
    const res = await fetch(`${API_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}
