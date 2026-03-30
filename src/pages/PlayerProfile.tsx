/**
 * Player Profile page
 * Detailed view of a player's stats, ELO graph, opponent breakdown, and match history
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Line } from 'react-chartjs-2'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { usePlayerStats, useLeaderboard } from '../hooks/useStats'
import { fetchEloHistory, EloHistoryEntry } from '../lib/api'
import { getRatingTier, formatEloDelta } from '../lib/elo'
import { Button } from '../components/ui'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
)

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { players, loading: playersLoading } = usePlayers()
  const { matches, loading: matchesLoading } = useMatches()
  const [eloHistory, setEloHistory] = useState<EloHistoryEntry[]>([])
  const [eloLoading, setEloLoading] = useState(true)
  const chartRef = useRef<any>(null)

  const player = useMemo(() => players.find(p => p.id === id), [players, id])
  const stats = usePlayerStats(id || '', matches, players)
  const leaderboard = useLeaderboard(players, matches)

  const rank = useMemo(() => {
    const entry = leaderboard.find(e => e.user.id === id)
    return entry?.rank || 0
  }, [leaderboard, id])

  // Load ELO history
  useEffect(() => {
    if (!id) return
    setEloLoading(true)
    fetchEloHistory([id])
      .then(setEloHistory)
      .catch(console.error)
      .finally(() => setEloLoading(false))
  }, [id])

  // Player's matches sorted newest first
  const playerMatches = useMemo(() => {
    if (!id) return []
    const playerMap = new Map(players.map(p => [p.id, p]))
    return matches
      .filter(m => m.playerAId === id || m.playerBId === id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(m => ({
        ...m,
        opponent: playerMap.get(m.playerAId === id ? m.playerBId : m.playerAId),
        isWin: m.winnerId === id,
        playerScore: m.playerAId === id ? m.playerAScore : m.playerBScore,
        opponentScore: m.playerAId === id ? m.playerBScore : m.playerAScore,
        eloDelta: m.winnerId === id ? m.winnerEloDelta : m.loserEloDelta,
      }))
  }, [id, matches, players])

  // Recent form (last 10)
  const recentForm = useMemo(() => {
    return playerMatches.slice(0, 10).reverse()
  }, [playerMatches])

  // Best / worst matchup
  const bestMatchup = useMemo(() => {
    if (stats.opponentStats.length === 0) return null
    return [...stats.opponentStats]
      .filter(s => s.wins + s.losses >= 2)
      .sort((a, b) => {
        const aRate = a.wins / (a.wins + a.losses)
        const bRate = b.wins / (b.wins + b.losses)
        return bRate - aRate
      })[0] || null
  }, [stats.opponentStats])

  const worstMatchup = useMemo(() => {
    if (stats.opponentStats.length === 0) return null
    return [...stats.opponentStats]
      .filter(s => s.wins + s.losses >= 2)
      .sort((a, b) => {
        const aRate = a.wins / (a.wins + a.losses)
        const bRate = b.wins / (b.wins + b.losses)
        return aRate - bRate
      })[0] || null
  }, [stats.opponentStats])

  // Average score margin
  const avgMargin = useMemo(() => {
    const wins = playerMatches.filter(m => m.isWin)
    if (wins.length === 0) return 0
    const totalMargin = wins.reduce((sum, m) => sum + (m.playerScore - m.opponentScore), 0)
    return Math.round((totalMargin / wins.length) * 10) / 10
  }, [playerMatches])

  // ELO chart data
  const chartData = useMemo(() => {
    if (eloHistory.length === 0) return { datasets: [] }

    const sorted = [...eloHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const data = sorted.map(entry => ({
      x: new Date(entry.timestamp),
      y: entry.eloRating,
    }))

    // Add current ELO as final point
    if (player) {
      data.push({ x: new Date(), y: player.eloRating })
    }

    return {
      datasets: [{
        label: 'ELO Rating',
        data,
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        fill: true,
      }]
    }
  }, [eloHistory, player])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: '#e5e5e5',
        borderColor: '#444',
        borderWidth: 1,
      },
      zoom: {
        pan: { enabled: true, mode: 'xy' as const },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy' as const,
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'day' as const,
          displayFormats: { day: 'MMM d', week: 'MMM d', month: 'MMM yyyy' },
          tooltipFormat: 'MMM d, yyyy',
        },
        ticks: { color: '#9ca3af', maxRotation: 45 },
        grid: { color: 'rgba(75, 75, 75, 0.3)' },
      },
      y: {
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(75, 75, 75, 0.3)' },
      }
    }
  }

  const loading = playersLoading || matchesLoading

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-accent"></div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🤷</div>
          <h2 className="text-xl font-semibold text-white mb-2">Player Not Found</h2>
          <Button onClick={() => navigate('/leaderboard')} variant="primary">
            Back to Leaderboard
          </Button>
        </div>
      </div>
    )
  }

  const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate('/leaderboard')}
        className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-4 safe-top pt-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm">Leaderboard</span>
      </button>

      {/* Player Header */}
      <div className="bg-background-light rounded-2xl p-5 border border-background-lighter mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">
              {player.displayName}
            </h1>
            <div className="text-yellow-400 text-sm mt-0.5">
              {getRatingTier(player.eloRating)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-display font-bold text-accent">
              {player.eloRating}
            </div>
            <div className="text-xs text-gray-400">
              Rank #{rank || '—'}
            </div>
          </div>
        </div>

        {/* PAUSED: season champion badges hidden
        {player.seasonWins && player.seasonWins.length > 0 && (
          <div className="mt-3 pt-3 border-t border-background-lighter">
            <div className="flex flex-wrap gap-2">
              {player.seasonWins.map(s => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-xs font-semibold"
                >
                  🏆 Season {s} Champion
                </span>
              ))}
            </div>
          </div>
        )} */}

        {/* Recent Form */}
        {recentForm.length > 0 && (
          <div className="mt-4 pt-4 border-t border-background-lighter">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Recent Form</span>
              <span className="text-xs text-gray-500">Last {recentForm.length} games</span>
            </div>
            <div className="flex gap-1.5">
              {recentForm.map((m, i) => (
                <div
                  key={m.id}
                  className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                    m.isWin
                      ? 'bg-success/20 text-success border border-success/30'
                      : 'bg-error/20 text-error border border-error/30'
                  }`}
                  title={`${m.isWin ? 'W' : 'L'} ${m.playerScore}-${m.opponentScore} vs ${m.opponent?.displayName || '?'}`}
                >
                  {m.isWin ? 'W' : 'L'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-background-light rounded-xl p-3 border border-background-lighter text-center">
          <div className="text-xl font-display font-bold text-success">{stats.wins}</div>
          <div className="text-xs text-gray-400">Wins</div>
        </div>
        <div className="bg-background-light rounded-xl p-3 border border-background-lighter text-center">
          <div className="text-xl font-display font-bold text-error">{stats.losses}</div>
          <div className="text-xs text-gray-400">Losses</div>
        </div>
        <div className="bg-background-light rounded-xl p-3 border border-background-lighter text-center">
          <div className="text-xl font-display font-bold text-accent">{winRate}%</div>
          <div className="text-xs text-gray-400">Win Rate</div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-background-light rounded-xl p-3 border border-background-lighter text-center">
          <div className="text-xl font-display font-bold text-white">{stats.totalGames}</div>
          <div className="text-xs text-gray-400">Games</div>
        </div>
        <div className="bg-background-light rounded-xl p-3 border border-background-lighter text-center">
          <div className={`text-xl font-display font-bold ${
            stats.streakType === 'win' ? 'text-success' : stats.streakType === 'loss' ? 'text-error' : 'text-gray-400'
          }`}>
            {stats.currentStreak > 0 ? `${stats.currentStreak}${stats.streakType === 'win' ? 'W' : 'L'}` : '—'}
          </div>
          <div className="text-xs text-gray-400">Streak</div>
        </div>
        <div className="bg-background-light rounded-xl p-3 border border-background-lighter text-center">
          <div className="text-xl font-display font-bold text-white">{avgMargin}</div>
          <div className="text-xs text-gray-400">Avg Margin</div>
        </div>
      </div>

      {/* Best / Worst Matchup */}
      {(bestMatchup || worstMatchup) && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {bestMatchup && (
            <div className="bg-background-light rounded-xl p-3 border border-success/20">
              <div className="text-xs text-gray-400 mb-1">Best Matchup</div>
              <div className="text-sm font-semibold text-white truncate">{bestMatchup.opponentName}</div>
              <div className="text-xs text-success">
                {bestMatchup.wins}W-{bestMatchup.losses}L ({Math.round((bestMatchup.wins / (bestMatchup.wins + bestMatchup.losses)) * 100)}%)
              </div>
            </div>
          )}
          {worstMatchup && (
            <div className="bg-background-light rounded-xl p-3 border border-error/20">
              <div className="text-xs text-gray-400 mb-1">Worst Matchup</div>
              <div className="text-sm font-semibold text-white truncate">{worstMatchup.opponentName}</div>
              <div className="text-xs text-error">
                {worstMatchup.wins}W-{worstMatchup.losses}L ({Math.round((worstMatchup.wins / (worstMatchup.wins + worstMatchup.losses)) * 100)}%)
              </div>
            </div>
          )}
        </div>
      )}

      {/* ELO Graph */}
      <section className="mb-4">
        <h2 className="text-lg font-semibold text-white mb-3">ELO History</h2>
        <div className="bg-background-light rounded-2xl p-4 border border-background-lighter">
          <div className="h-52">
            {eloLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
              </div>
            ) : chartData.datasets.length > 0 && chartData.datasets[0].data.length > 1 ? (
              <Line ref={chartRef} data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                Not enough data for a graph yet
              </div>
            )}
          </div>
          {!eloLoading && chartData.datasets.length > 0 && chartData.datasets[0].data.length > 1 && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => chartRef.current?.resetZoom()}
                className="px-3 py-1 text-xs bg-background text-gray-400 rounded-lg hover:text-white transition-colors"
              >
                Reset Zoom
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Opponent Breakdown */}
      {stats.opponentStats.length > 0 && (
        <section className="mb-4">
          <h2 className="text-lg font-semibold text-white mb-3">Head to Head</h2>
          <div className="space-y-2">
            {stats.opponentStats.map((opp) => {
              const total = opp.wins + opp.losses
              const winPct = total > 0 ? (opp.wins / total) * 100 : 0

              return (
                <div
                  key={opp.opponentId}
                  className="bg-background-light rounded-xl p-3 border border-background-lighter"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-white text-sm truncate">{opp.opponentName}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {total} game{total !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-error/30 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-success rounded-full transition-all duration-500"
                      style={{ width: `${winPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs">
                    <span className="text-success">{opp.wins}W</span>
                    <span className="text-error">{opp.losses}L</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Match History */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Match History
          <span className="text-sm font-normal text-gray-400 ml-2">({playerMatches.length})</span>
        </h2>
        <div className="space-y-2">
          {playerMatches.length > 0 ? (
            playerMatches.map((match) => (
              <div
                key={match.id}
                className={`p-3 rounded-xl border ${
                  match.isWin
                    ? 'bg-success/5 border-success/20'
                    : 'bg-error/5 border-error/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-sm font-bold w-5 ${match.isWin ? 'text-success' : 'text-error'}`}>
                      {match.isWin ? 'W' : 'L'}
                    </span>
                    <div>
                      <div className="text-white text-sm font-medium">
                        vs {match.opponent?.displayName || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {match.createdAt.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' · '}
                        First to {match.matchType}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-bold text-sm">
                      {match.playerScore}–{match.opponentScore}
                    </div>
                    <div className={`text-xs ${match.isWin ? 'text-success' : 'text-error'}`}>
                      {formatEloDelta(match.eloDelta)} ELO
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              No matches played yet
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
