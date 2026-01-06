/**
 * Custom hook for fetching and managing players
 * Provides real-time updates via Firestore snapshots
 */

import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { User } from '../types'

export function usePlayers() {
  const [players, setPlayers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Query all users, ordered by ELO rating (descending)
    const q = query(
      collection(db, 'users'),
      orderBy('eloRating', 'desc')
    )

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const playerList: User[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          email: doc.data().email,
          displayName: doc.data().displayName,
          eloRating: doc.data().eloRating,
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }))
        setPlayers(playerList)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching players:', err)
        setError('Failed to load players')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  return { players, loading, error }
}

