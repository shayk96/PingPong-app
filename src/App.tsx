import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Leaderboard from './pages/Leaderboard'
import NewMatch from './pages/NewMatch'
import PlayerProfile from './pages/PlayerProfile'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/leaderboard" replace />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="new-match" element={<NewMatch />} />
        <Route path="player/:id" element={<PlayerProfile />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
