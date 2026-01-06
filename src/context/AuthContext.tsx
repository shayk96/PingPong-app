/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Uses Firebase Auth for email/password authentication.
 */

import { createContext, useEffect, useState, ReactNode } from 'react'
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { User } from '../types'

// Initial ELO rating for all new players
const INITIAL_ELO = 1000

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      
      if (fbUser) {
        // Fetch user data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setUser({
              id: fbUser.uid,
              email: userData.email,
              displayName: userData.displayName,
              eloRating: userData.eloRating,
              createdAt: userData.createdAt?.toDate() || new Date()
            })
          } else {
            // User document doesn't exist yet (shouldn't happen normally)
            setUser(null)
          }
        } catch (err) {
          console.error('Error fetching user data:', err)
          setUser(null)
        }
      } else {
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Login with email and password
  const login = async (email: string, password: string) => {
    try {
      setError(null)
      setLoading(true)
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to login'
      setError(formatAuthError(message))
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Register new user
  const register = async (email: string, password: string, displayName: string) => {
    try {
      setError(null)
      setLoading(true)
      
      // Create Firebase Auth user
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password)
      
      // Update display name in Firebase Auth
      await updateProfile(fbUser, { displayName })
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', fbUser.uid), {
        email,
        displayName,
        eloRating: INITIAL_ELO,
        createdAt: serverTimestamp()
      })
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register'
      setError(formatAuthError(message))
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Logout
  const logout = async () => {
    try {
      setError(null)
      await signOut(auth)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to logout'
      setError(message)
      throw err
    }
  }

  // Clear error
  const clearError = () => setError(null)

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        error,
        login,
        register,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Format Firebase auth errors into user-friendly messages
 */
function formatAuthError(message: string): string {
  if (message.includes('auth/email-already-in-use')) {
    return 'This email is already registered'
  }
  if (message.includes('auth/invalid-email')) {
    return 'Invalid email address'
  }
  if (message.includes('auth/weak-password')) {
    return 'Password should be at least 6 characters'
  }
  if (message.includes('auth/user-not-found') || message.includes('auth/wrong-password')) {
    return 'Invalid email or password'
  }
  if (message.includes('auth/invalid-credential')) {
    return 'Invalid email or password'
  }
  if (message.includes('auth/too-many-requests')) {
    return 'Too many failed attempts. Please try again later'
  }
  return message
}

