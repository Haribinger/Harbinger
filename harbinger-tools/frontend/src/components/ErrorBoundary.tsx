import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: string
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: '' }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorInfo = info.componentStack || ''
    this.setState({ errorInfo })
    // Log to console for debugging
    console.error('[ErrorBoundary]', error.message, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

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
                  <h1 className="text-lg font-bold text-white font-mono">Runtime Error</h1>
                  <p className="text-sm text-gray-400 font-mono">Component crashed unexpectedly</p>
                </div>
              </div>

              {/* Error details */}
              <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-4 mb-6 overflow-auto max-h-48">
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
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-gray-500 rounded-lg text-sm font-mono transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[#1a1a2e] text-gray-400 hover:text-white hover:border-gray-500 rounded-lg text-sm font-mono transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-600 font-mono mt-4">
              HARBINGER v1.0 // Error boundary caught a rendering failure
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
