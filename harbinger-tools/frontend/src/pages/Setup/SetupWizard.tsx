import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Github,
  User,
  Settings,
  Shield,
  Sparkles,
  Loader2,
  ExternalLink,
  Copy,
  CheckCircle2,
} from 'lucide-react'
import { useSetupStore } from '../../store/setupStore'
import { useNavigate } from 'react-router-dom'

const steps = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'config', title: 'App Configuration', icon: Settings },
  { id: 'oauth', title: 'GitHub OAuth', icon: Github },
  { id: 'admin', title: 'Admin Account', icon: User },
  { id: 'complete', title: 'Complete Setup', icon: Check },
]

function SetupWizard() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    currentStep,
    totalSteps,
    isComplete,
    nextStep,
    prevStep,
    submitSetup,
    checkNeedsSetup,
    isStepValid,
    getStepError,
  } = useSetupStore()

  // Form fields
  const {
    appName,
    appUrl,
    githubClientId,
    githubClientSecret,
    adminEmail,
    adminPassword,
    adminPasswordConfirm,
    githubPat,
    githubOwner,
    githubRepo,
    llmProvider,
    llmApiKey,
    llmModel,
    setAppName,
    setAppUrl,
    setGitHubClientId,
    setGitHubClientSecret,
    setAdminEmail,
    setAdminPassword,
    setAdminPasswordConfirm,
    setGitHubPat,
    setGitHubOwner,
    setGitHubRepo,
    setLlmProvider,
    setLlmApiKey,
    setLlmModel,
  } = useSetupStore()

  useEffect(() => {
    checkNeedsSetup().then((needsSetup) => {
      if (!needsSetup) {
        navigate('/login')
      }
      setIsLoading(false)
    })
  }, [checkNeedsSetup, navigate])

  const handleNext = () => {
    if (!isStepValid()) {
      setSubmitError(getStepError())
      return
    }
    setSubmitError(null)
    nextStep()
  }

  const handleSubmit = async () => {
    if (!isStepValid()) {
      setSubmitError(getStepError())
      return
    }
    setSubmitError(null)
    const result = await submitSetup()
    if (!result.success) {
      setSubmitError(result.error || 'Setup failed')
    }
  }

  const copyRedirectUrl = () => {
    navigator.clipboard.writeText(`${appUrl}/api/auth/github/callback`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Setup Complete!</h1>
          <p className="text-text-secondary mb-8">
            Your Harbinger instance is now configured. You can now sign in with your admin account.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-xl font-medium transition-colors"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    index < currentStep
                      ? 'bg-green-500 text-white'
                      : index === currentStep
                        ? 'bg-[#f0c040] text-[#0a0a0f]'
                        : 'bg-surface-light text-text-secondary'
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-full h-1 mx-2 ${
                      index < currentStep ? 'bg-green-500' : 'bg-surface-light'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">{steps[currentStep].title}</h2>
            <p className="text-text-secondary text-sm">
              Step {currentStep + 1} of {totalSteps}
            </p>
          </div>
        </div>

        {/* Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-surface border border-border rounded-2xl p-8"
        >
          {/* Error */}
          {submitError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{submitError}</span>
            </div>
          )}

          {/* Step Content */}
          {currentStep === 0 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#f0c040]/10 border border-[#f0c040]/30 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-[#f0c040]" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">Welcome to Harbinger</h1>
              <p className="text-text-secondary mb-6 max-w-md mx-auto">
                Let's set up your bug bounty intelligence platform. This wizard will guide you through
                configuring your instance in just a few steps.
              </p>
              <div className="space-y-2 text-sm text-text-secondary">
                <p>• Configure GitHub OAuth for authentication</p>
                <p>• Set up your admin account</p>
                <p>• Connect to GitHub for automation</p>
                <p>• Configure AI/LLM settings</p>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">App Name</label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="My Harbinger"
                  className="w-full bg-surface-light border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-secondary mt-1">This will be displayed in the UI</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">App URL</label>
                <input
                  type="url"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  placeholder="https://harbinger.example.com"
                  className="w-full bg-surface-light border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-secondary mt-1">
                  The public URL where this instance will be hosted
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-400 font-medium mb-1">Create a GitHub OAuth App</p>
                    <p className="text-xs text-amber-300/70">
                      Go to{' '}
                      <a
                        href="https://github.com/settings/developers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        GitHub Developer Settings
                      </a>{' '}
                      → OAuth Apps → New OAuth App
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Authorization Callback URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={appUrl ? `${appUrl}/api/auth/github/callback` : 'Set App URL first'}
                    className="flex-1 bg-surface-light border border-border rounded-xl px-4 py-3 text-white/50 cursor-not-allowed"
                  />
                  <button
                    onClick={copyRedirectUrl}
                    disabled={!appUrl}
                    className="px-4 py-3 bg-surface-light border border-border rounded-xl hover:bg-surface-light/80 transition-colors disabled:opacity-50"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Copy this into your GitHub OAuth App settings
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Client ID</label>
                <input
                  type="text"
                  value={githubClientId}
                  onChange={(e) => setGitHubClientId(e.target.value)}
                  placeholder="Iv23lixxx..."
                  className="w-full bg-surface-light border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Client Secret</label>
                <input
                  type="password"
                  value={githubClientSecret}
                  onChange={(e) => setGitHubClientSecret(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-light border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-secondary mt-1">This will be encrypted and stored securely</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Admin Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-surface-light border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-light border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-secondary mt-1">Must be at least 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-light border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="bg-surface-light rounded-xl p-4 space-y-4">
                <h3 className="font-medium text-white flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  GitHub Automation
                </h3>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">Personal Access Token</label>
                  <input
                    type="password"
                    value={githubPat}
                    onChange={(e) => setGitHubPat(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  />
                  <p className="text-xs text-text-secondary mt-1">Needs repo and workflow scopes</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">GitHub Owner</label>
                    <input
                      type="text"
                      value={githubOwner}
                      onChange={(e) => setGitHubOwner(e.target.value)}
                      placeholder="username"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Repository Name</label>
                    <input
                      type="text"
                      value={githubRepo}
                      onChange={(e) => setGitHubRepo(e.target.value)}
                      placeholder="my-harbinger"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-surface-light rounded-xl p-4 space-y-4">
                <h3 className="font-medium text-white">AI Configuration</h3>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">LLM Provider</label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value as 'anthropic' | 'openai' | 'google')}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="google">Google (Gemini)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">API Key</label>
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">Model (optional)</label>
                  <input
                    type="text"
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="claude-sonnet-4-5-20251001"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  />
                  <p className="text-xs text-text-secondary mt-1">Leave blank for provider default</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-6 py-3 text-text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            {currentStep === totalSteps - 1 ? (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-8 py-3 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-xl font-medium transition-colors"
              >
                Complete Setup
                <Check className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-xl font-medium transition-colors"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default SetupWizard
