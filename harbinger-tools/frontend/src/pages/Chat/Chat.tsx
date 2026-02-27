import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Send,
  Settings,
  Copy,
  Check,
  Terminal,
  Maximize2,
  Minimize2,
  AlertCircle,
  Trash2,
  StopCircle,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { useSettingsStore } from '../../store/settingsStore'
import { chatApi } from '../../api/chat'
import type { Message, ChatSession } from '../../types'
import toast from 'react-hot-toast'

const FONT = 'JetBrains Mono, Fira Code, monospace'

function Chat() {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef(false)
  const {
    activeAgent,
    activeChat,
    addMessage,
    addChat,
    setActiveChat,
    chats
  } = useAgentStore()
  const { rightPanelVisible, toggleRightPanel, modelDefaults } = useSettingsStore()

  // Auto-scroll to bottom when messages change or during streaming
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [activeChat?.messages, streamingContent, scrollToBottom])

  // Focus input on mount and agent change
  useEffect(() => {
    inputRef.current?.focus()
  }, [activeAgent])

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
    if (!input.trim() || !activeAgent || isStreaming) return

    const messageContent = input.trim()
    setInput('')
    setError(null)
    abortRef.current = false

    try {
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

      // Start streaming
      setIsStreaming(true)
      setStreamingContent('')

      let accumulated = ''

      await chatApi.sendMessageStream(
        {
          content: messageContent,
          agentId: activeAgent.id,
          sessionId: chat.id,
          stream: true,
        },
        // onChunk
        (chunk: string) => {
          if (abortRef.current) return
          accumulated += chunk
          setStreamingContent(accumulated)
        },
        // onDone
        () => {
          if (abortRef.current) return
          const agentMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            agentId: activeAgent.id,
            role: 'assistant',
            content: accumulated || 'No response',
            timestamp: new Date().toISOString(),
          }
          addMessage(chat.id, agentMessage)
          setStreamingContent('')
          setIsStreaming(false)
        },
        // onError
        (err: Error) => {
          // Fallback to non-streaming
          setStreamingContent('')
          setIsStreaming(false)
          chatApi.sendMessage({
            content: messageContent,
            agentId: activeAgent.id,
            sessionId: chat.id,
            stream: false,
          }).then((response) => {
            const agentMessage: Message = {
              id: response.id || `msg-${Date.now() + 1}`,
              agentId: activeAgent.id,
              role: 'assistant',
              content: response.content || 'No response',
              timestamp: new Date().toISOString(),
            }
            addMessage(chat.id, agentMessage)
          }).catch(() => {
            setError('Failed to send message. Check backend connection.')
            toast.error('Failed to send message')
          })
        }
      )
    } catch {
      setError('Failed to send message. Please try again.')
      toast.error('Failed to send message')
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const handleStop = () => {
    abortRef.current = true
    if (streamingContent && activeChat) {
      const agentMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        agentId: activeAgent?.id || '',
        role: 'assistant',
        content: streamingContent + ' [stopped]',
        timestamp: new Date().toISOString(),
      }
      addMessage(activeChat.id, agentMessage)
    }
    setStreamingContent('')
    setIsStreaming(false)
  }

  const handleClear = () => {
    if (activeChat) {
      chatApi.clearSession(activeChat.id).catch(() => { /* non-critical */ })
    }
  }

  const messages: Message[] = activeChat?.messages || []

  return (
    <div className="h-full flex" style={{ fontFamily: FONT }}>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat Header */}
        <div
          className="h-14 flex items-center justify-between px-4 shrink-0"
          style={{ borderBottom: '1px solid #1a1a2e' }}
        >
          <div className="flex items-center gap-3">
            {activeAgent ? (
              <>
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: activeAgent.color + '20', color: activeAgent.color, border: `1px solid ${activeAgent.color}40` }}
                >
                  {activeAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#e5e7eb' }}>{activeAgent.name}</p>
                  <p className="text-[10px]" style={{ color: '#555555' }}>{activeAgent.description}</p>
                </div>
              </>
            ) : (
              <p className="text-xs" style={{ color: '#555555' }}>Select an agent to start chatting</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            {activeChat && messages.length > 0 && (
              <button
                onClick={handleClear}
                className="p-2 rounded transition-colors hover:bg-white/5"
                style={{ color: '#555555' }}
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={() => {}}
              className="p-2 rounded transition-colors hover:bg-white/5"
              style={{ color: '#555555' }}
            >
              <Settings size={14} />
            </button>
            <button
              onClick={toggleRightPanel}
              className="p-2 rounded transition-colors hover:bg-white/5"
              style={{ color: '#555555' }}
            >
              {rightPanelVisible ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-2 text-xs shrink-0"
            style={{ background: '#ef444410', borderBottom: '1px solid #ef444430', color: '#ef4444' }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-[10px] hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Messages — fixed height, scrollable */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
          style={{ background: '#0a0a0f' }}
        >
          {messages.length === 0 && !isStreaming ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Terminal size={32} style={{ color: '#1a1a2e' }} />
              <p className="text-sm mt-3" style={{ color: '#9ca3af' }}>
                {activeAgent ? `Start chatting with ${activeAgent.name}` : 'Select an agent to begin'}
              </p>
              <p className="text-[10px] mt-1" style={{ color: '#555555' }}>
                Messages are sent to the agent via the backend API
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBlock
                  key={message.id}
                  message={message}
                  isUser={message.role === 'user'}
                  agentColor={activeAgent?.color}
                  agentName={activeAgent?.name}
                />
              ))}

              {/* Streaming message */}
              {isStreaming && streamingContent && (
                <div className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: activeAgent?.color + '20', color: activeAgent?.color }}
                  >
                    {activeAgent?.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold" style={{ color: activeAgent?.color || '#f0c040' }}>
                      {activeAgent?.name}
                    </span>
                    <div
                      className="mt-1 text-xs leading-relaxed"
                      style={{ color: '#e5e7eb' }}
                    >
                      <span className="whitespace-pre-wrap">{streamingContent}</span>
                      <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style={{ background: '#f0c040' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Streaming indicator (no content yet) */}
              {isStreaming && !streamingContent && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#f0c040', animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#f0c040', animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#f0c040', animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[10px]" style={{ color: '#555555' }}>
                    {activeAgent?.name} is thinking...
                  </span>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-3" style={{ borderTop: '1px solid #1a1a2e', background: '#0d0d15' }}>
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={activeAgent ? `Message ${activeAgent.name}...` : 'Select an agent first'}
                disabled={!activeAgent || isStreaming}
                className="w-full rounded px-3 py-2.5 text-xs resize-none outline-none disabled:opacity-40 placeholder:text-gray-600"
                rows={1}
                style={{
                  minHeight: '40px',
                  maxHeight: '120px',
                  background: '#0a0a0f',
                  border: '1px solid #1a1a2e',
                  color: '#e5e7eb',
                  fontFamily: FONT,
                }}
              />
            </div>

            {isStreaming ? (
              <button
                onClick={handleStop}
                className="p-2.5 rounded transition-colors"
                style={{ background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444' }}
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !activeAgent}
                className="p-2.5 rounded transition-colors disabled:opacity-30"
                style={{ background: '#f0c04010', border: '1px solid #f0c04030', color: '#f0c040' }}
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel — Context */}
      {rightPanelVisible && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="overflow-y-auto shrink-0"
          style={{ borderLeft: '1px solid #1a1a2e', background: '#0d0d15' }}
        >
          <div className="p-4 space-y-5">
            <h3 className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#9ca3af' }}>
              Context
            </h3>

            {/* Active Tools */}
            {activeAgent?.tools && activeAgent.tools.length > 0 && (
              <div>
                <p className="text-[10px] tracking-wider mb-2" style={{ color: '#555555' }}>TOOLS</p>
                <div className="space-y-1">
                  {activeAgent.tools.slice(0, 8).map((tool) => (
                    <div
                      key={tool.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-[10px]"
                      style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', color: '#9ca3af' }}
                    >
                      <Terminal size={10} style={{ color: '#f0c040' }} />
                      {tool.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Config */}
            <div>
              <p className="text-[10px] tracking-wider mb-2" style={{ color: '#555555' }}>CONFIGURATION</p>
              <div className="space-y-2">
                <ConfigRow label="Model" value={activeAgent?.config.model || modelDefaults.model} />
                <ConfigRow label="Temperature" value={String(activeAgent?.config.temperature || 0.7)} />
                <ConfigRow label="Max Tokens" value={String(activeAgent?.config.maxTokens || 4096)} />
              </div>
            </div>

            {/* Session info */}
            {activeChat && (
              <div>
                <p className="text-[10px] tracking-wider mb-2" style={{ color: '#555555' }}>SESSION</p>
                <div className="space-y-2">
                  <ConfigRow label="Messages" value={String(messages.length)} />
                  <ConfigRow label="Session ID" value={activeChat.id.slice(0, 12) + '...'} />
                  <ConfigRow label="Created" value={new Date(activeChat.createdAt).toLocaleDateString()} />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ── Message Block (terminal-style, not chat bubbles) ────────────────────────

function MessageBlock({
  message,
  isUser,
  agentColor,
  agentName,
}: {
  message: Message
  isUser: boolean
  agentColor?: string
  agentName?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = typeof message.content === 'string' ? message.content : ''
    navigator.clipboard.writeText(text).catch(() => { /* clipboard may not be available */ })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 group"
    >
      <div
        className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
        style={{
          backgroundColor: isUser ? '#f0c04020' : (agentColor || '#f0c040') + '20',
          color: isUser ? '#f0c040' : agentColor || '#f0c040',
          border: `1px solid ${isUser ? '#f0c04030' : (agentColor || '#f0c040') + '30'}`,
        }}
      >
        {isUser ? 'U' : agentName?.charAt(0).toUpperCase() || 'A'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold" style={{ color: isUser ? '#f0c040' : agentColor || '#9ca3af' }}>
            {isUser ? 'You' : agentName || 'Agent'}
          </span>
          <span className="text-[9px]" style={{ color: '#555555' }}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
              style={{ color: '#555555' }}
            >
              {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
            </button>
          )}
        </div>
        <div
          className="text-xs leading-relaxed whitespace-pre-wrap"
          style={{ color: isUser ? '#e5e7eb' : '#d1d5db' }}
        >
          {content}
        </div>
      </div>
    </motion.div>
  )
}

// ── Config Row ──────────────────────────────────────────────────────────────

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span style={{ color: '#555555' }}>{label}</span>
      <span style={{ color: '#9ca3af' }}>{value}</span>
    </div>
  )
}

export default Chat
