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
  eloRating: { type: Number, default: 800 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastPlayedAt: { type: Date, default: Date.now } // Track last activity
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

// ELO History schema - tracks rating changes over time
const eloHistorySchema = new mongoose.Schema({
  playerId: { type: String, required: true, index: true },
  eloRating: { type: Number, required: true },
  matchId: { type: String }, // null for initial rating
  timestamp: { type: Date, default: Date.now }
})

const User = mongoose.model('User', userSchema)
const Match = mongoose.model('Match', matchSchema)
const EloHistory = mongoose.model('EloHistory', eloHistorySchema)

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// ============ Inactivity Settings ============

const INACTIVITY_GRACE_DAYS = 14 // Days before player is hidden
const INACTIVITY_PENALTY_PER_DAY = 7 // ELO penalty per day of inactivity

/**
 * Calculate inactivity penalty for a player returning after being inactive
 * Penalty is applied from day 1, not after grace period
 */
function calculateInactivityPenalty(lastPlayedAt) {
  if (!lastPlayedAt) return 0
  
  const now = new Date()
  const daysSinceLastPlayed = Math.floor((now - new Date(lastPlayedAt)) / (1000 * 60 * 60 * 24))
  
  // Only apply penalty if player was inactive
  if (daysSinceLastPlayed <= 0) return 0
  
  return daysSinceLastPlayed * INACTIVITY_PENALTY_PER_DAY
}

/**
 * Check if player should be hidden (inactive for more than grace period)
 */
function isPlayerInactive(lastPlayedAt) {
  if (!lastPlayedAt) return false
  
  const now = new Date()
  const daysSinceLastPlayed = Math.floor((now - new Date(lastPlayedAt)) / (1000 * 60 * 60 * 24))
  
  return daysSinceLastPlayed > INACTIVITY_GRACE_DAYS
}

// ============ Enhanced ELO Calculation ============

/**
 * Get K-factor based on number of games played
 * New players have more volatile ratings, experienced players are more stable
 */
function getKFactor(gamesPlayed) {
  if (gamesPlayed < 10) return 40  // New player - high volatility
  if (gamesPlayed < 30) return 32  // Intermediate - standard
  return 24                         // Experienced - more stable
}

/**
 * Calculate margin multiplier based on score difference
 * Winning by more points gives a bonus
 */
function getMarginMultiplier(winnerScore, loserScore) {
  const pointDifference = winnerScore - loserScore
  // Minimum difference is 2 (must win by 2 in ping pong)
  // Each additional point adds 0.05 to the multiplier
  // Example: win by 2 = 1.0, win by 6 = 1.2, win by 10 = 1.4, win by 11 = 1.45
  return 1 + Math.max(0, (pointDifference - 2)) * 0.05
}

/**
 * Calculate expected score (probability of winning)
 */
function expectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
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
      eloRating: 800,
      wins: 0,
      losses: 0,
      createdAt: new Date(),
      lastPlayedAt: new Date() // Start fresh, no inactivity penalty
    })

    await newPlayer.save()
    
    // Save initial ELO history entry
    await new EloHistory({
      playerId: newPlayer.id,
      eloRating: 800,
      matchId: null, // Initial rating, no match
      timestamp: new Date()
    }).save()
    
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

    // Remove ELO history for this player
    await EloHistory.deleteMany({ playerId: id })

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

    // Apply inactivity penalties before calculating match results
    const playerAPenalty = calculateInactivityPenalty(playerA.lastPlayedAt)
    const playerBPenalty = calculateInactivityPenalty(playerB.lastPlayedAt)
    
    // Apply penalties if any
    if (playerAPenalty > 0) {
      const newRating = Math.max(100, playerA.eloRating - playerAPenalty)
      await User.updateOne({ id: playerAId }, { eloRating: newRating })
      playerA.eloRating = newRating
      console.log(`📉 Applied inactivity penalty to ${playerA.displayName}: -${playerAPenalty} ELO`)
    }
    if (playerBPenalty > 0) {
      const newRating = Math.max(100, playerB.eloRating - playerBPenalty)
      await User.updateOne({ id: playerBId }, { eloRating: newRating })
      playerB.eloRating = newRating
      console.log(`📉 Applied inactivity penalty to ${playerB.displayName}: -${playerBPenalty} ELO`)
    }

    // Determine winner and loser
    const winnerId = playerAScore > playerBScore ? playerAId : playerBId
    const loserId = winnerId === playerAId ? playerBId : playerAId
    const winner = winnerId === playerA.id ? playerA : playerB
    const loser = loserId === playerA.id ? playerA : playerB
    const winnerScore = winnerId === playerAId ? playerAScore : playerBScore
    const loserScore = loserId === playerAId ? playerAScore : playerBScore

    // Calculate games played for each player
    const winnerGamesPlayed = winner.wins + winner.losses
    const loserGamesPlayed = loser.wins + loser.losses

    // Get K-factors based on experience - use average for symmetric calculation
    const winnerK = getKFactor(winnerGamesPlayed)
    const loserK = getKFactor(loserGamesPlayed)
    const avgK = (winnerK + loserK) / 2

    // Get margin multiplier based on score difference
    const marginMult = getMarginMultiplier(winnerScore, loserScore)

    // Calculate ELO changes - SYMMETRIC: winner gains exactly what loser loses
    const expWinner = expectedScore(winner.eloRating, loser.eloRating)
    
    const delta = Math.round(avgK * marginMult * (1 - expWinner))
    const winnerDelta = delta
    const loserDelta = -delta

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

    const now = new Date()

    // Update winner stats and lastPlayedAt
    await User.updateOne(
      { id: winnerId },
      { $inc: { eloRating: winnerDelta, wins: 1 }, $set: { lastPlayedAt: now } }
    )
    
    // Update loser stats and lastPlayedAt
    await User.updateOne(
      { id: loserId },
      { $inc: { eloRating: loserDelta, losses: 1 }, $set: { lastPlayedAt: now } }
    )

    // Save ELO history for both players
    const updatedWinner = await User.findOne({ id: winnerId })
    const updatedLoser = await User.findOne({ id: loserId })
    
    await EloHistory.insertMany([
      {
        playerId: winnerId,
        eloRating: updatedWinner.eloRating,
        matchId: newMatch.id,
        timestamp: now
      },
      {
        playerId: loserId,
        eloRating: updatedLoser.eloRating,
        matchId: newMatch.id,
        timestamp: now
      }
    ])

    res.status(201).json(newMatch)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create match' })
  }
})

