/**
 * Custom hook for fetching and managing matches
 * Provides real-time updates and match creation/deletion
 */

import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
  limit
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { calculateElo } from '../lib/elo'
import { validateMatch } from '../lib/validation'
import type { Match, NewMatchInput, User } from '../types'
import { useAuth } from './useAuth'

export function useMatches(playerId?: string) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    // Build query based on whether we're filtering by player
    let q
    if (playerId) {
      // Get matches where the player participated (as either player A or B)
      // Note: Firestore doesn't support OR queries directly, so we'll filter client-side
      q = query(
        collection(db, 'matches'),
        orderBy('createdAt', 'desc')
      )
    } else {
      q = query(
        collection(db, 'matches'),
        orderBy('createdAt', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let matchList: Match[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            playerAId: data.playerAId,
            playerBId: data.playerBId,
            playerAScore: data.playerAScore,
            playerBScore: data.playerBScore,
            winnerId: data.winnerId,
            loserId: data.loserId,
            matchType: data.matchType,
            winnerEloDelta: data.winnerEloDelta,
            loserEloDelta: data.loserEloDelta,
            createdAt: data.createdAt?.toDate() || new Date(),
            createdBy: data.createdBy
          }
        })

        // Filter by player if specified
        if (playerId) {
          matchList = matchList.filter(
            (m) => m.playerAId === playerId || m.playerBId === playerId
          )
        }

        setMatches(matchList)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching matches:', err)
        setError('Failed to load matches')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [playerId])

  /**
   * Create a new match
   * - Validates the match data
   * - Calculates ELO changes
   * - Updates both players' ratings and creates match document atomically
   */
  const createMatch = useCallback(
    async (input: NewMatchInput, players: User[]): Promise<void> => {
      if (!user) {
        throw new Error('Must be logged in to create a match')
      }

      // Validate match input
      const validation = validateMatch(input)
      if (!validation.isValid) {
        throw new Error(validation.error)
      }

      // Get player data
      const playerA = players.find((p) => p.id === input.playerAId)
      const playerB = players.find((p) => p.id === input.playerBId)
      if (!playerA || !playerB) {
        throw new Error('Invalid player selection')
      }

      // Determine winner and loser
      const winnerId = input.playerAScore > input.playerBScore 
        ? input.playerAId 
        : input.playerBId
      const loserId = winnerId === input.playerAId 
        ? input.playerBId 
        : input.playerAId
      const winner = winnerId === playerA.id ? playerA : playerB
      const loser = loserId === playerA.id ? playerA : playerB

      // Check for duplicate submission (same players, same scores within 1 minute)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
      const duplicateQuery = query(
        collection(db, 'matches'),
        where('playerAId', '==', input.playerAId),
        where('playerBId', '==', input.playerBId),
        where('playerAScore', '==', input.playerAScore),
        where('playerBScore', '==', input.playerBScore),
        where('createdAt', '>=', Timestamp.fromDate(oneMinuteAgo)),
        limit(1)
      )
      const duplicateSnapshot = await getDocs(duplicateQuery)
      if (!duplicateSnapshot.empty) {
        throw new Error('This match was already submitted recently')
      }

      // Calculate ELO changes
      const eloResult = calculateElo(winner.eloRating, loser.eloRating)

      // Use batch write to update everything atomically
      const batch = writeBatch(db)

      // Create match document
      const matchRef = doc(collection(db, 'matches'))
      batch.set(matchRef, {
        playerAId: input.playerAId,
        playerBId: input.playerBId,
        playerAScore: input.playerAScore,
        playerBScore: input.playerBScore,
        winnerId,
        loserId,
        matchType: input.matchType,
        winnerEloDelta: eloResult.winnerDelta,
        loserEloDelta: eloResult.loserDelta,
        createdAt: serverTimestamp(),
        createdBy: user.id
      })

      // Update winner's ELO
      const winnerRef = doc(db, 'users', winnerId)
      batch.update(winnerRef, {
        eloRating: eloResult.newWinnerRating
      })

      // Update loser's ELO
      const loserRef = doc(db, 'users', loserId)
      batch.update(loserRef, {
        eloRating: eloResult.newLoserRating
      })

      await batch.commit()
    },
    [user]
  )

  /**
   * Delete a match
   * - Reverts ELO changes for both players
   * - Deletes the match document
   * All done atomically using batch write
   */
  const deleteMatch = useCallback(
    async (matchId: string): Promise<void> => {
      if (!user) {
        throw new Error('Must be logged in to delete a match')
      }

      // Get the match data
      const matchRef = doc(db, 'matches', matchId)
      const matchSnap = await getDoc(matchRef)
      
      if (!matchSnap.exists()) {
        throw new Error('Match not found')
      }

      const matchData = matchSnap.data()

      // Verify the current user created this match
      if (matchData.createdBy !== user.id) {
        throw new Error('You can only delete matches you created')
      }

      // Get current player ratings
      const winnerRef = doc(db, 'users', matchData.winnerId)
      const loserRef = doc(db, 'users', matchData.loserId)
      
      const [winnerSnap, loserSnap] = await Promise.all([
        getDoc(winnerRef),
        getDoc(loserRef)
      ])

      if (!winnerSnap.exists() || !loserSnap.exists()) {
        throw new Error('Player data not found')
      }

      const currentWinnerRating = winnerSnap.data().eloRating
      const currentLoserRating = loserSnap.data().eloRating

      // Revert ELO changes
      const revertedWinnerRating = currentWinnerRating - matchData.winnerEloDelta
      const revertedLoserRating = currentLoserRating - matchData.loserEloDelta

      // Use batch write to update atomically
      const batch = writeBatch(db)

      // Revert winner's ELO
      batch.update(winnerRef, {
        eloRating: revertedWinnerRating
      })

      // Revert loser's ELO
      batch.update(loserRef, {
        eloRating: revertedLoserRating
      })

      // Delete the match
      batch.delete(matchRef)

      await batch.commit()
    },
    [user]
  )

  return { matches, loading, error, createMatch, deleteMatch }
}

