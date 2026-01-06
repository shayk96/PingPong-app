/**
 * Stats grid component
 * Displays player statistics in a grid of cards
 */

import type { UserStats } from '../../types'

interface StatsGridProps {
  stats: UserStats
  eloRating: number
  rank: number
}

export function StatsGrid({ stats, eloRating, rank }: StatsGridProps) {
  const winRate = stats.totalGames > 0 
    ? Math.round((stats.wins / stats.totalGames) * 100) 
    : 0

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* ELO Rating */}
      <div className="bg-background-light rounded-xl p-4 border border-background-lighter">
        <div className="text-sm text-gray-400 mb-1">ELO Rating</div>
        <div className="text-2xl font-display font-bold text-white">{eloRating}</div>
      </div>

      {/* Rank */}
      <div className="bg-background-light rounded-xl p-4 border border-background-lighter">
        <div className="text-sm text-gray-400 mb-1">Rank</div>
        <div className="text-2xl font-display font-bold text-white">#{rank}</div>
      </div>

      {/* Games Played */}
      <div className="bg-background-light rounded-xl p-4 border border-background-lighter">
        <div className="text-sm text-gray-400 mb-1">Games Played</div>
        <div className="text-2xl font-display font-bold text-white">{stats.totalGames}</div>
      </div>

      {/* Win Rate */}
      <div className="bg-background-light rounded-xl p-4 border border-background-lighter">
        <div className="text-sm text-gray-400 mb-1">Win Rate</div>
        <div className="text-2xl font-display font-bold text-white">{winRate}%</div>
      </div>

      {/* Wins */}
      <div className="bg-background-light rounded-xl p-4 border border-success/30">
        <div className="text-sm text-gray-400 mb-1">Wins</div>
        <div className="text-2xl font-display font-bold text-success">{stats.wins}</div>
      </div>

      {/* Losses */}
      <div className="bg-background-light rounded-xl p-4 border border-error/30">
        <div className="text-sm text-gray-400 mb-1">Losses</div>
        <div className="text-2xl font-display font-bold text-error">{stats.losses}</div>
      </div>

      {/* Current Streak - Full width */}
      <div className="col-span-2 bg-background-light rounded-xl p-4 border border-background-lighter">
        <div className="text-sm text-gray-400 mb-1">Current Streak</div>
        <div className="flex items-center gap-2">
          <span className={`
            text-2xl font-display font-bold
            ${stats.streakType === 'win' ? 'text-success' : stats.streakType === 'loss' ? 'text-error' : 'text-gray-400'}
          `}>
            {stats.currentStreak}
          </span>
          <span className={`
            text-lg
            ${stats.streakType === 'win' ? 'text-success' : stats.streakType === 'loss' ? 'text-error' : 'text-gray-400'}
          `}>
            {stats.streakType === 'win' && '🔥 Wins'}
            {stats.streakType === 'loss' && 'Losses'}
            {stats.streakType === 'none' && 'No games yet'}
          </span>
        </div>
      </div>
    </div>
  )
}

