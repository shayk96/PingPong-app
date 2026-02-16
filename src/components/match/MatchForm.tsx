/**
 * Match entry form
 * Allows users to log new matches
 */

import { useState, useMemo } from 'react'
import { Button, Select, Input } from '../ui'
import { validateMatch, getScoreExamples } from '../../lib/validation'
import type { User, NewMatchInput } from '../../types'

interface MatchFormProps {
  players: User[]
  currentUserId: string
  onSubmit: (input: NewMatchInput) => Promise<void>
  loading?: boolean
}

export function MatchForm({ players, currentUserId, onSubmit, loading }: MatchFormProps) {
  const [playerAId, setPlayerAId] = useState('')
  const [playerBId, setPlayerBId] = useState('')
  const [playerAScore, setPlayerAScore] = useState('')
  const [playerBScore, setPlayerBScore] = useState('')
  const matchType = 11 as const
  const [error, setError] = useState<string | null>(null)

  // Get player options (excluding already selected player)
  const playerAOptions = useMemo(() => 
    players.map(p => ({ value: p.id, label: p.displayName })),
    [players]
  )

  const playerBOptions = useMemo(() =>
    players
      .filter(p => p.id !== playerAId)
      .map(p => ({ value: p.id, label: p.displayName })),
    [players, playerAId]
  )

  // Pre-select current user as Player A
  useState(() => {
    if (currentUserId && !playerAId) {
      setPlayerAId(currentUserId)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const input: NewMatchInput = {
      playerAId,
      playerBId,
      playerAScore: parseInt(playerAScore) || 0,
      playerBScore: parseInt(playerBScore) || 0,
      matchType
    }

    // Validate
    const validation = validateMatch(input)
    if (!validation.isValid) {
      setError(validation.error || 'Invalid match data')
      return
    }

    try {
      await onSubmit(input)
      // Reset form on success
      setPlayerBId('')
      setPlayerAScore('')
      setPlayerBScore('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save match')
    }
  }

  const scoreExamples = getScoreExamples(matchType)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Player Selection */}
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Player 1"
          options={playerAOptions}
          value={playerAId}
          onChange={(e) => setPlayerAId(e.target.value)}
          placeholder="Select player"
        />
        <Select
          label="Player 2"
          options={playerBOptions}
          value={playerBId}
          onChange={(e) => setPlayerBId(e.target.value)}
          placeholder="Select player"
          disabled={!playerAId}
        />
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Player 1 Score"
          type="number"
          inputMode="numeric"
          min={0}
          max={30}
          value={playerAScore}
          onChange={(e) => setPlayerAScore(e.target.value)}
          placeholder="0"
        />
        <Input
          label="Player 2 Score"
          type="number"
          inputMode="numeric"
          min={0}
          max={30}
          value={playerBScore}
          onChange={(e) => setPlayerBScore(e.target.value)}
          placeholder="0"
        />
      </div>

      {/* Score hint */}
      <p className="text-xs text-gray-400 text-center">
        Valid scores: {scoreExamples.join(', ')}, etc.
      </p>

      {/* Error message */}
      {error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm text-center">
          {error}
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={loading}
        disabled={!playerAId || !playerBId || !playerAScore || !playerBScore}
      >
        Save Match
      </Button>
    </form>
  )
}

