import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { useSeason } from '../hooks/useSeason'
import { getRatingTier } from '../lib/elo'
import { seasonStandings, matchSeason, MIN_SEASON_GAMES, PODIUM_MEDALS, type PodiumRank } from '../lib/seasons'

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PODIUM_STYLE: Record<PodiumRank, { ring: string; bar: string; height: string }> = {
  1: { ring: 'border-yellow-400/60 bg-yellow-500/10', bar: 'bg-yellow-500/25', height: 'h-20' },
  2: { ring: 'border-gray-300/50 bg-gray-300/10', bar: 'bg-gray-400/20', height: 'h-14' },
  3: { ring: 'border-amber-600/50 bg-amber-700/10', bar: 'bg-amber-700/25', height: 'h-10' },
}

export default function SeasonHistory() {
  const navigate = useNavigate()
  const { players, loading: playersLoading } = usePlayers()
  const { matches, loading: matchesLoading } = useMatches()
  const { pastSeasons, loading: seasonLoading } = useSeason()
  const [selected, setSelected] = useState<number | null>(null)
  const [showProvisional, setShowProvisional] = useState(false)

  const completed = useMemo(
    () => [...pastSeasons].sort((a, b) => b.seasonNumber - a.seasonNumber),
    [pastSeasons],
  )
  const season = completed.find(s => s.seasonNumber === selected) ?? completed[0]

  const nameOf = useMemo(() => new Map(players.map(p => [p.id, p.displayName])), [players])

  const standings = useMemo(() => (season ? seasonStandings(season) : []), [season])
  const ranked = standings.filter(s => s.rank !== null)
  const provisional = standings.filter(s => s.rank === null)
  const podium = ranked.slice(0, 3)

  const seasonMatches = useMemo(
    () => (season ? matches.filter(m => matchSeason(m) === season.seasonNumber) : []),
    [matches, season],
  )

  // The season doc's start can post-date its earliest match (it's created lazily)
  const span = useMemo(() => {
    if (!season) return null
    const firstMatch = seasonMatches.reduce<Date | null>(
      (min, m) => (!min || m.createdAt.getTime() < min.getTime() ? m.createdAt : min),
      null,
    )
    const start =
      firstMatch && firstMatch.getTime() < season.startedAt.getTime() ? firstMatch : season.startedAt
    return { start, end: season.endedAt ?? season.endsAt }
  }, [season, seasonMatches])

  const loading = playersLoading || matchesLoading || seasonLoading
  const displayName = (id: string, fallback: string) => nameOf.get(id) ?? fallback

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-display font-bold text-white mb-1">Past Seasons</h1>
      <p className="text-sm text-gray-400 mb-4">
        Final standings when each season closed. Ranking needs {MIN_SEASON_GAMES}+ games that season.
      </p>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading seasons…</div>
      ) : !season ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-sm">No season has finished yet.</p>
        </div>
      ) : (
        <>
          {completed.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {completed.map(s => (
                <button
                  key={s.seasonNumber}
                  onClick={() => setSelected(s.seasonNumber)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    s.seasonNumber === season.seasonNumber
                      ? 'bg-accent text-white border-accent'
                      : 'bg-background-light text-gray-400 border-background-lighter hover:text-white'
                  }`}
                >
                  Season {s.seasonNumber}
                </button>
              ))}
            </div>
          )}

          {/* Season header */}
          <div className="mb-4 p-4 bg-background-light rounded-xl border border-background-lighter">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white font-semibold">Season {season.seasonNumber}</div>
                {span && (
                  <div className="text-xs text-gray-400">
                    {formatDay(span.start)}
                    {span.end && ` – ${formatDay(span.end)}`}
                  </div>
                )}
              </div>
              <div className="text-right text-xs text-gray-400 flex-shrink-0">
                <div>{seasonMatches.length} matches</div>
                <div>{ranked.length} ranked players</div>
              </div>
            </div>
          </div>

          {/* Podium: 2nd, 1st, 3rd */}
          {podium.length > 0 && (
            <div className="grid grid-cols-3 gap-2 items-end mb-5">
              {[podium[1], podium[0], podium[2]].map((p, slot) => {
                if (!p) return <div key={`empty-${slot}`} />
                const rank = p.rank as PodiumRank
                const style = PODIUM_STYLE[rank]
                return (
                  <button
                    key={p.playerId}
                    onClick={() => navigate(`/player/${p.playerId}?season=${season.seasonNumber}`)}
                    className="flex flex-col items-center text-center min-w-0"
                  >
                    <div className={`w-full rounded-xl border px-2 py-2.5 ${style.ring}`}>
                      <div className="text-2xl leading-none mb-1">{PODIUM_MEDALS[rank]}</div>
                      <div className="text-sm font-semibold text-white truncate">
                        {displayName(p.playerId, p.displayName)}
                      </div>
                      <div className="text-lg font-display font-bold text-white leading-tight">{p.eloRating}</div>
                      <div className="text-[10px] text-gray-400">{p.wins}W {p.losses}L</div>
                    </div>
                    <div className={`w-3/4 rounded-b-md ${style.bar} ${style.height}`} />
                  </button>
                )
              })}
            </div>
          )}

          {/* Full final table */}
          <div className="space-y-2">
            {[...ranked, ...(showProvisional ? provisional : [])].map(entry => {
              const winRate = entry.games > 0 ? Math.round((entry.wins / entry.games) * 100) : 0
              const medal = entry.rank !== null && entry.rank <= 3 ? PODIUM_MEDALS[entry.rank as PodiumRank] : null
              return (
                <button
                  key={entry.playerId}
                  onClick={() => navigate(`/player/${entry.playerId}?season=${season.seasonNumber}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-background-light border border-transparent hover:border-background-lighter transition-all text-left active:scale-[0.99]"
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-background-lighter text-sm font-bold text-gray-300 flex-shrink-0">
                    {medal ?? entry.rank ?? '–'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white flex items-center gap-1.5 min-w-0">
                      <span className="truncate min-w-0">{displayName(entry.playerId, entry.displayName)}</span>
                      {entry.rank === null && (
                        <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-600/40 text-gray-400">
                          provisional
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {entry.games} games · {entry.wins}W {entry.losses}L · {winRate}%
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-lg text-white leading-tight">{entry.eloRating}</div>
                    <div className="text-xs text-yellow-400">{getRatingTier(entry.eloRating)}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {provisional.length > 0 && (
            <button
              onClick={() => setShowProvisional(v => !v)}
              className="w-full mt-3 py-2 rounded-lg bg-background-light border border-background-lighter text-xs font-medium text-gray-300 hover:text-white transition-colors"
            >
              {showProvisional
                ? `Hide provisional (${provisional.length})`
                : `Show provisional (${provisional.length}) — under ${MIN_SEASON_GAMES} games`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
