/**
 * New Match page
 * Form to log a new ping pong match
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { validateMatch } from '../lib/validation'
import { ToastContainer, useToast, Button, Select } from '../components/ui'
import type { NewMatchInput, MatchType } from '../types'

export default function NewMatch() {
  const navigate = useNavigate()
  const { players, loading: playersLoading, refresh: refreshPlayers } = usePlayers()
  const { createMatch } = useMatches()
  const { toasts, showToast, removeToast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [playerAId, setPlayerAId] = useState('')
  const [playerBId, setPlayerBId] = useState('')
  const [playerAScore, setPlayerAScore] = useState('')
  const [playerBScore, setPlayerBScore] = useState('')
  const [matchType, setMatchType] = useState<MatchType>(11)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
      showToast(validation.error || 'Invalid match data', 'error')
      return
    }

    setSubmitting(true)
    try {
      await createMatch(input)
      await refreshPlayers() // Refresh to get updated ELO
      showToast('Match saved successfully!', 'success')
      
      // Navigate to leaderboard after short delay
      setTimeout(() => {
        navigate('/leaderboard')
      }, 1000)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save match',
        'error'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Filter out the other player and sort alphabetically
  const playerAOptions = players
    .filter(p => p.id !== playerBId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
  const playerBOptions = players
    .filter(p => p.id !== playerAId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  if (playersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-accent"></div>
      </div>
    )
  }

  // Need at least 2 players to create a match
  if (players.length < 2) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <header className="mb-6 safe-top pt-2">
          <h1 className="text-2xl font-display font-bold text-white">
            New Match
          </h1>
        </header>
        
        <div className="text-center py-12">
          <div className="text-6xl mb-4">👥</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Need More Players
          </h2>
          <p className="text-gray-400 mb-4">
            At least 2 players needed to log matches.
          </p>
          <Button onClick={() => navigate('/leaderboard')} variant="primary">
            Add Players
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <header className="mb-6 safe-top pt-2">
        <h1 className="text-2xl font-display font-bold text-white">
          New Match
        </h1>
        <p className="text-gray-400 text-sm">
          Log your latest ping pong battle
        </p>
      </header>

      {/* Match Form */}
      <form onSubmit={handleSubmit} className="bg-background-light rounded-2xl p-5 border border-background-lighter">
        {/* Match Type */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Game Type
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMatchType(11)}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                matchType === 11
                  ? 'bg-accent text-white'
                  : 'bg-background text-gray-400 hover:bg-background-lighter'
              }`}
            >
              First to 11
            </button>
            <button
              type="button"
              onClick={() => setMatchType(21)}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                matchType === 21
                  ? 'bg-accent text-white'
                  : 'bg-background text-gray-400 hover:bg-background-lighter'
              }`}
            >
              First to 21
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Select
            label="Player 1"
            value={playerAId}
            onChange={(e) => setPlayerAId(e.target.value)}
            options={[
              { value: '', label: 'Select player' },
              ...playerAOptions.map(p => ({ value: p.id, label: p.displayName }))
            ]}
          />
          <Select
            label="Player 2"
            value={playerBId}
            onChange={(e) => setPlayerBId(e.target.value)}
            options={[
              { value: '', label: 'Select player' },
              ...playerBOptions.map(p => ({ value: p.id, label: p.displayName }))
            ]}
          />
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {playerAId ? players.find(p => p.id === playerAId)?.displayName : 'Player 1'} Score
            </label>
            <input
              type="number"
              min="0"
              max="99"
              value={playerAScore}
              onChange={(e) => setPlayerAScore(e.target.value)}
              className="w-full bg-background border border-background-lighter rounded-xl px-4 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {playerBId ? players.find(p => p.id === playerBId)?.displayName : 'Player 2'} Score
            </label>
            <input
              type="number"
              min="0"
              max="99"
              value={playerBScore}
              onChange={(e) => setPlayerBScore(e.target.value)}
              className="w-full bg-background border border-background-lighter rounded-xl px-4 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="0"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/leaderboard')}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!playerAId || !playerBId || !playerAScore || !playerBScore}
            className="flex-1"
          >
            Save Match
          </Button>
        </div>
      </form>

      {/* Tips */}
      <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-xl">
        <h3 className="font-semibold text-white mb-2">📝 Quick Tips</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Select both players before entering scores</li>
          <li>• Winner must reach {matchType} points</li>
          <li>• Win by 2 in deuce situations (e.g., {matchType + 1}-{matchType - 1})</li>
        </ul>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
