/**
 * Simple Express server with JSON file storage
 * Run with: node server/index.js
 */

import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const USERS_FILE = join(__dirname, 'users.json')
const MATCHES_FILE = join(__dirname, 'matches.json')

// Middleware
app.use(cors())
app.use(express.json())

// Initialize data files if they don't exist
function initDataFiles() {
  // Check if old data.json exists and migrate
  const oldDataFile = join(__dirname, 'data.json')
  if (existsSync(oldDataFile)) {
    try {
      const oldData = JSON.parse(readFileSync(oldDataFile, 'utf-8'))
      
      // Migrate users
      if (!existsSync(USERS_FILE) && oldData.users) {
        writeFileSync(USERS_FILE, JSON.stringify(oldData.users, null, 2))
        console.log('Migrated users to users.json')
      }
      
      // Migrate matches
      if (!existsSync(MATCHES_FILE) && oldData.matches) {
        writeFileSync(MATCHES_FILE, JSON.stringify(oldData.matches, null, 2))
        console.log('Migrated matches to matches.json')
      }
    } catch (err) {
      console.error('Error migrating old data:', err)
    }
  }

  // Create users.json if it doesn't exist
  if (!existsSync(USERS_FILE)) {
    const initialUsers = [
      { id: 'demo1', displayName: 'Alice', eloRating: 1000, wins: 0, losses: 0, createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'demo2', displayName: 'Bob', eloRating: 1000, wins: 0, losses: 0, createdAt: '2024-01-02T00:00:00.000Z' },
      { id: 'demo3', displayName: 'Charlie', eloRating: 1000, wins: 0, losses: 0, createdAt: '2024-01-03T00:00:00.000Z' },
      { id: 'demo4', displayName: 'Diana', eloRating: 1000, wins: 0, losses: 0, createdAt: '2024-01-04T00:00:00.000Z' },
    ]
    writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2))
    console.log('Created users.json')
  }

  // Create matches.json if it doesn't exist
  if (!existsSync(MATCHES_FILE)) {
    writeFileSync(MATCHES_FILE, JSON.stringify([], null, 2))
    console.log('Created matches.json')
  }
}

// Read users from JSON file
function readUsers() {
  try {
    const data = readFileSync(USERS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error('Error reading users file:', err)
    return []
  }
}

// Write users to JSON file
function writeUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

// Read matches from JSON file
function readMatches() {
  try {
    const data = readFileSync(MATCHES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error('Error reading matches file:', err)
    return []
  }
}

// Write matches to JSON file
function writeMatches(matches) {
  writeFileSync(MATCHES_FILE, JSON.stringify(matches, null, 2))
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Admin password for protected operations
const ADMIN_PASSWORD = '207902602'

// ============ API Routes ============

// Get all players
app.get('/api/players', (req, res) => {
  const users = readUsers()
  const players = users.sort((a, b) => b.eloRating - a.eloRating)
  res.json(players)
})

// Add a new player
app.post('/api/players', (req, res) => {
  const { displayName } = req.body
  
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: 'Player name is required' })
  }

  const users = readUsers()
  
  // Check for duplicate name
  const existing = users.find(
    u => u.displayName.toLowerCase() === displayName.toLowerCase()
  )
  if (existing) {
    return res.status(400).json({ error: 'A player with this name already exists' })
  }

  const newPlayer = {
    id: generateId(),
    displayName: displayName.trim(),
    eloRating: 1000,
    wins: 0,
    losses: 0,
    createdAt: new Date().toISOString()
  }

  users.push(newPlayer)
  writeUsers(users)
  
  res.status(201).json(newPlayer)
})

// Delete a player (password protected)
app.delete('/api/players/:id', (req, res) => {
  const { id } = req.params
  const { password } = req.body || {}
  
  // Check password
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Invalid password' })
  }

  const users = readUsers()
  const matches = readMatches()
  
  // Check if player exists
  const player = users.find(u => u.id === id)
  if (!player) {
    return res.status(404).json({ error: 'Player not found' })
  }

  // Find matches involving this player and revert stats for opponents
  const playerMatches = matches.filter(
    m => m.playerAId === id || m.playerBId === id
  )
  
  for (const match of playerMatches) {
    const otherPlayerId = match.playerAId === id ? match.playerBId : match.playerAId
    const otherPlayer = users.find(u => u.id === otherPlayerId)
    
    if (otherPlayer) {
      if (match.winnerId === otherPlayerId) {
        otherPlayer.eloRating -= match.winnerEloDelta
        otherPlayer.wins = Math.max(0, (otherPlayer.wins || 0) - 1)
      } else {
        otherPlayer.eloRating -= match.loserEloDelta
        otherPlayer.losses = Math.max(0, (otherPlayer.losses || 0) - 1)
      }
    }
  }

  // Remove matches involving this player
  const remainingMatches = matches.filter(
    m => m.playerAId !== id && m.playerBId !== id
  )
  writeMatches(remainingMatches)

  // Remove the player
  const remainingUsers = users.filter(u => u.id !== id)
  writeUsers(remainingUsers)
  
  res.json({ success: true, deletedMatches: playerMatches.length })
})

