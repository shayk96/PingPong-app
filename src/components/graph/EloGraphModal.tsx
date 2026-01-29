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
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Line } from 'react-chartjs-2'
import { Modal } from '../ui/Modal'
import { fetchEloHistory, EloHistoryEntry } from '../../lib/api'
import { User } from '../../types'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
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
}

export function EloGraphModal({ isOpen, onClose, players }: EloGraphModalProps) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [eloHistory, setEloHistory] = useState<EloHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const chartRef = useRef<any>(null)

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
      return { labels: [], datasets: [] }
    }

    // Group history by player
    const playerHistories: Record<string, EloHistoryEntry[]> = {}
    selectedPlayerIds.forEach(id => {
      playerHistories[id] = eloHistory
        .filter(h => h.playerId === id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    })

    // Find all unique timestamps across all players
    const allTimestamps = [...new Set(
      eloHistory.map(h => new Date(h.timestamp).getTime())
    )].sort((a, b) => a - b)

    // Create labels from timestamps + "Now" for current ELO
    const labels = [
      ...allTimestamps.map((ts, index) => `Game ${index + 1}`),
      'Now'
    ]

    // Create datasets for each player
    const datasets = selectedPlayerIds.map((playerId, index) => {
      const history = playerHistories[playerId] || []
      const colorIndex = index % PLAYER_COLORS.length
      
      // Map player's ratings to the timeline
      const data = allTimestamps.map(ts => {
        const entry = history.find(h => new Date(h.timestamp).getTime() === ts)
        if (entry) return entry.eloRating
        
        // If no entry at this timestamp, use the last known rating before it
        const prevEntry = history
          .filter(h => new Date(h.timestamp).getTime() < ts)
          .pop()
        return prevEntry?.eloRating || null
      })

      // Add current ELO as the final point
      data.push(getCurrentElo(playerId))

      return {
        label: getPlayerName(playerId),
        data,
        borderColor: PLAYER_COLORS[colorIndex].border,
        backgroundColor: PLAYER_COLORS[colorIndex].bg,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      }
    })

    return { labels, datasets }
  }, [selectedPlayerIds, eloHistory, players])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#e5e5e5',
          font: { size: 12 }
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
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(75, 75, 75, 0.3)' }
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
    <Modal isOpen={isOpen} onClose={onClose} title="ELO History Graph">
      <div className="space-y-4">
        {/* Player selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Players to Compare
          </label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-background rounded-lg">
            {players.map((player, index) => {
              const isSelected = selectedPlayerIds.includes(player.id)
              const colorIndex = selectedPlayerIds.indexOf(player.id)
              const color = colorIndex >= 0 ? PLAYER_COLORS[colorIndex % PLAYER_COLORS.length] : null
              
              return (
                <button
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-all
                    ${isSelected 
                      ? 'text-white' 
                      : 'bg-background-lighter text-gray-400 hover:text-white hover:bg-gray-600'
                    }
                  `}
                  style={isSelected && color ? { 
                    backgroundColor: color.bg,
                    borderWidth: 2,
                    borderColor: color.border
                  } : undefined}
                >
                  {player.displayName}
                </button>
              )
            })}
          </div>
          {selectedPlayerIds.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">Click on players to add them to the graph</p>
          )}
        </div>

        {/* Chart */}
        <div className="bg-background rounded-lg p-4 h-64">
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
          ) : chartData.datasets.length > 0 && chartData.datasets.some(d => d.data.some(v => v !== null)) ? (
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
