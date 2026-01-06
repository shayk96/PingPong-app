/**
 * Profile page
 * Displays player stats and match history
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { usePlayerStats, useLeaderboard } from '../hooks/useStats'
import { useAuth } from '../hooks/useAuth'
import { StatsGrid } from '../components/profile/StatsGrid'
import { OpponentBreakdown } from '../components/profile/OpponentBreakdown'
import { MatchCard } from '../components/match/MatchCard'
import { Button, ConfirmModal, ToastContainer, useToast } from '../components/ui'
import { getRatingTier } from '../lib/elo'

export default function Profile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { players, loading: playersLoading } = usePlayers()
  const { matches, loading: matchesLoading, deleteMatch } = useMatches()
  const { toasts, showToast, removeToast } = useToast()
  
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Determine which player's profile to show
  const profileUserId = userId || user?.id
  const profilePlayer = players.find(p => p.id === profileUserId)
  const isOwnProfile = profileUserId === user?.id

  // Get stats
  const stats = usePlayerStats(profileUserId || '', matches, players)
  const leaderboard = useLeaderboard(players, matches)
  const playerRank = leaderboard.find(e => e.user.id === profileUserId)?.rank || 0

  // Get player's matches
  const playerMatches = matches
    .filter(m => m.playerAId === profileUserId || m.playerBId === profileUserId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)

  const loading = playersLoading || matchesLoading

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      showToast('Failed to logout', 'error')
    }
  }

  const handleDeleteMatch = async () => {
    if (!matchToDelete) return

    setDeleting(true)
    try {
      await deleteMatch(matchToDelete)
      showToast('Match deleted successfully', 'success')
      setMatchToDelete(null)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to delete match',
        'error'
      )
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-accent"></div>
      </div>
    )
  }

  if (!profilePlayer) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🤔</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Player Not Found
          </h2>
          <p className="text-gray-400 mb-4">
            This player doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/leaderboard')}>
            Back to Leaderboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <header className="mb-6 safe-top pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">
              {profilePlayer.displayName}
            </h1>
            <p className="text-gray-400 text-sm">
              {getRatingTier(profilePlayer.eloRating)}
            </p>
          </div>
          {isOwnProfile && (
            <Button variant="ghost" onClick={handleLogout}>
              Logout
            </Button>
          )}
        </div>
      </header>

      {/* Stats Grid */}
      <section className="mb-6">
        <StatsGrid 
          stats={stats} 
          eloRating={profilePlayer.eloRating}
          rank={playerRank}
        />
      </section>

      {/* Opponent Breakdown */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Head-to-Head
        </h2>
        <OpponentBreakdown stats={stats.opponentStats} />
      </section>

      {/* Match History */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Match History
        </h2>
        {playerMatches.length > 0 ? (
          <div className="space-y-3">
            {playerMatches.map((match) => {
              const playerA = players.find(p => p.id === match.playerAId)
              const playerB = players.find(p => p.id === match.playerBId)
              const canDelete = match.createdBy === user?.id

              return (
                <MatchCard
                  key={match.id}
                  match={match}
                  playerA={playerA}
                  playerB={playerB}
                  currentUserId={profileUserId}
                  canDelete={canDelete}
                  onDelete={() => setMatchToDelete(match.id)}
                />
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No matches played yet</p>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!matchToDelete}
        onClose={() => setMatchToDelete(null)}
        onConfirm={handleDeleteMatch}
        title="Delete Match?"
        message="This will permanently delete this match and revert all ELO changes. This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

