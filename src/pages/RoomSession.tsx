import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { validateMatch } from '../lib/validation'
import { Button, ToastContainer, useToast } from '../components/ui'
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

export default function RoomSession() {
  const navigate = useNavigate()
  const { players, loading: playersLoading, refresh: refreshPlayers } = usePlayers()
  const { createMatch } = useMatches()
  const { toasts, showToast, removeToast } = useToast()

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
  const [submitting, setSubmitting] = useState(false)
  const [roundNumber, setRoundNumber] = useState(1)
  const scoreARef = useRef<HTMLInputElement>(null)
  const scoreBRef = useRef<HTMLInputElement>(null)

  // 5+ player state across rounds
  const [playedPairs, setPlayedPairs] = useState<Set<string>>(new Set())
  const [gamesPlayedCount, setGamesPlayedCount] = useState<Map<string, number>>(new Map())
  // Track whether odd-player match has been added this round
  const [oddMatchAdded, setOddMatchAdded] = useState(false)

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [players]
  )

  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return sortedPlayers
    const q = playerSearch.trim().toLowerCase()
    return sortedPlayers.filter(p => p.displayName.toLowerCase().includes(q))
  }, [sortedPlayers, playerSearch])

  const togglePlayer = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Focus first score input when match changes
  useEffect(() => {
    if (phase === 'playing') {
      setTimeout(() => scoreARef.current?.focus(), 100)
    }
  }, [currentMatchIndex, phase])

  const startSession = () => {
    const selected = players.filter(p => selectedIds.has(p.id))
    if (selected.length < 3) {
      showToast('Select at least 3 players', 'error')
      return
    }

    const shuffled = shufflePlayers(selected)
    const m = getRoomMode(shuffled.length)
    setRoomPlayers(shuffled)
    setMode(m)
    setRoundNumber(1)
    setPlayedPairs(new Set())
    setGamesPlayedCount(new Map())
    setOddMatchAdded(false)

    const roundMatches = generateRound(shuffled, m, new Set(), new Map())
    setMatches(roundMatches)
    setCurrentMatchIndex(0)
    setScoreA('')
    setScoreB('')
    setPhase('playing')

    // Set first match to playing
    if (roundMatches.length > 0) {
      roundMatches[0].status = 'playing'
      setMatches([...roundMatches])
    }
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
    }
  }, [])

  const handleSubmitScore = async () => {
    const match = matches[currentMatchIndex]
    if (!match) return

    const pAScore = parseInt(scoreA) || 0
    const pBScore = parseInt(scoreB) || 0

    const input: NewMatchInput = {
      playerAId: match.playerA.id,
      playerBId: match.playerB.id,
      playerAScore: pAScore,
      playerBScore: pBScore,
      matchType: 11,
    }

    const validation = validateMatch(input)
    if (!validation.isValid) {
      showToast(validation.error || 'Invalid score', 'error')
      return
    }

    setSubmitting(true)
    try {
      await createMatch(input)

      const winnerId = pAScore > pBScore ? match.playerA.id : match.playerB.id
      const loserId = winnerId === match.playerA.id ? match.playerB.id : match.playerA.id

      // Update match result
      const updated = matches.map(m => ({ ...m }))
      updated[currentMatchIndex] = {
        ...updated[currentMatchIndex],
        status: 'done',
        result: { scoreA: pAScore, scoreB: pBScore, winnerId, loserId },
      }

      // Update played pairs and games count for 5+ mode
      const newPairs = addPlayedPair(playedPairs, match.playerA.id, match.playerB.id)
      setPlayedPairs(newPairs)

      const newCount = new Map(gamesPlayedCount)
      newCount.set(match.playerA.id, (newCount.get(match.playerA.id) || 0) + 1)
      newCount.set(match.playerB.id, (newCount.get(match.playerB.id) || 0) + 1)
      setGamesPlayedCount(newCount)

      // Resolve dependent matches for bracket modes
      let resolved = updated
      if (mode === '3-player') {
        resolved = resolve3PlayerMatch(updated, currentMatchIndex, roomPlayers)
      } else if (mode === '4-player') {
        resolved = resolve4PlayerMatch(updated, currentMatchIndex)
      } else if (mode === '5-plus' && !oddMatchAdded && roomPlayers.length % 2 === 1 && currentMatchIndex === 0) {
        // Odd player plays winner of game 1
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

      showToast('Score saved!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save match', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const startNewRound = () => {
    const rPlayers = mode === '3-player' ? roomPlayers : shufflePlayers(roomPlayers)
    const roundMatches = generateRound(rPlayers, mode, playedPairs, gamesPlayedCount)
    setMatches(roundMatches)
    setCurrentMatchIndex(0)
    setScoreA('')
    setScoreB('')
    setOddMatchAdded(false)
    setRoundNumber(prev => prev + 1)

    if (roundMatches.length > 0) {
      roundMatches[0].status = 'playing'
      setMatches([...roundMatches])
    }
    setPhase('playing')
  }

  const endSession = async () => {
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
      </header>

      {/* === SETUP PHASE === */}
      {phase === 'setup' && (
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
          {/* Progress */}
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Match {completedCount + 1}{expectedTotal ? ` of ${expectedTotal}` : ''}</span>
            <button
              onClick={() => {
                if (confirm('End session? Completed matches are already saved.')) endSession()
              }}
              className="text-xs text-gray-500 hover:text-error transition-colors"
            >
              End Session
            </button>
          </div>

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
                {matches.filter(m => m.status === 'done').map(m => {
                  const winnerIsA = m.result!.winnerId === m.playerA.id
                  return (
                    <div
                      key={m.id}
                      className="bg-background-light rounded-xl px-4 py-2.5 border border-background-lighter flex items-center justify-between"
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
                      <span className="text-sm font-bold text-white">
                        {m.result!.scoreA}–{m.result!.scoreB}
                      </span>
                    </div>
                  )
                })}
              </div>
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
              {matches.filter(m => m.status === 'done').map(m => {
                const winnerIsA = m.result!.winnerId === m.playerA.id
                return (
                  <div
                    key={m.id}
                    className="bg-background-light rounded-xl px-4 py-2.5 border border-background-lighter flex items-center justify-between"
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
                    <span className="text-sm font-bold text-white">
                      {m.result!.scoreA}–{m.result!.scoreB}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Player Win Summary */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Round Standings</h3>
            <div className="space-y-1.5">
              {roomPlayers
                .map(p => {
                  const wins = matches.filter(m => m.status === 'done' && m.result?.winnerId === p.id).length
                  const losses = matches.filter(m => m.status === 'done' && m.result?.loserId === p.id).length
                  return { player: p, wins, losses }
                })
                .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
                .map(({ player, wins, losses }) => (
                  <div
                    key={player.id}
                    className="bg-background-light rounded-xl px-4 py-2.5 border border-background-lighter flex items-center justify-between"
                  >
                    <span className="text-sm text-white font-medium">{player.displayName}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-success">{wins}W</span>
                      <span className="text-error">{losses}L</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

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
