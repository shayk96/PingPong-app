/**
 * Seed Data Script
 * 
 * Creates mock players and matches for testing.
 * Run this from the browser console when logged in, or import and call seedDatabase().
 * 
 * IMPORTANT: Only run this once on a fresh database!
 * This will create test users and matches that affect rankings.
 */

import { 
  collection, 
  doc, 
  setDoc, 
  writeBatch, 
  Timestamp,
  getDocs
} from 'firebase/firestore'
import { db } from './firebase'
import { calculateElo } from './elo'

// Mock player data
const MOCK_PLAYERS = [
  { id: 'player1', displayName: 'Alex Thunder', email: 'alex@example.com' },
  { id: 'player2', displayName: 'Jordan Smash', email: 'jordan@example.com' },
  { id: 'player3', displayName: 'Sam Spinner', email: 'sam@example.com' },
  { id: 'player4', displayName: 'Casey Ace', email: 'casey@example.com' },
  { id: 'player5', displayName: 'Morgan Rally', email: 'morgan@example.com' },
]

// Mock match results (playerAId, playerBId, playerAScore, playerBScore, matchType, daysAgo)
const MOCK_MATCHES: [string, string, number, number, 11 | 21, number][] = [
  // Recent matches
  ['player1', 'player2', 11, 8, 11, 0],
  ['player3', 'player4', 11, 9, 11, 0],
  ['player1', 'player3', 11, 7, 11, 1],
  ['player2', 'player5', 9, 11, 11, 1],
  ['player4', 'player1', 11, 6, 11, 2],
  
  // Older matches
  ['player2', 'player3', 11, 5, 11, 3],
  ['player5', 'player1', 8, 11, 11, 3],
  ['player3', 'player5', 21, 18, 21, 4],
  ['player4', 'player2', 12, 10, 11, 4],
  ['player1', 'player4', 11, 9, 11, 5],
  
  // More history
  ['player2', 'player1', 11, 7, 11, 6],
  ['player3', 'player2', 11, 8, 11, 6],
  ['player5', 'player4', 11, 9, 11, 7],
  ['player1', 'player5', 21, 19, 21, 8],
  ['player4', 'player3', 10, 12, 11, 9],
  
  // Deuce games
  ['player2', 'player4', 13, 11, 11, 10],
  ['player1', 'player3', 22, 20, 21, 11],
  ['player5', 'player2', 11, 9, 11, 12],
]

/**
 * Check if database already has data
 */
async function hasExistingData(): Promise<boolean> {
  const usersSnapshot = await getDocs(collection(db, 'users'))
  return !usersSnapshot.empty
}

/**
 * Seed the database with mock data
 * 
 * Creates 5 test players and simulates match history,
 * properly calculating ELO after each match.
 */
export async function seedDatabase(): Promise<void> {
  console.log('🏓 Starting database seed...')

  // Check for existing data
  if (await hasExistingData()) {
    console.warn('⚠️ Database already has data. Skipping seed.')
    console.log('To reset: Delete all documents from Firestore and try again.')
    return
  }

  const INITIAL_ELO = 1000

  // Track ELO ratings as we simulate matches
  const eloRatings: Record<string, number> = {}
  MOCK_PLAYERS.forEach(p => {
    eloRatings[p.id] = INITIAL_ELO
  })

  // Create players
  console.log('Creating players...')
  const batch1 = writeBatch(db)
  
  for (const player of MOCK_PLAYERS) {
    const userRef = doc(db, 'users', player.id)
    batch1.set(userRef, {
      email: player.email,
      displayName: player.displayName,
      eloRating: INITIAL_ELO,
      createdAt: Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days ago
    })
  }
  
  await batch1.commit()
  console.log(`✅ Created ${MOCK_PLAYERS.length} players`)

  // Create matches (in chronological order - oldest first)
  console.log('Creating matches...')
  const sortedMatches = [...MOCK_MATCHES].sort((a, b) => b[5] - a[5]) // Sort by daysAgo descending

  for (const [playerAId, playerBId, playerAScore, playerBScore, matchType, daysAgo] of sortedMatches) {
    const winnerId = playerAScore > playerBScore ? playerAId : playerBId
    const loserId = winnerId === playerAId ? playerBId : playerAId
    
    // Calculate ELO changes
    const winnerRating = eloRatings[winnerId]
    const loserRating = eloRatings[loserId]
    const eloResult = calculateElo(winnerRating, loserRating)
    
    // Update tracked ratings
    eloRatings[winnerId] = eloResult.newWinnerRating
    eloRatings[loserId] = eloResult.newLoserRating
    
    // Create match document
    const matchRef = doc(collection(db, 'matches'))
    const matchDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    
    await setDoc(matchRef, {
      playerAId,
      playerBId,
      playerAScore,
      playerBScore,
      winnerId,
      loserId,
      matchType,
      winnerEloDelta: eloResult.winnerDelta,
      loserEloDelta: eloResult.loserDelta,
      createdAt: Timestamp.fromDate(matchDate),
      createdBy: winnerId // Simulate winner created the match
    })
  }
  
  console.log(`✅ Created ${MOCK_MATCHES.length} matches`)

  // Update final ELO ratings
  console.log('Updating final ELO ratings...')
  const batch2 = writeBatch(db)
  
  for (const [playerId, rating] of Object.entries(eloRatings)) {
    const userRef = doc(db, 'users', playerId)
    batch2.update(userRef, { eloRating: rating })
  }
  
  await batch2.commit()
  console.log('✅ Updated player ratings')

  // Log final rankings
  console.log('\n📊 Final Rankings:')
  const rankings = Object.entries(eloRatings)
    .sort((a, b) => b[1] - a[1])
    .map(([id, elo], index) => {
      const player = MOCK_PLAYERS.find(p => p.id === id)
      return `${index + 1}. ${player?.displayName} - ${elo} ELO`
    })
  rankings.forEach(r => console.log(r))

  console.log('\n🎉 Database seeded successfully!')
  console.log('You can now login or register to see the leaderboard.')
}

/**
 * Clear all data from the database
 * WARNING: This deletes everything!
 */
export async function clearDatabase(): Promise<void> {
  console.log('⚠️ Clearing database...')
  
  // Delete all matches
  const matchesSnapshot = await getDocs(collection(db, 'matches'))
  const matchBatch = writeBatch(db)
  matchesSnapshot.docs.forEach(doc => {
    matchBatch.delete(doc.ref)
  })
  await matchBatch.commit()
  console.log(`Deleted ${matchesSnapshot.size} matches`)
  
  // Delete all users
  const usersSnapshot = await getDocs(collection(db, 'users'))
  const userBatch = writeBatch(db)
  usersSnapshot.docs.forEach(doc => {
    userBatch.delete(doc.ref)
  })
  await userBatch.commit()
  console.log(`Deleted ${usersSnapshot.size} users`)
  
  console.log('✅ Database cleared')
}

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as unknown as { seedDatabase: typeof seedDatabase; clearDatabase: typeof clearDatabase }).seedDatabase = seedDatabase;
  (window as unknown as { seedDatabase: typeof seedDatabase; clearDatabase: typeof clearDatabase }).clearDatabase = clearDatabase
}

