/**
 * Opponent breakdown component
 * Shows win/loss record against each opponent
 */

import type { OpponentStat } from '../../types'

interface OpponentBreakdownProps {
  stats: OpponentStat[]
}

export function OpponentBreakdown({ stats }: OpponentBreakdownProps) {
  if (stats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No matches played yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {stats.map((stat) => {
        const total = stat.wins + stat.losses
        const winPercentage = total > 0 ? (stat.wins / total) * 100 : 0

        return (
          <div
            key={stat.opponentId}
            className="bg-background-light rounded-xl p-4 border border-background-lighter"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white">{stat.opponentName}</span>
              <span className="text-sm text-gray-400">
                {total} game{total !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Win/Loss bar */}
            <div className="relative h-2 bg-error/30 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-success rounded-full transition-all duration-500"
                style={{ width: `${winPercentage}%` }}
              />
            </div>

            {/* Win/Loss counts */}
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-success">{stat.wins} wins</span>
              <span className="text-error">{stat.losses} losses</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

