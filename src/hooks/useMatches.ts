/**
 * Custom hook for fetching and managing matches
 * Uses API for data persistence
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchMatches, createMatch as apiCreateMatch, deleteMatch as apiDeleteMatch, undoMatch as apiUndoMatch } from '../lib/api'
import type { Match, NewMatchInput } from '../types'

export function useMatches(playerId?: string) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMatches = useCallback(async () => {
    try {
      const data = await fetchMatches()
      // Convert date strings to Date objects
      let matchList: Match[] = data.map((m: Match & { createdAt: string }) => ({
        ...m,
        createdAt: new Date(m.createdAt)
      }))

      // Filter by player if specified
      if (playerId) {
        matchList = matchList.filter(
          (m) => m.playerAId === playerId || m.playerBId === playerId
        )
      }

      // Sort by date (newest first)
      matchList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      setMatches(matchList)
      setError(null)
    } catch (err) {
      console.error('Error fetching matches:', err)
      setError('Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [playerId])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  const createMatch = useCallback(async (input: NewMatchInput): Promise<void> => {
    await apiCreateMatch({
      playerAId: input.playerAId,
      playerBId: input.playerBId,
      playerAScore: input.playerAScore,
      playerBScore: input.playerBScore,
      matchType: input.matchType
    })
    await loadMatches() // Refresh list
  }, [loadMatches])

  const deleteMatch = useCallback(async (matchId: string): Promise<void> => {
    await apiDeleteMatch(matchId)
    await loadMatches() // Refresh list
  }, [loadMatches])

  const undoMatch = useCallback(async (matchId: string): Promise<void> => {
    await apiUndoMatch(matchId)
    await loadMatches() // Refresh list
  }, [loadMatches])

  const refresh = loadMatches

  return { matches, loading, error, createMatch, deleteMatch, undoMatch, refresh }
}