// Undo a recent match (no password, 5-minute window)
const UNDO_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

app.post('/api/matches/:id/undo', async (req, res) => {
  const { id } = req.params

  try {
    const match = await Match.findOne({ id })
    if (!match) {
      return res.status(404).json({ error: 'Match not found' })
    }

    // Check if match is within the undo window
    const elapsed = Date.now() - new Date(match.createdAt).getTime()
    if (elapsed > UNDO_WINDOW_MS) {
      return res.status(403).json({ error: 'Undo window has expired (5 minutes)' })
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

    // Remove ELO history entries for this match
    await EloHistory.deleteMany({ matchId: id })

    // Remove match
    await Match.deleteOne({ id })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to undo match' })
  }
})

// Delete a match
app.delete('/api/matches/:id', async (req, res) => {
  const { id } = req.params

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

// Get ELO history for all players (or specific players)
app.get('/api/elo-history', async (req, res) => {
  try {
    const { playerIds } = req.query
    
    let query = {}
    if (playerIds) {
      // If specific players requested, filter by their IDs
      const ids = playerIds.split(',')
      query = { playerId: { $in: ids } }
    }
    
    const history = await EloHistory.find(query).sort({ timestamp: 1 })
    res.json(history)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ELO history' })
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

// List ELO backups
app.get('/api/backups', async (req, res) => {
  try {
    const backups = await EloBackup.find()
      .select('backupId createdAt')
      .sort({ createdAt: -1 })
    res.json(backups)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch backups' })
  }
})

// Restore from a backup (password protected)
app.post('/api/backups/:backupId/restore', async (req, res) => {
  const { backupId } = req.params
  const { password } = req.body || {}
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Invalid password' })
  }
  
  try {
    const success = await restoreEloBackup(backupId)
    
    if (success) {
      // Also rebuild ELO history after restore
      await EloHistory.deleteMany({})
      
      const players = await User.find()
      const matches = await Match.find().sort({ createdAt: 1 })
      
      const playerElos = {}
      const historyEntries = []
      
      for (const player of players) {
        playerElos[player.id] = 800
        historyEntries.push({
          playerId: player.id,
          eloRating: 800,
          matchId: null,
          timestamp: player.createdAt || new Date('2024-01-01')
        })
      }
      
      for (const match of matches) {
        if (playerElos[match.winnerId] !== undefined) {
          playerElos[match.winnerId] += match.winnerEloDelta
          historyEntries.push({
            playerId: match.winnerId,
            eloRating: playerElos[match.winnerId],
            matchId: match.id,
            timestamp: match.createdAt
          })
        }
        if (playerElos[match.loserId] !== undefined) {
          playerElos[match.loserId] += match.loserEloDelta
          historyEntries.push({
            playerId: match.loserId,
            eloRating: playerElos[match.loserId],
            matchId: match.id,
            timestamp: match.createdAt
          })
        }
      }
      
      await EloHistory.insertMany(historyEntries)
      
      res.json({ success: true, message: 'ELO restored from backup' })
    } else {
      res.status(404).json({ error: 'Backup not found' })
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore backup' })
  }
})

// Catch-all route for SPA (production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'))
  })
}

// ============ ELO Backup Schema ============

const eloBackupSchema = new mongoose.Schema({
  backupId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  players: [{
    id: String,
    displayName: String,
    eloRating: Number,
    wins: Number,
    losses: Number,
    lastPlayedAt: Date
  }],
  matchDeltas: [{
    matchId: String,
    winnerEloDelta: Number,
    loserEloDelta: Number
  }]
})

const EloBackup = mongoose.model('EloBackup', eloBackupSchema)

// ============ ELO Recalculation ============

/**
 * Create a backup of current ELO state before recalculation
 */
async function createEloBackup() {
  try {
    const backupId = `backup_${Date.now()}`
    
    // Get all current player states
    const players = await User.find()
    const playerBackups = players.map(p => ({
      id: p.id,
      displayName: p.displayName,
      eloRating: p.eloRating,
      wins: p.wins,
      losses: p.losses,
      lastPlayedAt: p.lastPlayedAt
    }))
    
    // Get all match deltas
    const matches = await Match.find()
    const matchDeltas = matches.map(m => ({
      matchId: m.id,
      winnerEloDelta: m.winnerEloDelta,
      loserEloDelta: m.loserEloDelta
    }))
    
    // Save backup
    const backup = new EloBackup({
      backupId,
      createdAt: new Date(),
      players: playerBackups,
      matchDeltas: matchDeltas
    })
    
    await backup.save()
    console.log(`💾 Created ELO backup: ${backupId}`)
    
    return backupId
  } catch (err) {
    console.error('Error creating backup:', err.message)
    return null
  }
}

/**
 * Restore ELO from a backup
 */
async function restoreEloBackup(backupId) {
  try {
    const backup = await EloBackup.findOne({ backupId })
    
    if (!backup) {
      console.error(`Backup not found: ${backupId}`)
      return false
    }
    
    console.log(`🔄 Restoring ELO from backup: ${backupId}`)
    
    // Restore player states
    for (const player of backup.players) {
      await User.updateOne(
        { id: player.id },
        {
          eloRating: player.eloRating,
          wins: player.wins,
          losses: player.losses,
          lastPlayedAt: player.lastPlayedAt
        }
      )
    }
    
    // Restore match deltas
    for (const match of backup.matchDeltas) {
      await Match.updateOne(
        { id: match.matchId },
        {
          winnerEloDelta: match.winnerEloDelta,
          loserEloDelta: match.loserEloDelta
        }
      )
    }
    
    console.log(`✅ Restored ${backup.players.length} players from backup`)
    return true
  } catch (err) {
    console.error('Error restoring backup:', err.message)
    return false
  }
}

/**
 * Completely recalculate all ELO ratings from scratch
 * - Resets all players to 800 ELO with 0 wins/losses
 * - Replays all matches in chronological order using current formula
 * - Updates match deltas and rebuilds ELO history
 */
async function recalculateAllElo() {
  try {
    // Create backup before recalculating
    const backupId = await createEloBackup()
    if (backupId) {
      console.log(`💾 Backup created. To restore, use backupId: ${backupId}`)
    }
    
    console.log('🔄 Recalculating all ELO ratings from scratch...')
    
    // Get all players and matches
    const players = await User.find()
    const matches = await Match.find().sort({ createdAt: 1 }) // Oldest first
    
    if (matches.length === 0) {
      console.log('📊 No matches to recalculate')
      return
    }
    
    // Clear existing ELO history
    await EloHistory.deleteMany({})
    
    // Track each player's state
    const playerState = {}
    const historyEntries = []
    
    // Reset all players to initial state
    for (const player of players) {
      playerState[player.id] = {
        eloRating: 800,
        wins: 0,
        losses: 0,
        lastPlayedAt: player.createdAt || new Date()
      }
      
      // Add initial ELO history entry
      historyEntries.push({
        playerId: player.id,
        eloRating: 800,
        matchId: null,
        timestamp: player.createdAt || new Date('2024-01-01')
      })
    }
    
    // Replay all matches in chronological order
    for (const match of matches) {
      const winnerId = match.winnerId
      const loserId = match.loserId
      
      // Skip if players don't exist
      if (!playerState[winnerId] || !playerState[loserId]) continue
      
      const winner = playerState[winnerId]
      const loser = playerState[loserId]
      
      // Get scores from match
      const winnerScore = match.playerAId === winnerId ? match.playerAScore : match.playerBScore
      const loserScore = match.playerAId === loserId ? match.playerAScore : match.playerBScore
      
      // Calculate games played at time of match
      const winnerGamesPlayed = winner.wins + winner.losses
      const loserGamesPlayed = loser.wins + loser.losses
      
      // Get K-factors - use average for symmetric calculation
      const winnerK = getKFactor(winnerGamesPlayed)
      const loserK = getKFactor(loserGamesPlayed)
      const avgK = (winnerK + loserK) / 2
      
      // Get margin multiplier
      const marginMult = getMarginMultiplier(winnerScore, loserScore)
      
      // Calculate ELO changes - SYMMETRIC
      const expWinner = expectedScore(winner.eloRating, loser.eloRating)
      const delta = Math.round(avgK * marginMult * (1 - expWinner))
      
      // Update player states
      winner.eloRating += delta
      winner.wins += 1
      winner.lastPlayedAt = match.createdAt
      
      loser.eloRating -= delta
      loser.losses += 1
      loser.lastPlayedAt = match.createdAt
      
      // Update match with new deltas
      await Match.updateOne(
        { id: match.id },
        { 
          winnerEloDelta: delta,
          loserEloDelta: -delta
        }
      )
      
      // Add ELO history entries
      historyEntries.push({
        playerId: winnerId,
        eloRating: winner.eloRating,
        matchId: match.id,
        timestamp: match.createdAt
      })
      historyEntries.push({
        playerId: loserId,
        eloRating: loser.eloRating,
        matchId: match.id,
        timestamp: match.createdAt
      })
    }
    
    // Update all players in database
    for (const playerId of Object.keys(playerState)) {
      const state = playerState[playerId]
      await User.updateOne(
        { id: playerId },
        {
          eloRating: state.eloRating,
          wins: state.wins,
          losses: state.losses,
          lastPlayedAt: state.lastPlayedAt
        }
      )
    }
    
    // Insert all ELO history entries
    if (historyEntries.length > 0) {
      await EloHistory.insertMany(historyEntries)
    }
    
    console.log(`✅ Recalculated ELO for ${players.length} players from ${matches.length} matches`)
    console.log(`📈 Created ${historyEntries.length} ELO history entries`)
    
  } catch (err) {
    console.error('Error recalculating ELO:', err.message)
  }
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
    
    // ONE-TIME: Recalculate all ELO ratings with current formula
    // This will reset everyone and replay all matches
    // Remove or comment out this line after it runs once
    await recalculateAllElo()
    
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
