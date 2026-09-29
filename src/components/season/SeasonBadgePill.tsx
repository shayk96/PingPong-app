import { PODIUM_MEDALS, type SeasonBadge } from '../../lib/seasons'

const TONE: Record<SeasonBadge['rank'], string> = {
  1: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300',
  2: 'bg-gray-300/10 border-gray-300/35 text-gray-200',
  3: 'bg-amber-700/20 border-amber-600/40 text-amber-400',
}

const PLACE: Record<SeasonBadge['rank'], string> = { 1: 'Champion', 2: '2nd place', 3: '3rd place' }

interface SeasonBadgePillProps {
  badge: SeasonBadge
  /** Compact form for dense rows: medal + "S1" only */
  compact?: boolean
}

export function SeasonBadgePill({ badge, compact = false }: SeasonBadgePillProps) {
  const title = `Season ${badge.seasonNumber} ${PLACE[badge.rank]}`
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 rounded-md border font-bold leading-none ${TONE[badge.rank]} ${
        compact ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      }`}
    >
      <span className={compact ? 'text-[11px]' : 'text-sm'}>{PODIUM_MEDALS[badge.rank]}</span>
      {compact ? `S${badge.seasonNumber}` : title}
    </span>
  )
}
