import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LeaderboardEntry, Match } from '../../types'
import { getRatingTier } from '../../lib/elo'
import { computeCurrentStreaks } from '../../lib/streaks'
import type { SeasonBadge } from '../../lib/seasons'
import { SeasonBadgePill } from '../season/SeasonBadgePill'

// Streak thresholds for hot/cold badges
const FIRE_MIN = 6 // winning streak of over 5 games
const ICE_MIN = 5  // losing streak of 5+ games
const MIN_RANKED_GAMES = 5

const MOMENTUM_GAMES = 10

interface Momentum {
  wins: number
  losses: number
  delta: number
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  matches?: Match[]
  /** Podium of the last completed season, keyed by player id */
  seasonBadges?: Map<string, SeasonBadge>
}

export function LeaderboardTable({ entries, matches = [], seasonBadges }: LeaderboardTableProps) {
  const navigate = useNavigate()

  // Count total 11-0 wins per player
  const perfectWinsMap = useMemo(() => {
    const map = new Map<string, number>()
    if (matches.length === 0) return map
    for (const m of matches) {
      if ((m.playerAScore === 11 && m.playerBScore === 0) || (m.playerBScore === 11 && m.playerAScore === 0)) {
        map.set(m.winnerId, (map.get(m.winnerId) || 0) + 1)
      }
    }
    return map
  }, [matches])

  // Current win/loss streak per player (for Fire/Ice badges)
  const streakMap = useMemo(() => computeCurrentStreaks(matches), [matches])

  // Record and net ELO over each player's last 10 games
  const momentumMap = useMemo(() => {
    const map = new Map<string, Momentum>()
    const newestFirst = [...matches].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const add = (id: string, won: boolean, delta: number) => {
      const m = map.get(id) ?? { wins: 0, losses: 0, delta: 0 }
      if (m.wins + m.losses >= MOMENTUM_GAMES) return
      if (won) m.wins++
      else m.losses++
      m.delta += delta
      map.set(id, m)
    }
    for (const m of newestFirst) {
      add(m.winnerId, true, m.winnerEloDelta)
      add(m.loserId, false, m.loserEloDelta)
    }
    return map
  }, [matches])

  // Today's ELO delta per player
  const todayDeltaMap = useMemo(() => {
    const map = new Map<string, number>()
    if (matches.length === 0) return map
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    for (const m of matches) {
      if (new Date(m.createdAt).getTime() < todayStart) continue
      map.set(m.winnerId, (map.get(m.winnerId) || 0) + m.winnerEloDelta)
      map.set(m.loserId, (map.get(m.loserId) || 0) + m.loserEloDelta)
    }
    return map
  }, [matches])

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No players yet. Add some players to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const pw = perfectWinsMap.get(entry.user.id) || 0
        const todayDelta = todayDeltaMap.get(entry.user.id) || 0
        const streak = streakMap.get(entry.user.id)
        const onFire = streak?.type === 'win' && streak.length >= FIRE_MIN
        const onIce = streak?.type === 'loss' && streak.length >= ICE_MIN
        const seasonBadge = seasonBadges?.get(entry.user.id)
        return (
          <div
            key={entry.user.id}
            onClick={() => navigate(`/player/${entry.user.id}`)}
            className="flex items-center gap-2 p-3 pr-2 rounded-xl border border-transparent hover:border-background-lighter transition-all duration-200 cursor-pointer active:scale-[0.99] bg-background-light"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Rank */}
            <div className="w-9 flex-shrink-0">
              <RankBadge rank={entry.rank} isProvisional={entry.isProvisional} games={entry.wins + entry.losses} />
            </div>

            {/* Player info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`font-semibold truncate min-w-0 ${entry.isProvisional ? 'text-gray-400' : 'text-white'}`}>
                  {entry.user.displayName}
                </span>
                {(seasonBadge || pw > 0 || onFire || onIce) && (
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {seasonBadge && <SeasonBadgePill badge={seasonBadge} compact />}
                    {pw > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5"
                        title={`${pw} total 11-0 win${pw > 1 ? 's' : ''}`}
                      >
                        <span className="text-sm leading-none">🔫</span>
                        <span className="text-[10px] font-bold text-accent">{pw}</span>
                      </span>
                    )}
                    {onFire && (
                      <span
                        className="inline-flex items-center gap-0.5"
                        title={`On fire — ${streak!.length} wins in a row`}
                      >
                        <span className="text-sm leading-none">🔥</span>
                        <span className="text-[10px] font-bold text-orange-400">{streak!.length}</span>
                      </span>
                    )}
                    {onIce && (
                      <span
                        className="inline-flex items-center gap-0.5"
                        title={`Ice cold — ${streak!.length} losses in a row`}
                      >
                        <span className="text-sm leading-none">🧊</span>
                        <span className="text-[10px] font-bold text-sky-400">{streak!.length}</span>
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="text-xs text-yellow-400">
                {getRatingTier(entry.user.eloRating)}
              </div>
            </div>

            {/* Stats column — stacked so the name keeps more room on narrow screens */}
            <div className="flex-shrink-0 text-right leading-tight">
              <div className="text-xs text-success">{entry.wins}W</div>
              <div className="text-xs text-error">{entry.losses}L</div>
            </div>

            {/* ELO */}
            <div className="flex-shrink-0 w-14 text-right">
              <div className="font-display font-bold text-lg text-white">
                {entry.user.eloRating}
              </div>
              {todayDelta !== 0 && (
                <div className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${todayDelta > 0 ? 'text-success' : 'text-error'}`}>
                  {todayDelta > 0 ? '▲' : '▼'} {Math.abs(todayDelta)}
                </div>
              )}
            </div>

            <MomentumArrow momentum={momentumMap.get(entry.user.id)} />
          </div>
        )
      })}
    </div>
  )
}

/** Arrow tilted by net ELO over the last 10 games: steep up → flat → steep down */
function MomentumArrow({ momentum }: { momentum?: Momentum }) {
  if (!momentum) return <div className="flex-shrink-0 w-7" />
  const { wins, losses, delta } = momentum
  const [rotation, color] =
    delta >= 30 ? [-90, 'text-success']
    : delta >= 10 ? [-45, 'text-success/80']
    : delta > -10 ? [0, 'text-gray-400']
    : delta > -30 ? [45, 'text-error/80']
    : [90, 'text-error']
  return (
    <div
      className={`flex-shrink-0 w-7 h-7 flex items-center justify-center ${color}`}
      title={`Last ${wins + losses}: ${wins}W–${losses}L, ${delta > 0 ? '+' : ''}${delta} ELO`}
    >
      <svg className="w-4 h-4 transition-transform" style={{ transform: `rotate(${rotation}deg)` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-6-6l6 6-6 6" />
      </svg>
    </div>
  )
}

function RankBadge({ rank, isProvisional, games }: { rank: number; isProvisional?: boolean; games: number }) {
  if (isProvisional) {
    const left = MIN_RANKED_GAMES - games
    return (
      <div
        className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] font-semibold text-gray-400"
        title={`Unranked — ${left} more game${left === 1 ? '' : 's'} this season to get a rank`}
      >
        {games}/{MIN_RANKED_GAMES}
      </div>
    )
  }
  
  if (rank === 1) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-sm font-bold text-yellow-900 shadow-lg shadow-yellow-500/30">
        👑
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-sm font-bold text-gray-800">
        2
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-sm font-bold text-amber-100">
        3
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-background-lighter flex items-center justify-center text-sm font-medium text-gray-300">
      {rank}
    </div>
  )
}
