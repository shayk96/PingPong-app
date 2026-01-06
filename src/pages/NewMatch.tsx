/**
 * New Match page
 * Form to log a new ping pong match
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { useAuth } from '../hooks/useAuth'
import { MatchForm } from '../components/match/MatchForm'
import { ToastContainer, useToast } from '../components/ui'
import type { NewMatchInput } from '../types'

export default function NewMatch() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { players, loading: playersLoading } = usePlayers()
  const { createMatch } = useMatches()
  const { toasts, showToast, removeToast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (input: NewMatchInput) => {
    if (!user) return

    setSubmitting(true)
    try {
      await createMatch(input, players)
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
          <p className="text-gray-400">
            At least 2 players need to register before you can log matches.
          </p>
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
      <div className="bg-background-light rounded-2xl p-5 border border-background-lighter">
        <MatchForm
          players={players}
          currentUserId={user?.id || ''}
          onSubmit={handleSubmit}
          loading={submitting}
        />
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-xl">
        <h3 className="font-semibold text-white mb-2">📝 Quick Tips</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Select both players before entering scores</li>
          <li>• Winner must reach 11 (or 21) points</li>
          <li>• Win by 2 in deuce situations (e.g., 12-10)</li>
        </ul>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

