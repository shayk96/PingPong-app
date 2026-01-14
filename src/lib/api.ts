/**
 * API client for communicating with the backend server
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

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

export async function deleteMatch(matchId: string, password: string) {
  const res = await fetch(`${API_URL}/matches/${matchId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete match')
  }
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
