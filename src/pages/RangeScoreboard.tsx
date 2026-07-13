import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { calculateElo, getRatingTier } from '../lib/elo'

const BASE_ELO = 800
const MIN_GAMES_ACTIVE = 5

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromInputDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

interface Standing {
  id: string
  name: string
  elo: number
  wins: number
  losses: number
  games: number
}

export default function RangeScoreboard() {
  const navigate = useNavigate()
  const { players } = usePlayers()
  const { matches } = useMatches()

  const today = startOfDay(new Date())
  const [rangeFrom, setRangeFrom] = useState(addDays(today, -30))
  const [rangeTo, setRangeTo] = useState(today)
  const [showInactive, setShowInactive] = useState(false)

  const playerMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of players) m.set(p.id, p.displayName)
    return m
  }, [players])

  // Replay every match in the window from a clean slate (everyone starts at BASE_ELO)
  const standings = useMemo<Standing[]>(() => {
    const start = startOfDay(rangeFrom).getTime()
    const end = addDays(startOfDay(rangeTo), 1).getTime()

    const inRange = matches
      .filter(m => {
        const t = new Date(m.createdAt).getTime()
        return t >= start && t < end
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const state = new Map<string, Standing>()
    const ensure = (id: string) => {
      if (!state.has(id)) {
        state.set(id, { id, name: playerMap.get(id) || 'Unknown', elo: BASE_ELO, wins: 0, losses: 0, games: 0 })
      }
      return state.get(id)!
    }

    for (const m of inRange) {
      const winner = ensure(m.winnerId)
      const loser = ensure(m.loserId)

      const winnerScore = m.winnerId === m.playerAId ? m.playerAScore : m.playerBScore
      const loserScore = m.winnerId === m.playerAId ? m.playerBScore : m.playerAScore

      const result = calculateElo(
        winner.elo,
        loser.elo,
        winner.games,
        loser.games,
        winnerScore,
        loserScore,
      )

      winner.elo = result.newWinnerRating
      loser.elo = result.newLoserRating
      winner.wins += 1
      loser.losses += 1
      winner.games += 1
      loser.games += 1
    }

    return [...state.values()].sort((a, b) => b.elo - a.elo)
  }, [matches, rangeFrom, rangeTo, playerMap])

  const inactiveCount = useMemo(() => standings.filter(s => s.games < MIN_GAMES_ACTIVE).length, [standings])
  const visibleStandings = useMemo(
    () => (showInactive ? standings : standings.filter(s => s.games >= MIN_GAMES_ACTIVE)),
    [standings, showInactive],
  )

  const totalMatches = useMemo(() => standings.reduce((s, r) => s + r.games, 0) / 2, [standings])

  const setQuickRange = (days: number) => {
    setRangeFrom(addDays(today, -days))
    setRangeTo(today)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-display font-bold text-white mb-1">Scoreboard by Date</h1>
      <p className="text-sm text-gray-400 mb-4">
        Standings as if everyone started fresh at {BASE_ELO} on {formatDateShort(rangeFrom)}.
      </p>

      {/* Quick ranges */}
      <div className="flex gap-1 p-1 bg-background-light rounded-lg mb-3">
        {[
          { label: '1W', days: 7 },
          { label: '1M', days: 30 },
          { label: '3M', days: 90 },
          { label: '1Y', days: 365 },
        ].map(opt => {
          const active = toInputDate(rangeFrom) === toInputDate(addDays(today, -opt.days)) && toInputDate(rangeTo) === toInputDate(today)
          return (
            <button
              key={opt.label}
              onClick={() => setQuickRange(opt.days)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                active ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Date range picker */}
      <div className="mb-5 p-4 bg-background-light rounded-xl border border-background-lighter">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={toInputDate(rangeFrom)}
              max={toInputDate(rangeTo)}
              onChange={e => e.target.value && setRangeFrom(fromInputDate(e.target.value))}
              className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="pt-5 text-gray-500">–</div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={toInputDate(rangeTo)}
              min={toInputDate(rangeFrom)}
              max={toInputDate(today)}
              onChange={e => e.target.value && setRangeTo(fromInputDate(e.target.value))}
              className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Active/inactive toggle */}
      {standings.length > 0 && inactiveCount > 0 && (
        <button
          onClick={() => setShowInactive(v => !v)}
          className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-background-light border border-background-lighter text-xs font-medium text-gray-300 hover:text-white hover:border-primary/40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {showInactive ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            )}
          </svg>
          {showInactive ? `Hide inactive (${inactiveCount})` : `Show inactive (${inactiveCount})`}
        </button>
      )}

      {/* Standings */}
      {standings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No games played in this range</p>
        </div>
      ) : visibleStandings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">All players have fewer than {MIN_GAMES_ACTIVE} games in this range.</p>
          <button
            onClick={() => setShowInactive(true)}
            className="mt-3 text-sm text-primary-400 hover:text-primary-300"
          >
            Show them anyway
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleStandings.map((entry, index) => {
            const winRate = entry.games > 0 ? Math.round((entry.wins / entry.games) * 100) : 0
            const eloChange = entry.elo - BASE_ELO
            return (
              <div
                key={entry.id}
                onClick={() => navigate(`/player/${entry.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl bg-background-light hover:border-background-lighter border border-transparent transition-all duration-200 cursor-pointer active:scale-[0.99]"
              >
                <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0 ${
                  index === 0 ? 'bg-yellow-500/20 text-yellow-400' : index === 1 ? 'bg-gray-400/20 text-gray-300' : index === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-background-lighter text-gray-300'
                }`}>
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate flex items-center gap-1.5">
                    <span className="truncate">{entry.name}</span>
                    {entry.games < MIN_GAMES_ACTIVE && (
                      <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-600/40 text-gray-400">
                        provisional
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {entry.games} game{entry.games !== 1 ? 's' : ''} · {entry.wins}W {entry.losses}L · {winRate}%
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-lg text-white leading-tight">{entry.elo}</div>
                  <div className={`text-xs font-medium ${eloChange > 0 ? 'text-success' : eloChange < 0 ? 'text-error' : 'text-gray-500'}`}>
                    {eloChange > 0 ? '+' : ''}{eloChange} · {getRatingTier(entry.elo)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {visibleStandings.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-500">
          {totalMatches} match{totalMatches !== 1 ? 'es' : ''} · {visibleStandings.length} player{visibleStandings.length !== 1 ? 's' : ''}
          {!showInactive && inactiveCount > 0 && ` · ${inactiveCount} hidden`}
        </div>
      )}
    </div>
  )
}
