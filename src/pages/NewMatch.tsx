/**
 * New Match page
 * Form to log a new ping pong match
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { validateMatch } from '../lib/validation'
import { ToastContainer, useToast, Button } from '../components/ui'
import type { NewMatchInput, MatchType, User } from '../types'

export default function NewMatch() {
  const navigate = useNavigate()
  const { players, loading: playersLoading, refresh: refreshPlayers } = usePlayers()
  const { createMatch } = useMatches()
  const { toasts, showToast, removeToast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [playerA, setPlayerA] = useState<User | null>(null)
  const [playerB, setPlayerB] = useState<User | null>(null)
  const [playerAScore, setPlayerAScore] = useState('')
  const [playerBScore, setPlayerBScore] = useState('')
  const [matchType, setMatchType] = useState<MatchType>(11)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!playerA || !playerB) {
      showToast('Please select both players', 'error')
      return
    }

    const input: NewMatchInput = {
      playerAId: playerA.id,
      playerBId: playerB.id,
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

  // Sort players alphabetically
  const sortedPlayers = [...players].sort((a, b) => 
    a.displayName.localeCompare(b.displayName)
  )

  const selectPlayer = (player: User, slot: 'A' | 'B') => {
    if (slot === 'A') {
      if (playerB?.id === player.id) setPlayerB(null)
      setPlayerA(player)
    } else {
      if (playerA?.id === player.id) setPlayerA(null)
      setPlayerB(player)
    }
  }

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
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Match Type */}
        <div className="bg-background-light rounded-2xl p-4 border border-background-lighter">
          <label className="block text-sm font-medium text-gray-300 mb-3">
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

        {/* Players Selection */}
        <div className="bg-background-light rounded-2xl p-4 border border-background-lighter">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Select Players
          </label>
          
          {/* Selected Players Display */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div 
              className={`p-4 rounded-xl border-2 border-dashed text-center transition-all ${
                playerA 
                  ? 'border-accent bg-accent/10' 
                  : 'border-background-lighter'
              }`}
            >
              {playerA ? (
                <div>
                  <div className="text-white font-semibold">{playerA.displayName}</div>
                  <div className="text-xs text-gray-400">{playerA.eloRating} ELO</div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Player 1</div>
              )}
            </div>
            <div 
              className={`p-4 rounded-xl border-2 border-dashed text-center transition-all ${
                playerB 
                  ? 'border-accent bg-accent/10' 
                  : 'border-background-lighter'
              }`}
            >
              {playerB ? (
                <div>
                  <div className="text-white font-semibold">{playerB.displayName}</div>
                  <div className="text-xs text-gray-400">{playerB.eloRating} ELO</div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Player 2</div>
              )}
            </div>
          </div>

          {/* Player Grid */}
          <div className="grid grid-cols-3 gap-2">
            {sortedPlayers.map((player) => {
              const isSelectedA = playerA?.id === player.id
              const isSelectedB = playerB?.id === player.id
              const isSelected = isSelectedA || isSelectedB
              
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    if (isSelectedA) {
                      setPlayerA(null)
                    } else if (isSelectedB) {
                      setPlayerB(null)
                    } else if (!playerA) {
                      selectPlayer(player, 'A')
                    } else if (!playerB) {
                      selectPlayer(player, 'B')
                    }
                  }}
                  className={`p-3 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-accent text-white'
                      : 'bg-background text-gray-300 hover:bg-background-lighter'
                  }`}
                >
                  {player.displayName}
                </button>
              )
            })}
          </div>
        </div>

        {/* Scores */}
        {playerA && playerB && (
          <div className="bg-background-light rounded-2xl p-4 border border-background-lighter">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Final Score
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-center text-sm text-gray-400 mb-2">
                  {playerA.displayName}
                </div>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={playerAScore}
                  onChange={(e) => setPlayerAScore(e.target.value)}
                  className="w-full bg-background border border-background-lighter rounded-xl px-4 py-4 text-white text-center text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="0"
                />
              </div>
              <div>
                <div className="text-center text-sm text-gray-400 mb-2">
                  {playerB.displayName}
                </div>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={playerBScore}
                  onChange={(e) => setPlayerBScore(e.target.value)}
                  className="w-full bg-background border border-background-lighter rounded-xl px-4 py-4 text-white text-center text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

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
            disabled={!playerA || !playerB || !playerAScore || !playerBScore}
            className="flex-1"
          >
            Save Match
          </Button>
        </div>
      </form>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
