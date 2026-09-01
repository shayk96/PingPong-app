import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { Modal } from '../components/ui/Modal'
import { computeHallOfFame, RECORD_GROUPS, type RecordGroup, type RecordHolder } from '../lib/hallOfFame'

type RangeKey = 'all' | '1m' | '3m' | '1y' | 'custom'

const RANGE_OPTIONS: { key: RangeKey; label: string; days?: number }[] = [
  { key: 'all', label: 'All-time' },
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'custom', label: 'Custom' },
]

const MEDALS = ['🥇', '🥈', '🥉']
/** Rows shown before the "show more" expander kicks in */
const COLLAPSED_ROWS = 3

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function toInputDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function fromInputDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatEloDelta(n: number): string {
  const r = Math.round(n)
  return r > 0 ? `+${r}` : `${r}`
}

export default function Records() {
  const navigate = useNavigate()
  const { players, loading: playersLoading } = usePlayers()
  const { matches, loading: matchesLoading } = useMatches()

  const today = startOfDay(new Date())
  const [range, setRange] = useState<RangeKey>('all')
  const [customFrom, setCustomFrom] = useState(addDays(today, -30))
  const [customTo, setCustomTo] = useState(today)
  const [group, setGroup] = useState<RecordGroup | 'all'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [gamesModal, setGamesModal] = useState<{
    title: string
    subtitle: string
    playerId: string
    matchIds: string[]
    negative?: boolean
  } | null>(null)

  const rangedMatches = useMemo(() => {
    if (range === 'all') return matches
    const now = startOfDay(new Date())
    const option = RANGE_OPTIONS.find(o => o.key === range)
    const from = range === 'custom' ? startOfDay(customFrom) : addDays(now, -(option?.days ?? 30))
    const to = range === 'custom' ? addDays(startOfDay(customTo), 1) : addDays(now, 1)
    return matches.filter(m => {
      const t = new Date(m.createdAt).getTime()
      return t >= from.getTime() && t < to.getTime()
    })
  }, [matches, range, customFrom, customTo])

  const categories = useMemo(
    () => computeHallOfFame(rangedMatches, players, matches),
    [rangedMatches, players, matches],
  )

  const visibleCategories = useMemo(
    () => (group === 'all' ? categories : categories.filter(c => c.group === group)),
    [categories, group],
  )

  const matchById = useMemo(() => new Map(matches.map(m => [m.id, m])), [matches])
  const playerName = useMemo(() => {
    const map = new Map(players.map(p => [p.id, p.displayName]))
    return (id: string) => map.get(id) ?? 'Unknown'
  }, [players])

  const modalGames = useMemo(() => {
    if (!gamesModal) return []
    const me = gamesModal.playerId
    return gamesModal.matchIds
      .map(id => matchById.get(id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(m => {
        const isWin = m.winnerId === me
        const opponentId = m.playerAId === me ? m.playerBId : m.playerAId
        return {
          id: m.id,
          date: new Date(m.createdAt),
          opponent: playerName(opponentId),
          myScore: m.playerAId === me ? m.playerAScore : m.playerBScore,
          theirScore: m.playerAId === me ? m.playerBScore : m.playerAScore,
          myLucky: m.playerAId === me ? (m.playerALuckyPoints ?? 0) : (m.playerBLuckyPoints ?? 0),
          eloDelta: isWin ? m.winnerEloDelta : m.loserEloDelta,
          isWin,
        }
      })
  }, [gamesModal, matchById, playerName])

  const openHolder = (holder: RecordHolder, title: string, negative?: boolean) => {
    if (!holder.matchIds || holder.matchIds.length === 0) {
      navigate(`/player/${holder.playerId}`)
      return
    }
    const who = holder.opponentName ? `${holder.name} vs ${holder.opponentName}` : holder.name
    setGamesModal({
      title,
      subtitle: `${who} · ${holder.detail ?? holder.display}`,
      playerId: holder.playerId,
      matchIds: holder.matchIds,
      negative,
    })
  }

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const loading = playersLoading || matchesLoading

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

      <h1 className="text-2xl font-display font-bold text-white mb-1">Record Book</h1>
      <p className="text-sm text-gray-400 mb-4">
        Every all-time best (and worst) in the league. Tap a name to see the games behind it.
      </p>

      {/* Date range */}
      <div className="flex gap-1 p-1 bg-background-light rounded-lg mb-3">
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              range === opt.key ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="mb-3 p-4 bg-background-light rounded-xl border border-background-lighter">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">From</label>
              <input
                type="date"
                value={toInputDate(customFrom)}
                max={toInputDate(customTo)}
                onChange={e => e.target.value && setCustomFrom(fromInputDate(e.target.value))}
                className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="pt-5 text-gray-500">–</div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">To</label>
              <input
                type="date"
                value={toInputDate(customTo)}
                min={toInputDate(customFrom)}
                max={toInputDate(today)}
                onChange={e => e.target.value && setCustomTo(fromInputDate(e.target.value))}
                className="w-full bg-background border border-background-lighter rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* Category groups */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setGroup('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            group === 'all'
              ? 'bg-primary text-white border-primary'
              : 'bg-background-light text-gray-400 border-background-lighter hover:text-white'
          }`}
        >
          All
        </button>
        {RECORD_GROUPS.map(g => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              group === g.id
                ? 'bg-primary text-white border-primary'
                : 'bg-background-light text-gray-400 border-background-lighter hover:text-white'
            }`}
          >
            <span className="mr-1">{g.emoji}</span>
            {g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading records…</div>
      ) : visibleCategories.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-sm">No records in this range yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleCategories.map(cat => {
            const isExpanded = expanded.has(cat.id)
            const rows = isExpanded ? cat.holders : cat.holders.slice(0, COLLAPSED_ROWS)
            const hidden = cat.holders.length - rows.length

            return (
              <div
                key={cat.id}
                className={`rounded-xl border overflow-hidden ${
                  cat.negative
                    ? 'bg-error/5 border-error/20'
                    : 'bg-background-light border-background-lighter'
                }`}
              >
                <div className="px-3.5 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{cat.emoji}</span>
                    <h2 className="font-semibold text-white text-sm">{cat.title}</h2>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{cat.description}</p>
                </div>

                <div className="divide-y divide-background-lighter/60">
                  {rows.map((holder, i) => (
                    <button
                      key={`${holder.playerId}-${i}`}
                      onClick={() => openHolder(holder, cat.title, cat.negative)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-background-lighter/40 transition-colors active:scale-[0.995]"
                    >
                      <span className="w-6 flex-shrink-0 text-center text-sm">
                        {i < MEDALS.length ? (
                          MEDALS[i]
                        ) : (
                          <span className="text-xs font-bold text-gray-500">{i + 1}</span>
                        )}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {holder.name}
                          {holder.opponentName && (
                            <>
                              <span className="text-gray-500 font-normal"> vs </span>
                              {holder.opponentName}
                            </>
                          )}
                        </div>
                        {holder.detail && (
                          <div className="text-[11px] text-gray-500 truncate">{holder.detail}</div>
                        )}
                      </div>

                      <span
                        className={`flex-shrink-0 font-display font-bold tabular-nums ${
                          i === 0 ? 'text-base' : 'text-sm'
                        } ${
                          cat.negative
                            ? i === 0
                              ? 'text-error'
                              : 'text-error/70'
                            : i === 0
                              ? 'text-primary-400'
                              : 'text-gray-300'
                        }`}
                      >
                        {holder.display}
                      </span>
                    </button>
                  ))}
                </div>

                {(hidden > 0 || isExpanded) && (
                  <button
                    onClick={() => toggleExpanded(cat.id)}
                    className="w-full py-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-300 transition-colors border-t border-background-lighter/60"
                  >
                    {isExpanded ? 'Show less' : `Show ${hidden} more`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && visibleCategories.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-500">
          {visibleCategories.length} record{visibleCategories.length !== 1 ? 's' : ''} ·{' '}
          {rangedMatches.length} match{rangedMatches.length !== 1 ? 'es' : ''} analysed
        </div>
      )}

      {/* Games behind a record */}
      <Modal
        isOpen={gamesModal !== null}
        onClose={() => setGamesModal(null)}
        title={gamesModal?.title || ''}
        maxWidth="lg"
      >
        {(() => {
          const totalElo = modalGames.reduce((s, g) => s + g.eloDelta, 0)
          const wins = modalGames.filter(g => g.isWin).length
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 bg-background rounded-xl p-3">
                <div className="min-w-0">
                  <div
                    className={`text-2xl font-display font-bold ${
                      gamesModal?.negative ? 'text-error' : 'text-success'
                    }`}
                  >
                    {modalGames.length}
                    <span className="text-sm font-medium text-gray-400 ml-1">games</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{gamesModal?.subtitle}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className={`text-lg font-bold ${
                      totalElo > 0 ? 'text-success' : totalElo < 0 ? 'text-error' : 'text-gray-400'
                    }`}
                  >
                    {formatEloDelta(totalElo)}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {wins}W {modalGames.length - wins}L
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {modalGames.map((game, i) => (
                  <div
                    key={game.id}
                    className={`p-3 rounded-xl border ${
                      game.isWin ? 'bg-success/5 border-success/20' : 'bg-error/5 border-error/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-gray-500 w-5 flex-shrink-0">
                          #{i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-white text-sm font-medium truncate">
                            vs {game.opponent}
                          </div>
                          <div className="text-xs text-gray-500">
                            {game.date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            {game.myLucky > 0 && <span className="ml-2">🍀 {game.myLucky}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-white font-bold text-sm">
                          {game.myScore}–{game.theirScore}
                        </div>
                        <div className={`text-xs ${game.isWin ? 'text-success' : 'text-error'}`}>
                          {formatEloDelta(game.eloDelta)} ELO
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const id = gamesModal?.playerId
                  setGamesModal(null)
                  if (id) navigate(`/player/${id}`)
                }}
                className="w-full py-2.5 rounded-xl bg-background-lighter text-sm font-medium text-gray-200 hover:text-white transition-colors"
              >
                View profile
              </button>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
