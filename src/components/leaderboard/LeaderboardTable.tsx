import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LeaderboardEntry, Match } from '../../types'
import { getRatingTier } from '../../lib/elo'

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  onDeletePlayer?: (playerId: string, playerName: string) => void
  matches?: Match[]
}

export function LeaderboardTable({ entries, onDeletePlayer, matches = [] }: LeaderboardTableProps) {
  const navigate = useNavigate()

  // Count unique opponents beaten per player (1 "gun" per unique opponent defeated)
  const uniqueKillsMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (matches.length === 0) return new Map<string, number>()
    for (const m of matches) {
      const loserId = m.winnerId === m.playerAId ? m.playerBId : m.playerAId
      if (!map.has(m.winnerId)) map.set(m.winnerId, new Set())
      map.get(m.winnerId)!.add(loserId)
    }
    const result = new Map<string, number>()
    for (const [id, opponents] of map) {
      result.set(id, opponents.size)
    }
    return result
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
        const kills = uniqueKillsMap.get(entry.user.id) || 0
        return (
          <div
            key={entry.user.id}
            onClick={() => navigate(`/player/${entry.user.id}`)}
            className="flex items-center gap-2 p-3 rounded-xl border border-transparent hover:border-background-lighter transition-all duration-200 cursor-pointer active:scale-[0.99] bg-background-light"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Rank */}
            <div className="w-9 flex-shrink-0">
              <RankBadge rank={entry.rank} isProvisional={entry.isProvisional} isInactive={entry.isInactive} />
            </div>

            {/* Player info */}
            <div className="flex-1 min-w-0">
              <div className={`font-semibold truncate flex items-center gap-1.5 ${entry.isProvisional ? 'text-gray-400' : 'text-white'}`}>
                {entry.user.displayName}
                {kills > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 flex-shrink-0"
                    title={`Defeated ${kills} unique opponent${kills > 1 ? 's' : ''}`}
                  >
                    <svg className="w-4 h-4 text-accent drop-shadow-[0_0_3px_rgba(249,115,22,0.4)]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 5H23L19.5 8.5L23 12H7L3 17H1V15L4 11L1 7V5H3L7 5Z" />
                    </svg>
                    <span className="text-[10px] font-bold text-accent">{kills}</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-yellow-400">
                {getRatingTier(entry.user.eloRating)}
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

            {/* Delete button */}
            {onDeletePlayer && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeletePlayer(entry.user.id, entry.user.displayName)
                }}
                className="flex-shrink-0 p-2 text-gray-500 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                title="Delete player"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RankBadge({ rank, isProvisional, isInactive }: { rank: number; isProvisional?: boolean; isInactive?: boolean }) {
  // PAUSED: inactive badge disabled — all players ranked normally
  // if (isInactive) {
  //   return (
  //     <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-medium text-gray-500" title="Inactive">-</div>
  //   )
  // }
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
