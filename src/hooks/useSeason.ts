import { useState, useEffect, useCallback } from 'react'
import { fetchCurrentSeason, fetchAllSeasons, endSeason as apiEndSeason, SeasonResponse } from '../lib/api'
import type { Season } from '../types'

function toSeason(raw: SeasonResponse): Season {
  return {
    ...raw,
    startedAt: new Date(raw.startedAt),
    endedAt: raw.endedAt ? new Date(raw.endedAt) : null,
  }
}

export function useSeason() {
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null)
  const [pastSeasons, setPastSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)

  const loadSeason = useCallback(async () => {
    try {
      const [current, all] = await Promise.all([
        fetchCurrentSeason(),
        fetchAllSeasons()
      ])
      setCurrentSeason(toSeason(current))
      setPastSeasons(all.filter(s => !s.isActive).map(toSeason))
    } catch (err) {
      console.error('Error fetching season:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSeason()
  }, [loadSeason])

  const endCurrentSeason = useCallback(async (password: string) => {
    const result = await apiEndSeason(password)
    await loadSeason()
    return result
  }, [loadSeason])

  return { currentSeason, pastSeasons, loading, endCurrentSeason, refresh: loadSeason }
}
