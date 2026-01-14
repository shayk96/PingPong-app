/**
 * Leaderboard page
 * Displays player rankings sorted by ELO with option to add/delete players and matches
 */

import { useState, useMemo } from 'react'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { useLeaderboard, useRecentMatchesWithPlayers } from '../hooks/useStats'
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable'
import { MatchCard } from '../components/match/MatchCard'
import { Modal, Button, Input, ToastContainer, useToast } from '../components/ui'

export default function Leaderboard() {
  const { players, loading: playersLoading, addPlayer, deletePlayer, refresh: refreshPlayers } = usePlayers()
  const { matches, loading: matchesLoading, deleteMatch, refresh: refreshMatches } = useMatches()
  const leaderboard = useLeaderboard(players, matches)
  const recentMatches = useRecentMatchesWithPlayers(matches, players, 10)
  const { toasts, showToast, removeToast } = useToast()
  
  // Add player modal state
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)

  // Delete player modal state
  const [showDeletePlayerModal, setShowDeletePlayerModal] = useState(false)
  const [deletePlayerId, setDeletePlayerId] = useState('')
  const [deletePlayerName, setDeletePlayerName] = useState('')
  const [deletePlayerPassword, setDeletePlayerPassword] = useState('')
  const [deletingPlayer, setDeletingPlayer] = useState(false)

  // Delete match modal state
  const [showDeleteMatchModal, setShowDeleteMatchModal] = useState(false)
  const [deleteMatchId, setDeleteMatchId] = useState('')
  const [deleteMatchInfo, setDeleteMatchInfo] = useState('')
  const [deleteMatchPassword, setDeleteMatchPassword] = useState('')
  const [deletingMatch, setDeletingMatch] = useState(false)

  // Player history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyPlayerId, setHistoryPlayerId] = useState('')
  const [historyPlayerName, setHistoryPlayerName] = useState('')

  const loading = playersLoading || matchesLoading

  // Get matches for selected player
  const playerMatches = useMemo(() => {
    if (!historyPlayerId) return []
    
    const playerMap = new Map(players.map(p => [p.id, p]))
    
    return matches
      .filter(m => m.playerAId === historyPlayerId || m.playerBId === historyPlayerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(match => ({
        ...match,
        playerA: playerMap.get(match.playerAId),
        playerB: playerMap.get(match.playerBId)
      }))
  }, [historyPlayerId, matches, players])

  // Get player stats for history modal
  const historyPlayerStats = useMemo(() => {
    const player = players.find(p => p.id === historyPlayerId)
    if (!player) return null
    return {
      eloRating: player.eloRating,
      wins: player.wins || 0,
      losses: player.losses || 0,
      winRate: player.wins + player.losses > 0 
        ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
        : 0
    }
  }, [historyPlayerId, players])

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      showToast('Please enter a player name', 'error')
      return
    }

    setAddingPlayer(true)
    try {
      await addPlayer(newPlayerName.trim())
      showToast(`${newPlayerName.trim()} added successfully!`, 'success')
      setNewPlayerName('')
      setShowAddPlayer(false)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to add player',
        'error'
      )
    } finally {
      setAddingPlayer(false)
    }
  }

  const handleDeletePlayerClick = (playerId: string, playerName: string) => {
    setDeletePlayerId(playerId)
    setDeletePlayerName(playerName)
    setDeletePlayerPassword('')
    setShowDeletePlayerModal(true)
  }

  const handleDeletePlayer = async () => {
    if (!deletePlayerPassword) {
      showToast('Please enter the admin password', 'error')
      return
    }

    setDeletingPlayer(true)
    try {
      await deletePlayer(deletePlayerId, deletePlayerPassword)
      await refreshMatches()
      showToast(`${deletePlayerName} deleted successfully!`, 'success')
      setShowDeletePlayerModal(false)
      setDeletePlayerPassword('')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to delete player',
        'error'
      )
    } finally {
      setDeletingPlayer(false)
    }
  }

  const handleDeleteMatchClick = (matchId: string, matchInfo: string) => {
    setDeleteMatchId(matchId)
    setDeleteMatchInfo(matchInfo)
    setDeleteMatchPassword('')
    setShowDeleteMatchModal(true)
  }

  const handleDeleteMatch = async () => {
    if (!deleteMatchPassword) {
      showToast('Please enter the admin password', 'error')
      return
    }

    setDeletingMatch(true)
    try {
      await deleteMatch(deleteMatchId, deleteMatchPassword)
      await refreshPlayers()
      showToast('Match deleted successfully!', 'success')
      setShowDeleteMatchModal(false)
      setDeleteMatchPassword('')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to delete match',
        'error'
      )
    } finally {
      setDeletingMatch(false)
    }
  }

  const handleViewHistory = (playerId: string, playerName: string) => {
    setHistoryPlayerId(playerId)
    setHistoryPlayerName(playerName)
    setShowHistoryModal(true)
  }

  const handleRefresh = async () => {
    await Promise.all([refreshPlayers(), refreshMatches()])
    showToast('Data refreshed!', 'success')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-accent"></div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <header className="mb-6 safe-top pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">
              🏓 Ping Pong
            </h1>
            <p className="text-gray-400 text-sm">
              {players.length} player{players.length !== 1 ? 's' : ''} competing
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              variant="secondary"
              size="sm"
              title="Refresh data"
            >
              ↻
            </Button>
            <Button
              onClick={() => setShowAddPlayer(true)}
              variant="primary"
              size="sm"
            >
              + Add Player
            </Button>
          </div>
        </div>
      </header>

      {/* Rankings */}
      {players.length > 0 && (
        <section className="mb-8">
          <LeaderboardTable 
            entries={leaderboard} 
            onViewHistory={handleViewHistory}
            onDeletePlayer={handleDeletePlayerClick}
          />
        </section>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">
            Recent Matches
          </h2>
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                playerA={match.playerA}
                playerB={match.playerB}
                canDelete={true}
                onDelete={() => {
                  const info = `${match.playerA?.displayName || 'Unknown'} vs ${match.playerB?.displayName || 'Unknown'} (${match.playerAScore}-${match.playerBScore})`
                  handleDeleteMatchClick(match.id, info)
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {players.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏓</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            No players yet
          </h2>
          <p className="text-gray-400 mb-6">
            Add some players to start tracking matches!
          </p>
          <Button onClick={() => setShowAddPlayer(true)} variant="primary">
            Add First Player
          </Button>
        </div>
      )}

      {/* Add Player Modal */}
      <Modal
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
        title="Add New Player"
      >
        <div className="space-y-4">
          <Input
            label="Player Name"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Enter player name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddPlayer()
            }}
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowAddPlayer(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddPlayer}
              loading={addingPlayer}
              className="flex-1"
            >
              Add Player
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Player Modal */}
      <Modal
        isOpen={showDeletePlayerModal}
        onClose={() => setShowDeletePlayerModal(false)}
        title="Delete Player"
      >
        <div className="space-y-4">
          <div className="bg-error/10 border border-error/30 rounded-xl p-4">
            <p className="text-error font-medium mb-1">⚠️ Warning</p>
            <p className="text-gray-300 text-sm">
              This will permanently delete <strong className="text-white">{deletePlayerName}</strong> and all their match history. This action cannot be undone.
            </p>
          </div>
          
          <Input
            label="Admin Password"
            type="password"
            value={deletePlayerPassword}
            onChange={(e) => setDeletePlayerPassword(e.target.value)}
            placeholder="Enter admin password"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDeletePlayer()
            }}
          />
          
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeletePlayerModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeletePlayer}
              loading={deletingPlayer}
              className="flex-1 !bg-error hover:!bg-error/80"
            >
              Delete Player
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Match Modal */}
      <Modal
        isOpen={showDeleteMatchModal}
        onClose={() => setShowDeleteMatchModal(false)}
        title="Delete Match"
      >
        <div className="space-y-4">
          <div className="bg-error/10 border border-error/30 rounded-xl p-4">
            <p className="text-error font-medium mb-1">⚠️ Warning</p>
            <p className="text-gray-300 text-sm">
              This will delete the match <strong className="text-white">{deleteMatchInfo}</strong> and recalculate player ratings. This action cannot be undone.
            </p>
          </div>
          
          <Input
            label="Admin Password"
            type="password"
            value={deleteMatchPassword}
            onChange={(e) => setDeleteMatchPassword(e.target.value)}
            placeholder="Enter admin password"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDeleteMatch()
            }}
          />
          
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteMatchModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteMatch}
              loading={deletingMatch}
              className="flex-1 !bg-error hover:!bg-error/80"
            >
              Delete Match
            </Button>
          </div>
        </div>
      </Modal>

      {/* Player History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`${historyPlayerName}'s Match History`}
      >
        <div className="space-y-4">
          {/* Player Stats Summary */}
          {historyPlayerStats && (
            <div className="grid grid-cols-4 gap-2 p-3 bg-background rounded-xl">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{historyPlayerStats.eloRating}</div>
                <div className="text-xs text-gray-400">ELO</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-success">{historyPlayerStats.wins}</div>
                <div className="text-xs text-gray-400">Wins</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-error">{historyPlayerStats.losses}</div>
                <div className="text-xs text-gray-400">Losses</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-accent">{historyPlayerStats.winRate}%</div>
                <div className="text-xs text-gray-400">Win Rate</div>
              </div>
            </div>
          )}

          {/* Match List */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {playerMatches.length > 0 ? (
              playerMatches.map((match) => {
                const isWinner = match.winnerId === historyPlayerId
                const opponent = match.playerAId === historyPlayerId ? match.playerB : match.playerA
                const playerScore = match.playerAId === historyPlayerId ? match.playerAScore : match.playerBScore
                const opponentScore = match.playerAId === historyPlayerId ? match.playerBScore : match.playerAScore
                const eloDelta = isWinner ? match.winnerEloDelta : match.loserEloDelta

                return (
                  <div
                    key={match.id}
                    className={`p-3 rounded-xl border ${
                      isWinner 
                        ? 'bg-success/10 border-success/30' 
                        : 'bg-error/10 border-error/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${isWinner ? 'text-success' : 'text-error'}`}>
                          {isWinner ? 'W' : 'L'}
                        </span>
                        <div>
                          <div className="text-white font-medium">
                            vs {opponent?.displayName || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {match.createdAt.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">
                          {playerScore} - {opponentScore}
                        </div>
                        <div className={`text-sm ${isWinner ? 'text-success' : 'text-error'}`}>
                          {eloDelta > 0 ? '+' : ''}{eloDelta} ELO
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No matches yet</p>
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            onClick={() => setShowHistoryModal(false)}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
