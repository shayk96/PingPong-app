import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { useLeaderboard } from '../hooks/useStats'
import { validateMatch } from '../lib/validation'
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable'
import { Button, ToastContainer, useToast } from '../components/ui'
import { saveRoom as apiSaveRoom, fetchActiveRoom as apiFetchActiveRoom, endRoom as apiEndRoom } from '../lib/api'
import type { User, NewMatchInput } from '../types'
import {
  RoomMatch,
  RoomMode,
  getRoomMode,
  shufflePlayers,
  generate3PlayerRound,
  resolve3PlayerMatch,
  generate4PlayerRound,
  resolve4PlayerMatch,
  generate5PlusRound,
  getOddPlayerMatch,
  addPlayedPair,
  totalMatchesInRound,
} from '../lib/tournament'

type Phase = 'setup' | 'playing' | 'round-complete'

// Rooms inactive for longer than this are considered stale and ignored/auto-closed
const ROOM_MAX_AGE_MS = 2 * 60 * 60 * 1000 // 2 hours

function isRoomStale(data: Record<string, unknown>): boolean {
  const updatedAt = data.updatedAt ? new Date(data.updatedAt as string).getTime() : 0
  return !updatedAt || Date.now() - updatedAt > ROOM_MAX_AGE_MS
}

