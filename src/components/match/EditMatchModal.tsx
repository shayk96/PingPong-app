/**
 * Reusable modal for editing a match's score and lucky points.
 * Editing is only allowed within a 12-hour window after the match was played.
 */

import { useEffect, useState } from 'react'
import { Modal } from '../ui'
import type { Match, User } from '../../types'

export const EDIT_WINDOW_MS = 12 * 60 * 60 * 1000 // 12 hours

interface EditMatchModalProps {
  isOpen: boolean
  onClose: () => void
  match: Match | null
  playerA?: User
  playerB?: User
  onSave: (matchId: string, data: {
    playerAScore: number
    playerBScore: number
    playerALuckyPoints: number
    playerBLuckyPoints: number
  }) => Promise<void>
}

export function EditMatchModal({ isOpen, onClose, match, playerA, playerB, onSave }: EditMatchModalProps) {
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [luckyA, setLuckyA] = useState('')
  const [luckyB, setLuckyB] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && match) {
      setScoreA(String(match.playerAScore))
      setScoreB(String(match.playerBScore))
      setLuckyA(String(match.playerALuckyPoints ?? 0))
      setLuckyB(String(match.playerBLuckyPoints ?? 0))
      setError('')
    }
  }, [isOpen, match])

  const nameA = playerA?.displayName || 'Player A'
  const nameB = playerB?.displayName || 'Player B'

  const handleSave = async () => {
    if (!match) return
    const sA = parseInt(scoreA)
    const sB = parseInt(scoreB)
    const lA = parseInt(luckyA) || 0
    const lB = parseInt(luckyB) || 0
    if (isNaN(sA) || isNaN(sB)) {
      setError('Enter valid scores')
      return
    }
    if (sA === sB) {
      setError('Scores cannot be tied')
      return
    }
    if (lA > sA || lB > sB) {
      setError("Lucky points cannot exceed a player's score")
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(match.id, {
        playerAScore: sA,
        playerBScore: sB,
        playerALuckyPoints: lA,
        playerBLuckyPoints: lB,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to edit match')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Match">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          You can edit a game's score and lucky points for up to 12 hours after it was played. Ratings will be recalculated.
        </p>

        {/* Scores */}
        <div>
          <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Score</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-sm text-white mb-1 truncate">{nameA}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={scoreA}
                onChange={e => setScoreA(e.target.value)}
                className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-white text-lg font-display font-bold text-center focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <span className="block text-sm text-white mb-1 truncate">{nameB}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={scoreB}
                onChange={e => setScoreB(e.target.value)}
                className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-white text-lg font-display font-bold text-center focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Lucky points */}
        <div>
          <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Lucky Points</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={luckyA}
              onChange={e => setLuckyA(e.target.value)}
              className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-yellow-300 text-center focus:outline-none focus:border-primary"
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={luckyB}
              onChange={e => setLuckyB(e.target.value)}
              className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-yellow-300 text-center focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-background-lighter text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl font-medium hover:bg-accent-600 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
