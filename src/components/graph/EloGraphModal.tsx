/**
 * ELO Graph Modal - Shows ELO history for selected players
 * Uses Chart.js for line chart visualization
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Line } from 'react-chartjs-2'
import { Modal } from '../ui/Modal'
import { fetchEloHistory, EloHistoryEntry } from '../../lib/api'
import { User } from '../../types'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

// Predefined colors for player lines
const PLAYER_COLORS = [
  { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.5)' },   // Blue
  { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.5)' },     // Red
  { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.5)' },     // Green
  { border: 'rgb(249, 115, 22)', bg: 'rgba(249, 115, 22, 0.5)' },   // Orange
  { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.5)' },   // Purple
  { border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.5)' },   // Pink
  { border: 'rgb(20, 184, 166)', bg: 'rgba(20, 184, 166, 0.5)' },   // Teal
  { border: 'rgb(234, 179, 8)', bg: 'rgba(234, 179, 8, 0.5)' },     // Yellow
]

interface EloGraphModalProps {
  isOpen: boolean
  onClose: () => void
  players: User[]
  initialPlayerIds?: string[]
}

export function EloGraphModal({ isOpen, onClose, players, initialPlayerIds }: EloGraphModalProps) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [eloHistory, setEloHistory] = useState<EloHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [playerSearch, setPlayerSearch] = useState('')
  const chartRef = useRef<any>(null)

  // Pre-select players when modal opens
  useEffect(() => {
    if (isOpen && initialPlayerIds && initialPlayerIds.length > 0) {
      setSelectedPlayerIds(initialPlayerIds)
    }
  }, [isOpen, initialPlayerIds])

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [players]
  )
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return sortedPlayers
    const q = playerSearch.trim().toLowerCase()
    return sortedPlayers.filter(p => p.displayName.toLowerCase().includes(q))
  }, [sortedPlayers, playerSearch])

  // Reset zoom function
  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom()
    }
  }

  // Load ELO history when selected players change
  useEffect(() => {
    if (selectedPlayerIds.length === 0) {
      setEloHistory([])
      return
    }

    const loadHistory = async () => {
      setLoading(true)
      try {
        const history = await fetchEloHistory(selectedPlayerIds)
        setEloHistory(history)
      } catch (err) {
        console.error('Failed to load ELO history:', err)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [selectedPlayerIds])

  // Toggle player selection
  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

  // Get player name by ID
  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId)
    return player?.displayName || 'Unknown'
  }

  // Get current ELO for a player
  const getCurrentElo = (playerId: string) => {
    const player = players.find(p => p.id === playerId)
    return player?.eloRating || null
  }

  // Build chart data
  const chartData = useMemo(() => {
    if (selectedPlayerIds.length === 0 || eloHistory.length === 0) {
      return { datasets: [] }
    }

    // Group history by player
    const playerHistories: Record<string, EloHistoryEntry[]> = {}
    selectedPlayerIds.forEach(id => {
      playerHistories[id] = eloHistory
        .filter(h => h.playerId === id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    })

    // Create datasets — grouped by day (last game per day), x-axis is date
    // Each player gets a main line plus a dashed linear-regression trend line
    const datasets = selectedPlayerIds.flatMap((playerId, index) => {
      const history = playerHistories[playerId] || []
      const colorIndex = index % PLAYER_COLORS.length

      const dayGroups = new Map<string, { date: Date; eloRating: number }>()
      history.forEach((entry) => {
        const d = new Date(entry.timestamp)
        const dayKey = d.toDateString()
        dayGroups.set(dayKey, { date: d, eloRating: entry.eloRating })
      })

      const data = Array.from(dayGroups.values()).map(p => ({
        x: p.date,
        y: p.eloRating,
      }))

      const mainDataset = {
        label: getPlayerName(playerId),
        data,
        borderColor: PLAYER_COLORS[colorIndex].border,
        backgroundColor: PLAYER_COLORS[colorIndex].bg,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      }

      const result: { data: { x: Date; y: number }[]; [key: string]: unknown }[] = [mainDataset]

      // Linear regression trend line over this player's points
      if (data.length >= 2) {
        const n = data.length
        const xs = data.map(p => p.x.getTime())
        const ys = data.map(p => p.y)
        const meanX = xs.reduce((s, v) => s + v, 0) / n
        const meanY = ys.reduce((s, v) => s + v, 0) / n
        let num = 0
        let den = 0
        for (let i = 0; i < n; i++) {
          num += (xs[i] - meanX) * (ys[i] - meanY)
          den += (xs[i] - meanX) ** 2
        }
        const slope = den === 0 ? 0 : num / den
        const intercept = meanY - slope * meanX
        result.push({
          label: `${getPlayerName(playerId)} (trend)`,
          data: [
            { x: data[0].x, y: Math.round(slope * xs[0] + intercept) },
            { x: data[n - 1].x, y: Math.round(slope * xs[n - 1] + intercept) },
          ],
          borderColor: PLAYER_COLORS[colorIndex].border,
          backgroundColor: 'transparent',
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
          spanGaps: true,
        })
      }

      return result
    })

    return { datasets }
  }, [selectedPlayerIds, eloHistory, players])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#e5e5e5',
          font: { size: 12 },
          // Hide trend lines from the legend to reduce clutter
          filter: (item: { text?: string }) => !item.text?.endsWith('(trend)'),
        }
      },
      tooltip: {
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: '#e5e5e5',
        borderColor: '#444',
        borderWidth: 1,
      },
      zoom: {
        // Prevent zooming/panning beyond the original data range,
        // which otherwise produces an invalid range and blank chart
        limits: {
          x: { min: 'original' as const, max: 'original' as const },
          y: { min: 'original' as const, max: 'original' as const },
        },
        pan: {
          enabled: true,
          mode: 'xy' as const,
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'xy' as const,
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          displayFormats: {
            day: 'MMM d',
            week: 'MMM d',
            month: 'MMM yyyy'
          },
          tooltipFormat: 'MMM d, yyyy h:mm a'
        },
        ticks: {
          color: '#9ca3af',
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
        },
        grid: { color: 'rgba(75, 75, 75, 0.3)' },
        title: {
          display: true,
          text: 'Date',
          color: '#9ca3af'
        }
      },
      y: {
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(75, 75, 75, 0.3)' },
        title: {
          display: true,
          text: 'ELO Rating',
          color: '#9ca3af'
        }
      }
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ELO History Graph" maxWidth="2xl">
      <div className="space-y-4">
        {/* Player selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Select Players
            </label>
            {selectedPlayerIds.length > 0 && (
              <button
                onClick={() => setSelectedPlayerIds([])}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          {players.length > 4 && (
            <input
              type="search"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full mb-2 px-3 py-2 rounded-xl bg-background border border-background-lighter text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              aria-label="Search players"
            />
          )}
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {filteredPlayers.map((player) => {
              const isSelected = selectedPlayerIds.includes(player.id)
              const colorIndex = selectedPlayerIds.indexOf(player.id)
              const color = colorIndex >= 0 ? PLAYER_COLORS[colorIndex % PLAYER_COLORS.length] : null
              
              return (
                <button
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? 'text-white ring-2 ring-offset-1 ring-offset-background-light'
                      : 'bg-background text-gray-400 hover:text-white hover:bg-background-lighter'
                  }`}
                  style={isSelected && color ? {
                    backgroundColor: color.bg,
                    ringColor: color.border,
                    borderColor: color.border,
                    ['--tw-ring-color' as any]: color.border,
                  } : undefined}
                >
                  {isSelected && (
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color?.border }}
                    />
                  )}
                  <span className="truncate">{player.displayName}</span>
                </button>
              )
            })}
          </div>
          {playerSearch.trim() && filteredPlayers.length === 0 && (
            <p className="text-xs text-gray-500 mt-2 text-center">No players match your search</p>
          )}
          {selectedPlayerIds.length === 0 && !playerSearch.trim() && (
            <p className="text-xs text-gray-500 mt-2 text-center">Tap players to add them to the graph</p>
          )}
        </div>

        {/* Chart */}
        <div className="bg-background rounded-lg p-4 h-96">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : selectedPlayerIds.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <p>Select players to view their ELO history</p>
              </div>
            </div>
          ) : chartData.datasets.length > 0 && chartData.datasets.some(d => d.data.length > 0) ? (
            <Line ref={chartRef} data={chartData} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <p>No ELO history available for selected players</p>
            </div>
          )}
        </div>

        {/* Reset Zoom Button */}
        {selectedPlayerIds.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={resetZoom}
              className="px-3 py-1.5 text-xs bg-background-lighter text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Reset Zoom
            </button>
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-gray-500 text-center">
          Scroll to zoom, drag to pan. ELO history is recorded after each match.
        </p>
      </div>
    </Modal>
  )
}
