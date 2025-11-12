'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface AiChatContextType {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

const AiChatContext = createContext<AiChatContextType | undefined>(undefined)

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <AiChatContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </AiChatContext.Provider>
  )
}

export function useAiChat() {
  const context = useContext(AiChatContext)
  // Return default values if context is not available (for pages without AI chat)
  if (context === undefined) {
    return { isOpen: false, setIsOpen: () => {} }
  }
  return context
}

