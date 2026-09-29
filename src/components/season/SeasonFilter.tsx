import type { SeasonFilterValue } from '../../lib/seasons'

interface SeasonFilterProps {
  value: SeasonFilterValue
  onChange: (value: SeasonFilterValue) => void
  seasonNumbers: number[]
  currentSeasonNumber?: number
  className?: string
}

export function SeasonFilter({ value, onChange, seasonNumbers, currentSeasonNumber, className = '' }: SeasonFilterProps) {
  if (seasonNumbers.length < 2) return null

  const options: { value: SeasonFilterValue; label: string }[] = [
    { value: 'all', label: 'All seasons' },
    ...seasonNumbers.map(n => ({
      value: n,
      label: n === currentSeasonNumber ? `Season ${n} · now` : `Season ${n}`,
    })),
  ]

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map(opt => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            value === opt.value
              ? 'bg-accent text-white border-accent'
              : 'bg-background-light text-gray-400 border-background-lighter hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
