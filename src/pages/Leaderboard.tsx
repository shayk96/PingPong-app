/**
 * Leaderboard page
 * Displays player rankings sorted by ELO with option to add/delete players and matches
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { useLeaderboard, useRecentMatchesWithPlayers, isPlayerInactive } from '../hooks/useStats'
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable'
import { MatchCard } from '../components/match/MatchCard'
import { WeirdStatsBanner } from '../components/WeirdStatsBanner'
import { Modal, Button, Input, ToastContainer, useToast } from '../components/ui'
import type { User } from '../types'

export default function Leaderboard() {
  const { players, loading: playersLoading, addPlayer, deletePlayer, refresh: refreshPlayers } = usePlayers()
  const { matches, loading: matchesLoading, deleteMatch, undoMatch, refresh: refreshMatches } = useMatches()
  const [showInactivePlayers, setShowInactivePlayers] = useState(false)
  const leaderboard = useLeaderboard(players, matches, showInactivePlayers)
  const recentMatches = useRecentMatchesWithPlayers(matches, players, 10)
  const inactiveCount = useMemo(() => players.filter(p => isPlayerInactive(p.lastPlayedAt)).length, [players])
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
  const [deletingMatch, setDeletingMatch] = useState(false)

  // Head to Head modal state
  const [showH2HModal, setShowH2HModal] = useState(false)
  const [h2hPlayerA, setH2hPlayerA] = useState<User | null>(null)
  const [h2hPlayerB, setH2hPlayerB] = useState<User | null>(null)

  // Undo state
  const [undoing, setUndoing] = useState(false)
  const [undoTimeLeft, setUndoTimeLeft] = useState(0)

  const UNDO_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

  // Find the most recent match and check if it's within the undo window
  const undoableMatch = useMemo(() => {
    if (matches.length === 0) return null
    const latest = matches[0] // already sorted newest first
    const elapsed = Date.now() - new Date(latest.createdAt).getTime()
    if (elapsed < UNDO_WINDOW_MS) return latest
    return null
  }, [matches])

  // Countdown timer for undo window
  useEffect(() => {
    if (!undoableMatch) {
      setUndoTimeLeft(0)
      return
    }

    const tick = () => {
      const elapsed = Date.now() - new Date(undoableMatch.createdAt).getTime()
      const remaining = Math.max(0, UNDO_WINDOW_MS - elapsed)
      setUndoTimeLeft(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [undoableMatch])

  const formatTimeLeft = useCallback((ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  const handleUndo = async () => {
    if (!undoableMatch) return
    setUndoing(true)
    try {
      await undoMatch(undoableMatch.id)
      await refreshPlayers()
      showToast('Match undone successfully!', 'success')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to undo match',
        'error'
      )
    } finally {
      setUndoing(false)
    }
  }

  const loading = playersLoading || matchesLoading

  // Sort players alphabetically for selection
  const sortedPlayers = useMemo(() => 
    [...players].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [players]
  )

  // Get Head to Head matches and stats (with matches grouped by date)
  const h2hData = useMemo(() => {
    if (!h2hPlayerA || !h2hPlayerB) return null

    const h2hMatches = matches
      .filter(m =>
        (m.playerAId === h2hPlayerA.id && m.playerBId === h2hPlayerB.id) ||
        (m.playerAId === h2hPlayerB.id && m.playerBId === h2hPlayerA.id)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const playerAWins = h2hMatches.filter(m => m.winnerId === h2hPlayerA.id).length
    const playerBWins = h2hMatches.filter(m => m.winnerId === h2hPlayerB.id).length
    const total = h2hMatches.length
    const winPctA = total > 0 ? Math.round((playerAWins / total) * 100) : 50
    const winPctB = total > 0 ? Math.round((playerBWins / total) * 100) : 50

    // Group matches by date for display
    const byDate: { label: string; matches: typeof h2hMatches }[] = []
    let currentLabel = ''
    for (const m of h2hMatches) {
      const label = formatH2HDateLabel(m.createdAt)
      if (label !== currentLabel) {
        currentLabel = label
        byDate.push({ label, matches: [] })
      }
      byDate[byDate.length - 1].matches.push(m)
    }

    return {
      matches: h2hMatches,
      byDate,
      playerAWins,
      playerBWins,
      total,
      winPctA,
      winPctB,
    }
  }, [h2hPlayerA, h2hPlayerB, matches])

  function formatH2HDateLabel(date: Date): string {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (d.getTime() === today.getTime()) return 'Today'
    if (d.getTime() === yesterday.getTime()) return 'Yesterday'
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000)
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
    if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

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
    setShowDeleteMatchModal(true)
  }

  const handleDeleteMatch = async () => {
    setDeletingMatch(true)
    try {
      await deleteMatch(deleteMatchId)
      await refreshPlayers()
      showToast('Match deleted successfully!', 'success')
      setShowDeleteMatchModal(false)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to delete match',
        'error'
      )
    } finally {
      setDeletingMatch(false)
    }
  }


  const handleRefresh = async () => {
    await Promise.all([refreshPlayers(), refreshMatches()])
    showToast('Data refreshed!', 'success')
  }

  const openH2HModal = () => {
    setH2hPlayerA(null)
    setH2hPlayerB(null)
    setShowH2HModal(true)
  }

  const selectH2HPlayer = (player: User) => {
    if (h2hPlayerA?.id === player.id) {
      setH2hPlayerA(null)
    } else if (h2hPlayerB?.id === player.id) {
      setH2hPlayerB(null)
    } else if (!h2hPlayerA) {
      setH2hPlayerA(player)
    } else if (!h2hPlayerB) {
      setH2hPlayerB(player)
    }
  }

  const swapH2HPlayers = () => {
    if (h2hPlayerA && h2hPlayerB) {
      setH2hPlayerA(h2hPlayerB)
      setH2hPlayerB(h2hPlayerA)
    }
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
              + Add
            </Button>
          </div>
        </div>
      </header>

      {/* Undo Last Match Banner */}
      {undoableMatch && undoTimeLeft > 0 && (() => {
        const playerA = players.find(p => p.id === undoableMatch.playerAId)
        const playerB = players.find(p => p.id === undoableMatch.playerBId)
        return (
          <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-xl animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300">
                  <span className="text-white font-medium">{playerA?.displayName || '?'}</span>
                  {' '}{undoableMatch.playerAScore}-{undoableMatch.playerBScore}{' '}
                  <span className="text-white font-medium">{playerB?.displayName || '?'}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Undo available for {formatTimeLeft(undoTimeLeft)}
                </p>
              </div>
              <button
                onClick={handleUndo}
                disabled={undoing}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition-all disabled:opacity-50"
              >
                {undoing ? 'Undoing...' : 'Undo'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Weird Stats Banner */}
      {matches.length >= 3 && players.length >= 2 && (
        <WeirdStatsBanner matches={matches} players={players} />
      )}

      {/* Head to Head button removed for now (code kept in modal/state/handlers) */}

      {/* Rankings */}
      {players.length > 0 && (
        <section className="mb-8">
          <LeaderboardTable 
            entries={leaderboard} 
            onDeletePlayer={handleDeletePlayerClick}
          />
          {inactiveCount > 0 && (
            <button
              type="button"
              onClick={() => setShowInactivePlayers(prev => !prev)}
              className="w-full mt-3 py-2.5 rounded-xl border border-background-lighter text-gray-400 text-sm font-medium hover:bg-background-lighter hover:text-gray-300 transition-colors"
            >
              {showInactivePlayers
                ? 'Hide inactive players'
                : `Show inactive players (${inactiveCount})`
              }
            </button>
          )}
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
            <p className="text-error font-medium mb-1">Are you sure?</p>
            <p className="text-gray-300 text-sm">
              This will delete <strong className="text-white">{deleteMatchInfo}</strong> and recalculate player ratings. This cannot be undone.
            </p>
          </div>
          
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

      {/* Head to Head Modal */}
      <Modal
        isOpen={showH2HModal}
        onClose={() => setShowH2HModal(false)}
        title="Head to Head"
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Player selection: 2-column grid with slot badges */}
          <div className="grid grid-cols-2 gap-2">
            {sortedPlayers.map((player) => {
              const isSlotA = h2hPlayerA?.id === player.id
              const isSlotB = h2hPlayerB?.id === player.id
              const selected = isSlotA || isSlotB
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => selectH2HPlayer(player)}
                  className={`flex items-center gap-2 p-3 rounded-xl text-left transition-all border ${
                    selected
                      ? 'border-accent bg-accent/15 text-white'
                      : 'border-background-lighter bg-background text-gray-300 hover:bg-background-lighter'
                  }`}
                >
                  {isSlotA && <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/80 text-white text-xs font-bold flex items-center justify-center">1</span>}
                  {isSlotB && <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/80 text-white text-xs font-bold flex items-center justify-center">2</span>}
                  {!selected && <span className="flex-shrink-0 w-5 h-5 rounded-full border border-gray-600 text-gray-500 text-xs flex items-center justify-center">+</span>}
                  <span className="font-medium truncate">{player.displayName}</span>
                  {selected && <span className="text-xs text-gray-400 flex-shrink-0">{player.eloRating}</span>}
                </button>
              )
            })}
          </div>

          {/* VS summary card (when both selected) */}
          {h2hData && h2hPlayerA && h2hPlayerB && (
            <>
              <div className="bg-background rounded-xl p-4 border border-background-lighter">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 text-center">
                    <div className="text-white font-semibold truncate">{h2hPlayerA.displayName}</div>
                    <div className={`text-2xl font-bold ${h2hData.playerAWins > h2hData.playerBWins ? 'text-success' : 'text-white'}`}>
                      {h2hData.playerAWins}
                    </div>
                    <div className="text-xs text-gray-500">{h2hData.total > 0 ? `${h2hData.winPctA}%` : '–'}</div>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-gray-500 text-sm font-medium">VS</span>
                    <button
                      type="button"
                      onClick={swapH2HPlayers}
                      className="text-xs text-gray-400 hover:text-accent transition-colors"
                      title="Swap players"
                    >
                      swap
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 text-center">
                    <div className="text-white font-semibold truncate">{h2hPlayerB.displayName}</div>
                    <div className={`text-2xl font-bold ${h2hData.playerBWins > h2hData.playerAWins ? 'text-success' : 'text-white'}`}>
                      {h2hData.playerBWins}
                    </div>
                    <div className="text-xs text-gray-500">{h2hData.total > 0 ? `${h2hData.winPctB}%` : '–'}</div>
                  </div>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                  {h2hData.total} match{h2hData.total !== 1 ? 'es' : ''} played
                </div>
              </div>

              {/* Match list with date dividers */}
              <div className="max-h-52 overflow-y-auto space-y-3">
                {h2hData.byDate.length > 0 ? (
                  h2hData.byDate.map((group) => (
                    <div key={group.label}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="h-px flex-1 bg-background-lighter" />
                        <span className="text-xs font-medium text-gray-500">{group.label}</span>
                        <div className="h-px flex-1 bg-background-lighter" />
                      </div>
                      <div className="space-y-1">
                        {group.matches.map((match) => {
                          const aIsPlayerA = match.playerAId === h2hPlayerA.id
                          const scoreA = aIsPlayerA ? match.playerAScore : match.playerBScore
                          const scoreB = aIsPlayerA ? match.playerBScore : match.playerAScore
                          const winnerIsA = match.winnerId === h2hPlayerA.id
                          return (
                            <div
                              key={match.id}
                              className="p-2.5 rounded-lg bg-background-lighter flex items-center justify-between"
                            >
                              <span className="text-xs text-gray-500">
                                {match.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold w-6 text-right ${winnerIsA ? 'text-success' : 'text-gray-400'}`}>{scoreA}</span>
                                <span className="text-gray-600">–</span>
                                <span className={`text-sm font-bold w-6 ${!winnerIsA ? 'text-success' : 'text-gray-400'}`}>{scoreB}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No matches between these players yet
                  </div>
                )}
              </div>
            </>
          )}

          <Button
            variant="secondary"
            onClick={() => setShowH2HModal(false)}
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