export default function RoomSession() {
  const navigate = useNavigate()
  const { players, loading: playersLoading, refresh: refreshPlayers } = usePlayers()
  const { matches: globalMatches, createMatch, undoMatch, refresh: refreshMatches } = useMatches()
  const leaderboard = useLeaderboard(players, globalMatches)
  const { toasts, showToast, removeToast } = useToast()

  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [isViewer, setIsViewer] = useState(false)
  const endingRef = useRef(false)

  // Setup phase
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [playerSearch, setPlayerSearch] = useState('')

  // Playing phase
  const [phase, setPhase] = useState<Phase>('setup')
  const [roomPlayers, setRoomPlayers] = useState<User[]>([])
  const [mode, setMode] = useState<RoomMode>('3-player')
  const [matches, setMatches] = useState<RoomMatch[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [luckyA, setLuckyA] = useState('')
  const [luckyB, setLuckyB] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [roundNumber, setRoundNumber] = useState(1)
  const scoreARef = useRef<HTMLInputElement>(null)
  const scoreBRef = useRef<HTMLInputElement>(null)

  // 5+ player state across rounds
  const [playedPairs, setPlayedPairs] = useState<Set<string>>(new Set())
  const [gamesPlayedCount, setGamesPlayedCount] = useState<Map<string, number>>(new Map())
  const [oddMatchAdded, setOddMatchAdded] = useState(false)

  // Mid-session management panels
  const [showAddPlayerPanel, setShowAddPlayerPanel] = useState(false)
  const [showRemovePlayerPanel, setShowRemovePlayerPanel] = useState(false)
  const [showManualGamePanel, setShowManualGamePanel] = useState(false)
  const [addPlayerSearch, setAddPlayerSearch] = useState('')
  const [addPlayerNextGame, setAddPlayerNextGame] = useState(true)
  const [manualPlayerA, setManualPlayerA] = useState<string>('')
  const [manualPlayerB, setManualPlayerB] = useState<string>('')

  // Edit game state
  const [editingMatchIdx, setEditingMatchIdx] = useState<number | null>(null)
  const [editScoreA, setEditScoreA] = useState('')
  const [editScoreB, setEditScoreB] = useState('')
  const [editLuckyA, setEditLuckyA] = useState('')
  const [editLuckyB, setEditLuckyB] = useState('')

  // Track backend match IDs so we can undo them
  const [matchBackendIds, setMatchBackendIds] = useState<Map<number, string>>(new Map())

  // Round history — stores completed rounds for viewing
  const [pastRounds, setPastRounds] = useState<{ roundNumber: number; matches: RoomMatch[] }[]>([])
  const [showPastRounds, setShowPastRounds] = useState(false)

  // All players who ever participated in this session (survives removal)
  const [allSessionPlayers, setAllSessionPlayers] = useState<User[]>([])

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [players]
  )

  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return sortedPlayers
    const q = playerSearch.trim().toLowerCase()
    return sortedPlayers.filter(p => p.displayName.toLowerCase().includes(q))
  }, [sortedPlayers, playerSearch])

  // Players available to add (not already in room)
  const addablePlayers = useMemo(() => {
    const roomIds = new Set(roomPlayers.map(p => p.id))
    let list = players.filter(p => !roomIds.has(p.id))
    if (addPlayerSearch.trim()) {
      const q = addPlayerSearch.trim().toLowerCase()
      list = list.filter(p => p.displayName.toLowerCase().includes(q))
    }
    return list.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [players, roomPlayers, addPlayerSearch])

  const togglePlayer = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Sync ELO ratings from global players into roomPlayers and current matches
  useEffect(() => {
    if (phase === 'setup' || players.length === 0 || roomPlayers.length === 0) return
    const playerMap = new Map(players.map(p => [p.id, p]))

    setRoomPlayers(prev => prev.map(rp => {
      const fresh = playerMap.get(rp.id)
      return fresh ? { ...rp, eloRating: fresh.eloRating, wins: fresh.wins, losses: fresh.losses } : rp
    }))

    setAllSessionPlayers(prev => prev.map(sp => {
      const fresh = playerMap.get(sp.id)
      return fresh ? { ...sp, eloRating: fresh.eloRating, wins: fresh.wins, losses: fresh.losses } : sp
    }))

    setMatches(prev => prev.map(m => {
      const freshA = playerMap.get(m.playerA.id)
      const freshB = playerMap.get(m.playerB.id)
      return {
        ...m,
        playerA: freshA ? { ...m.playerA, eloRating: freshA.eloRating } : m.playerA,
        playerB: freshB ? { ...m.playerB, eloRating: freshB.eloRating } : m.playerB,
      }
    }))
  }, [players])

  // Serialize room state for backend sync
  const serializeRoom = useCallback(() => ({
    phase,
    roomPlayerIds: roomPlayers.map(p => p.id),
    allSessionPlayerIds: allSessionPlayers.map(p => p.id),
    mode,
    matches: matches.map(m => ({
      id: m.id,
      playerAId: m.playerA.id,
      playerBId: m.playerB.id,
      status: m.status,
      result: m.result || null,
    })),
    currentMatchIndex,
    roundNumber,
    playedPairs: Array.from(playedPairs),
    gamesPlayedCount: Object.fromEntries(gamesPlayedCount),
    pastRounds: pastRounds.map(r => ({
      roundNumber: r.roundNumber,
      matches: r.matches.map(m => ({
        id: m.id,
        playerAId: m.playerA.id,
        playerBId: m.playerB.id,
        status: m.status,
        result: m.result || null,
      })),
    })),
    oddMatchAdded,
  }), [phase, roomPlayers, allSessionPlayers, mode, matches, currentMatchIndex, roundNumber, playedPairs, gamesPlayedCount, pastRounds, oddMatchAdded])

  // Sync room state to backend (any active participant)
  const syncRoomToBackend = useCallback(async () => {
    if (phase === 'setup' || endingRef.current) return
    try {
      lastLocalWrite.current = Date.now()
      const saved = await apiSaveRoom(serializeRoom())
      // Track our own write so polling doesn't reload it back over us
      if (saved?.updatedAt) {
        lastLoadedUpdatedAt.current = new Date(saved.updatedAt as string).getTime()
      }
    } catch {
      // Silent fail — room sync is best-effort
    }
  }, [phase, serializeRoom])

  // Auto-sync to backend when room state changes
  useEffect(() => {
    if (phase === 'setup' || endingRef.current) return
    // Skip the sync triggered by applying a freshly-loaded remote state (avoids write ping-pong)
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }
    syncRoomToBackend()
  }, [matches, phase, roomPlayers, currentMatchIndex, roundNumber, pastRounds])

  // Deserialize room from backend data
  const loadRoomFromBackend = useCallback((data: Record<string, unknown>) => {
    // Applying remote state — mark it so the resulting auto-sync is skipped,
    // and record its timestamp so polling doesn't reload it again
    skipNextSyncRef.current = true
    lastLoadedUpdatedAt.current = data.updatedAt ? new Date(data.updatedAt as string).getTime() : Date.now()
    const playerMap = new Map(players.map(p => [p.id, p]))
    const resolvePlayer = (id: string) => playerMap.get(id) || { id, displayName: '?', eloRating: 800, wins: 0, losses: 0, createdAt: new Date() } as User
    const resolveMatch = (m: any): RoomMatch => ({
      id: m.id,
      playerA: resolvePlayer(m.playerAId),
      playerB: resolvePlayer(m.playerBId),
      status: m.status,
      result: m.result || undefined,
    })

    const rPlayerIds = (data.roomPlayerIds as string[]) || []
    const allPlayerIds = (data.allSessionPlayerIds as string[]) || []
    setRoomPlayers(rPlayerIds.map(resolvePlayer))
    setAllSessionPlayers(allPlayerIds.map(resolvePlayer))
    setMode((data.mode as RoomMode) || '3-player')
    setMatches(((data.matches as any[]) || []).map(resolveMatch))
    setCurrentMatchIndex((data.currentMatchIndex as number) || 0)
    setRoundNumber((data.roundNumber as number) || 1)
    setPlayedPairs(new Set((data.playedPairs as string[]) || []))
    setGamesPlayedCount(new Map(Object.entries((data.gamesPlayedCount as Record<string, number>) || {})))
    setOddMatchAdded((data.oddMatchAdded as boolean) || false)
    setPastRounds(((data.pastRounds as any[]) || []).map((r: any) => ({
      roundNumber: r.roundNumber,
      matches: (r.matches || []).map(resolveMatch),
    })))
    setPhase((data.phase as Phase) || 'playing')
  }, [players])

  // Track when this device last wrote to avoid overwriting own changes
  const lastLocalWrite = useRef<number>(0)
  // Timestamp of the most recent room state we've loaded/written (for updatedAt-based sync)
  const lastLoadedUpdatedAt = useRef<number>(0)
  // Set when applying remote state, to skip the auto-sync it would otherwise trigger
  const skipNextSyncRef = useRef(false)

  // On load, check for an active room — if one exists and is recent, join it
  useEffect(() => {
    if (players.length === 0 || isHost) return
    apiFetchActiveRoom().then(data => {
      if (data && !isRoomStale(data) && (data.phase === 'playing' || data.phase === 'round-complete')) {
        setIsViewer(true)
        loadRoomFromBackend(data)
      }
    }).catch(() => { /* no active room */ })
  }, [players, isHost])

  // Poll for updates from other devices
  useEffect(() => {
    if (phase === 'setup' || players.length === 0 || endingRef.current) return
    const interval = setInterval(async () => {
      if (endingRef.current) return
      // Skip poll if we just wrote (avoid overwriting our own changes)
      if (Date.now() - lastLocalWrite.current < 4000) return
      try {
        const data = await apiFetchActiveRoom()
        // Room ended or auto-closed (stale) on the server — leave the session
        if (isViewer && (!data || data.phase === 'ended')) {
          setIsViewer(false)
          setPhase('setup')
          return
        }
        if (data) {
          if (data.phase === 'ended') {
            setIsViewer(false)
            setIsHost(false)
            setPhase('setup')
            return
          }
          // Reload whenever the backend has a newer version than what we last saw/wrote.
          // This propagates ALL changes (scores, edits, reshuffle, add/remove player, etc.)
          const serverUpdatedAt = data.updatedAt ? new Date(data.updatedAt as string).getTime() : 0
          if (serverUpdatedAt > lastLoadedUpdatedAt.current) {
            loadRoomFromBackend(data)
          }
        }
      } catch { /* silent */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [phase, players, loadRoomFromBackend, isViewer])

  // Focus first score input when match changes
  useEffect(() => {
    if (phase === 'playing') {
      setTimeout(() => scoreARef.current?.focus(), 100)
    }
  }, [currentMatchIndex, phase])

  const startSession = async () => {
    const selected = players.filter(p => selectedIds.has(p.id))
    if (selected.length < 3) {
      showToast('Select at least 3 players', 'error')
      return
    }

    // Warn if another active room already exists (would be replaced)
    try {
      const existing = await apiFetchActiveRoom()
      if (existing && !isRoomStale(existing) && (existing.phase === 'playing' || existing.phase === 'round-complete')) {
        const ok = confirm('There is already an active room. Starting a new session will replace it. Continue?')
        if (!ok) return
      }
    } catch { /* ignore — proceed */ }

    endingRef.current = false
    const shuffled = shufflePlayers(selected)
    const m = getRoomMode(shuffled.length)
    setRoomPlayers(shuffled)
    setAllSessionPlayers(shuffled)
    setMode(m)
    setRoundNumber(1)
    setPlayedPairs(new Set())
    setGamesPlayedCount(new Map())
    setOddMatchAdded(false)
    setMatchBackendIds(new Map())
    setPastRounds([])

    const roundMatches = generateRound(shuffled, m, new Set(), new Map())
    setMatches(roundMatches)
    setCurrentMatchIndex(0)
    setScoreA('')
    setScoreB('')
    setLuckyA('')
    setLuckyB('')
    setPhase('playing')

    if (roundMatches.length > 0) {
      roundMatches[0].status = 'playing'
      setMatches([...roundMatches])
    }

    setIsHost(true)
    setIsViewer(false)
  }

  const generateRound = (
    rPlayers: User[],
    rMode: RoomMode,
    pairs: Set<string>,
    gamesCount: Map<string, number>
  ): RoomMatch[] => {
    if (rMode === '3-player') return generate3PlayerRound(rPlayers)
    if (rMode === '4-player') return generate4PlayerRound(shufflePlayers(rPlayers))
    return generate5PlusRound(rPlayers, pairs, gamesCount)
  }

  const advanceToNextMatch = useCallback((updatedMatches: RoomMatch[]) => {
    const nextIdx = updatedMatches.findIndex(m => m.status === 'pending')
    if (nextIdx === -1) {
      setPhase('round-complete')
    } else {
      updatedMatches[nextIdx].status = 'playing'
      setCurrentMatchIndex(nextIdx)
      setMatches([...updatedMatches])
      setScoreA('')
      setScoreB('')
      setLuckyA('')
      setLuckyB('')
    }
  }, [])

  const handleSubmitScore = async () => {
    const match = matches[currentMatchIndex]
    if (!match) return

    const pAScore = parseInt(scoreA) || 0
    const pBScore = parseInt(scoreB) || 0
    const pALucky = parseInt(luckyA) || 0
    const pBLucky = parseInt(luckyB) || 0

    if (pALucky > pAScore) {
      showToast(`Lucky points can't exceed score (${pAScore})`, 'error')
      return
    }
    if (pBLucky > pBScore) {
      showToast(`Lucky points can't exceed score (${pBScore})`, 'error')
      return
    }

    const input: NewMatchInput = {
      playerAId: match.playerA.id,
      playerBId: match.playerB.id,
      playerAScore: pAScore,
      playerBScore: pBScore,
      matchType: 11,
      playerALuckyPoints: pALucky,
      playerBLuckyPoints: pBLucky,
    }

    const validation = validateMatch(input)
    if (!validation.isValid) {
      showToast(validation.error || 'Invalid score', 'error')
      return
    }

    setSubmitting(true)
    try {
      // Guard against double-scoring the same game from two devices simultaneously
      try {
        const serverRoom = await apiFetchActiveRoom()
        if (serverRoom && Array.isArray(serverRoom.matches)) {
          const serverMatch = (serverRoom.matches as any[]).find(m => m.id === match.id)
          if (serverMatch && serverMatch.status === 'done') {
            showToast('This game was already scored on another device', 'error')
            loadRoomFromBackend(serverRoom)
            setSubmitting(false)
            return
          }
        }
      } catch { /* if the check fails, proceed with submit */ }

      const result = await createMatch(input)

      // Store backend match ID for potential undo/edit
      if (result?.id) {
        setMatchBackendIds(prev => new Map(prev).set(currentMatchIndex, result.id))
      }

      const winnerId = pAScore > pBScore ? match.playerA.id : match.playerB.id
      const loserId = winnerId === match.playerA.id ? match.playerB.id : match.playerA.id

      const updated = matches.map(m => ({ ...m }))
      updated[currentMatchIndex] = {
        ...updated[currentMatchIndex],
        status: 'done',
        result: {
          scoreA: pAScore,
          scoreB: pBScore,
          winnerId,
          loserId,
          winnerEloDelta: result?.winnerEloDelta,
          loserEloDelta: result?.loserEloDelta,
        },
      }

      const newPairs = addPlayedPair(playedPairs, match.playerA.id, match.playerB.id)
      setPlayedPairs(newPairs)

      const newCount = new Map(gamesPlayedCount)
      newCount.set(match.playerA.id, (newCount.get(match.playerA.id) || 0) + 1)
      newCount.set(match.playerB.id, (newCount.get(match.playerB.id) || 0) + 1)
      setGamesPlayedCount(newCount)

      let resolved = updated
      if (mode === '3-player') {
        resolved = resolve3PlayerMatch(updated, currentMatchIndex, roomPlayers)
      } else if (mode === '4-player') {
        resolved = resolve4PlayerMatch(updated, currentMatchIndex)
      } else if (mode === '5-plus' && !oddMatchAdded && roomPlayers.length % 2 === 1 && currentMatchIndex === 0) {
        const winner = winnerId === match.playerA.id ? match.playerA : match.playerB
        const pairedIds = new Set<string>()
        resolved.forEach(m => {
          pairedIds.add(m.playerA.id)
          pairedIds.add(m.playerB.id)
        })
        const oddMatch = getOddPlayerMatch(roomPlayers, pairedIds, winner, resolved.length)
        if (oddMatch) {
          resolved = [...resolved, oddMatch]
          setOddMatchAdded(true)
        }
      }

      setMatches(resolved)
      advanceToNextMatch(resolved)

      refreshPlayers()
      refreshMatches()

      showToast('Score saved!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save match', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Add player mid-session ---
  const handleAddPlayer = (player: User, putInNextGame: boolean) => {
    const newRoomPlayers = [...roomPlayers, player]
    setRoomPlayers(newRoomPlayers)
    // Track in all-session list
    setAllSessionPlayers(prev =>
      prev.some(p => p.id === player.id) ? prev : [...prev, player]
    )

    const newMode = getRoomMode(newRoomPlayers.length)
    setMode(newMode)

    if (putInNextGame) {
      const nextId = matches.length > 0 ? Math.max(...matches.map(m => m.id)) + 1 : 0

      // Determine who is playing in the current match so we don't pick them
      const currentlyPlayingIds = new Set<string>()
      const curMatch = matches[currentMatchIndex]
      if (curMatch && curMatch.status === 'playing') {
        currentlyPlayingIds.add(curMatch.playerA.id)
        currentlyPlayingIds.add(curMatch.playerB.id)
      }

      // Find partner: least games played, not currently playing, not a repeat pairing if possible
      let partner: User | null = null
      let fallbackPartner: User | null = null
      let minGames = Infinity
      let fallbackMinGames = Infinity

      for (const p of roomPlayers) {
        if (p.id === player.id) continue
        if (currentlyPlayingIds.has(p.id)) continue

        const g = gamesPlayedCount.get(p.id) || 0
        const key = [player.id, p.id].sort().join(':')
        const alreadyPlayed = playedPairs.has(key)

        if (!alreadyPlayed && g < minGames) {
          minGames = g
          partner = p
        }
        if (g < fallbackMinGames) {
          fallbackMinGames = g
          fallbackPartner = p
        }
      }

      if (!partner) partner = fallbackPartner
      if (!partner) partner = roomPlayers[0]

      // Remove any pending matches involving the chosen partner
      // (they're now playing the new player instead)
      let updated = matches.map(m => ({ ...m }))
      updated = updated.filter(m =>
        m.status === 'done' || m.status === 'playing' ||
        (m.playerA.id !== partner!.id && m.playerB.id !== partner!.id)
      )

      const newMatch: RoomMatch = {
        id: nextId,
        playerA: player,
        playerB: partner,
        status: 'pending',
      }

      const insertAt = updated.findIndex((m, i) => i > currentMatchIndex && m.status === 'pending')
      if (insertAt === -1) {
        updated.push(newMatch)
      } else {
        updated.splice(insertAt, 0, newMatch)
      }
      setMatches(updated)
    }

    setShowAddPlayerPanel(false)
    setAddPlayerSearch('')
    showToast(`${player.displayName} joined the room`, 'success')
  }

  // --- Remove player mid-session ---
  const handleRemovePlayer = (playerId: string) => {
    const player = roomPlayers.find(p => p.id === playerId)
    if (!player) return

    const newRoomPlayers = roomPlayers.filter(p => p.id !== playerId)
    if (newRoomPlayers.length < 2) {
      showToast('Need at least 2 players to continue', 'error')
      return
    }

    setRoomPlayers(newRoomPlayers)
    setMode(getRoomMode(newRoomPlayers.length))

    // Remove player from pending matches
    let updated = matches.map(m => ({ ...m }))
    const currentPlaying = updated[currentMatchIndex]

    // If the removed player is in the current match, skip it
    if (currentPlaying?.status === 'playing' &&
      (currentPlaying.playerA.id === playerId || currentPlaying.playerB.id === playerId)) {
      updated[currentMatchIndex] = { ...updated[currentMatchIndex], status: 'pending' }
      // Remove matches involving this player that are pending
      updated = updated.filter(m =>
        m.status === 'done' || (m.playerA.id !== playerId && m.playerB.id !== playerId)
      )
      setMatches(updated)
      advanceToNextMatch(updated)
    } else {
      // Just remove pending matches involving this player
      updated = updated.filter(m =>
        m.status === 'done' || m.status === 'playing' || (m.playerA.id !== playerId && m.playerB.id !== playerId)
      )
      setMatches(updated)
    }

    setShowRemovePlayerPanel(false)
    showToast(`${player.displayName} left the room`, 'info')
  }

  // --- Delete a completed game ---
  const handleDeleteGame = async (matchIdx: number) => {
    const match = matches[matchIdx]
    if (!match || match.status !== 'done') return

    const backendId = matchBackendIds.get(matchIdx)
    if (backendId) {
      try {
        await undoMatch(backendId)
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to undo match on server', 'error')
        return
      }
    }

    const updated = matches.filter((_, i) => i !== matchIdx)
    // Reindex backend IDs
    const newBackendIds = new Map<number, string>()
    matchBackendIds.forEach((bid, oldIdx) => {
      if (oldIdx === matchIdx) return
      const newIdx = oldIdx > matchIdx ? oldIdx - 1 : oldIdx
      newBackendIds.set(newIdx, bid)
    })
    setMatchBackendIds(newBackendIds)

    // Adjust currentMatchIndex if needed
    if (currentMatchIndex > matchIdx) {
      setCurrentMatchIndex(prev => prev - 1)
    }

    setMatches(updated)
    refreshPlayers()
    refreshMatches()
    showToast('Game deleted and reverted', 'success')
  }

  // --- Edit a completed game ---
  const startEditGame = (matchIdx: number) => {
    const match = matches[matchIdx]
    if (!match?.result) return
    setEditingMatchIdx(matchIdx)
    setEditScoreA(String(match.result.scoreA))
    setEditScoreB(String(match.result.scoreB))
    setEditLuckyA('0')
    setEditLuckyB('0')
  }

  const cancelEditGame = () => {
    setEditingMatchIdx(null)
    setEditScoreA('')
    setEditScoreB('')
    setEditLuckyA('')
    setEditLuckyB('')
  }

  const handleSaveEditGame = async () => {
    if (editingMatchIdx === null) return
    const match = matches[editingMatchIdx]
    if (!match) return

    const pAScore = parseInt(editScoreA) || 0
    const pBScore = parseInt(editScoreB) || 0
    const pALucky = parseInt(editLuckyA) || 0
    const pBLucky = parseInt(editLuckyB) || 0

    if (pALucky > pAScore) {
      showToast(`Lucky points can't exceed score (${pAScore})`, 'error')
      return
    }
    if (pBLucky > pBScore) {
      showToast(`Lucky points can't exceed score (${pBScore})`, 'error')
      return
    }

    const input: NewMatchInput = {
      playerAId: match.playerA.id,
      playerBId: match.playerB.id,
      playerAScore: pAScore,
      playerBScore: pBScore,
      matchType: 11,
      playerALuckyPoints: pALucky,
      playerBLuckyPoints: pBLucky,
    }

    const validation = validateMatch(input)
    if (!validation.isValid) {
      showToast(validation.error || 'Invalid score', 'error')
      return
    }

    setSubmitting(true)
    try {
      // Undo old match on backend
      const backendId = matchBackendIds.get(editingMatchIdx)
      if (backendId) {
        await undoMatch(backendId)
      }

      // Create new match
      const result = await createMatch(input)
      if (result?.id) {
        setMatchBackendIds(prev => new Map(prev).set(editingMatchIdx, result.id))
      }

      const winnerId = pAScore > pBScore ? match.playerA.id : match.playerB.id
      const loserId = winnerId === match.playerA.id ? match.playerB.id : match.playerA.id

      const updated = matches.map(m => ({ ...m }))
      updated[editingMatchIdx] = {
        ...updated[editingMatchIdx],
        status: 'done',
        result: { scoreA: pAScore, scoreB: pBScore, winnerId, loserId },
      }
      setMatches(updated)

      cancelEditGame()
      refreshPlayers()
      refreshMatches()
      showToast('Game updated!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update match', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Add manual game ---
  const handleAddManualGame = () => {
    if (!manualPlayerA || !manualPlayerB || manualPlayerA === manualPlayerB) {
      showToast('Select two different players', 'error')
      return
    }
    const pA = roomPlayers.find(p => p.id === manualPlayerA)
    const pB = roomPlayers.find(p => p.id === manualPlayerB)
    if (!pA || !pB) return

    const nextId = matches.length > 0 ? Math.max(...matches.map(m => m.id)) + 1 : 0
    const newMatch: RoomMatch = {
      id: nextId,
      playerA: pA,
      playerB: pB,
      status: 'pending',
    }

    // Insert right after the current match
    const updated = [...matches]
    const insertAt = currentMatchIndex + 1
    updated.splice(insertAt, 0, newMatch)
    setMatches(updated)

    setManualPlayerA('')
    setManualPlayerB('')
    setShowManualGamePanel(false)
    showToast(`Manual game added: ${pA.displayName} vs ${pB.displayName}`, 'success')
  }

  // --- Skip current game (remove entirely, give skipped players priority) ---
  const handleSkipGame = () => {
    const updated = matches.map(m => ({ ...m }))
    const current = updated[currentMatchIndex]
    if (!current || current.status !== 'playing') return

    const skippedA = current.playerA.id
    const skippedB = current.playerB.id

    // Remove the skipped match entirely
    updated.splice(currentMatchIndex, 1)

    // Give skipped players priority by reducing their games played count
    const newCount = new Map(gamesPlayedCount)
    newCount.set(skippedA, Math.max((newCount.get(skippedA) || 0) - 1, 0))
    newCount.set(skippedB, Math.max((newCount.get(skippedB) || 0) - 1, 0))
    setGamesPlayedCount(newCount)

    // Find next pending match and start it
    const nextIdx = updated.findIndex(m => m.status === 'pending')
    if (nextIdx !== -1) {
      updated[nextIdx].status = 'playing'
      setCurrentMatchIndex(nextIdx)
    } else {
      setPhase('round-complete')
    }

    setMatches(updated)
    setScoreA('')
    setScoreB('')
    setLuckyA('')
    setLuckyB('')
    showToast('Game skipped — those players get priority next', 'info')
  }

  // --- Reshuffle remaining games ---
  const handleReshuffle = () => {
    const done = matches.filter(m => m.status === 'done')
    const playing = matches.find(m => m.status === 'playing')
    const pending = matches.filter(m => m.status === 'pending')

    if (pending.length === 0) {
      showToast('No pending games to reshuffle', 'info')
      return
    }

    // Collect players from pending matches
    const pendingPlayerIds = new Set<string>()
    pending.forEach(m => {
      pendingPlayerIds.add(m.playerA.id)
      pendingPlayerIds.add(m.playerB.id)
    })
    if (playing) {
      pendingPlayerIds.delete(playing.playerA.id)
      pendingPlayerIds.delete(playing.playerB.id)
    }

    const pendingPlayers = roomPlayers.filter(p => pendingPlayerIds.has(p.id))
    const newPending = generate5PlusRound(pendingPlayers, playedPairs, gamesPlayedCount)

    // Reassign IDs
    const baseId = matches.length > 0 ? Math.max(...matches.map(m => m.id)) + 1 : 0
    newPending.forEach((m, i) => { m.id = baseId + i })

    const rebuilt = [...done]
    if (playing) rebuilt.push(playing)
    rebuilt.push(...newPending)

    const playingIdx = rebuilt.findIndex(m => m.status === 'playing')
    setCurrentMatchIndex(playingIdx >= 0 ? playingIdx : rebuilt.findIndex(m => m.status === 'pending'))

    if (playingIdx === -1) {
      const nextPend = rebuilt.findIndex(m => m.status === 'pending')
      if (nextPend !== -1) {
        rebuilt[nextPend].status = 'playing'
        setCurrentMatchIndex(nextPend)
      }
    }

    setMatches(rebuilt)
    showToast('Games reshuffled', 'success')
  }

  const startNewRound = () => {
    // Save current round to history
    const completedMatches = matches.filter(m => m.status === 'done')
    if (completedMatches.length > 0) {
      setPastRounds(prev => [...prev, { roundNumber, matches: completedMatches }])
    }

    const rPlayers = mode === '3-player' ? roomPlayers : shufflePlayers(roomPlayers)
    const roundMatches = generateRound(rPlayers, mode, playedPairs, gamesPlayedCount)
    setMatches(roundMatches)
    setCurrentMatchIndex(0)
    setScoreA('')
    setScoreB('')
    setLuckyA('')
    setLuckyB('')
    setOddMatchAdded(false)
    setRoundNumber(prev => prev + 1)
    setMatchBackendIds(new Map())

    if (roundMatches.length > 0) {
      roundMatches[0].status = 'playing'
      setMatches([...roundMatches])
    }
    setPhase('playing')
  }

  const endSession = async () => {
    endingRef.current = true
    setPhase('setup')
    setIsHost(false)
    setIsViewer(false)
    try { await apiEndRoom() } catch { /* silent */ }
    await refreshPlayers()
    navigate('/leaderboard')
  }

  const completedCount = matches.filter(m => m.status === 'done').length
  const expectedTotal = totalMatchesInRound(roomPlayers.length, mode)

  const currentMatch = phase === 'playing' ? matches[currentMatchIndex] : null

  if (playersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-accent"></div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <header className="mb-6 safe-top pt-2">
        <button
          onClick={() => phase === 'setup' ? navigate('/leaderboard') : undefined}
          className={`flex items-center gap-1 text-gray-400 transition-colors mb-3 ${phase === 'setup' ? 'hover:text-white' : 'opacity-0 pointer-events-none'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-2xl font-display font-bold text-white">
          Room Session
        </h1>
        {phase !== 'setup' && (
          <p className="text-gray-400 text-sm">
            Round {roundNumber} &middot; {roomPlayers.length} players &middot; {mode === '3-player' ? '3-player' : mode === '4-player' ? '4-player' : `${roomPlayers.length}-player`}
          </p>
        )}
        {isViewer && (
          <p className="text-xs text-accent mt-1">Live — synced across devices</p>
        )}
      </header>

      {/* === SETUP PHASE === */}
      {phase === 'setup' && !isViewer && (
        <div className="space-y-4">
          <div className="bg-background-light rounded-2xl p-4 border border-background-lighter">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300">
                Select Players ({selectedIds.size} selected)
              </label>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {players.length > 4 && (
              <input
                type="search"
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                placeholder="Search players..."
                className="w-full mb-3 px-3 py-2 rounded-xl bg-background border border-background-lighter text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              {filteredPlayers.map(player => {
                const selected = selectedIds.has(player.id)
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(player.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all border ${
                      selected
                        ? 'border-accent bg-accent/15 text-white'
                        : 'border-background-lighter bg-background text-gray-300 hover:bg-background-lighter'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected ? 'border-accent bg-accent' : 'border-gray-600'
                    }`}>
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{player.displayName}</span>
                  </button>
                )
              })}
            </div>
            {playerSearch.trim() && filteredPlayers.length === 0 && (
              <p className="text-xs text-gray-500 mt-2 text-center">No players match your search</p>
            )}
          </div>

          {selectedIds.size >= 3 && (
            <div className="bg-background-light rounded-2xl p-4 border border-background-lighter">
              <div className="text-sm text-gray-400 mb-2">Mode preview</div>
              <div className="text-white font-semibold">
                {selectedIds.size === 3 && '3-Player Round Robin — 3 matches per round, same order each round'}
                {selectedIds.size === 4 && '4-Player Bracket — 6 matches per round, reshuffle each round'}
                {selectedIds.size >= 5 && `${selectedIds.size}-Player Queue — ${Math.ceil(selectedIds.size / 2)} matches per round, smart pairing`}
              </div>
            </div>
          )}

          <Button
            onClick={startSession}
            variant="primary"
            disabled={selectedIds.size < 3}
            className="w-full"
          >
            Shuffle & Start ({selectedIds.size} players)
          </Button>
        </div>
      )}

      {/* === PLAYING PHASE === */}
      {phase === 'playing' && currentMatch && (
        <div className="space-y-4">
          {/* Progress + Actions */}
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Match {completedCount + 1}{expectedTotal ? ` of ${expectedTotal}` : ''}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowAddPlayerPanel(p => !p)
                  setShowRemovePlayerPanel(false)
                  setShowManualGamePanel(false)
                }}
                className="text-xs text-accent hover:text-accent/80 transition-colors"
                title="Add player"
              >
                + Player
              </button>
              <button
                onClick={() => {
                  setShowRemovePlayerPanel(p => !p)
                  setShowAddPlayerPanel(false)
                  setShowManualGamePanel(false)
                }}
                className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                title="Remove player"
              >
                − Player
              </button>
              <button
                onClick={() => {
                  setShowManualGamePanel(p => !p)
                  setShowAddPlayerPanel(false)
                  setShowRemovePlayerPanel(false)
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                title="Add manual game"
              >
                + Game
              </button>
              <button
                onClick={handleSkipGame}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                title="Skip current game"
              >
                Skip
              </button>
              <button
                onClick={handleReshuffle}
                className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                title="Reshuffle remaining games"
              >
                Reshuffle
              </button>
              <button
                onClick={() => {
                  if (confirm('End session? Completed matches are already saved.')) endSession()
                }}
                className="text-xs text-gray-500 hover:text-error transition-colors"
              >
                End
              </button>
            </div>
          </div>

          {/* Add Player Panel */}
          {showAddPlayerPanel && (
            <div className="bg-background-light rounded-xl p-3 border border-accent/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">Add Player</span>
                <button onClick={() => setShowAddPlayerPanel(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
              </div>
              {addablePlayers.length > 4 && (
                <input
                  type="search"
                  value={addPlayerSearch}
                  onChange={e => setAddPlayerSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full px-3 py-1.5 rounded-lg bg-background border border-background-lighter text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
              )}
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addPlayerNextGame}
                  onChange={e => setAddPlayerNextGame(e.target.checked)}
                  className="rounded border-gray-600 bg-background"
                />
                Put in next game
              </label>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {addablePlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddPlayer(p, addPlayerNextGame)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-background hover:bg-background-lighter text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {p.displayName}
                  </button>
                ))}
                {addablePlayers.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">No players available</p>
                )}
              </div>
            </div>
          )}

          {/* Remove Player Panel */}
          {showRemovePlayerPanel && (
            <div className="bg-background-light rounded-xl p-3 border border-orange-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Remove Player</span>
                <button onClick={() => setShowRemovePlayerPanel(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {roomPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (confirm(`Remove ${p.displayName} from the room?`)) handleRemovePlayer(p.id)
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-background hover:bg-red-900/30 text-sm text-gray-300 hover:text-red-300 transition-colors flex items-center justify-between"
                  >
                    <span>{p.displayName}</span>
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Game Panel */}
          {showManualGamePanel && (
            <div className="bg-background-light rounded-xl p-3 border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Add Manual Game</span>
                <button onClick={() => setShowManualGamePanel(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <select
                  value={manualPlayerA}
                  onChange={e => setManualPlayerA(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg bg-background border border-background-lighter text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  <option value="">Player A</option>
                  {roomPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.displayName}</option>
                  ))}
                </select>
                <span className="text-gray-500 text-xs">vs</span>
                <select
                  value={manualPlayerB}
                  onChange={e => setManualPlayerB(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg bg-background border border-background-lighter text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  <option value="">Player B</option>
                  {roomPlayers.filter(p => p.id !== manualPlayerA).map(p => (
                    <option key={p.id} value={p.id}>{p.displayName}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleAddManualGame}
                variant="primary"
                disabled={!manualPlayerA || !manualPlayerB || manualPlayerA === manualPlayerB}
                className="w-full text-sm"
              >
                Add to Next
              </Button>
            </div>
          )}

          {/* Main Leaderboard Table (collapsible) */}
          <button
            onClick={() => setShowLeaderboard(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-background-light border border-background-lighter text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span className="font-medium">Leaderboard</span>
            <svg className={`w-4 h-4 transition-transform ${showLeaderboard ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showLeaderboard && (
            <div className="max-h-80 overflow-y-auto">
              <LeaderboardTable entries={leaderboard} matches={globalMatches} />
            </div>
          )}

          {/* Live Standings (includes all session players, even those who left) */}
          {completedCount > 0 && (
            <div className="bg-background-light rounded-xl p-3 border border-background-lighter">
              <div className="grid grid-cols-[1.2rem_1fr_2.5rem_3.5rem] gap-1 text-xs text-gray-500 font-medium mb-1.5 px-1">
                <span>#</span>
                <span>Player</span>
                <span className="text-center">W-L</span>
                <span className="text-right">Margin</span>
              </div>
              {allSessionPlayers
                .map(p => {
                  const allRoundMatches = [...pastRounds.flatMap(r => r.matches), ...matches]
                  const wins = allRoundMatches.filter(m => m.status === 'done' && m.result?.winnerId === p.id).length
                  const losses = allRoundMatches.filter(m => m.status === 'done' && m.result?.loserId === p.id).length
                  const marginPoints = allRoundMatches
                    .filter(m => m.status === 'done' && (m.playerA.id === p.id || m.playerB.id === p.id))
                    .reduce((sum, m) => {
                      if (!m.result) return sum
                      const isA = m.playerA.id === p.id
                      const myScore = isA ? m.result.scoreA : m.result.scoreB
                      const oppScore = isA ? m.result.scoreB : m.result.scoreA
                      return sum + (myScore - oppScore)
                    }, 0)
                  const gamesPlayed = wins + losses
                  const avgMargin = gamesPlayed > 0 ? Math.round((marginPoints / gamesPlayed) * 10) / 10 : 0
                  const isActive = roomPlayers.some(rp => rp.id === p.id)
                  return { player: p, wins, losses, avgMargin, gamesPlayed, isActive }
                })
                .filter(s => s.gamesPlayed > 0)
                .sort((a, b) => b.wins - a.wins || b.avgMargin - a.avgMargin)
                .map(({ player, wins, losses, avgMargin, isActive }, i) => (
                  <div
                    key={player.id}
                    className={`grid grid-cols-[1.2rem_1fr_2.5rem_3.5rem] gap-1 items-center px-1 py-1 rounded-lg text-xs ${
                      i === 0 && wins > 0 ? 'bg-accent/10' : ''
                    }`}
                  >
                    <span className={`font-bold ${i === 0 && wins > 0 ? 'text-accent' : 'text-gray-500'}`}>{i + 1}</span>
                    <span className={`font-medium truncate ${isActive ? 'text-white' : 'text-gray-500 italic'}`}>
                      {player.displayName}{!isActive ? ' (left)' : ''}
                    </span>
                    <span className="text-center">
                      <span className="text-success">{wins}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-error">{losses}</span>
                    </span>
                    <span className={`text-right font-medium ${avgMargin > 0 ? 'text-success' : avgMargin < 0 ? 'text-error' : 'text-gray-500'}`}>
                      {avgMargin > 0 ? '+' : ''}{avgMargin}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Current Match Card */}
          <div className="bg-background-light rounded-2xl p-5 border-2 border-accent/40">
            <div className="text-xs text-accent font-semibold text-center mb-3 uppercase tracking-wider">Now Playing</div>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <div className="text-white font-bold text-lg">{currentMatch.playerA.displayName}</div>
                <div className="text-xs text-gray-400">{currentMatch.playerA.eloRating} ELO</div>
              </div>
              <div className="text-accent font-display font-bold text-sm">VS</div>
              <div className="flex-1 text-center">
                <div className="text-white font-bold text-lg">{currentMatch.playerB.displayName}</div>
                <div className="text-xs text-gray-400">{currentMatch.playerB.eloRating} ELO</div>
              </div>
            </div>

            {/* Score inputs */}
            <div className="mt-4 grid gap-3 items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
              <input
                ref={scoreARef}
                type="number"
                min="0"
                max="30"
                value={scoreA}
                onChange={e => setScoreA(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && scoreA && scoreB) handleSubmitScore()
                }}
                className="w-full bg-background border border-background-lighter rounded-xl px-3 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="0"
              />
              <span className="text-gray-500 font-medium">–</span>
              <input
                ref={scoreBRef}
                type="number"
                min="0"
                max="30"
                value={scoreB}
                onChange={e => setScoreB(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && scoreA && scoreB) handleSubmitScore()
                }}
                className="w-full bg-background border border-background-lighter rounded-xl px-3 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="0"
              />
            </div>

            {/* Lucky points inputs */}
            <div className="mt-2 grid gap-3 items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
              <input
                type="number"
                min="0"
                max="30"
                value={luckyA}
                onChange={e => setLuckyA(e.target.value)}
                className="w-full bg-background border border-background-lighter rounded-lg px-2 py-1.5 text-yellow-400 text-center text-sm font-medium focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                placeholder="0"
                title="Lucky points"
              />
              <span className="text-yellow-500 text-xs">&#9733;</span>
              <input
                type="number"
                min="0"
                max="30"
                value={luckyB}
                onChange={e => setLuckyB(e.target.value)}
                className="w-full bg-background border border-background-lighter rounded-lg px-2 py-1.5 text-yellow-400 text-center text-sm font-medium focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                placeholder="0"
                title="Lucky points"
              />
            </div>

            <Button
              onClick={handleSubmitScore}
              variant="primary"
              loading={submitting}
              disabled={!scoreA || !scoreB}
              className="w-full mt-4"
            >
              Submit Score
            </Button>
          </div>

          {/* Upcoming Matches */}
          {matches.some(m => m.status === 'pending') && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Upcoming</h3>
              <div className="space-y-1.5">
                {matches.filter(m => m.status === 'pending').map(m => {
                  const isPlaceholder = m.playerA.id === m.playerB.id
                  return (
                    <div
                      key={m.id}
                      className="bg-background-light rounded-xl px-4 py-2.5 border border-background-lighter text-sm text-gray-400"
                    >
                      {isPlaceholder ? 'TBD' : `${m.playerA.displayName} vs ${m.playerB.displayName}`}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Completed Matches */}
          {matches.some(m => m.status === 'done') && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Completed</h3>
              <div className="space-y-1.5">
                {matches.map((m, idx) => {
                  if (m.status !== 'done') return null
                  const winnerIsA = m.result!.winnerId === m.playerA.id
                  const isEditing = editingMatchIdx === idx

                  if (isEditing) {
                    return (
                      <div key={m.id} className="bg-background-light rounded-xl px-4 py-3 border-2 border-blue-500/40 space-y-2">
                        <div className="flex items-center justify-between text-xs text-blue-400 font-semibold">
                          <span>Edit: {m.playerA.displayName} vs {m.playerB.displayName}</span>
                          <button onClick={cancelEditGame} className="text-gray-500 hover:text-white">✕</button>
                        </div>
                        <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
                          <input
                            type="number" min="0" max="30"
                            value={editScoreA}
                            onChange={e => setEditScoreA(e.target.value)}
                            className="w-full bg-background border border-background-lighter rounded-lg px-2 py-2 text-white text-center text-lg font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-gray-500 text-xs">–</span>
                          <input
                            type="number" min="0" max="30"
                            value={editScoreB}
                            onChange={e => setEditScoreB(e.target.value)}
                            className="w-full bg-background border border-background-lighter rounded-lg px-2 py-2 text-white text-center text-lg font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
                          <input
                            type="number" min="0" max="30"
                            value={editLuckyA}
                            onChange={e => setEditLuckyA(e.target.value)}
                            className="w-full bg-background border border-background-lighter rounded-lg px-1 py-1 text-yellow-400 text-center text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                            placeholder="0"
                          />
                          <span className="text-yellow-500 text-[10px]">&#9733;</span>
                          <input
                            type="number" min="0" max="30"
                            value={editLuckyB}
                            onChange={e => setEditLuckyB(e.target.value)}
                            className="w-full bg-background border border-background-lighter rounded-lg px-1 py-1 text-yellow-400 text-center text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                            placeholder="0"
                          />
                        </div>
                        <Button onClick={handleSaveEditGame} variant="primary" loading={submitting} disabled={!editScoreA || !editScoreB} className="w-full text-sm">
                          Save Changes
                        </Button>
                      </div>
                    )
                  }

                  const eloDelta = m.result!.winnerEloDelta
                  return (
                    <div
                      key={m.id}
                      className="bg-background-light rounded-xl px-4 py-2.5 border border-background-lighter flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className={winnerIsA ? 'text-success font-semibold' : 'text-gray-400'}>
                          {m.playerA.displayName}
                        </span>
                        <span className="text-gray-500">vs</span>
                        <span className={!winnerIsA ? 'text-success font-semibold' : 'text-gray-400'}>
                          {m.playerB.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {m.result!.scoreA}–{m.result!.scoreB}
                        </span>
                        {eloDelta != null && (
                          <span className="text-[10px] text-gray-500 font-medium w-8 text-right">
                            ±{Math.abs(Math.round(eloDelta))}
                          </span>
                        )}
                        <button
                          onClick={() => startEditGame(idx)}
                          className="text-gray-600 hover:text-blue-400 active:text-blue-400 transition-all p-1"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this game? This will undo the match on the server.')) handleDeleteGame(idx)
                          }}
                          className="text-gray-600 hover:text-red-400 active:text-red-400 transition-all p-1"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Past Rounds History */}
          {pastRounds.length > 0 && (
            <div>
              <button
                onClick={() => setShowPastRounds(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-background-light border border-background-lighter text-sm text-gray-400 hover:text-white transition-colors"
              >
                <span className="font-medium">Previous Rounds ({pastRounds.length})</span>
                <svg className={`w-4 h-4 transition-transform ${showPastRounds ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPastRounds && (
                <div className="mt-2 space-y-3">
                  {pastRounds.map((round) => (
                    <div key={round.roundNumber} className="bg-background-light rounded-xl p-3 border border-background-lighter">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Round {round.roundNumber}</h4>
                      <div className="space-y-1">
                        {round.matches.map(m => {
                          const winnerIsA = m.result!.winnerId === m.playerA.id
                          const eloDelta = m.result!.winnerEloDelta
                          return (
                            <div key={m.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-background/60">
                              <div className="flex items-center gap-1.5">
                                <span className={winnerIsA ? 'text-success font-semibold' : 'text-gray-400'}>{m.playerA.displayName}</span>
                                <span className="text-gray-600">vs</span>
                                <span className={!winnerIsA ? 'text-success font-semibold' : 'text-gray-400'}>{m.playerB.displayName}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{m.result!.scoreA}–{m.result!.scoreB}</span>
                                {eloDelta != null && (
                                  <span className="text-[10px] text-gray-500">±{Math.abs(Math.round(eloDelta))}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === ROUND COMPLETE PHASE === */}
      {phase === 'round-complete' && (
        <div className="space-y-4">
          <div className="bg-background-light rounded-2xl p-5 border border-accent/30 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <h2 className="text-xl font-display font-bold text-white mb-1">Round {roundNumber} Complete!</h2>
            <p className="text-sm text-gray-400">{matches.length} matches played</p>
          </div>

          {/* Round Summary */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Results</h3>
            <div className="space-y-1.5">
              {matches.map((m, idx) => {
                if (m.status !== 'done') return null
                const winnerIsA = m.result!.winnerId === m.playerA.id
                const isEditing = editingMatchIdx === idx

                if (isEditing) {
                  return (
                    <div key={m.id} className="bg-background-light rounded-xl px-4 py-3 border-2 border-blue-500/40 space-y-2">
                      <div className="flex items-center justify-between text-xs text-blue-400 font-semibold">
                        <span>Edit: {m.playerA.displayName} vs {m.playerB.displayName}</span>
                        <button onClick={cancelEditGame} className="text-gray-500 hover:text-white">✕</button>
                      </div>
                      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
                        <input
                          type="number" min="0" max="30"
                          value={editScoreA}
                          onChange={e => setEditScoreA(e.target.value)}
                          className="w-full bg-background border border-background-lighter rounded-lg px-2 py-2 text-white text-center text-lg font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-gray-500 text-xs">–</span>
                        <input
                          type="number" min="0" max="30"
                          value={editScoreB}
                          onChange={e => setEditScoreB(e.target.value)}
                          className="w-full bg-background border border-background-lighter rounded-lg px-2 py-2 text-white text-center text-lg font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
                        <input
                          type="number" min="0" max="30"
                          value={editLuckyA}
                          onChange={e => setEditLuckyA(e.target.value)}
                          className="w-full bg-background border border-background-lighter rounded-lg px-1 py-1 text-yellow-400 text-center text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                          placeholder="0"
                        />
                        <span className="text-yellow-500 text-[10px]">&#9733;</span>
                        <input
                          type="number" min="0" max="30"
                          value={editLuckyB}
                          onChange={e => setEditLuckyB(e.target.value)}
                          className="w-full bg-background border border-background-lighter rounded-lg px-1 py-1 text-yellow-400 text-center text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                          placeholder="0"
                        />
                      </div>
                      <Button onClick={handleSaveEditGame} variant="primary" loading={submitting} disabled={!editScoreA || !editScoreB} className="w-full text-sm">
                        Save Changes
                      </Button>
                    </div>
                  )
                }

                const eloDelta = m.result!.winnerEloDelta
                return (
                  <div
                    key={m.id}
                    className="bg-background-light rounded-xl px-4 py-2.5 border border-background-lighter flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className={winnerIsA ? 'text-success font-semibold' : 'text-gray-400'}>
                        {m.playerA.displayName}
                      </span>
                      <span className="text-gray-500">vs</span>
                      <span className={!winnerIsA ? 'text-success font-semibold' : 'text-gray-400'}>
                        {m.playerB.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {m.result!.scoreA}–{m.result!.scoreB}
                      </span>
                      {eloDelta != null && (
                        <span className="text-[10px] text-gray-500 font-medium w-8 text-right">
                          ±{Math.abs(Math.round(eloDelta))}
                        </span>
                      )}
                      <button
                        onClick={() => startEditGame(idx)}
                        className="text-gray-600 hover:text-blue-400 active:text-blue-400 transition-all p-1"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this game? This will undo the match on the server.')) handleDeleteGame(idx)
                        }}
                        className="text-gray-600 hover:text-red-400 active:text-red-400 transition-all p-1"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Session Standings (all rounds combined) */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Session Standings</h3>
            <div className="space-y-1.5">
              {allSessionPlayers
                .map(p => {
                  const allRoundMatches = [...pastRounds.flatMap(r => r.matches), ...matches]
                  const wins = allRoundMatches.filter(m => m.status === 'done' && m.result?.winnerId === p.id).length
                  const losses = allRoundMatches.filter(m => m.status === 'done' && m.result?.loserId === p.id).length
                  const isActive = roomPlayers.some(rp => rp.id === p.id)
                  return { player: p, wins, losses, gamesPlayed: wins + losses, isActive }
                })
                .filter(s => s.gamesPlayed > 0)
                .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
                .map(({ player, wins, losses, isActive }) => (
                  <div
                    key={player.id}
                    className="bg-background-light rounded-xl px-4 py-2.5 border border-background-lighter flex items-center justify-between"
                  >
                    <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-500 italic'}`}>
                      {player.displayName}{!isActive ? ' (left)' : ''}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-success">{wins}W</span>
                      <span className="text-error">{losses}L</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Past Rounds History */}
          {pastRounds.length > 0 && (
            <div>
              <button
                onClick={() => setShowPastRounds(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-background-light border border-background-lighter text-sm text-gray-400 hover:text-white transition-colors"
              >
                <span className="font-medium">Previous Rounds ({pastRounds.length})</span>
                <svg className={`w-4 h-4 transition-transform ${showPastRounds ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPastRounds && (
                <div className="mt-2 space-y-3">
                  {pastRounds.map((round) => (
                    <div key={round.roundNumber} className="bg-background-light rounded-xl p-3 border border-background-lighter">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Round {round.roundNumber}</h4>
                      <div className="space-y-1">
                        {round.matches.map(m => {
                          const winnerIsA = m.result!.winnerId === m.playerA.id
                          const eloDelta = m.result!.winnerEloDelta
                          return (
                            <div key={m.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-background/60">
                              <div className="flex items-center gap-1.5">
                                <span className={winnerIsA ? 'text-success font-semibold' : 'text-gray-400'}>{m.playerA.displayName}</span>
                                <span className="text-gray-600">vs</span>
                                <span className={!winnerIsA ? 'text-success font-semibold' : 'text-gray-400'}>{m.playerB.displayName}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{m.result!.scoreA}–{m.result!.scoreB}</span>
                                {eloDelta != null && (
                                  <span className="text-[10px] text-gray-500">±{Math.abs(Math.round(eloDelta))}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={endSession} variant="secondary" className="flex-1">
              End Session
            </Button>
            <Button onClick={startNewRound} variant="primary" className="flex-1">
              New Round
            </Button>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
