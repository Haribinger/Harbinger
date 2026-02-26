import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Send,
  Paperclip,
  Settings,
  Copy,
  Check,
  Terminal,
  Maximize2,
  Minimize2,
  AlertCircle,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { useSettingsStore } from '../../store/settingsStore'
import { chatApi } from '../../api/chat'
import type { Message, ChatSession } from '../../types'
import toast from 'react-hot-toast'

function Chat() {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    activeAgent,
    activeChat,
    addMessage,
    addChat,
    setActiveChat,
    chats
  } = useAgentStore()
  const { rightPanelVisible, toggleRightPanel, modelDefaults } = useSettingsStore()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [activeChat?.messages])

  // Create a new chat session if none exists
  const ensureActiveChat = async (): Promise<ChatSession | null> => {
    if (activeChat) return activeChat
    if (!activeAgent) return null

    const newChat: ChatSession = {
      id: `chat-${Date.now()}`,
      name: `Chat with ${activeAgent.name}`,
      agentId: activeAgent.id,
      messages: [],
      mode: 'chat',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    addChat(newChat)
    setActiveChat(newChat)
    return newChat
  }

  const handleSend = async () => {
    if (!input.trim() || !activeAgent) return

    const messageContent = input.trim()
    setInput('')
    setError(null)

    try {
      // Ensure we have an active chat
      const chat = await ensureActiveChat()
      if (!chat) {
        setError('No active chat or agent selected')
        return
      }

      // Add user message
      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        agentId: activeAgent.id,
        role: 'user',
        content: messageContent,
        timestamp: new Date().toISOString(),
      }

      addMessage(chat.id, userMessage)
      setIsTyping(true)

      // Try to use real API first, fall back to mock
      try {
        const response = await chatApi.sendMessage({
          content: messageContent,
          agentId: activeAgent.id,
          sessionId: chat.id,
          stream: false,
        })

        // Add agent response from API
        const agentMessage: Message = {
          id: response.id || `msg-${Date.now() + 1}`,
          agentId: activeAgent.id,
          role: 'assistant',
          content: response.content || 'No response',
          timestamp: new Date().toISOString(),
        }
        addMessage(chat.id, agentMessage)
      } catch (apiError) {
        // API not available, use mock response
        console.log('Chat API not available, using mock response')

        setTimeout(() => {
          const agentMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            agentId: activeAgent.id,
            role: 'assistant',
            content: `**${activeAgent.name}:** I received your message: "${messageContent}"\n\nThis is a simulated response since the chat API is not currently available.`,
            timestamp: new Date().toISOString(),
          }
          addMessage(chat.id, agentMessage)
          setIsTyping(false)
        }, 1000)
      }

    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Failed to send message. Please try again.')
      toast.error('Failed to send message')
      setIsTyping(false)
    }
  }

  const messages: Message[] = activeChat?.messages || []

  return (
    <div className="h-full flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {activeAgent ? (
              <>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{ backgroundColor: activeAgent.color }}
                >
                  {activeAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{activeAgent.name}</p>
                  <p className="text-xs text-text-secondary">{activeAgent.description}</p>
                </div>
              </>
            ) : (
              <p className="text-text-secondary">Select an agent to start chatting</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-surface-light text-text-secondary'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={toggleRightPanel}
              className="p-2 hover:bg-surface-light rounded-lg transition-colors text-text-secondary"
            >
              {rightPanelVisible ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/20 p-3 flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-xs hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-xs hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-secondary">
              <div className="w-16 h-16 rounded-full bg-surface-light flex items-center justify-center mb-4">
                <Send className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">Send a message to begin chatting with the agent</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isUser={message.role === 'user'}
                agentColor={activeAgent?.color}
              />
            ))
          )}

          {isTyping && (
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: activeAgent?.color }}
              >
                {activeAgent?.name.charAt(0).toUpperCase()}
              </div>
              <div className="typing-bubble">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2">
            <button className="p-2 hover:bg-surface-light rounded-lg transition-colors text-text-secondary">
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={activeAgent ? "Type your message..." : "Select an agent first"}
                disabled={!activeAgent}
                className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 pr-12 resize-none focus:outline-none focus:border-primary disabled:opacity-50"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '200px' }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!input.trim() || !activeAgent}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {rightPanelVisible && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="border-l border-border bg-surface overflow-y-auto"
        >
          <div className="p-4">
            <h3 className="font-semibold mb-4">Context</h3>

            {/* Active Tools */}
            <div className="mb-6">
              <p className="text-sm text-text-secondary mb-2">Active Tools</p>
              <div className="space-y-2">
                {activeAgent?.tools.slice(0, 5).map((tool) => (
                  <div key={tool.id} className="flex items-center gap-2 p-2 bg-surface-light rounded-lg">
                    <Terminal className="w-4 h-4 text-primary" />
                    <span className="text-sm">{tool.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Info */}
            <div className="mb-6">
              <p className="text-sm text-text-secondary mb-2">Agent Configuration</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-text-secondary">Model</p>
                  <p className="text-sm font-medium">{activeAgent?.config.model || modelDefaults.model}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Temperature</p>
                  <p className="text-sm font-medium">{activeAgent?.config.temperature || 0.7}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Max Tokens</p>
                  <p className="text-sm font-medium">{activeAgent?.config.maxTokens || 4096}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function MessageBubble({
  message,
  isUser,
  agentColor,
}: {
  message: Message
  isUser: boolean
  agentColor?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = typeof message.content === 'string' ? message.content : ''
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
          isUser ? 'bg-indigo-600 text-white' : ''
        }`}
        style={{ backgroundColor: isUser ? undefined : agentColor }}
      >
        {isUser ? 'U' : 'A'}
      </div>

      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block text-left px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-surface-light text-white border border-border rounded-tl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</p>
        </div>

        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-xs text-text-secondary">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-surface-light rounded text-text-secondary"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default Chat
