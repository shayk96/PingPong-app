import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSeason } from '../hooks/useSeason'
import { calculateElo, expectedScore, getKFactor, getMarginMultiplier, getRatingTier } from '../lib/elo'
import { MIN_SEASON_GAMES, PODIUM_MEDALS } from '../lib/seasons'

const START_ELO = 800

const K_TIERS = [
  { games: '0–9 games', k: getKFactor(0), label: 'New — rating moves fast' },
  { games: '10–29 games', k: getKFactor(10), label: 'Settling in' },
  { games: '30+ games', k: getKFactor(30), label: 'Experienced — rating is stable' },
]

const MARGINS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(diff => ({
  score: diff === 11 ? '11–0' : `11–${11 - diff}`,
  diff,
  mult: getMarginMultiplier(11, 11 - diff),
}))

const RATING_GAPS = [0, 50, 100, 200, 300, 400]

const STAR_TIERS = [1050, 850, 750, 650, 550, 0].map((min, i, all) => ({
  range: i === 0 ? `${min}+` : min === 0 ? `Below ${all[i - 1]}` : `${min}–${all[i - 1] - 1}`,
  stars: getRatingTier(min),
}))

const EXAMPLES = [
  { label: 'Equal players, close game', w: 1000, l: 1000, score: [11, 9] },
  { label: 'Equal players, 11–5', w: 1000, l: 1000, score: [11, 5] },
  { label: 'Equal players, 11–0', w: 1000, l: 1000, score: [11, 0] },
  { label: 'Underdog wins (900 beats 1100)', w: 900, l: 1100, score: [11, 9] },
  { label: 'Favourite wins (1100 beats 900)', w: 1100, l: 900, score: [11, 9] },
].map(e => ({ ...e, delta: calculateElo(e.w, e.l, 30, 30, e.score[0], e.score[1]).winnerDelta }))

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <section className="bg-background-light rounded-2xl border border-background-lighter p-4 mb-4">
      <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
        <span>{emoji}</span>
        {title}
      </h2>
      <div className="space-y-3 text-sm text-gray-300 leading-relaxed">{children}</div>
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="rounded-xl overflow-hidden border border-background-lighter">
      <table className="w-full text-sm">
        <thead className="bg-background text-gray-500 text-xs uppercase tracking-wider">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-background-lighter">
              {row.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${i === 0 ? 'text-left text-gray-300' : 'text-right text-white font-medium'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const EXPERIENCE = [
  { id: 'new', label: 'New (0–9)', games: 0 },
  { id: 'mid', label: '10–29', games: 10 },
  { id: 'exp', label: '30+', games: 30 },
]

function Calculator() {
  const [ratingA, setRatingA] = useState(1000)
  const [ratingB, setRatingB] = useState(1000)
  const [expA, setExpA] = useState(30)
  const [expB, setExpB] = useState(30)
  const [loserScore, setLoserScore] = useState(7)

  const aWins = calculateElo(ratingA, ratingB, expA, expB, 11, loserScore).winnerDelta
  const bWins = calculateElo(ratingB, ratingA, expB, expA, 11, loserScore).winnerDelta
  const chanceA = Math.round(expectedScore(ratingA, ratingB) * 100)

  const player = (name: string, rating: number, setRating: (n: number) => void, exp: number, setExp: (n: number) => void) => (
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="text-xs text-gray-500">{name}</div>
      <input
        type="number"
        value={rating}
        onChange={e => setRating(Number(e.target.value) || 0)}
        className="w-full bg-background border border-background-lighter rounded-lg px-2 py-1.5 text-white text-center font-bold focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <select
        value={exp}
        onChange={e => setExp(Number(e.target.value))}
        className="w-full bg-background border border-background-lighter rounded-lg px-1 py-1 text-xs text-gray-300 focus:outline-none"
      >
        {EXPERIENCE.map(x => <option key={x.id} value={x.games}>{x.label} games</option>)}
      </select>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {player('Player A ELO', ratingA, setRatingA, expA, setExpA)}
        {player('Player B ELO', ratingB, setRatingB, expB, setExpB)}
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Final score</span>
          <span className="text-white font-semibold">11–{loserScore}</span>
        </div>
        <input
          type="range"
          min={0}
          max={9}
          value={loserScore}
          onChange={e => setLoserScore(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-background rounded-xl p-2.5">
          <div className="text-[11px] text-gray-500">If A wins</div>
          <div className="text-lg font-display font-bold text-success">+{aWins}</div>
        </div>
        <div className="bg-background rounded-xl p-2.5">
          <div className="text-[11px] text-gray-500">If B wins</div>
          <div className="text-lg font-display font-bold text-success">+{bWins}</div>
        </div>
      </div>
      <p className="text-xs text-gray-500 text-center">
        A is expected to win {chanceA}% of the time · the loser drops by the same amount
      </p>
    </div>
  )
}

export default function Rules() {
  const navigate = useNavigate()
  const { currentSeason } = useSeason()

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

      <h1 className="text-2xl font-display font-bold text-white mb-1">League Rules</h1>
      <p className="text-sm text-gray-400 mb-5">How ratings, seasons and the leaderboard work.</p>

      <Section emoji="⚡" title="In short">
        <ul className="list-disc pl-5 space-y-1">
          <li>Everyone starts each season at <b className="text-white">{START_ELO} ELO</b>.</li>
          <li>Win and you take points from your opponent — exactly what you gain, they lose.</li>
          <li>Beating a stronger player, or winning big, earns more.</li>
          <li>Play <b className="text-white">{MIN_SEASON_GAMES} games</b> in a season to get a rank.</li>
          <li>Highest ELO at the end of the season is champion {PODIUM_MEDALS[1]}.</li>
        </ul>
      </Section>

      <Section emoji="📐" title="How ELO is calculated">
        <p>After every game the winner gains, and the loser loses, the same number of points:</p>
        <div className="bg-background rounded-xl px-3 py-2.5 text-center font-mono text-white text-[13px]">
          points = K × margin × (1 − win chance)
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li><b className="text-white">K</b> — how fast ratings move, based on experience (below). The two players' K values are averaged.</li>
          <li><b className="text-white">Margin</b> — bonus for winning by more.</li>
          <li><b className="text-white">Win chance</b> — how likely the winner was to win, from the rating gap. An expected win pays little; an upset pays a lot.</li>
        </ul>
      </Section>

      <Section emoji="🎯" title="Win chance by rating gap">
        <Table
          head={['Rating gap', 'Favourite wins', 'Underdog wins']}
          rows={RATING_GAPS.map(gap => [
            gap === 0 ? 'Equal' : `${gap} points`,
            `${Math.round(expectedScore(1000 + gap, 1000) * 100)}%`,
            `${Math.round(expectedScore(1000, 1000 + gap) * 100)}%`,
          ])}
        />
      </Section>

      <Section emoji="🏎️" title="Experience (K-factor)">
        <Table head={['Games played', 'K']} rows={K_TIERS.map(t => [<span>{t.games}<span className="block text-xs text-gray-500">{t.label}</span></span>, t.k])} />
        <p className="text-xs text-gray-500">Games played counts your whole history, not just this season.</p>
      </Section>

      <Section emoji="💥" title="Score margin bonus">
        <Table head={['Score', 'Won by', 'Multiplier']} rows={MARGINS.map(m => [m.score, m.diff, `×${m.mult.toFixed(2)}`])} />
        <p className="text-xs text-gray-500">Each point beyond a 2-point win adds ×0.05. Deuce games (12–10, 13–11…) count as a 2-point win.</p>
      </Section>

      <Section emoji="🧮" title="Examples (experienced players)">
        <Table head={['Game', 'Points']} rows={EXAMPLES.map(e => [<span>{e.label}<span className="block text-xs text-gray-500">{e.score[0]}–{e.score[1]}</span></span>, `±${e.delta}`])} />
      </Section>

      <Section emoji="🔢" title="Try it">
        <Calculator />
      </Section>

      <Section emoji="🗓️" title="Seasons">
        <ul className="list-disc pl-5 space-y-1">
          <li>Seasons last about three months.{currentSeason?.endsAt && <> Season {currentSeason.seasonNumber} ends on <b className="text-white">{formatDay(currentSeason.endsAt)}</b>.</>}</li>
          <li>When a season ends, everyone's ELO resets to {START_ELO}. Wins, losses and records are kept.</li>
          <li>The champion is the highest ELO among players with {MIN_SEASON_GAMES}+ games that season.</li>
          <li>The top 3 wear a badge for the whole next season: {PODIUM_MEDALS[1]} champion, {PODIUM_MEDALS[2]} 2nd, {PODIUM_MEDALS[3]} 3rd.</li>
          <li>Finished seasons are locked — their games can't be edited or deleted. See them under Past Seasons.</li>
        </ul>
      </Section>

      <Section emoji="📋" title="Leaderboard">
        <ul className="list-disc pl-5 space-y-1">
          <li><b className="text-white">Ranked</b> — {MIN_SEASON_GAMES}+ games this season, sorted by ELO.</li>
          <li><b className="text-white">Inactive</b> — 1–{MIN_SEASON_GAMES - 1} games this season. Hidden behind "Show inactive players" with a progress badge like 2/{MIN_SEASON_GAMES}.</li>
          <li><b className="text-white">Not shown</b> — no games yet this season. You reappear after your first game.</li>
          <li><b className="text-white">Retired</b> — players who left. Hidden from the current season on; their history stays.</li>
        </ul>
      </Section>

      <Section emoji="🏓" title="Games">
        <ul className="list-disc pl-5 space-y-1">
          <li>Games are to <b className="text-white">11, win by 2</b>.</li>
          <li><b className="text-white">Lucky points</b> (nets and edges) are logged for fun and stats — they don't change ELO.</li>
          <li>Logged a game by mistake? <b className="text-white">Undo</b> it within 5 minutes, or edit it within 12 hours.</li>
          <li>The win chance and 🔮 predicted score on New Match are just for fun — they never affect anything.</li>
        </ul>
      </Section>

      <Section emoji="🏅" title="Badges">
        <Table
          head={['Badge', 'Meaning']}
          rows={[
            ['🔫 3', '11–0 wins this season'],
            ['🔥 6', 'Win streak of 6+'],
            ['🧊 5', 'Losing streak of 5+'],
            ['↗ ↘', 'Momentum: net ELO over the last 10 games'],
            ['👑', '#1 on the leaderboard'],
          ]}
        />
      </Section>

      <Section emoji="⭐" title="Star tiers">
        <Table head={['ELO', 'Stars']} rows={STAR_TIERS.map(t => [t.range, t.stars])} />
      </Section>
    </div>
  )
}
