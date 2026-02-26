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
  const [isValidating, setIsValidating] = useState(true)

  useEffect(() => {
    // Check if token is expired
    if (token && isTokenExpired(token)) {
      logout()
    }
    setIsValidating(false)
  }, [token, logout])

  if (isValidating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to login, but save the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export function PublicRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (isAuthenticated) {
    // Redirect to dashboard if already logged in
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}
