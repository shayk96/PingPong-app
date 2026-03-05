/**
 * Custom hook for fetching and managing players
 * Uses API for data persistence
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchPlayers, createPlayer as apiCreatePlayer, deletePlayer as apiDeletePlayer } from '../lib/api'
import type { User } from '../types'

export function usePlayers() {
  const [players, setPlayers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPlayers = useCallback(async () => {
    try {
      const data = await fetchPlayers()
      // Convert date strings to Date objects and sort by ELO
      const playerList = data.map((p: User & { createdAt: string; lastPlayedAt?: string }) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        lastPlayedAt: p.lastPlayedAt ? new Date(p.lastPlayedAt) : undefined,
        seasonWins: p.seasonWins || []
      })).sort((a: User, b: User) => b.eloRating - a.eloRating)
      setPlayers(playerList)
      setError(null)
    } catch (err) {
      console.error('Error fetching players:', err)
      setError('Failed to load players')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlayers()
  }, [loadPlayers])

  const addPlayer = useCallback(async (displayName: string) => {
    const newPlayer = await apiCreatePlayer(displayName)
    await loadPlayers() // Refresh list
    return newPlayer
  }, [loadPlayers])

  const deletePlayer = useCallback(async (playerId: string, password: string) => {
    await apiDeletePlayer(playerId, password)
    await loadPlayers() // Refresh list
  }, [loadPlayers])

  const refresh = loadPlayers

  return { players, loading, error, addPlayer, deletePlayer, refresh }
}