// Get all matches
app.get('/api/matches', (req, res) => {
  const matches = readMatches()
  const sorted = matches.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  res.json(sorted)
})

// Create a new match
app.post('/api/matches', (req, res) => {
  const { playerAId, playerBId, playerAScore, playerBScore, matchType } = req.body

  // Validate input
  if (!playerAId || !playerBId || playerAScore === undefined || playerBScore === undefined) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (playerAId === playerBId) {
    return res.status(400).json({ error: 'Cannot play against yourself' })
  }

  const users = readUsers()
  const matches = readMatches()
  
  const playerA = users.find(u => u.id === playerAId)
  const playerB = users.find(u => u.id === playerBId)
  
  if (!playerA || !playerB) {
    return res.status(400).json({ error: 'Invalid player selection' })
  }

  // Determine winner and loser
  const winnerId = playerAScore > playerBScore ? playerAId : playerBId
  const loserId = winnerId === playerAId ? playerBId : playerAId
  const winner = winnerId === playerA.id ? playerA : playerB
  const loser = loserId === playerA.id ? playerA : playerB

  // Calculate ELO changes
  const K = 32
  const expectedWinner = 1 / (1 + Math.pow(10, (loser.eloRating - winner.eloRating) / 400))
  const winnerDelta = Math.round(K * (1 - expectedWinner))
  const loserDelta = -winnerDelta

  // Create match
  const newMatch = {
    id: generateId(),
    playerAId,
    playerBId,
    playerAScore,
    playerBScore,
    winnerId,
    loserId,
    matchType: matchType || 11,
    winnerEloDelta: winnerDelta,
    loserEloDelta: loserDelta,
    createdAt: new Date().toISOString()
  }

  // Update winner stats
  const winnerIndex = users.findIndex(u => u.id === winnerId)
  users[winnerIndex].eloRating += winnerDelta
  users[winnerIndex].wins = (users[winnerIndex].wins || 0) + 1
  
  // Update loser stats
  const loserIndex = users.findIndex(u => u.id === loserId)
  users[loserIndex].eloRating += loserDelta
  users[loserIndex].losses = (users[loserIndex].losses || 0) + 1

  // Save to files
  matches.push(newMatch)
  writeMatches(matches)
  writeUsers(users)

  res.status(201).json(newMatch)
})

// Delete a match (password protected) - recalculates ratings
app.delete('/api/matches/:id', (req, res) => {
  const { id } = req.params
  const { password } = req.body || {}
  
  // Check password
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Invalid password' })
  }

  const users = readUsers()
  const matches = readMatches()
  
  const match = matches.find(m => m.id === id)
  if (!match) {
    return res.status(404).json({ error: 'Match not found' })
  }

  // Revert ELO and win/loss for winner
  const winnerIndex = users.findIndex(u => u.id === match.winnerId)
  if (winnerIndex !== -1) {
    users[winnerIndex].eloRating -= match.winnerEloDelta
    users[winnerIndex].wins = Math.max(0, (users[winnerIndex].wins || 0) - 1)
  }
  
  // Revert ELO and win/loss for loser
  const loserIndex = users.findIndex(u => u.id === match.loserId)
  if (loserIndex !== -1) {
    users[loserIndex].eloRating -= match.loserEloDelta
    users[loserIndex].losses = Math.max(0, (users[loserIndex].losses || 0) - 1)
  }

  // Remove match and save
  const remainingMatches = matches.filter(m => m.id !== id)
  writeMatches(remainingMatches)
  writeUsers(users)

  res.json({ success: true })
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Initialize and start server
initDataFiles()
app.listen(PORT, () => {
  console.log(`🏓 Ping Pong server running on http://localhost:${PORT}`)
  console.log(`📁 Users stored in: ${USERS_FILE}`)
  console.log(`📁 Matches stored in: ${MATCHES_FILE}`)
})
