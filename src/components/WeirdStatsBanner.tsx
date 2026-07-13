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

  const step = useCallback((dir: 1 | -1) => {
    if (stats.length <= 1) return
    setFading(true)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + dir + stats.length) % stats.length)
      setFading(false)
    }, 300) // fade-out duration
  }, [stats.length])

  // Auto-rotate (pauses briefly after manual navigation)
  useEffect(() => {
    if (stats.length <= 1) return
    const timer = setInterval(() => step(1), interval)
    return () => clearInterval(timer)
  }, [stats.length, interval, step])

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

      <div className="relative px-2 py-3 flex items-center gap-1">
        {stats.length > 1 && (
          <button
            onClick={() => step(-1)}
            aria-label="Previous stat"
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div
          className={`flex items-center gap-3 flex-1 min-w-0 transition-opacity duration-300 ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="text-xl flex-shrink-0">{current.emoji}</span>
          <p className="text-sm text-gray-200 font-medium leading-snug flex-1 min-w-0">
            {current.text}
          </p>
        </div>

        {stats.length > 1 && (
          <div className="hidden sm:flex gap-1 flex-shrink-0">
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

        {stats.length > 1 && (
          <button
            onClick={() => step(1)}
            aria-label="Next stat"
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
