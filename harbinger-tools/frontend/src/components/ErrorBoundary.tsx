import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  compact?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: string
  copied: boolean
}

class ErrorBoundary extends Component<Props, State> {
  private copyTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: '', copied: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorInfo = info.componentStack || ''
    this.setState({ errorInfo })
    console.error('[ErrorBoundary]', error.message, errorInfo)
  }

  componentWillUnmount() {
    if (this.copyTimeout) clearTimeout(this.copyTimeout)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: '', copied: false })
  }

  handleCopyError = () => {
    const { error, errorInfo } = this.state
    const text = `[HARBINGER ERROR]\n${error?.message || 'Unknown error'}\n\nStack:\n${error?.stack || 'N/A'}\n\nComponent:\n${errorInfo}`
    navigator.clipboard.writeText(text).catch(() => { /* clipboard API may not be available */ })
    this.setState({ copied: true })
    this.copyTimeout = setTimeout(() => this.setState({ copied: false }), 2000)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const timestamp = new Date().toISOString()
      const isCompact = this.props.compact

      if (isCompact) {
        return (
          <div className="flex-1 flex items-center justify-center p-8 bg-[#0a0a0f]">
            <div className="max-w-lg w-full bg-[#0d0d15] border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-sm font-bold text-red-400 font-mono">PAGE RENDER FAILURE</span>
                <span className="ml-auto text-[10px] text-gray-600 font-mono">{timestamp}</span>
              </div>
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-3 mb-4 max-h-32 overflow-auto">
                <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-words">
                  {this.state.error?.message || 'Unknown error'}
                </pre>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={this.handleDismiss}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg text-xs font-mono transition-colors"
                >
                  <Bug className="w-3.5 h-3.5" />
                  Retry
                </button>
                <button
                  onClick={this.handleCopyError}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-gray-500 rounded-lg text-xs font-mono transition-colors"
                >
                  {this.state.copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {this.state.copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-gray-500 rounded-lg text-xs font-mono transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload
                </button>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
          <div className="max-w-lg w-full">
            <div className="bg-[#0d0d15] border border-[#1a1a2e] rounded-xl p-8">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white font-mono">FATAL // Runtime Error</h1>
                  <p className="text-sm text-gray-400 font-mono">Component crashed unexpectedly</p>
                </div>
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-2 mb-4 text-[10px] text-gray-600 font-mono">
                <span>TIMESTAMP: {timestamp}</span>
              </div>

              {/* Error details */}
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-4 mb-6 overflow-auto max-h-48">
                <div className="text-[10px] text-gray-600 font-mono mb-1">ERROR OUTPUT</div>
                <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-words">
                  {this.state.error?.message || 'Unknown error'}
                </pre>
                {this.state.errorInfo && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 font-mono cursor-pointer hover:text-gray-400">
                      Stack trace
                    </summary>
                    <pre className="mt-2 text-xs text-gray-600 font-mono whitespace-pre-wrap break-words">
                      {this.state.errorInfo}
                    </pre>
                  </details>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={this.handleDismiss}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg text-sm font-mono transition-colors"
                >
                  <Bug className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={this.handleCopyError}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-gray-500 rounded-lg text-sm font-mono transition-colors"
                >
                  {this.state.copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {this.state.copied ? 'Copied' : 'Copy Error'}
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-gray-500 rounded-lg text-sm font-mono transition-colors"
                >
                  <Home className="w-4 h-4" />
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-gray-500 rounded-lg text-sm font-mono transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-600 font-mono mt-4">
              HARBINGER v1.1 // Error boundary caught a rendering failure
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
