/**
 * Floating action buttons for new match and ELO graph
 * Mobile-first floating buttons
 */

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { EloGraphModal } from '../graph/EloGraphModal'
import { usePlayers } from '../../hooks/usePlayers'

export function BottomNav() {
  const [showGraph, setShowGraph] = useState(false)
  const { players } = usePlayers()
  const location = useLocation()

  // Hide floating buttons on the new-match page
  const hideButtons = location.pathname === '/new-match'

  return (
    <>
      {!hideButtons && (
        <>
          {/* Graph button - left side */}
          <button
            onClick={() => setShowGraph(true)}
            className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40 hover:scale-105 active:scale-95 transition-transform z-50"
            title="ELO Graph"
          >
            <svg 
              className="w-7 h-7 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" 
              />
            </svg>
          </button>

          {/* Add match button - right side */}
          <Link
            to="/new-match"
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/40 hover:scale-105 active:scale-95 transition-transform z-50"
            title="New Match"
          >
            <svg 
              className="w-7 h-7 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2.5} 
                d="M12 4v16m8-8H4" 
              />
            </svg>
          </Link>
        </>
      )}

      {/* ELO Graph Modal */}
      <EloGraphModal 
        isOpen={showGraph} 
        onClose={() => setShowGraph(false)} 
        players={players}
      />
    </>
  )
}
