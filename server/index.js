/**
 * Express server with MongoDB storage
 * Run with: node server/index.js
 */

import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, existsSync } from 'fs'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// MongoDB connection string (from environment variable)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pingpong'

// Admin password for protected operations
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '207902602'

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')))
}

// ============ MongoDB Schemas ============

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  eloRating: { type: Number, default: 1000 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
})

const matchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  playerAId: { type: String, required: true },
  playerBId: { type: String, required: true },
  playerAScore: { type: Number, required: true },
  playerBScore: { type: Number, required: true },
  winnerId: { type: String, required: true },
  loserId: { type: String, required: true },
  matchType: { type: Number, default: 11 },
  winnerEloDelta: { type: Number, required: true },
  loserEloDelta: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
})

const User = mongoose.model('User', userSchema)
const Match = mongoose.model('Match', matchSchema)

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// ============ Data Migration from JSON files ============

async function migrateFromJsonFiles() {
  const usersFile = join(__dirname, 'users.json')
  const matchesFile = join(__dirname, 'matches.json')
  
  // Check if we have existing users in MongoDB
  const existingUsers = await User.countDocuments()
  if (existingUsers > 0) {
    console.log('📦 MongoDB already has data, skipping migration')
    return
  }
  
  // Migrate users
  if (existsSync(usersFile)) {
    try {
      const usersData = JSON.parse(readFileSync(usersFile, 'utf-8'))
      if (usersData.length > 0) {
        await User.insertMany(usersData)
        console.log(`✅ Migrated ${usersData.length} users from users.json`)
      }
    } catch (err) {
      console.error('Error migrating users:', err.message)
    }
  }
  
  // Migrate matches
  if (existsSync(matchesFile)) {
    try {
      const matchesData = JSON.parse(readFileSync(matchesFile, 'utf-8'))
      if (matchesData.length > 0) {
        await Match.insertMany(matchesData)
        console.log(`✅ Migrated ${matchesData.length} matches from matches.json`)
      }
    } catch (err) {
      console.error('Error migrating matches:', err.message)
    }
  }
}

// ============ API Routes ============

// Get all players
app.get('/api/players', async (req, res) => {
  try {
    const players = await User.find().sort({ eloRating: -1 })
    res.json(players)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players' })
  }
})

// Add a new player
app.post('/api/players', async (req, res) => {
  const { displayName } = req.body
  
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: 'Player name is required' })
  }

  try {
    // Check for duplicate name (case-insensitive)
    const existing = await User.findOne({ 
      displayName: { $regex: new RegExp(`^${displayName.trim()}$`, 'i') }
    })
    
    if (existing) {
      return res.status(400).json({ error: 'A player with this name already exists' })
    }

    const newPlayer = new User({
      id: generateId(),
      displayName: displayName.trim(),
      eloRating: 1000,
      wins: 0,
      losses: 0,
      createdAt: new Date()
    })

    await newPlayer.save()
    res.status(201).json(newPlayer)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create player' })
  }
})

// Delete a player (password protected)
app.delete('/api/players/:id', async (req, res) => {
  const { id } = req.params
  const { password } = req.body || {}
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Invalid password' })
  }

  try {
    const player = await User.findOne({ id })
    if (!player) {
      return res.status(404).json({ error: 'Player not found' })
    }

    // Find matches involving this player
    const playerMatches = await Match.find({
      $or: [{ playerAId: id }, { playerBId: id }]
    })

    // Revert stats for opponents
    for (const match of playerMatches) {
      const otherPlayerId = match.playerAId === id ? match.playerBId : match.playerAId
      
      if (match.winnerId === otherPlayerId) {
        await User.updateOne(
          { id: otherPlayerId },
          { 
            $inc: { 
              eloRating: -match.winnerEloDelta,
              wins: -1 
            }
          }
        )
      } else {
        await User.updateOne(
          { id: otherPlayerId },
          { 
            $inc: { 
              eloRating: -match.loserEloDelta,
              losses: -1 
            }
          }
        )
      }
    }

    // Remove matches involving this player
    await Match.deleteMany({
      $or: [{ playerAId: id }, { playerBId: id }]
    })

    // Remove the player
    await User.deleteOne({ id })
    
    res.json({ success: true, deletedMatches: playerMatches.length })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete player' })
  }
})

// Get all matches
app.get('/api/matches', async (req, res) => {
  try {
    const matches = await Match.find().sort({ createdAt: -1 })
    res.json(matches)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matches' })
  }
})

// Create a new match
app.post('/api/matches', async (req, res) => {
  const { playerAId, playerBId, playerAScore, playerBScore, matchType } = req.body

  if (!playerAId || !playerBId || playerAScore === undefined || playerBScore === undefined) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (playerAId === playerBId) {
    return res.status(400).json({ error: 'Cannot play against yourself' })
  }

  try {
    const playerA = await User.findOne({ id: playerAId })
    const playerB = await User.findOne({ id: playerBId })
    
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
    const newMatch = new Match({
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
      createdAt: new Date()
    })

    await newMatch.save()

    // Update winner stats
    await User.updateOne(
      { id: winnerId },
      { $inc: { eloRating: winnerDelta, wins: 1 } }
    )
    
    // Update loser stats
    await User.updateOne(
      { id: loserId },
      { $inc: { eloRating: loserDelta, losses: 1 } }
    )

    res.status(201).json(newMatch)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create match' })
  }
})

// Delete a match (password protected)
app.delete('/api/matches/:id', async (req, res) => {
  const { id } = req.params
  const { password } = req.body || {}
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Invalid password' })
  }

  try {
    const match = await Match.findOne({ id })
    if (!match) {
      return res.status(404).json({ error: 'Match not found' })
    }

    // Revert ELO and win/loss for winner
    await User.updateOne(
      { id: match.winnerId },
      { $inc: { eloRating: -match.winnerEloDelta, wins: -1 } }
    )
    
    // Revert ELO and win/loss for loser
    await User.updateOne(
      { id: match.loserId },
      { $inc: { eloRating: -match.loserEloDelta, losses: -1 } }
    )

    // Remove match
    await Match.deleteOne({ id })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete match' })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  })
})

// Catch-all route for SPA (production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'))
  })
}

// ============ Start Server ============

async function startServer() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB')
    
    // Migrate data from JSON files if needed
    await migrateFromJsonFiles()
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🏓 Ping Pong server running on port ${PORT}`)
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (err) {
    console.error('❌ Failed to start server:', err.message)
    process.exit(1)
  }
}

startServer()
