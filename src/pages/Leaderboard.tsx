/**
 * Leaderboard page
 * Displays player rankings sorted by ELO
 */

import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { useLeaderboard, useRecentMatchesWithPlayers } from '../hooks/useStats'
import { useAuth } from '../hooks/useAuth'
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable'
import { MatchCard } from '../components/match/MatchCard'

export default function Leaderboard() {
  const { user } = useAuth()
  const { players, loading: playersLoading } = usePlayers()
  const { matches, loading: matchesLoading } = useMatches()
  const leaderboard = useLeaderboard(players, matches)
  const recentMatches = useRecentMatchesWithPlayers(matches, players, 5)

  const loading = playersLoading || matchesLoading

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-accent"></div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <header className="mb-6 safe-top pt-2">
        <h1 className="text-2xl font-display font-bold text-white">
          Leaderboard
        </h1>
        <p className="text-gray-400 text-sm">
          {players.length} player{players.length !== 1 ? 's' : ''} competing
        </p>
      </header>

      {/* Rankings */}
      <section className="mb-8">
        <LeaderboardTable 
          entries={leaderboard} 
          currentUserId={user?.id}
        />
      </section>

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">
            Recent Matches
          </h2>
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                playerA={match.playerA}
                playerB={match.playerB}
                currentUserId={user?.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {players.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏓</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            No players yet
          </h2>
          <p className="text-gray-400">
            Be the first to join and start tracking matches!
          </p>
        </div>
      )}
    </div>
  )
}

