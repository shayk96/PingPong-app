import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const hideButtons = location.pathname.startsWith('/new-match') || location.pathname.startsWith('/matches') || location.pathname.startsWith('/room') || location.pathname.startsWith('/daily')

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <>
      {!hideButtons && (
        <>
          {/* Menu button - left side */}
          <div ref={menuRef} className="fixed bottom-6 left-6 z-50">
            {/* Popup menu */}
            {menuOpen && (
              <div className="absolute bottom-16 left-0 w-48 bg-background-light border border-background-lighter rounded-xl shadow-xl overflow-hidden animate-fade-in">
                <button
                  onClick={() => navigate('/matches')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-background-lighter transition-colors"
                >
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Match History
                </button>
                <div className="h-px bg-background-lighter" />
                <button
                  onClick={() => navigate('/daily')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-background-lighter transition-colors"
                >
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Daily Ranking
                </button>
                <div className="h-px bg-background-lighter" />
                <button
                  onClick={() => navigate('/leaderboard?lucky=1')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-background-lighter transition-colors"
                >
                  <span className="w-5 h-5 flex items-center justify-center text-yellow-400 text-lg leading-none">&#9733;</span>
                  Lucky Points
                </button>
              </div>
            )}

            {/* Menu FAB */}
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                menuOpen
                  ? 'bg-gray-600 shadow-gray-600/40 rotate-45'
                  : 'bg-blue-600 shadow-blue-600/40 hover:scale-105 active:scale-95'
              }`}
              title="Menu"
            >
              <svg className="w-7 h-7 text-white transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

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
