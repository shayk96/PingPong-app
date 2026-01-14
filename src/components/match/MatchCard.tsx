/**
 * Match card component
 * Displays a single match with scores and ELO changes
 */

import { formatEloDelta } from '../../lib/elo'
import type { Match, User } from '../../types'

interface MatchCardProps {
  match: Match
  playerA?: User
  playerB?: User
  onDelete?: () => void
  canDelete?: boolean
}

export function MatchCard({
  match,
  playerA,
  playerB,
  onDelete,
  canDelete = false
}: MatchCardProps) {
  const isPlayerAWinner = match.winnerId === match.playerAId

  // Format date
  const dateStr = match.createdAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className="bg-background-light rounded-xl p-4 border border-background-lighter">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">{dateStr}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-background-lighter px-2 py-0.5 rounded-full text-gray-300">
            First to {match.matchType}
          </span>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.()
              }}
              className="text-gray-400 hover:text-error transition-colors p-1"
              title="Delete match"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Players and scores */}
      <div className="flex items-center justify-between">
        {/* Player A */}
        <div className={`flex-1 ${isPlayerAWinner ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate max-w-[100px]">
              {playerA?.displayName || 'Unknown'}
            </span>
            {isPlayerAWinner && (
              <span className="text-success">✓</span>
            )}
          </div>
          <div className={`text-sm ${isPlayerAWinner ? 'text-success' : 'text-error'}`}>
            {isPlayerAWinner 
              ? formatEloDelta(match.winnerEloDelta)
              : formatEloDelta(match.loserEloDelta)
            }
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2 px-4">
          <span className={`
            text-2xl font-display font-bold
            ${isPlayerAWinner ? 'text-white' : 'text-gray-400'}
          `}>
            {match.playerAScore}
          </span>
          <span className="text-gray-500">:</span>
          <span className={`
            text-2xl font-display font-bold
            ${!isPlayerAWinner ? 'text-white' : 'text-gray-400'}
          `}>
            {match.playerBScore}
          </span>
        </div>

        {/* Player B */}
        <div className={`flex-1 text-right ${!isPlayerAWinner ? '' : 'opacity-60'}`}>
          <div className="flex items-center justify-end gap-2">
            {!isPlayerAWinner && (
              <span className="text-success">✓</span>
            )}
            <span className="font-semibold text-white truncate max-w-[100px]">
              {playerB?.displayName || 'Unknown'}
            </span>
          </div>
          <div className={`text-sm ${!isPlayerAWinner ? 'text-success' : 'text-error'}`}>
            {!isPlayerAWinner 
              ? formatEloDelta(match.winnerEloDelta)
              : formatEloDelta(match.loserEloDelta)
            }
          </div>
        </div>
      </div>
    </div>
  )
}

