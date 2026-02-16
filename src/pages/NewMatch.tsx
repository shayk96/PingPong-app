/**
 * New Match page
 * Form to log one or more ping pong games between the same two players
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { validateMatch } from '../lib/validation'
import { expectedScore } from '../lib/elo'
import { ToastContainer, useToast, Button } from '../components/ui'
import type { NewMatchInput, User } from '../types'

interface GameEntry {
  playerAScore: string
  playerBScore: string
}

export default function NewMatch() {
  const navigate = useNavigate()
  const { players, loading: playersLoading, refresh: refreshPlayers } = usePlayers()
  const { matches, createMatch } = useMatches()
  const { toasts, showToast, removeToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState('')

  const [playerA, setPlayerA] = useState<User | null>(null)
  const [playerB, setPlayerB] = useState<User | null>(null)
  const [games, setGames] = useState<GameEntry[]>([{ playerAScore: '', playerBScore: '' }])
  const matchType = 11 as const // All games first to 11
  const [gameErrors, setGameErrors] = useState<(string | null)[]>([])
  const scoreInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const [focusTarget, setFocusTarget] = useState<string | null>(null)

  // Focus a score input when target changes
  useEffect(() => {
    if (focusTarget) {
      // Small delay to let the DOM render the new row
      const timer = setTimeout(() => {
        scoreInputRefs.current.get(focusTarget)?.focus()
        setFocusTarget(null)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [focusTarget])

  const setScoreRef = useCallback((key: string, el: HTMLInputElement | null) => {
    if (el) scoreInputRefs.current.set(key, el)
    else scoreInputRefs.current.delete(key)
  }, [])

  // Blended win probability: H2H history + ELO, with more weight on history
  const winProb = useMemo(() => {
    if (!playerA || !playerB) return null

    // ELO-based probability
    const eloProbA = expectedScore(playerA.eloRating, playerB.eloRating)

    // Head-to-head record
    const h2hMatches = matches.filter(m =>
      (m.playerAId === playerA.id && m.playerBId === playerB.id) ||
      (m.playerAId === playerB.id && m.playerBId === playerA.id)
    )
    const h2hGames = h2hMatches.length
    const h2hWinsA = h2hMatches.filter(m => m.winnerId === playerA.id).length
    const h2hProbA = h2hGames > 0 ? h2hWinsA / h2hGames : 0.5

    // Blend: each H2H game shifts 7% weight toward history, max 70%
    const h2hWeight = Math.min(h2hGames * 0.07, 0.7)
    const eloWeight = 1 - h2hWeight
    const blendedA = eloWeight * eloProbA + h2hWeight * h2hProbA
    const pctA = Math.round(blendedA * 100)

    return {
      pctA: Math.max(1, Math.min(99, pctA)),
      pctB: Math.max(1, Math.min(99, 100 - pctA)),
      h2hGames,
      h2hWinsA,
      h2hWinsB: h2hGames - h2hWinsA,
    }
  }, [playerA, playerB, matches])

  const updateGame = (index: number, field: 'playerAScore' | 'playerBScore', value: string) => {
    setGames(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g))
    // Clear error for this game when user edits
    setGameErrors(prev => prev.map((e, i) => i === index ? null : e))
  }

  const addGame = () => {
    const newIndex = games.length
    setGames(prev => [...prev, { playerAScore: '', playerBScore: '' }])
    setGameErrors(prev => [...prev, null])
    setFocusTarget(`${newIndex}-A`)
  }

  const removeGame = (index: number) => {
    if (games.length <= 1) return
    setGames(prev => prev.filter((_, i) => i !== index))
    setGameErrors(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!playerA || !playerB) {
      showToast('Please select both players', 'error')
      return
    }

    // Validate all games
    const inputs: NewMatchInput[] = []
    const errors: (string | null)[] = []
    let hasError = false

    for (const game of games) {
      const input: NewMatchInput = {
        playerAId: playerA.id,
        playerBId: playerB.id,
        playerAScore: parseInt(game.playerAScore) || 0,
        playerBScore: parseInt(game.playerBScore) || 0,
        matchType
      }
      const validation = validateMatch(input)
      if (!validation.isValid) {
        errors.push(validation.error || 'Invalid score')
        hasError = true
      } else {
        errors.push(null)
      }
      inputs.push(input)
    }

    if (hasError) {
      setGameErrors(errors)
      showToast('Some games have invalid scores — check below', 'error')
      return
    }

    // Submit all games sequentially
    setSubmitting(true)
    let savedCount = 0
    try {
      for (let i = 0; i < inputs.length; i++) {
        setSubmitProgress(`Saving game ${i + 1} of ${inputs.length}...`)
        await createMatch(inputs[i])
        savedCount++
      }
      await refreshPlayers()
      const gameWord = inputs.length === 1 ? 'game' : 'games'
      showToast(`${savedCount} ${gameWord} saved successfully!`, 'success')

      setTimeout(() => {
        navigate('/leaderboard')
      }, 1000)
    } catch (err) {
      showToast(
        `Saved ${savedCount} of ${inputs.length} games. ${err instanceof Error ? err.message : 'Failed to save remaining games.'}`,
        'error'
      )
    } finally {
      setSubmitting(false)
      setSubmitProgress('')
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
      // Auto-focus first score when both players now selected
      if (playerB && playerB.id !== player.id) setFocusTarget('0-A')
    } else {
      if (playerA?.id === player.id) setPlayerA(null)
      setPlayerB(player)
      // Auto-focus first score when both players now selected
      if (playerA && playerA.id !== player.id) setFocusTarget('0-A')
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
        {/* Players Selection */}
        <div className="bg-background-light rounded-2xl p-4 border border-background-lighter">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            {playerA && playerB ? 'Matchup' : 'Select Players'}
          </label>

          {/* Player list */}
          <div className="grid grid-cols-2 gap-2">
            {sortedPlayers.map((player) => {
              const isSelectedA = playerA?.id === player.id
              const isSelectedB = playerB?.id === player.id
              const isSelected = isSelectedA || isSelectedB
              const bothSelected = playerA && playerB
              
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
                  className={`relative flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-accent text-white ring-2 ring-accent ring-offset-1 ring-offset-background-light'
                      : bothSelected
                        ? 'bg-background text-gray-500'
                        : 'bg-background text-gray-300 hover:bg-background-lighter'
                  }`}
                >
                  {/* Selection badge */}
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {isSelectedA ? '1' : '2'}
                    </span>
                  )}
                  <span className="truncate">{player.displayName}</span>
                </button>
              )
            })}
          </div>

          {/* VS display with names, H2H record, and blended win probability */}
          {playerA && playerB && winProb && (
            <div className="mt-3 p-3 bg-background rounded-xl">
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <div className="text-white font-bold">{playerA.displayName}</div>
                  <div className="text-xs text-gray-400">{playerA.eloRating} ELO</div>
                </div>
                <div className="text-accent font-display font-bold text-sm">VS</div>
                <div className="flex-1 text-center">
                  <div className="text-white font-bold">{playerB.displayName}</div>
                  <div className="text-xs text-gray-400">{playerB.eloRating} ELO</div>
                </div>
              </div>
              {/* H2H record */}
              {winProb.h2hGames > 0 && (
                <div className="mt-2 flex justify-center">
                  <span className="text-xs text-gray-500">
                    H2H: <span className="text-gray-300">{winProb.h2hWinsA}</span>–<span className="text-gray-300">{winProb.h2hWinsB}</span>
                    <span className="text-gray-600 ml-1">({winProb.h2hGames} games)</span>
                  </span>
                </div>
              )}
              {/* Win probability bar */}
              <div className="mt-2.5 pt-2.5 border-t border-background-lighter">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className={winProb.pctA >= winProb.pctB ? 'text-accent font-semibold' : 'text-gray-400'}>{winProb.pctA}%</span>
                  <span className="text-gray-500">Win Probability</span>
                  <span className={winProb.pctB >= winProb.pctA ? 'text-accent font-semibold' : 'text-gray-400'}>{winProb.pctB}%</span>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                  <div
                    className="rounded-full transition-all duration-500"
                    style={{
                      width: `${winProb.pctA}%`,
                      backgroundColor: winProb.pctA >= winProb.pctB ? '#f97316' : '#4b5563',
                    }}
                  />
                  <div
                    className="rounded-full transition-all duration-500"
                    style={{
                      width: `${winProb.pctB}%`,
                      backgroundColor: winProb.pctB > winProb.pctA ? '#f97316' : '#4b5563',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Games / Scores */}
        {playerA && playerB && (
          <div className="bg-background-light rounded-2xl p-4 border border-background-lighter">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300">
                Scores
              </label>
              <span className="text-xs text-gray-500">
                {games.length} {games.length === 1 ? 'game' : 'games'}
              </span>
            </div>

            {/* Column headers */}
            <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr auto 1fr auto' }}>
              <div className="text-center text-xs text-gray-400 truncate px-1">
                {playerA.displayName}
              </div>
              <div></div>
              <div className="text-center text-xs text-gray-400 truncate px-1">
                {playerB.displayName}
              </div>
              <div className="w-8"></div>
            </div>

            {/* Game rows */}
            <div className="space-y-2">
              {games.map((game, index) => (
                <div key={index}>
                  <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr auto 1fr auto' }}>
                    <input
                      ref={(el) => setScoreRef(`${index}-A`, el)}
                      type="number"
                      min="0"
                      max="99"
                      value={game.playerAScore}
                      onChange={(e) => updateGame(index, 'playerAScore', e.target.value)}
                      className={`w-full bg-background border rounded-xl px-3 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent ${
                        gameErrors[index] ? 'border-error' : 'border-background-lighter'
                      }`}
                      placeholder="0"
                    />
                    <span className="text-gray-500 text-sm font-medium">–</span>
                    <input
                      ref={(el) => setScoreRef(`${index}-B`, el)}
                      type="number"
                      min="0"
                      max="99"
                      value={game.playerBScore}
                      onChange={(e) => updateGame(index, 'playerBScore', e.target.value)}
                      className={`w-full bg-background border rounded-xl px-3 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent ${
                        gameErrors[index] ? 'border-error' : 'border-background-lighter'
                      }`}
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={() => removeGame(index)}
                      disabled={games.length <= 1}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                        games.length <= 1
                          ? 'text-gray-700 cursor-not-allowed'
                          : 'text-gray-500 hover:text-error hover:bg-error/10'
                      }`}
                      title="Remove game"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  {gameErrors[index] && (
                    <p className="text-error text-xs mt-1 text-center">
                      {gameErrors[index]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Add game button */}
            <button
              type="button"
              onClick={addGame}
              className="w-full mt-3 py-2.5 rounded-xl border-2 border-dashed border-background-lighter text-gray-400 text-sm font-medium hover:border-accent hover:text-accent transition-all"
            >
              + Add Game
            </button>
          </div>
        )}

        {/* Submit progress */}
        {submitting && submitProgress && (
          <div className="text-center text-sm text-accent animate-pulse">
            {submitProgress}
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
            disabled={!playerA || !playerB || games.every(g => !g.playerAScore && !g.playerBScore)}
            className="flex-1"
          >
            {games.length > 1 ? `Save ${games.length} Games` : 'Save Game'}
          </Button>
        </div>
      </form>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
