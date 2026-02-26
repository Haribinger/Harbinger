import { useState, useEffect, useRef } from 'react'
import type { SVGProps } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Loader2, Copy, Cpu, RefreshCw, Key } from 'lucide-react'
import { useAuthStore, parseJWT } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

type Tab = 'oauth' | 'device' | 'token'

interface DeviceState {
  deviceCode: string
  userCode: string
  verificationUri: string
  interval: number
}

// Inline GitHub SVG — avoids lucide's Github icon which has inconsistent rendering
function GitHubIcon({ style, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      width="14"
      height="14"
      style={style}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

const S = {
  bg: '#0a0a0f',
  surface: '#0d0d15',
  border: '#1a1a2e',
  gold: '#f0c040',
  danger: '#ef4444',
  muted: '#9ca3af',
  dim: '#374151',
  dimmer: '#6b7280',
  white: '#ffffff',
} as const

const btnBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 20px',
  background: 'transparent',
  border: `1px solid ${S.gold}`,
  borderRadius: '4px',
  color: S.gold,
  fontSize: '11px',
  letterSpacing: '0.15em',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  fontFamily: 'inherit',
  fontWeight: 700,
  transition: 'opacity 0.15s, border-color 0.15s, color 0.15s',
}

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'GitHub OAuth not configured on server',
  token_exchange_failed: 'Token exchange failed',
  user_fetch_failed: 'Failed to fetch GitHub user',
  token_generation_failed: 'Session token generation failed',
  no_code: 'No authorization code received',
  access_denied: 'Access denied by GitHub user',
  invalid_state: 'OAuth state mismatch — possible CSRF attempt. Try again.',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'oauth', label: 'OAUTH' },
  { id: 'device', label: 'DEVICE FLOW' },
  { id: 'token', label: 'TOKEN' },
]

const AGENTS = ['PATHFINDER', 'BREACH', 'PHANTOM', 'SPECTER', 'CIPHER', 'SCRIBE']

