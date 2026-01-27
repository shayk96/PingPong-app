/**
 * Leaderboard table component
 * Displays player rankings with ELO and stats
 */

import type { LeaderboardEntry } from '../../types'
import { getRatingTier } from '../../lib/elo'

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  onDeletePlayer?: (playerId: string, playerName: string) => void
  onViewHistory?: (playerId: string, playerName: string) => void
}

export function LeaderboardTable({ entries, onDeletePlayer, onViewHistory }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No players yet. Add some players to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div
          key={entry.user.id}
          className="flex items-center gap-2 p-3 rounded-xl bg-background-light border border-transparent hover:border-background-lighter transition-all duration-200"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Rank */}
          <div className="w-9 flex-shrink-0">
            <RankBadge rank={entry.rank} isProvisional={entry.isProvisional} />
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0">
            <div className={`font-semibold truncate ${entry.isProvisional ? 'text-gray-400' : 'text-white'}`}>
              {entry.user.displayName}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-yellow-400">
                {getRatingTier(entry.user.eloRating)}
              </span>
              {entry.isProvisional && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded-full whitespace-nowrap">
                  Provisional
                </span>
              )}
            </div>
          </div>

          {/* Stats column */}
          <div className="flex-shrink-0 text-center px-2">
            <div className="text-xs">
              <span className="text-success">{entry.wins}W</span>
              {' '}
              <span className="text-error">{entry.losses}L</span>
            </div>
          </div>

          {/* ELO */}
          <div className="flex-shrink-0 w-14 text-right">
            <div className="font-display font-bold text-lg text-white">
              {entry.user.eloRating}
            </div>
          </div>

          {/* View History button */}
          {onViewHistory && (
            <button
              onClick={() => onViewHistory(entry.user.id, entry.user.displayName)}
              className="flex-shrink-0 p-2 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
              title="View match history"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          {/* Delete button */}
          {onDeletePlayer && (
            <button
              onClick={() => onDeletePlayer(entry.user.id, entry.user.displayName)}
              className="flex-shrink-0 p-2 text-gray-500 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
              title="Delete player"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function RankBadge({ rank, isProvisional }: { rank: number; isProvisional?: boolean }) {
  // Provisional players get a muted badge with "?" or just grayed out
  if (isProvisional) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-medium text-gray-500">
        -
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
