/**
 * Floating action button for new match
 * Mobile-first floating button
 */

import { Link } from 'react-router-dom'

export function BottomNav() {
  return (
    <Link
      to="/new-match"
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/40 hover:scale-105 active:scale-95 transition-transform z-50"
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
  )
}
