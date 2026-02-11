/**
 * Floating action buttons for new match and match history
 * Mobile-first floating buttons
 */

import { Link, useLocation } from 'react-router-dom'

export function BottomNav() {
  const location = useLocation()

  // Hide floating buttons on the new-match page and all-matches page
  const hideButtons = location.pathname.startsWith('/new-match') || location.pathname.startsWith('/matches')

  return (
    <>
      {!hideButtons && (
        <>
          {/* All Matches button - left side */}
          <Link
            to="/matches"
            className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40 hover:scale-105 active:scale-95 transition-transform z-50"
            title="All Matches"
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" 
              />
            </svg>
          </Link>

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
    </>
  )
}
