/**
 * Leaderboard table component
 * Displays player rankings with ELO and stats
 */

import { useNavigate } from 'react-router-dom'
import type { LeaderboardEntry } from '../../types'
import { getRatingTier } from '../../lib/elo'

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  currentUserId?: string
}

export function LeaderboardTable({ entries, currentUserId }: LeaderboardTableProps) {
  const navigate = useNavigate()

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No players yet. Be the first to register!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div
          key={entry.user.id}
          onClick={() => navigate(`/profile/${entry.user.id}`)}
          className={`
            flex items-center gap-3 p-3 rounded-xl cursor-pointer
            transition-all duration-200 hover:scale-[1.02]
            ${entry.user.id === currentUserId 
              ? 'bg-accent/10 border border-accent/30' 
              : 'bg-background-light border border-transparent hover:border-background-lighter'
            }
          `}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Rank */}
          <div className="w-10 text-center">
            <RankBadge rank={entry.rank} />
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate">
                {entry.user.displayName}
              </span>
              {entry.user.id === currentUserId && (
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{getRatingTier(entry.user.eloRating)}</span>
              <span>•</span>
              <span className="text-success">{entry.wins}W</span>
              <span className="text-error">{entry.losses}L</span>
            </div>
          </div>

          {/* ELO and rank change */}
          <div className="text-right">
            <div className="font-display font-bold text-lg text-white">
              {entry.user.eloRating}
            </div>
            <RankChange change={entry.rankChange} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
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

function RankChange({ change }: { change: number }) {
  if (change > 0) {
    return (
      <div className="flex items-center justify-end text-success text-xs font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <span>{change}</span>
      </div>
    )
  }
  if (change < 0) {
    return (
      <div className="flex items-center justify-end text-error text-xs font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>{Math.abs(change)}</span>
      </div>
    )
  }
  return <div className="text-xs text-gray-500">—</div>
}

