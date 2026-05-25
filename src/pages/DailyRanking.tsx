import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'

type ViewMode = 'day' | 'week' | 'range'

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(startOfDay(d), diff)
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
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

interface PlayerDelta {
  id: string
  name: string
  delta: number
  wins: number
  losses: number
  games: number
}

export default function DailyRanking() {
  const navigate = useNavigate()
  const { players } = usePlayers()
  const { matches } = useMatches()

  const today = startOfDay(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [rangeFrom, setRangeFrom] = useState(addDays(today, -7))
  const [rangeTo, setRangeTo] = useState(today)

  const playerMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of players) m.set(p.id, p.displayName)
    return m
  }, [players])

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'range') {
      return { rangeStart: startOfDay(rangeFrom), rangeEnd: addDays(startOfDay(rangeTo), 1) }
    }
    if (viewMode === 'week') {
      const monday = getMonday(selectedDate)
      return { rangeStart: monday, rangeEnd: addDays(monday, 7) }
    }
    const day = startOfDay(selectedDate)
    return { rangeStart: day, rangeEnd: addDays(day, 1) }
  }, [selectedDate, viewMode, rangeFrom, rangeTo])

  const rankings = useMemo<PlayerDelta[]>(() => {
    const filtered = matches.filter(m => {
      const t = new Date(m.createdAt).getTime()
      return t >= rangeStart.getTime() && t < rangeEnd.getTime()
    })

    const map = new Map<string, PlayerDelta>()

    for (const m of filtered) {
      const winnerId = m.winnerId
      const loserId = m.loserId
      const wDelta = m.winnerEloDelta
      const lDelta = m.loserEloDelta

      if (!map.has(winnerId)) {
        map.set(winnerId, { id: winnerId, name: playerMap.get(winnerId) || 'Unknown', delta: 0, wins: 0, losses: 0, games: 0 })
      }
      if (!map.has(loserId)) {
        map.set(loserId, { id: loserId, name: playerMap.get(loserId) || 'Unknown', delta: 0, wins: 0, losses: 0, games: 0 })
      }

      const w = map.get(winnerId)!
      w.delta += wDelta
      w.wins += 1
      w.games += 1

      const l = map.get(loserId)!
      l.delta += lDelta
      l.losses += 1
      l.games += 1
    }

    return [...map.values()].sort((a, b) => b.delta - a.delta)
  }, [matches, rangeStart, rangeEnd, playerMap])

  const navigateDate = (dir: -1 | 1) => {
    if (viewMode === 'week') {
      setSelectedDate(prev => addDays(prev, dir * 7))
    } else {
      setSelectedDate(prev => addDays(prev, dir))
    }
  }

  const isToday = startOfDay(selectedDate).getTime() === today.getTime()
  const isCurrentWeek = viewMode === 'week' && getMonday(selectedDate).getTime() === getMonday(today).getTime()
  const canGoForward = viewMode === 'day' ? !isToday : viewMode === 'week' ? !isCurrentWeek : false

  const headerLabel = viewMode === 'range'
    ? `${formatDateShort(rangeFrom)} – ${formatDateShort(rangeTo)}`
    : viewMode === 'week'
    ? `${formatDateShort(rangeStart)} – ${formatDateShort(addDays(rangeEnd, -1))}`
    : isToday ? 'Today' : formatDateShort(selectedDate)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-display font-bold text-white mb-4">
        {viewMode === 'day' ? 'Daily' : viewMode === 'week' ? 'Weekly' : 'Custom Range'} Ranking
      </h1>

      {/* View mode toggle */}
      <div className="flex gap-1 p-1 bg-background-light rounded-lg mb-4">
        <button
          onClick={() => setViewMode('day')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'day' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Day
        </button>
        <button
          onClick={() => setViewMode('week')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'week' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Week
        </button>
        <button
          onClick={() => setViewMode('range')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'range' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Range
        </button>
      </div>

      {/* Date navigation — day/week modes */}
      {viewMode !== 'range' && (
        <>
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 rounded-lg bg-background-light hover:bg-background-lighter transition-colors"
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-white font-semibold text-lg hover:text-primary-300 transition-colors flex items-center gap-2"
            >
              {headerLabel}
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              onClick={() => navigateDate(1)}
              disabled={!canGoForward}
              className={`p-2 rounded-lg transition-colors ${
                canGoForward ? 'bg-background-light hover:bg-background-lighter text-gray-300' : 'bg-background-light/50 text-gray-600 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {showDatePicker && (
            <div className="mb-4 p-3 bg-background-light rounded-xl border border-background-lighter">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={toInputDate(selectedDate)}
                  max={toInputDate(today)}
                  onChange={e => {
                    setSelectedDate(fromInputDate(e.target.value))
                    setShowDatePicker(false)
                  }}
                  className="flex-1 bg-background border border-background-lighter rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                />
                {!isToday && (
                  <button
                    onClick={() => { setSelectedDate(today); setShowDatePicker(false) }}
                    className="text-sm text-primary-400 hover:text-primary-300 whitespace-nowrap"
                  >
                    Go to today
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Date range picker — range mode */}
      {viewMode === 'range' && (
        <div className="mb-5 p-4 bg-background-light rounded-xl border border-background-lighter space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">From</label>
              <input
                type="date"
                value={toInputDate(rangeFrom)}
                max={toInputDate(rangeTo)}
                onChange={e => setRangeFrom(fromInputDate(e.target.value))}
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
                onChange={e => setRangeTo(fromInputDate(e.target.value))}
                className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="text-center text-xs text-gray-400">
            {formatDateShort(rangeFrom)} – {formatDateShort(rangeTo)}
          </div>
        </div>
      )}

      {/* Rankings table */}
      {rankings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No games played {viewMode === 'day' ? 'on this day' : viewMode === 'week' ? 'this week' : 'in this range'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rankings.map((entry, index) => (
            <div
              key={entry.id}
              onClick={() => navigate(`/player/${entry.id}`)}
              className="flex items-center gap-3 p-3 rounded-xl bg-background-light hover:border-background-lighter border border-transparent transition-all duration-200 cursor-pointer active:scale-[0.99]"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              {/* Rank */}
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-background-lighter text-sm font-bold text-gray-300 flex-shrink-0">
                {index + 1}
              </div>

              {/* Player name + record */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{entry.name}</div>
                <div className="text-xs text-gray-400">
                  {entry.games} game{entry.games !== 1 ? 's' : ''} · {entry.wins}W {entry.losses}L
                </div>
              </div>

              {/* ELO delta */}
              <div className={`text-right font-bold text-lg flex-shrink-0 ${
                entry.delta > 0 ? 'text-success' : entry.delta < 0 ? 'text-error' : 'text-gray-400'
              }`}>
                {entry.delta > 0 ? '+' : ''}{entry.delta}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary footer */}
      {rankings.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-500">
          {rankings.reduce((s, r) => s + r.games, 0) / 2} match{rankings.reduce((s, r) => s + r.games, 0) / 2 !== 1 ? 'es' : ''} · {rankings.length} player{rankings.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