function Login() {
  const [tab, setTab] = useState<Tab>('oauth')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [ghToken, setGhToken] = useState('')
  const [device, setDevice] = useState<DeviceState | null>(null)
  const [polling, setPolling] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { login, initiateGitHubAuth, startDeviceFlow, pollDeviceFlow, loginWithGHToken } = useAuthStore()
  const navigate = useNavigate()

  // Clear device flow polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Handle OAuth callback token / error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const errorParam = params.get('error')

    if (errorParam) {
      setError(ERROR_MESSAGES[errorParam] ?? `Auth error: ${errorParam}`)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (token) {
      const result = parseJWT(token)
      if (result?.success && result.data) {
        login(token, result.data)
        window.history.replaceState({}, '', window.location.pathname)
        navigate('/')
      } else {
        setError('Invalid token received from server')
      }
    }
  }, [login, navigate])

  const switchTab = (t: Tab) => {
    setTab(t)
    setError(null)
    // Cancel in-flight device poll when switching away
    if (t !== 'device' && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
      setPolling(false)
      setDevice(null)
    }
  }

  // --- OAuth tab ---
  const handleOAuthLogin = async () => {
    setIsLoading(true)
    setError(null)
    const result = await initiateGitHubAuth()
    if (result?.success && result.data?.authUrl) {
      window.location.href = result.data.authUrl
    } else {
      setIsLoading(false)
      setError(result?.error?.message ?? 'Failed to start OAuth flow')
    }
  }

  // --- Device flow tab ---
  const handleStartDevice = async () => {
    setIsLoading(true)
    setError(null)
    const data = await startDeviceFlow()
    setIsLoading(false)

    if (!data) {
      setError('Failed to start device flow — check GITHUB_CLIENT_ID on server')
      return
    }

    setDevice({
      deviceCode: data.deviceCode,
      userCode: data.userCode,
      verificationUri: data.verificationUri,
      interval: data.interval,
    })
    setPolling(true)

    // Poll slightly above the server-supplied interval to avoid rate limiting
    pollRef.current = setInterval(async () => {
      const ok = await pollDeviceFlow(data.deviceCode)
      if (ok) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        navigate('/')
      }
    }, (data.interval + 1) * 1000)
  }

  const copyUserCode = () => {
    if (!device) return
    navigator.clipboard.writeText(device.userCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // --- Token tab ---
  // useEnv=true uses the server's GH_TOKEN env var (dev shortcut)
  const handleTokenAuth = async (useEnv = false) => {
    if (!useEnv && !ghToken.trim()) {
      setError('Enter a GitHub token')
      return
    }
    setIsLoading(true)
    setError(null)
    const result = await loginWithGHToken(useEnv ? undefined : ghToken.trim())
    setIsLoading(false)

    if (result?.ok && result.jwt) {
      const parsed = parseJWT(result.jwt)
      if (parsed?.success && parsed.data) {
        login(result.jwt, parsed.data)
        navigate('/')
        return
      }
    }
    setError(result?.error ?? 'Authentication failed')
  }

  return (
    <div
      style={{
        background: S.bg,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        padding: '24px',
        position: 'relative',
      }}
    >
      {/* Scanline overlay — static, no JS animation */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <Cpu size={44} color={S.gold} strokeWidth={1.5} />
          </div>
          <h1
            style={{
              fontSize: '26px',
              letterSpacing: '0.3em',
              color: S.gold,
              margin: 0,
              fontWeight: 700,
            }}
          >
            HARBINGER
          </h1>
          <p
            style={{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: S.dimmer,
              margin: '6px 0 0',
            }}
          >
            AUTONOMOUS SECURITY FRAMEWORK
          </p>
        </div>

        {/* ── Card ── */}
        <div
          style={{
            background: S.surface,
            border: `1px solid ${S.border}`,
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}` }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                style={{
                  flex: 1,
                  padding: '11px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === t.id ? `2px solid ${S.gold}` : '2px solid transparent',
                  color: tab === t.id ? S.gold : S.dimmer,
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: tab === t.id ? 700 : 400,
                  transition: 'color 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: '26px 22px' }}>
            {/* Error banner */}
            {error && (
              <div
                style={{
                  marginBottom: '18px',
                  padding: '9px 12px',
                  background: 'rgba(239,68,68,0.07)',
                  border: `1px solid rgba(239,68,68,0.25)`,
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: S.danger,
                  fontSize: '11px',
                }}
              >
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* ── OAuth ── */}
              {tab === 'oauth' && (
                <motion.div
                  key="oauth"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                >
                  <p
                    style={{
                      color: S.muted,
                      fontSize: '11px',
                      lineHeight: 1.7,
                      marginBottom: '22px',
                      marginTop: 0,
                    }}
                  >
                    Standard GitHub OAuth flow. Requires a callback URL configured in your GitHub OAuth App settings.
                  </p>
                  <button
                    onClick={handleOAuthLogin}
                    disabled={isLoading}
                    style={{ ...btnBase, opacity: isLoading ? 0.5 : 1 }}
                    onMouseEnter={(e) => {
                      if (!isLoading) e.currentTarget.style.borderColor = S.white
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = S.gold
                    }}
                  >
                    {isLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <GitHubIcon />
                    )}
                    {isLoading ? 'CONNECTING...' : 'CONTINUE WITH GITHUB'}
                  </button>
                </motion.div>
              )}

              {/* ── Device Flow ── */}
              {tab === 'device' && (
                <motion.div
                  key="device"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                >
                  {!device ? (
                    <>
                      <p
                        style={{
                          color: S.muted,
                          fontSize: '11px',
                          lineHeight: 1.7,
                          marginBottom: '22px',
                          marginTop: 0,
                        }}
                      >
                        No callback URL required. GitHub generates a one-time code — enter it at{' '}
                        <span style={{ color: S.gold }}>github.com/login/device</span>.
                      </p>
                      <button
                        onClick={handleStartDevice}
                        disabled={isLoading}
                        style={{ ...btnBase, opacity: isLoading ? 0.5 : 1 }}
                      >
                        {isLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Key size={13} />
                        )}
                        {isLoading ? 'REQUESTING CODE...' : 'START DEVICE FLOW'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p
                        style={{
                          color: S.muted,
                          fontSize: '11px',
                          marginBottom: '10px',
                          marginTop: 0,
                        }}
                      >
                        1. Open:{' '}
                        <a
                          href={device.verificationUri}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: S.gold }}
                        >
                          {device.verificationUri}
                        </a>
                      </p>
                      <p style={{ color: S.muted, fontSize: '11px', marginBottom: '12px' }}>
                        2. Enter this code:
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '20px',
                          padding: '14px 16px',
                          background: S.bg,
                          border: `1px solid ${S.gold}`,
                          borderRadius: '4px',
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: '22px',
                            letterSpacing: '0.35em',
                            color: S.gold,
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        >
                          {device.userCode}
                        </span>
                        <button
                          onClick={copyUserCode}
                          title={copied ? 'Copied!' : 'Copy'}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: copied ? S.gold : S.dimmer,
                            padding: '4px',
                            transition: 'color 0.15s',
                          }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                      {polling && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: S.dimmer,
                            fontSize: '11px',
                          }}
                        >
                          <RefreshCw size={11} className="animate-spin" />
                          Waiting for authorization...
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* ── Token ── */}
              {tab === 'token' && (
                <motion.div
                  key="token"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                >
                  <p
                    style={{
                      color: S.muted,
                      fontSize: '11px',
                      lineHeight: 1.7,
                      marginBottom: '14px',
                      marginTop: 0,
                    }}
                  >
                    Authenticate with a GitHub personal access token (ghp_...).
                  </p>
                  <input
                    type="password"
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    placeholder="ghp_..."
                    autoComplete="off"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: S.bg,
                      border: `1px solid ${S.border}`,
                      borderRadius: '4px',
                      color: S.white,
                      fontSize: '12px',
                      fontFamily: 'inherit',
                      marginBottom: '12px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = S.gold)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = S.border)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTokenAuth()
                    }}
                  />
                  <button
                    onClick={() => handleTokenAuth()}
                    disabled={isLoading}
                    style={{ ...btnBase, marginBottom: '14px', opacity: isLoading ? 0.5 : 1 }}
                  >
                    {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
                    {isLoading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
                  </button>

                  {/* Server GH_TOKEN shortcut */}
                  <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: '14px' }}>
                    <button
                      onClick={() => handleTokenAuth(true)}
                      style={{
                        width: '100%',
                        padding: '9px 16px',
                        background: 'transparent',
                        border: `1px solid ${S.border}`,
                        borderRadius: '4px',
                        color: S.dimmer,
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = S.gold
                        e.currentTarget.style.color = S.gold
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = S.border
                        e.currentTarget.style.color = S.dimmer
                      }}
                    >
                      USE SERVER GH_TOKEN
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Agent roster strip ── */}
        <div
          style={{
            marginTop: '22px',
            display: 'flex',
            justifyContent: 'center',
            gap: '14px',
            flexWrap: 'wrap',
          }}
        >
          {AGENTS.map((a) => (
            <span
              key={a}
              style={{
                fontSize: '9px',
                letterSpacing: '0.12em',
                color: S.dim,
                fontFamily: 'inherit',
              }}
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Login
