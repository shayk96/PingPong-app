/**
 * Login page
 * Email/password authentication
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, loading, error, clearError } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
    } catch {
      // Error is handled by context
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo/Brand */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary-950 flex items-center justify-center shadow-xl">
          <span className="text-4xl">🏓</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-white">
          Ping Pong
        </h1>
        <p className="text-gray-400 mt-1">Track your games</p>
      </div>

      {/* Login Form */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) clearError()
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
              if (error) clearError()
            }}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={loading}
          >
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-gray-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

