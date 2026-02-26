import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, isTokenExpired } from '../store/authStore'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { token, isAuthenticated, logout } = useAuthStore()
  const location = useLocation()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Wait a tick for zustand persist to rehydrate from localStorage
    // then check token validity
    const check = () => {
      const state = useAuthStore.getState()
      if (state.token && isTokenExpired(state.token)) {
        state.logout()
      }
      setIsReady(true)
    }

    // If the store already has a token, we're rehydrated
    if (token !== null) {
      check()
      return
    }

    // Otherwise wait for persist rehydration (max 200ms)
    const timer = setTimeout(check, 100)
    // Also listen for store changes (rehydration triggers a state update)
    const unsub = useAuthStore.subscribe(() => {
      clearTimeout(timer)
      check()
    })

    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isReady) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Loader2 className="w-8 h-8 text-primary animate-spin" style={{ color: '#f0c040' }} />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export function PublicRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, token } = useAuthStore()
  const location = useLocation()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const check = () => setIsReady(true)
    if (token !== null || isAuthenticated) {
      check()
      return
    }
    // Wait for persist rehydration
    const timer = setTimeout(check, 100)
    const unsub = useAuthStore.subscribe(() => {
      clearTimeout(timer)
      check()
    })
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isReady) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#f0c040' }} />
      </div>
    )
  }

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}
