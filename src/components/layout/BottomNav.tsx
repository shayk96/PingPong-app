/**
 * Bottom navigation bar
 * Mobile-first tab navigation
 */

import { Link } from 'react-router-dom'

interface BottomNavProps {
  currentPath: string
}

export function BottomNav({ currentPath }: BottomNavProps) {
  const navItems = [
    {
      path: '/leaderboard',
      label: 'Rankings',
      icon: (active: boolean) => (
        <svg 
          className={`w-6 h-6 ${active ? 'text-accent' : 'text-gray-400'}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
          />
        </svg>
      )
    },
    {
      path: '/new-match',
      label: 'New Match',
      icon: (active: boolean) => (
        <div className={`
          w-12 h-12 -mt-4 rounded-full flex items-center justify-center
          ${active ? 'bg-accent' : 'bg-accent/80'}
          shadow-lg shadow-accent/30
          transition-transform hover:scale-105
        `}>
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
        </div>
      ),
      isCenter: true
    },
    {
      path: '/profile',
      label: 'Profile',
      icon: (active: boolean) => (
        <svg 
          className={`w-6 h-6 ${active ? 'text-accent' : 'text-gray-400'}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
          />
        </svg>
      )
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background-light border-t border-background-lighter safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = currentPath.startsWith(item.path)
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center
                ${item.isCenter ? 'px-2' : 'flex-1 h-full'}
                transition-colors
              `}
            >
              {item.icon(isActive)}
              {!item.isCenter && (
                <span className={`
                  text-xs mt-1 font-medium
                  ${isActive ? 'text-accent' : 'text-gray-400'}
                `}>
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

