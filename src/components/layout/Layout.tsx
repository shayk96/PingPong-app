/**
 * Main layout wrapper with floating action button
 * Provides consistent structure for all pages
 */

import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      
      {/* Floating action button */}
      <BottomNav />
    </div>
  )
}
