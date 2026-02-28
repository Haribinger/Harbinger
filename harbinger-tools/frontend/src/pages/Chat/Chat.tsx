import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  AlertCircle,
  Trash2,
  StopCircle,
  Plus,
  MessageSquare,
  ChevronRight,
  Hash,
  Globe,
  Bot,
  User,
  Clock,
  Zap,
  Radio,
  ArrowDown,
  X,
  Cpu,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { useSettingsStore } from '../../store/settingsStore'
import { chatApi } from '../../api/chat'
import type { Message, ChatSession, Agent } from '../../types'
import toast from 'react-hot-toast'

// ── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0f',
  surface: '#0d0d15',
  surfaceAlt: '#111119',
  border: '#1a1a2e',
  borderHover: '#2a2a4e',
  gold: '#f0c040',
  goldDim: '#f0c04060',
  green: '#22c55e',
  red: '#ef4444',
  cyan: '#06b6d4',
  purple: '#a855f7',
  blue: '#3b82f6',
  orange: '#f97316',
  muted: '#9ca3af',
  dim: '#555555',
  white: '#e5e7eb',
  font: 'JetBrains Mono, Fira Code, monospace',
}

// ── Agent color lookup ──────────────────────────────────────────────────────
function agentColor(name: string): string {
  const upper = name.toUpperCase()
  const map: Record<string, string> = {
    PATHFINDER: '#3b82f6', BREACH: '#ef4444', PHANTOM: '#a855f7',
    SPECTER: '#06b6d4', CIPHER: '#f97316', SCRIBE: '#22c55e',
    SAM: '#14b8a6', BRIEF: '#64748b', SAGE: '#eab308',
    LENS: '#ec4899', MAINTAINER: '#10b981',
  }
  return map[upper] || C.gold
}

