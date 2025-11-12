'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAiChat } from './ai-chat-context'

// Helper to recursively process React nodes and format text
const processNodeForFinancials = (node: React.ReactNode): React.ReactNode => {
  if (typeof node === 'string') {
    return formatFinancialText(node)
  }
  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <span key={idx}>{processNodeForFinancials(child)}</span>
    ))
  }
  // For React elements, we'll process them in the component itself
  return node
}

// Utility function to detect and format financial numbers in text
const formatFinancialText = (text: string): React.ReactNode => {
  // Pattern to match currency amounts: $123,456.78 or $123456.78 or $123,456
  const currencyPattern = /\$[\d,]+(?:\.\d{2})?/g
  // Pattern to match percentages: 12.5% or 12%
  const percentPattern = /\d+\.?\d*%/g
  // Pattern to match large numbers that might be financial: 1,234,567 or 1234567
  const largeNumberPattern = /\b\d{1,3}(?:,\d{3})+\b/g
  
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  
  // Combine all patterns and find matches
  const allMatches: Array<{ index: number; length: number; text: string; type: 'currency' | 'percent' | 'number' }> = []
  
  // Find currency matches
  let match: RegExpExecArray | null
  while ((match = currencyPattern.exec(text)) !== null) {
    allMatches.push({
      index: match.index,
      length: match[0].length,
      text: match[0],
      type: 'currency'
    })
  }
  
  // Find percent matches
  while ((match = percentPattern.exec(text)) !== null) {
    allMatches.push({
      index: match.index,
      length: match[0].length,
      text: match[0],
      type: 'percent'
    })
  }
  
  // Find large number matches (but not if already matched as currency)
  while ((match = largeNumberPattern.exec(text)) !== null) {
    const isPartOfCurrency = allMatches.some(m => 
      match!.index >= m.index && match!.index < m.index + m.length
    )
    if (!isPartOfCurrency) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        text: match[0],
        type: 'number'
      })
    }
  }
  
  // Sort matches by index
  allMatches.sort((a, b) => a.index - b.index)
  
  // Remove overlapping matches (prefer currency > percent > number)
  const filteredMatches: typeof allMatches = []
  for (const currentMatch of allMatches) {
    const overlaps = filteredMatches.some(existing => 
      currentMatch.index < existing.index + existing.length &&
      currentMatch.index + currentMatch.length > existing.index
    )
    if (!overlaps) {
      filteredMatches.push(currentMatch)
    }
  }
  
  // Build React elements
  for (const match of filteredMatches) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    
    // Determine color based on context (check for negative/positive indicators)
    const contextStart = Math.max(0, match.index - 30)
    const contextEnd = Math.min(text.length, match.index + match.length + 30)
    const contextText = text.substring(contextStart, contextEnd).toLowerCase()
    
    const isNegative = contextText.includes('over budget') || 
                      (contextText.includes('variance') && contextText.includes('+')) ||
                      contextText.includes('exceed') ||
                      contextText.includes('loss') ||
                      contextText.includes('overage') ||
                      contextText.includes('deficit')
    const isPositive = contextText.includes('under budget') ||
                       contextText.includes('saved') ||
                       contextText.includes('profit') ||
                       contextText.includes('surplus') ||
                       contextText.includes('savings')
    
    let colorClass = 'font-semibold'
    if (match.type === 'currency') {
      if (isNegative) {
        colorClass = 'text-red-600 font-bold'
      } else if (isPositive) {
        colorClass = 'text-green-600 font-bold'
      } else {
        colorClass = 'text-blue-700 font-bold'
      }
    } else if (match.type === 'percent') {
      colorClass = 'text-purple-600 font-semibold'
    } else if (match.type === 'number') {
      colorClass = 'text-indigo-600 font-semibold'
    }
    
    parts.push(
      <span key={key++} className={colorClass}>
        {match.text}
      </span>
    )
    
    lastIndex = match.index + match.length
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  return parts.length > 1 ? <>{parts}</> : text
}

// Sabey AI Logo - Three curved bars with a plus sign
const SabeyAILogo = ({ size = 16, className = '', id = 'sabey-ai' }: { size?: number; className?: string; id?: string }) => {
  // Use useMemo to generate stable ID that doesn't change on re-renders
  const gradientId = useMemo(() => `sabeyAIGradient-${id}-${Math.random().toString(36).substr(2, 9)}`, [id])
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Three curved horizontal bars with wave-like curves */}
      {/* Top bar - curved path */}
      <path
        d="M2 5.5 Q4 4.5 6 5 Q8 5.5 10 5.5 Q12 5.5 14 5 Q16 4.5 18 5"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Middle bar - curved path */}
      <path
        d="M2 11.5 Q4 10.5 6 11 Q8 11.5 10 11.5 Q12 11.5 14 11 Q16 10.5 18 11"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bottom bar - curved path */}
      <path
        d="M2 17.5 Q4 16.5 6 17 Q8 17.5 10 17.5 Q12 17.5 14 17 Q16 16.5 18 17"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Plus sign - overlapping the top bar on the right */}
      <g>
        {/* Horizontal line of plus */}
        <line
          x1="17"
          y1="5"
          x2="21"
          y2="5"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Vertical line of plus */}
        <line
          x1="19"
          y1="3"
          x2="19"
          y2="7"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Project {
  id: string
  code: string
  name: string
  region: string
  projectBudget?: number | string | null
  eac?: number | string | null
  budgetVariance?: number | string | null
  percentComplete?: number | null
  reports?: Array<{
    totalTradeWorkers?: number | null
    workPerformed?: string | null
    safety?: string | null
    reportDate?: Date | string
  }>
}

