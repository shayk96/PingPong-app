/**
 * All Matches page
 * Displays all matches grouped by date with dividers
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { formatEloDelta } from '../lib/elo'
import { Modal } from '../components/ui/Modal'

export default function AllMatches() {
  const navigate = useNavigate()
  const { players, loading: playersLoading, refresh: refreshPlayers } = usePlayers()
  const { matches, loading: matchesLoading, deleteMatch } = useMatches()

  const loading = playersLoading || matchesLoading

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteMatchId, setDeleteMatchId] = useState('')
  const [deleteMatchInfo, setDeleteMatchInfo] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const openDeleteModal = (matchId: string, info: string) => {
    setDeleteMatchId(matchId)
    setDeleteMatchInfo(info)
    setDeleteError('')
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteMatch(deleteMatchId)
      await refreshPlayers()
      setShowDeleteModal(false)
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  // Group matches by date
  const groupedMatches = useMemo(() => {
    const playerMap = new Map(players.map(p => [p.id, p]))
    const sorted = [...matches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const groups: { label: string; matches: typeof sorted }[] = []
    let currentLabel = ''

    for (const match of sorted) {
      const dateLabel = formatDateLabel(match.createdAt)
      if (dateLabel !== currentLabel) {
        currentLabel = dateLabel
        groups.push({ label: dateLabel, matches: [] })
      }
      groups[groups.length - 1].matches.push(match)
    }

    // Attach player data
    return groups.map(group => ({
      ...group,
      matches: group.matches.map(m => ({
        ...m,
        playerA: playerMap.get(m.playerAId),
        playerB: playerMap.get(m.playerBId),
      }))
    }))
  }, [matches, players])

  const totalMatches = matches.length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-accent"></div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate('/leaderboard')}
        className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-4 safe-top pt-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm">Leaderboard</span>
      </button>

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold text-white">
          All Matches
        </h1>
        <p className="text-gray-400 text-sm">
          {totalMatches} match{totalMatches !== 1 ? 'es' : ''} played
        </p>
      </header>

      {/* Matches grouped by date */}
      {groupedMatches.length > 0 ? (
        <div className="space-y-6">
          {groupedMatches.map((group) => (
            <section key={group.label}>
              {/* Date divider */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-background-lighter"></div>
                <span className="text-xs font-medium text-gray-400 flex-shrink-0">
                  {group.label}
                </span>
                <span className="text-xs text-gray-600 flex-shrink-0">
                  {group.matches.length} game{group.matches.length !== 1 ? 's' : ''}
                </span>
                <div className="h-px flex-1 bg-background-lighter"></div>
              </div>

              {/* Match cards */}
              <div className="space-y-2">
                {group.matches.map((match) => {
                  const isPlayerAWinner = match.winnerId === match.playerAId
                  const timeStr = match.createdAt.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <div
                      key={match.id}
                      className="bg-background-light rounded-xl p-3 border border-background-lighter"
                    >
                      <div className="flex items-center justify-between">
                        {/* Player A */}
                        <div className={`flex-1 min-w-0 ${isPlayerAWinner ? '' : 'opacity-60'}`}>
                          <div className="flex items-center gap-1.5">
                            {isPlayerAWinner && (
                              <span className="text-success text-xs">✓</span>
                            )}
                            <span className="font-semibold text-white text-sm truncate">
                              {match.playerA?.displayName || 'Unknown'}
                            </span>
                          </div>
                          <div className={`text-xs ${isPlayerAWinner ? 'text-success' : 'text-error'}`}>
                            {isPlayerAWinner
                              ? formatEloDelta(match.winnerEloDelta)
                              : formatEloDelta(match.loserEloDelta)
                            }
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-1.5 px-3 flex-shrink-0">
                          <span className={`text-xl font-display font-bold ${isPlayerAWinner ? 'text-white' : 'text-gray-500'}`}>
                            {match.playerAScore}
                          </span>
                          <span className="text-gray-600 text-sm">–</span>
                          <span className={`text-xl font-display font-bold ${!isPlayerAWinner ? 'text-white' : 'text-gray-500'}`}>
                            {match.playerBScore}
                          </span>
                        </div>

                        {/* Player B */}
                        <div className={`flex-1 min-w-0 text-right ${!isPlayerAWinner ? '' : 'opacity-60'}`}>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-semibold text-white text-sm truncate">
                              {match.playerB?.displayName || 'Unknown'}
                            </span>
                            {!isPlayerAWinner && (
                              <span className="text-success text-xs">✓</span>
                            )}
                          </div>
                          <div className={`text-xs ${!isPlayerAWinner ? 'text-success' : 'text-error'}`}>
                            {!isPlayerAWinner
                              ? formatEloDelta(match.winnerEloDelta)
                              : formatEloDelta(match.loserEloDelta)
                            }
                          </div>
                        </div>
                      </div>

                      {/* Time + match type + delete */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-background-lighter">
                        <span className="text-xs text-gray-500">{timeStr}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">First to {match.matchType}</span>
                          <button
                            onClick={() => openDeleteModal(
                              match.id,
                              `${match.playerA?.displayName || 'Unknown'} ${match.playerAScore}–${match.playerBScore} ${match.playerB?.displayName || 'Unknown'}`
                            )}
                            className="text-gray-600 hover:text-error transition-colors p-1 -mr-1"
                            title="Delete match"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏓</div>
          <h2 className="text-xl font-semibold text-white mb-2">No matches yet</h2>
          <p className="text-gray-400">Start playing to see match history here!</p>
        </div>
      )}

      {/* Delete match confirmation modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Match">
        <div className="space-y-4">
          <div className="bg-error/10 border border-error/30 rounded-xl p-4">
            <p className="text-error font-medium mb-1">Are you sure?</p>
            <p className="text-gray-300 text-sm">
              This will delete <strong className="text-white">{deleteMatchInfo}</strong> and recalculate player ratings. This cannot be undone.
            </p>
          </div>

          {deleteError && (
            <p className="text-error text-sm">{deleteError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 px-4 py-2.5 bg-background-lighter text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-error text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </span>
              ) : 'Delete Match'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Format a date into a human-friendly label
 */
function formatDateLabel(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const matchDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (matchDay.getTime() === today.getTime()) return 'Today'
  if (matchDay.getTime() === yesterday.getTime()) return 'Yesterday'

  // Within the last 7 days: show day name
  const diffDays = Math.floor((today.getTime() - matchDay.getTime()) / 86400000)
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  // Same year: show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  }

  // Different year
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
