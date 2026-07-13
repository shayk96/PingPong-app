import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Leaderboard from './pages/Leaderboard'
import NewMatch from './pages/NewMatch'
import PlayerProfile from './pages/PlayerProfile'
import AllMatches from './pages/AllMatches'
import RoomSession from './pages/RoomSession'
import DailyRanking from './pages/DailyRanking'
import RangeScoreboard from './pages/RangeScoreboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/leaderboard" replace />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="new-match" element={<NewMatch />} />
        <Route path="player/:id" element={<PlayerProfile />} />
        <Route path="matches" element={<AllMatches />} />
        <Route path="room" element={<RoomSession />} />
        <Route path="daily" element={<DailyRanking />} />
        <Route path="scoreboard" element={<RangeScoreboard />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