// ── Channel badge colors ────────────────────────────────────────────────────
const CHANNEL_COLORS: Record<string, string> = {
  webchat: C.green, discord: '#5865F2', telegram: '#229ED9', slack: '#4A154B',
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN CHAT COMPONENT
// ════════════════════════════════════════════════════════════════════════════

function Chat() {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [sessionSidebarOpen, setSessionSidebarOpen] = useState(true)
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef(false)
  const {
    agents,
    activeAgent,
    setActiveAgent,
    activeChat,
    addMessage,
    addChat,
    setActiveChat,
    chats,
    removeChat,
  } = useAgentStore()
  const { rightPanelVisible, toggleRightPanel, modelDefaults } = useSettingsStore()

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [activeChat?.messages, streamingContent, scrollToBottom])

  // Track if user scrolled up
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setShowScrollBtn(!atBottom)
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [activeAgent])

  // ── Session management ────────────────────────────────────────────────────
  const ensureActiveChat = async (): Promise<ChatSession | null> => {
    if (activeChat) return activeChat
    if (!activeAgent) return null

    const newChat: ChatSession = {
      id: `chat-${Date.now()}`,
      name: `${activeAgent.name} — ${new Date().toLocaleDateString()}`,
      agentId: activeAgent.id,
      messages: [],
      mode: 'chat',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    addChat(newChat)
    setActiveChat(newChat)

    // Create on backend
    chatApi.createSession(activeAgent.id, newChat.name).catch(() => { /* non-critical */ })

    return newChat
  }

  const handleNewSession = () => {
    if (!activeAgent) {
      setAgentPickerOpen(true)
      return
    }
    const newChat: ChatSession = {
      id: `chat-${Date.now()}`,
      name: `${activeAgent.name} — ${new Date().toLocaleDateString()}`,
      agentId: activeAgent.id,
      messages: [],
      mode: 'chat',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    addChat(newChat)
    setActiveChat(newChat)
    chatApi.createSession(activeAgent.id, newChat.name).catch(() => { /* non-critical */ })
  }

  const handleDeleteSession = (chatId: string) => {
    removeChat(chatId)
    if (activeChat?.id === chatId) {
      const remaining = chats.filter((c) => c.id !== chatId)
      setActiveChat(remaining.length > 0 ? remaining[0] : null)
    }
    chatApi.deleteSession(chatId).catch(() => { /* non-critical */ })
  }

  const handleSelectAgent = (agent: Agent) => {
    setActiveAgent(agent)
    setAgentPickerOpen(false)
    // Find existing chat for this agent or create one
    const existingChat = chats.find((c) => c.agentId === agent.id)
    if (existingChat) {
      setActiveChat(existingChat)
    } else {
      const newChat: ChatSession = {
        id: `chat-${Date.now()}`,
        name: `${agent.name} — ${new Date().toLocaleDateString()}`,
        agentId: agent.id,
        messages: [],
        mode: 'chat',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      addChat(newChat)
      setActiveChat(newChat)
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
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

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        agentId: activeAgent.id,
        role: 'user',
        content: messageContent,
        timestamp: new Date().toISOString(),
      }
      addMessage(chat.id, userMessage)

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
        (chunk: string) => {
          if (abortRef.current) return
          accumulated += chunk
          setStreamingContent(accumulated)
        },
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
        () => {
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
  const color = activeAgent ? (activeAgent.color || agentColor(activeAgent.name)) : C.gold

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-full flex" style={{ fontFamily: C.font, background: C.bg }}>
      {/* ── Session Sidebar ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {sessionSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="shrink-0 flex flex-col min-h-0 overflow-hidden"
            style={{ borderRight: `1px solid ${C.border}`, background: C.surface }}
          >
            {/* Sidebar Header */}
            <div
              className="h-14 flex items-center justify-between px-4 shrink-0"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-2">
                <Radio size={14} style={{ color: C.gold }} />
                <span className="text-[11px] font-bold tracking-wider" style={{ color: C.muted }}>
                  SESSIONS
                </span>
              </div>
              <button
                onClick={handleNewSession}
                className="p-1.5 rounded transition-colors hover:bg-white/5"
                style={{ color: C.gold }}
                title="New session"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Agent Selector */}
            <div className="px-3 py-2 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
              <button
                onClick={() => setAgentPickerOpen(!agentPickerOpen)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors hover:bg-white/5"
                style={{ border: `1px solid ${C.border}`, background: C.bg }}
              >
                {activeAgent ? (
                  <>
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                      style={{ backgroundColor: color + '20', color: color, border: `1px solid ${color}40` }}
                    >
                      {activeAgent.name.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold flex-1" style={{ color: C.white }}>
                      {activeAgent.name}
                    </span>
                    <ChevronRight
                      size={10}
                      style={{ color: C.dim, transform: agentPickerOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                    />
                  </>
                ) : (
                  <>
                    <Bot size={14} style={{ color: C.dim }} />
                    <span className="text-[10px] flex-1" style={{ color: C.dim }}>Select agent...</span>
                    <ChevronRight size={10} style={{ color: C.dim }} />
                  </>
                )}
              </button>

              {/* Agent Picker Dropdown */}
              <AnimatePresence>
                {agentPickerOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 max-h-48 overflow-y-auto space-y-0.5">
                      {agents.filter(a => a.status !== 'stopped').map((agent) => {
                        const c = agent.color || agentColor(agent.name)
                        return (
                          <button
                            key={agent.id}
                            onClick={() => handleSelectAgent(agent)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors hover:bg-white/5"
                            style={{
                              background: activeAgent?.id === agent.id ? `${c}10` : 'transparent',
                              borderLeft: activeAgent?.id === agent.id ? `2px solid ${c}` : '2px solid transparent',
                            }}
                          >
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold"
                              style={{ backgroundColor: c + '20', color: c }}
                            >
                              {agent.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold truncate" style={{ color: C.white }}>
                                {agent.name}
                              </div>
                              <div className="text-[8px] truncate" style={{ color: C.dim }}>
                                {agent.type || agent.description?.slice(0, 30)}
                              </div>
                            </div>
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: agent.status === 'running' ? C.green : agent.status === 'idle' ? C.gold : C.dim }}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-4">
                  <MessageSquare size={20} style={{ color: C.dim, marginBottom: 8 }} />
                  <p className="text-[10px] text-center" style={{ color: C.dim }}>
                    No sessions yet.
                  </p>
                  <p className="text-[9px] text-center mt-1" style={{ color: C.dim }}>
                    Select an agent and start chatting.
                  </p>
                </div>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {[...chats].reverse().map((chat) => {
                    const isActive = activeChat?.id === chat.id
                    const chatAgent = agents.find(a => a.id === chat.agentId)
                    const chatColor = chatAgent ? (chatAgent.color || agentColor(chatAgent.name)) : C.gold
                    return (
                      <div
                        key={chat.id}
                        className="group flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer transition-colors"
                        style={{
                          background: isActive ? `${chatColor}08` : 'transparent',
                          borderLeft: isActive ? `2px solid ${chatColor}` : '2px solid transparent',
                        }}
                        onClick={() => {
                          setActiveChat(chat)
                          if (chatAgent) setActiveAgent(chatAgent)
                        }}
                      >
                        <Hash size={10} style={{ color: isActive ? chatColor : C.dim }} />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[10px] font-medium truncate"
                            style={{ color: isActive ? C.white : C.muted }}
                          >
                            {chat.name}
                          </div>
                          <div className="text-[8px]" style={{ color: C.dim }}>
                            {chat.messages.length} msgs
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSession(chat.id) }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity hover:bg-white/10"
                          style={{ color: C.dim }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sidebar Footer — Channel Status */}
            <div className="shrink-0 px-3 py-2" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="text-[8px] tracking-wider mb-1.5" style={{ color: C.dim }}>CHANNELS</div>
              <div className="flex gap-2">
                {Object.entries(CHANNEL_COLORS).map(([ch, clr]) => (
                  <div
                    key={ch}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                    style={{ background: `${clr}10`, border: `1px solid ${clr}25` }}
                  >
                    <div className="w-1 h-1 rounded-full" style={{ background: ch === 'webchat' ? C.green : clr }} />
                    <span className="text-[7px] uppercase" style={{ color: clr }}>
                      {ch === 'webchat' ? 'WEB' : ch.slice(0, 4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Chat Area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat Header */}
        <div
          className="h-14 flex items-center justify-between px-4 shrink-0"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}
        >
          <div className="flex items-center gap-3">
            {/* Toggle sidebar */}
            <button
              onClick={() => setSessionSidebarOpen(!sessionSidebarOpen)}
              className="p-1.5 rounded transition-colors hover:bg-white/5"
              style={{ color: C.dim }}
              title={sessionSidebarOpen ? 'Hide sessions' : 'Show sessions'}
            >
              <MessageSquare size={14} />
            </button>

            {activeAgent ? (
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: color + '15', color, border: `1px solid ${color}30` }}
                >
                  {activeAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: C.white }}>
                      {activeAgent.name}
                    </span>
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: activeAgent.status === 'running' ? C.green : activeAgent.status === 'idle' ? C.gold : C.dim }}
                    />
                    <span className="text-[9px]" style={{ color: C.dim }}>
                      {activeAgent.status}
                    </span>
                  </div>
                  <p className="text-[9px]" style={{ color: C.dim }}>
                    {activeAgent.type} agent — {activeChat?.name || 'no session'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={{ color: C.dim }}>Select an agent to start chatting</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            {activeChat && messages.length > 0 && (
              <button
                onClick={handleClear}
                className="p-2 rounded transition-colors hover:bg-white/5"
                style={{ color: C.dim }}
                title="Clear chat"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              onClick={toggleRightPanel}
              className="p-2 rounded transition-colors hover:bg-white/5"
              style={{ color: C.dim }}
            >
              {rightPanelVisible ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-2 text-xs shrink-0"
            style={{ background: '#ef444410', borderBottom: '1px solid #ef444430', color: C.red }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-[10px] hover:underline">Dismiss</button>
          </div>
        )}

        {/* Messages — fixed height, scrollable */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto min-h-0 relative"
          style={{ background: C.bg }}
        >
          <div className="p-4 space-y-1">
            {messages.length === 0 && !isStreaming ? (
              <EmptyState agent={activeAgent} onPickAgent={() => setAgentPickerOpen(true)} />
            ) : (
              <>
                {messages.map((message, i) => (
                  <MessageBlock
                    key={message.id}
                    message={message}
                    isUser={message.role === 'user'}
                    agentColor={color}
                    agentName={activeAgent?.name}
                    isFirst={i === 0 || messages[i - 1].role !== message.role}
                  />
                ))}

                {/* Streaming message */}
                {isStreaming && streamingContent && (
                  <div className="flex gap-3 pt-2">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ backgroundColor: color + '15', color, border: `1px solid ${color}25` }}
                    >
                      {activeAgent?.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold" style={{ color }}>{activeAgent?.name}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${C.gold}15`, color: C.gold }}>
                          streaming
                        </span>
                      </div>
                      <div
                        className="text-xs leading-relaxed rounded px-3 py-2"
                        style={{ background: C.surfaceAlt, border: `1px solid ${C.border}` }}
                      >
                        <span className="whitespace-pre-wrap" style={{ color: C.white }}>{streamingContent}</span>
                        <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style={{ background: C.gold }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming indicator (no content yet) */}
                {isStreaming && !streamingContent && (
                  <div className="flex items-center gap-3 px-3 py-3">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: color + '15', color }}
                    >
                      {activeAgent?.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{ background: C.gold, animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px]" style={{ color: C.dim }}>
                        {activeAgent?.name} is processing...
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll-to-bottom button */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={scrollToBottom}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors"
                style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.gold }}
              >
                <ArrowDown size={12} />
                <span className="text-[9px]">New messages</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-3" style={{ borderTop: `1px solid ${C.border}`, background: C.surface }}>
          {/* Active channel indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: `${C.green}10`, border: `1px solid ${C.green}20` }}>
              <Globe size={8} style={{ color: C.green }} />
              <span className="text-[8px]" style={{ color: C.green }}>WEBCHAT</span>
            </div>
            {activeAgent && (
              <span className="text-[8px]" style={{ color: C.dim }}>
                Sending to {activeAgent.name} via local backend
              </span>
            )}
          </div>

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
                placeholder={activeAgent ? `Message ${activeAgent.name}... (Enter to send, Shift+Enter for newline)` : 'Select an agent first'}
                disabled={!activeAgent || isStreaming}
                className="w-full rounded px-3 py-2.5 text-xs resize-none outline-none disabled:opacity-40 placeholder:text-gray-600"
                rows={1}
                style={{
                  minHeight: '40px',
                  maxHeight: '120px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.white,
                  fontFamily: C.font,
                }}
              />
            </div>

            {isStreaming ? (
              <button
                onClick={handleStop}
                className="p-2.5 rounded transition-all hover:scale-105"
                style={{ background: '#ef444420', border: '1px solid #ef444440', color: C.red }}
                title="Stop streaming"
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !activeAgent}
                className="p-2.5 rounded transition-all disabled:opacity-20 hover:scale-105"
                style={{ background: `${C.gold}10`, border: `1px solid ${C.gold}30`, color: C.gold }}
                title="Send message"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Right Panel — Context ────────────────────────────────────────── */}
      <AnimatePresence>
        {rightPanelVisible && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-y-auto shrink-0"
            style={{ borderLeft: `1px solid ${C.border}`, background: C.surface }}
          >
            <div className="p-4 space-y-5">
              {/* Agent Info */}
              {activeAgent && (
                <div>
                  <SectionHeader label="AGENT" />
                  <div className="flex items-center gap-2 mt-2 px-2 py-2 rounded" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: color + '15', color }}
                    >
                      {activeAgent.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold" style={{ color: C.white }}>{activeAgent.name}</div>
                      <div className="text-[8px]" style={{ color: C.dim }}>{activeAgent.type} — {activeAgent.status}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Tools */}
              {activeAgent?.tools && activeAgent.tools.length > 0 && (
                <div>
                  <SectionHeader label="TOOLS" />
                  <div className="space-y-1 mt-2">
                    {activeAgent.tools.slice(0, 8).map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-[10px]"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted }}
                      >
                        <Zap size={9} style={{ color: C.gold }} />
                        {tool.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capabilities */}
              {activeAgent?.capabilities && activeAgent.capabilities.length > 0 && (
                <div>
                  <SectionHeader label="CAPABILITIES" />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activeAgent.capabilities.slice(0, 10).map((cap) => (
                      <span
                        key={cap}
                        className="text-[8px] px-1.5 py-0.5 rounded"
                        style={{ background: `${color}10`, color: color, border: `1px solid ${color}20` }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Configuration */}
              <div>
                <SectionHeader label="CONFIGURATION" />
                <div className="space-y-2 mt-2">
                  <ConfigRow label="Model" value={activeAgent?.config.model || modelDefaults.model} />
                  <ConfigRow label="Temperature" value={String(activeAgent?.config.temperature || 0.7)} />
                  <ConfigRow label="Max Tokens" value={String(activeAgent?.config.maxTokens || 4096)} />
                  <ConfigRow label="Channel" value="WebChat" />
                </div>
              </div>

              {/* Session Info */}
              {activeChat && (
                <div>
                  <SectionHeader label="SESSION" />
                  <div className="space-y-2 mt-2">
                    <ConfigRow label="Messages" value={String(messages.length)} />
                    <ConfigRow label="Session" value={activeChat.id.slice(0, 16)} />
                    <ConfigRow label="Created" value={new Date(activeChat.createdAt).toLocaleDateString()} />
                    <ConfigRow label="Mode" value={activeChat.mode} />
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <SectionHeader label="QUICK ACTIONS" />
                <div className="space-y-1 mt-2">
                  <ActionButton label="New Session" icon={Plus} onClick={handleNewSession} />
                  <ActionButton label="Clear Messages" icon={Trash2} onClick={handleClear} disabled={!activeChat || messages.length === 0} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// ── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ agent, onPickAgent }: { agent: Agent | null; onPickAgent: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center py-16">
      <div
        className="w-16 h-16 rounded-lg flex items-center justify-center mb-4"
        style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}15` }}
      >
        <Cpu size={28} style={{ color: C.gold, opacity: 0.4 }} />
      </div>
      <p className="text-sm font-bold mb-1" style={{ color: C.muted }}>
        {agent ? `Ready to chat with ${agent.name}` : 'HARBINGER CHAT'}
      </p>
      <p className="text-[10px] max-w-xs text-center leading-relaxed" style={{ color: C.dim }}>
        {agent
          ? 'Send a message to start the conversation. Messages stream in real-time via SSE.'
          : 'Select an agent from the sidebar to begin. Each agent has specialized knowledge and tools.'}
      </p>
      {!agent && (
        <button
          onClick={onPickAgent}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded text-[10px] font-bold tracking-wider transition-colors hover:bg-white/5"
          style={{ border: `1px solid ${C.gold}40`, color: C.gold }}
        >
          <Bot size={12} />
          SELECT AGENT
        </button>
      )}
      <div className="flex items-center gap-4 mt-6">
        {[
          { label: 'Streaming', icon: Radio },
          { label: 'Multi-Agent', icon: Bot },
          { label: 'Session History', icon: Clock },
        ].map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-1.5 text-[8px]" style={{ color: C.dim }}>
            <Icon size={10} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Message Block ───────────────────────────────────────────────────────────
function MessageBlock({
  message,
  isUser,
  agentColor: aColor,
  agentName,
  isFirst,
}: {
  message: Message
  isUser: boolean
  agentColor?: string
  agentName?: string
  isFirst: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = typeof message.content === 'string' ? message.content : ''
    navigator.clipboard.writeText(text).catch(() => { /* clipboard may not be available */ })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  const roleColor = isUser ? C.gold : aColor || C.muted

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className={`flex gap-3 group ${isFirst ? 'pt-3' : 'pt-0.5'}`}
    >
      {/* Avatar — only show on first message in a run */}
      <div className="w-7 shrink-0">
        {isFirst && (
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: roleColor + '12',
              color: roleColor,
              border: `1px solid ${roleColor}20`,
            }}
          >
            {isUser ? <User size={12} /> : agentName?.charAt(0).toUpperCase() || 'A'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + timestamp — only on first */}
        {isFirst && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold" style={{ color: roleColor }}>
              {isUser ? 'You' : agentName || 'Agent'}
            </span>
            <span className="text-[8px]" style={{ color: C.dim }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Message content */}
        <div className="flex items-start gap-1">
          <div
            className={`text-xs leading-relaxed whitespace-pre-wrap rounded px-3 py-1.5 ${isFirst ? '' : ''}`}
            style={{
              color: isUser ? C.white : '#d1d5db',
              background: isUser ? `${C.gold}06` : C.surfaceAlt,
              border: `1px solid ${isUser ? `${C.gold}10` : C.border}`,
              maxWidth: '85%',
            }}
          >
            {content}
          </div>

          {/* Copy button */}
          {!isUser && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity shrink-0 mt-0.5"
              style={{ color: C.dim }}
              title="Copy response"
            >
              {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] tracking-widest font-bold" style={{ color: C.dim }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: C.border }} />
    </div>
  )
}

// ── Config Row ──────────────────────────────────────────────────────────────
function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[10px] px-1">
      <span style={{ color: C.dim }}>{label}</span>
      <span className="font-medium" style={{ color: C.muted }}>{value}</span>
    </div>
  )
}

// ── Action Button ───────────────────────────────────────────────────────────
function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string
  icon: React.ElementType
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[10px] transition-colors hover:bg-white/5 disabled:opacity-30"
      style={{ border: `1px solid ${C.border}`, color: C.muted }}
    >
      <Icon size={10} style={{ color: C.gold }} />
      {label}
    </button>
  )
}

export default Chat
