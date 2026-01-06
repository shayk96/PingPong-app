/**
 * Registration page
 * Create new user account
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

export default function Register() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const { register, loading, error, clearError } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    // Validate display name
    if (displayName.trim().length < 2) {
      setLocalError('Display name must be at least 2 characters')
      return
    }

    // Validate password match
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match')
      return
    }

    // Validate password strength
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters')
      return
    }

    try {
      await register(email, password, displayName.trim())
    } catch {
      // Error is handled by context
    }
  }

  const displayError = localError || error

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo/Brand */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary-950 flex items-center justify-center shadow-xl">
          <span className="text-4xl">🏓</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-white">
          Join the Game
        </h1>
        <p className="text-gray-400 mt-1">Create your account</p>
      </div>

      {/* Registration Form */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Display Name"
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value)
              if (displayError) {
                setLocalError(null)
                clearError()
              }
            }}
            placeholder="Your nickname"
            autoComplete="name"
            required
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (displayError) {
                setLocalError(null)
                clearError()
              }
            }}
            placeholder="your@email.com"
            autoComplete="email"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (displayError) {
                setLocalError(null)
                clearError()
              }
            }}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (displayError) {
                setLocalError(null)
                clearError()
              }
            }}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />

          {displayError && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm text-center">
              {displayError}
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={loading}
          >
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

