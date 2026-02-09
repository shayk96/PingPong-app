/**
 * Weird Stats Rotating Banner
 * 
 * Displays cherry-picked, broadcast-style quirky stats that auto-rotate.
 * Cycles through generated stats with a fade transition.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { generateWeirdStats } from '../lib/weirdStats'
import type { Match, User } from '../types'

interface WeirdStatsBannerProps {
  matches: Match[]
  players: User[]
  /** Rotation interval in milliseconds (default: 6000) */
  interval?: number
}

export function WeirdStatsBanner({ matches, players, interval = 6000 }: WeirdStatsBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [fading, setFading] = useState(false)

  const stats = useMemo(
    () => generateWeirdStats(matches, players),
    [matches, players]
  )

  const advance = useCallback(() => {
    if (stats.length <= 1) return
    setFading(true)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % stats.length)
      setFading(false)
    }, 300) // fade-out duration
  }, [stats.length])

  // Auto-rotate
  useEffect(() => {
    if (stats.length <= 1) return
    const timer = setInterval(advance, interval)
    return () => clearInterval(timer)
  }, [stats.length, interval, advance])

  // Reset index if stats change
  useEffect(() => {
    setCurrentIndex(0)
  }, [stats])

  if (stats.length === 0) return null

  const current = stats[currentIndex % stats.length]

  return (
    <div
      className="mb-4 relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/30 via-background-light to-primary/30 border border-primary/20"
    >
      {/* Subtle shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />

      <div
        className={`relative px-4 py-3 flex items-center gap-3 transition-opacity duration-300 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="text-xl flex-shrink-0">{current.emoji}</span>
        <p className="text-sm text-gray-200 font-medium leading-snug flex-1">
          {current.text}
        </p>
        {stats.length > 1 && (
          <div className="flex gap-1 flex-shrink-0">
            {stats.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === currentIndex % stats.length
                    ? 'bg-accent w-3'
                    : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
