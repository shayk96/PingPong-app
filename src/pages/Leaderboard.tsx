/**
 * Leaderboard page
 * Displays player rankings sorted by ELO with option to add/delete players and matches
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { useSeason } from '../hooks/useSeason'
import { useLeaderboard, useRecentMatchesWithPlayers, isPlayerInactive } from '../hooks/useStats'
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable'
import { MatchCard } from '../components/match/MatchCard'
import { EditMatchModal, EDIT_WINDOW_MS } from '../components/match/EditMatchModal'
import { WeirdStatsBanner } from '../components/WeirdStatsBanner'
import { Modal, Button, Input, ToastContainer, useToast } from '../components/ui'
import type { User, Match } from '../types'

export default function Leaderboard() {
  const navigate = useNavigate()
  const { players, loading: playersLoading, addPlayer, deletePlayer, refresh: refreshPlayers } = usePlayers()
  const { matches, loading: matchesLoading, deleteMatch, editMatch, undoMatch, refresh: refreshMatches } = useMatches()
  const { currentSeason, pastSeasons, loading: seasonLoading, refresh: refreshSeason } = useSeason()
  const [showInactivePlayers, setShowInactivePlayers] = useState(false)
  const leaderboard = useLeaderboard(players, matches, showInactivePlayers)
  const recentMatches = useRecentMatchesWithPlayers(matches, players, 10)
  const inactiveCount = useMemo(() => players.filter(p => isPlayerInactive(p.lastPlayedAt, (p.wins || 0) + (p.losses || 0))).length, [players])
  const { toasts, showToast, removeToast } = useToast()
  
  // Add player modal state
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)

  // Delete player modal state
  const [showDeletePlayerModal, setShowDeletePlayerModal] = useState(false)
  const [deletePlayerId, setDeletePlayerId] = useState('')
  const [deletePlayerName, setDeletePlayerName] = useState('')
  const [deletingPlayer, setDeletingPlayer] = useState(false)

  // Delete match modal state
  const [showDeleteMatchModal, setShowDeleteMatchModal] = useState(false)
  const [deleteMatchId, setDeleteMatchId] = useState('')
  const [deleteMatchInfo, setDeleteMatchInfo] = useState('')
  const [deletingMatch, setDeletingMatch] = useState(false)

  // Edit match modal state
  const [showEditMatchModal, setShowEditMatchModal] = useState(false)
  const [editMatchTarget, setEditMatchTarget] = useState<Match | null>(null)

  // Season countdown state
  const [seasonTimeLeft, setSeasonTimeLeft] = useState('')

  // Head to Head modal state
  const [showH2HModal, setShowH2HModal] = useState(false)
  const [h2hPlayerA, setH2hPlayerA] = useState<User | null>(null)
  const [h2hPlayerB, setH2hPlayerB] = useState<User | null>(null)
  const [h2hPlayerSearch, setH2hPlayerSearch] = useState('')

  // Lucky leaderboard modal (auto-open via ?lucky=1 search param)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showLuckyModal, setShowLuckyModal] = useState(false)

  useEffect(() => {
    if (searchParams.get('lucky') === '1') {
      setShowLuckyModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

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

  // Season countdown timer -- reads end date from the season API
  useEffect(() => {
    if (!currentSeason?.endsAt) {
      setSeasonTimeLeft('')
      return
    }
    const endDate = currentSeason.endsAt.getTime()

    const tick = () => {
      const diff = endDate - Date.now()
      if (diff <= 0) {
        setSeasonTimeLeft('Season ended!')
        refreshSeason()
        refreshPlayers()
        return
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (days > 0) {
        setSeasonTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      } else {
        setSeasonTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [currentSeason?.endsAt])

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

  const seasonStartDate = useMemo(() => {
    if (!currentSeason) return null
    const seasonMatches = matches.filter(m => m.seasonNumber === currentSeason.seasonNumber)
    if (seasonMatches.length === 0) return null
    const oldest = seasonMatches.reduce((a, b) => a.createdAt.getTime() < b.createdAt.getTime() ? a : b)
    return oldest.createdAt
  }, [matches, currentSeason])

  // Lucky points leaderboard data — only count games since lucky tracking began
  const luckyLeaderboard = useMemo(() => {
    // Find the earliest match with any lucky points to determine feature start date
    const sortedByDate = [...matches].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const firstLuckyMatch = sortedByDate.find(m =>
      (m.playerALuckyPoints || 0) > 0 || (m.playerBLuckyPoints || 0) > 0
    )
    if (!firstLuckyMatch) {
      return []
    }
    const luckyStartDate = firstLuckyMatch.createdAt

    const playerLucky: Record<string, { name: string; total: number; games: number }> = {}
    // Only count matches from when lucky tracking began
    const relevantMatches = matches.filter(m => m.createdAt.getTime() >= luckyStartDate.getTime())
    for (const m of relevantMatches) {
      const aLucky = m.playerALuckyPoints || 0
      const bLucky = m.playerBLuckyPoints || 0
      if (!playerLucky[m.playerAId]) {
        const p = players.find(pl => pl.id === m.playerAId)
        playerLucky[m.playerAId] = { name: p?.displayName || 'Unknown', total: 0, games: 0 }
      }
      playerLucky[m.playerAId].total += aLucky
      playerLucky[m.playerAId].games += 1
      if (!playerLucky[m.playerBId]) {
        const p = players.find(pl => pl.id === m.playerBId)
        playerLucky[m.playerBId] = { name: p?.displayName || 'Unknown', total: 0, games: 0 }
      }
      playerLucky[m.playerBId].total += bLucky
      playerLucky[m.playerBId].games += 1
    }
    return Object.entries(playerLucky)
      .map(([id, data]) => ({
        id,
        name: data.name,
        totalLucky: data.total,
        games: data.games,
        avgLucky: data.games > 0 ? Math.round((data.total / data.games) * 100) / 100 : 0,
      }))
      .filter(e => e.totalLucky > 0)
      .sort((a, b) => b.avgLucky - a.avgLucky)
  }, [matches, players])

  // Unlucky points leaderboard — lucky points conceded (opponent's lucky points scored against you)
  const unluckyLeaderboard = useMemo(() => {
    const sortedByDate = [...matches].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const firstLuckyMatch = sortedByDate.find(m =>
      (m.playerALuckyPoints || 0) > 0 || (m.playerBLuckyPoints || 0) > 0
    )
    if (!firstLuckyMatch) return []
    const luckyStartDate = firstLuckyMatch.createdAt

    const playerUnlucky: Record<string, { name: string; total: number; games: number }> = {}
    const relevantMatches = matches.filter(m => m.createdAt.getTime() >= luckyStartDate.getTime())
    for (const m of relevantMatches) {
      const aLucky = m.playerALuckyPoints || 0
      const bLucky = m.playerBLuckyPoints || 0
      // Player A concedes bLucky, Player B concedes aLucky
      if (!playerUnlucky[m.playerAId]) {
        const p = players.find(pl => pl.id === m.playerAId)
        playerUnlucky[m.playerAId] = { name: p?.displayName || 'Unknown', total: 0, games: 0 }
      }
      playerUnlucky[m.playerAId].total += bLucky
      playerUnlucky[m.playerAId].games += 1
      if (!playerUnlucky[m.playerBId]) {
        const p = players.find(pl => pl.id === m.playerBId)
        playerUnlucky[m.playerBId] = { name: p?.displayName || 'Unknown', total: 0, games: 0 }
      }
      playerUnlucky[m.playerBId].total += aLucky
      playerUnlucky[m.playerBId].games += 1
    }
    return Object.entries(playerUnlucky)
      .map(([id, data]) => ({
        id,
        name: data.name,
        totalUnlucky: data.total,
        games: data.games,
        avgUnlucky: data.games > 0 ? Math.round((data.total / data.games) * 100) / 100 : 0,
      }))
      .filter(e => e.totalUnlucky > 0)
      .sort((a, b) => b.avgUnlucky - a.avgUnlucky)
  }, [matches, players])

  // Total lucky leaderboard — average lucky + average unlucky per player
  const totalLuckyLeaderboard = useMemo(() => {
    const luckyById = new Map(luckyLeaderboard.map(e => [e.id, { name: e.name, avg: e.avgLucky }]))
    const unluckyById = new Map(unluckyLeaderboard.map(e => [e.id, { name: e.name, avg: e.avgUnlucky }]))
    const ids = new Set<string>([...luckyById.keys(), ...unluckyById.keys()])
    return [...ids]
      .map(id => {
        const avgLucky = luckyById.get(id)?.avg || 0
        const avgUnlucky = unluckyById.get(id)?.avg || 0
        const name = luckyById.get(id)?.name || unluckyById.get(id)?.name || 'Unknown'
        return {
          id,
          name,
          avgLucky,
          avgUnlucky,
          avgTotal: Math.round((avgLucky + avgUnlucky) * 100) / 100,
        }
      })
      .filter(e => e.avgTotal > 0)
      .sort((a, b) => b.avgTotal - a.avgTotal)
  }, [luckyLeaderboard, unluckyLeaderboard])

  const [luckyTab, setLuckyTab] = useState<'lucky' | 'unlucky' | 'total'>('lucky')

  const loading = playersLoading || matchesLoading || seasonLoading

  // Sort players alphabetically for selection
  const sortedPlayers = useMemo(() => 
    [...players].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [players]
  )
  const filteredH2hPlayers = useMemo(() => {
    if (!h2hPlayerSearch.trim()) return sortedPlayers
    const q = h2hPlayerSearch.trim().toLowerCase()
    return sortedPlayers.filter(p => p.displayName.toLowerCase().includes(q))
  }, [sortedPlayers, h2hPlayerSearch])

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
    setShowDeletePlayerModal(true)
  }

  const handleDeletePlayer = async () => {
    setDeletingPlayer(true)
    try {
      await deletePlayer(deletePlayerId)
      await refreshMatches()
      showToast(`${deletePlayerName} deleted successfully!`, 'success')
      setShowDeletePlayerModal(false)
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

  const handleEditMatchClick = (match: Match) => {
    setEditMatchTarget(match)
    setShowEditMatchModal(true)
  }

  const handleSaveEditMatch = useCallback(async (matchId: string, data: {
    playerAScore: number
    playerBScore: number
    playerALuckyPoints: number
    playerBLuckyPoints: number
  }) => {
    await editMatch(matchId, data)
    await refreshPlayers()
    await refreshMatches()
  }, [editMatch, refreshPlayers, refreshMatches])

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
    await Promise.all([refreshPlayers(), refreshMatches(), refreshSeason()])
    showToast('Data refreshed!', 'success')
  }

  const openH2HModal = () => {
    setH2hPlayerA(null)
    setH2hPlayerB(null)
    setH2hPlayerSearch('')
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
              onClick={() => navigate('/room')}
              variant="secondary"
              size="sm"
              title="Room Session"
            >
              Room
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

      {currentSeason && (
        <div className="mb-4 p-3 bg-background-light rounded-xl border border-background-lighter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <div>
                <div className="text-white font-semibold text-sm">
                  Season {currentSeason.seasonNumber}
                </div>
                <div className="text-xs text-gray-400">
                  {seasonStartDate
                    ? `Started ${seasonStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'No matches yet'}
                </div>
              </div>
            </div>
            {seasonTimeLeft && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Ends in</div>
                <div className="text-sm font-mono font-bold text-accent">{seasonTimeLeft}</div>
              </div>
            )}
          </div>
          {pastSeasons.length > 0 && pastSeasons[0].winnerName && (
            <div className="mt-2 pt-2 border-t border-background-lighter flex items-center gap-2">
              <span className="text-yellow-400 text-xs">👑</span>
              <span className="text-xs text-gray-400">
                Season {pastSeasons[0].seasonNumber} Champion: <span className="text-yellow-400 font-medium">{pastSeasons[0].winnerName}</span>
              </span>
            </div>
          )}
        </div>
      )}

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
            matches={matches}
          />
          <button
            type="button"
            onClick={() => setShowInactivePlayers(prev => !prev)}
            className="w-full mt-3 py-2.5 rounded-xl border border-background-lighter text-gray-400 text-sm font-medium hover:bg-background-lighter hover:text-gray-300 transition-colors"
          >
            {showInactivePlayers
              ? 'Hide inactive players'
              : `Show inactive players${inactiveCount > 0 ? ` (${inactiveCount})` : ''}`
            }
          </button>
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
                canEdit={Date.now() - match.createdAt.getTime() <= EDIT_WINDOW_MS}
                onEdit={() => handleEditMatchClick(match)}
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

      {/* Edit Match Modal */}
      <EditMatchModal
        isOpen={showEditMatchModal}
        onClose={() => setShowEditMatchModal(false)}
        match={editMatchTarget}
        playerA={editMatchTarget ? players.find(p => p.id === editMatchTarget.playerAId) : undefined}
        playerB={editMatchTarget ? players.find(p => p.id === editMatchTarget.playerBId) : undefined}
        onSave={handleSaveEditMatch}
      />

      {/* Head to Head Modal */}
      <Modal
        isOpen={showH2HModal}
        onClose={() => setShowH2HModal(false)}
        title="Head to Head"
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Player selection: 2-column grid with slot badges */}
          {players.length > 4 && (
            <input
              type="search"
              value={h2hPlayerSearch}
              onChange={(e) => setH2hPlayerSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full px-3 py-2 rounded-xl bg-background border border-background-lighter text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              aria-label="Search players"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            {filteredH2hPlayers.map((player) => {
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
          {h2hPlayerSearch.trim() && filteredH2hPlayers.length === 0 && (
            <p className="text-xs text-gray-500 text-center">No players match your search</p>
          )}

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

      {/* Lucky / Unlucky Points Leaderboard Modal */}
      <Modal
        isOpen={showLuckyModal}
        onClose={() => setShowLuckyModal(false)}
        title="Lucky Points"
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-background rounded-lg">
            <button
              onClick={() => setLuckyTab('lucky')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                luckyTab === 'lucky' ? 'bg-yellow-500/20 text-yellow-300' : 'text-gray-400 hover:text-white'
              }`}
            >
              Lucky
            </button>
            <button
              onClick={() => setLuckyTab('unlucky')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                luckyTab === 'unlucky' ? 'bg-red-500/20 text-red-300' : 'text-gray-400 hover:text-white'
              }`}
            >
              Unlucky
            </button>
            <button
              onClick={() => setLuckyTab('total')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                luckyTab === 'total' ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:text-white'
              }`}
            >
              Total
            </button>
          </div>

          {luckyTab === 'lucky' && (
            luckyLeaderboard.length > 0 ? (
              <>
                <div className="grid grid-cols-[2rem_1fr_4.5rem_4rem] gap-2 px-3 text-xs text-gray-500 font-medium uppercase tracking-wider">
                  <span>#</span>
                  <span>Player</span>
                  <span className="text-right">Avg</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="space-y-1">
                  {luckyLeaderboard.map((entry, i) => (
                    <div
                      key={entry.id}
                      className={`grid grid-cols-[2rem_1fr_4.5rem_4rem] gap-2 items-center px-3 py-2.5 rounded-xl ${
                        i === 0 ? 'bg-yellow-500/10 border border-yellow-500/25' : 'bg-background border border-background-lighter'
                      }`}
                    >
                      <span className={`text-sm font-bold ${i === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {i + 1}
                      </span>
                      <span className={`text-sm font-medium truncate ${i === 0 ? 'text-yellow-300' : 'text-white'}`}>
                        {entry.name}
                      </span>
                      <span className={`text-sm font-bold text-right ${i === 0 ? 'text-yellow-400' : 'text-yellow-400/80'}`}>
                        {entry.avgLucky}
                      </span>
                      <span className="text-sm text-gray-500 text-right">
                        {entry.totalLucky}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                No lucky points recorded yet
              </div>
            )
          )}

          {luckyTab === 'unlucky' && (
            unluckyLeaderboard.length > 0 ? (
              <>
                <div className="grid grid-cols-[2rem_1fr_4.5rem_4rem] gap-2 px-3 text-xs text-gray-500 font-medium uppercase tracking-wider">
                  <span>#</span>
                  <span>Player</span>
                  <span className="text-right">Avg</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="space-y-1">
                  {unluckyLeaderboard.map((entry, i) => (
                    <div
                      key={entry.id}
                      className={`grid grid-cols-[2rem_1fr_4.5rem_4rem] gap-2 items-center px-3 py-2.5 rounded-xl ${
                        i === 0 ? 'bg-red-500/10 border border-red-500/25' : 'bg-background border border-background-lighter'
                      }`}
                    >
                      <span className={`text-sm font-bold ${i === 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {i + 1}
                      </span>
                      <span className={`text-sm font-medium truncate ${i === 0 ? 'text-red-300' : 'text-white'}`}>
                        {entry.name}
                      </span>
                      <span className={`text-sm font-bold text-right ${i === 0 ? 'text-red-400' : 'text-red-400/80'}`}>
                        {entry.avgUnlucky}
                      </span>
                      <span className="text-sm text-gray-500 text-right">
                        {entry.totalUnlucky}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                No unlucky points recorded yet
              </div>
            )
          )}

          {luckyTab === 'total' && (
            totalLuckyLeaderboard.length > 0 ? (
              <>
                <div className="grid grid-cols-[1.5rem_1fr_3rem_3rem_3.5rem] gap-1.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                  <span>#</span>
                  <span>Player</span>
                  <span className="text-right">Lucky</span>
                  <span className="text-right">Unl.</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="space-y-1">
                  {totalLuckyLeaderboard.map((entry, i) => (
                    <div
                      key={entry.id}
                      className={`grid grid-cols-[1.5rem_1fr_3rem_3rem_3.5rem] gap-1.5 items-center px-3 py-2.5 rounded-xl ${
                        i === 0 ? 'bg-accent/10 border border-accent/25' : 'bg-background border border-background-lighter'
                      }`}
                    >
                      <span className={`text-sm font-bold ${i === 0 ? 'text-accent' : 'text-gray-500'}`}>
                        {i + 1}
                      </span>
                      <span className={`text-sm font-medium truncate ${i === 0 ? 'text-accent' : 'text-white'}`}>
                        {entry.name}
                      </span>
                      <span className="text-sm text-yellow-400/80 text-right">
                        {entry.avgLucky}
                      </span>
                      <span className="text-sm text-red-400/80 text-right">
                        {entry.avgUnlucky}
                      </span>
                      <span className={`text-sm font-bold text-right ${i === 0 ? 'text-accent' : 'text-accent/80'}`}>
                        {entry.avgTotal}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 px-3">
                  Total = avg lucky + avg unlucky (conceded) per game
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                No lucky points recorded yet
              </div>
            )
          )}
          <Button
            variant="secondary"
            onClick={() => setShowLuckyModal(false)}
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
