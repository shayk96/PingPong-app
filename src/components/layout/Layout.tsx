/**
 * Main layout wrapper with bottom navigation
 * Provides consistent structure for all protected pages
 */

import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export default function Layout() {
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area */}
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      
      {/* Bottom navigation */}
      <BottomNav currentPath={location.pathname} />
    </div>
  )
}

