import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useAuthStore, parseJWT } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function Login() {
  const [error, setError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { login, isAuthenticated, initiateGitHubAuth } = useAuthStore()
  const navigate = useNavigate()
  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    const errorParam = urlParams.get('error')

    if (errorParam) {
      setError(getErrorMessage(errorParam))
      // Clear the URL parameters
      window.history.replaceState({}, '', window.location.pathname)
    } else if (token) {
      const result = parseJWT(token)
      if (result?.success && result.data) {
        login(token, result.data)
        // Clear the URL parameters
        window.history.replaceState({}, '', window.location.pathname)
        // Navigate to dashboard
        navigate('/')
      } else {
        setError('Invalid token received')
      }
    }
    // Note: No else branch - no token is normal on first page load
  }, [login, navigate])

  const getErrorMessage = (code: string): string => {
    const messages: Record<string, string> = {
      'not_configured': 'GitHub OAuth is not configured on the server',
      'token_exchange_failed': 'Failed to exchange code for token',
      'user_fetch_failed': 'Failed to fetch user information',
      'token_generation_failed': 'Failed to generate session token',
      'no_code': 'No authorization code received',
      'access_denied': 'You denied access to your GitHub account',
    }
    return messages[code] || `Authentication failed: ${code}`
  }

  const handleGitHubLogin = async () => {
    setIsLoading(true)
    setError(null)

    const result = await initiateGitHubAuth()
    if (result?.success && result.data?.authUrl) {
      // Redirect to GitHub authorization page
      window.location.href = result.data.authUrl
    } else {
      setIsLoading(false)
      setError(result?.error?.message || 'Failed to initiate GitHub authentication')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Harbinger</h1>
          <p className="text-text-secondary">Bug Bounty Intelligence Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-border rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            Welcome Back
          </h2>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          {/* GitHub Login Button */}
          <button
            onClick={handleGitHubLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <GitHubIcon className="w-5 h-5" />
                <span>Continue with GitHub</span>
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              By continuing, you agree to our{' '}
              <a href="#" className="text-primary hover:underline">
                Terms of Service
              </a>
              {' '}and{' '}
              <a href="#" className="text-primary hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: 'Bug Bounty', desc: 'Track programs' },
            { label: 'AI Agents', desc: 'Automate tasks' },
            { label: 'Security', desc: 'Stay protected' },
          ].map((feature) => (
            <div key={feature.label} className="text-center">
              <p className="text-white font-medium text-sm">{feature.label}</p>
              <p className="text-text-secondary text-xs">{feature.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default Login