interface AiChatProps {
  projects: Project[]
  weekEnding?: string
}

export function AiChat({ projects, weekEnding }: AiChatProps) {
  const { isOpen, setIsOpen } = useAiChat()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle ESC key to close chat
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleEsc)
      return () => {
        window.removeEventListener('keydown', handleEsc)
      }
    }
  }, [isOpen, setIsOpen])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          projects,
          weekEnding: weekEnding || new Date().toISOString().split('T')[0],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response'
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMessage}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Toggle Button - hidden when chat is open */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed right-0 top-20 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-l-lg px-4 py-3 shadow-lg transition-all flex items-center gap-2"
          title="Open Sabey AI"
        >
          <SabeyAILogo size={20} />
          <span className="hidden sm:inline font-medium">Sabey AI</span>
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-screen w-[400px] bg-white shadow-2xl border-l border-gray-200 flex flex-col z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-400 to-blue-200 text-white px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SabeyAILogo size={32} />
            <h3 className="font-bold text-lg">Sabey AI</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-blue-700 rounded-full p-1 transition-colors"
            title="Close (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-teal-800 flex items-center justify-center shadow-sm">
                  <SabeyAILogo size={32} />
                </div>
              </div>
              <p className="font-semibold text-base mb-2 text-gray-700">Ask me anything about your projects!</p>
              <p className="text-sm text-gray-500 mb-4">Try questions like:</p>
              <div className="text-xs space-y-2 text-left max-w-xs mx-auto">
                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                  <p className="text-gray-600 font-medium mb-1">💡 Example questions:</p>
                  <ul className="space-y-1.5 text-gray-500">
                    <li>• &quot;What is the budget for [project name]?&quot;</li>
                    <li>• &quot;List the top 5 projects by budget&quot;</li>
                    <li>• &quot;Which projects are over budget?&quot;</li>
                    <li>• &quot;Show me projects in [region]&quot;</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-800 flex items-center justify-center shadow-sm">
                  <SabeyAILogo size={16} />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                    : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => {
                          return <p className="mb-4 last:mb-0 text-gray-800 leading-7">{processNodeForFinancials(children)}</p>
                        },
                        strong: ({ children }) => {
                          return <strong className="font-bold text-gray-900">{processNodeForFinancials(children)}</strong>
                        },
                        em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                        ul: ({ children }) => (
                          <ul className="list-disc list-outside mb-4 ml-6 space-y-2.5 text-gray-800 marker:text-blue-600 marker:font-bold">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-outside mb-4 ml-6 space-y-2.5 text-gray-800 marker:font-bold marker:text-blue-600">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => {
                          return <li className="pl-2 leading-7">{processNodeForFinancials(children)}</li>
                        },
                        code: ({ children, ...props }: { children?: React.ReactNode; className?: string }) => {
                          const isInline = !props.className?.includes('language-')
                          return isInline ? (
                            <code className="bg-gray-100 text-blue-700 px-2 py-1 rounded text-xs font-mono font-semibold border border-gray-200">
                              {children}
                            </code>
                          ) : (
                            <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono overflow-x-auto mb-4 border border-gray-700">
                              {children}
                            </code>
                          )
                        },
                        pre: ({ children }) => <pre className="mb-4">{children}</pre>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-blue-400 pl-4 italic text-gray-700 my-4 bg-blue-50 py-2 rounded-r">
                            {children}
                          </blockquote>
                        ),
                        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 text-gray-900 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mb-2.5 mt-4 text-gray-900 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 text-gray-900 first:mt-0">{children}</h3>,
                        hr: () => <hr className="my-5 border-gray-300" />,
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4 border border-gray-200 rounded-lg shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-gradient-to-r from-gray-50 to-gray-100">{children}</thead>,
                        tbody: ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
                        tr: ({ children }) => <tr className="hover:bg-gray-50 transition-colors">{children}</tr>,
                        th: ({ children }) => {
                          return (
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                              {processNodeForFinancials(children)}
                            </th>
                          )
                        },
                        td: ({ children }) => {
                          return <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{processNodeForFinancials(children)}</td>
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-sm">
                  <span className="text-white text-xs font-bold">You</span>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-800 flex items-center justify-center shadow-sm">
                <SabeyAILogo size={16} />
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask a question about your projects..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[44px] max-h-32"
              disabled={loading}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 transition-all shadow-sm hover:shadow-md flex items-center justify-center min-w-[44px]"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line, ESC to close
          </p>
        </div>
      </div>
    </>
  )
}

