'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'
import { useSession, signIn, getProviders } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { LoadingProvider } from './loading-provider'
import { AiChatProvider } from './ai-chat-context'

function AutoLogin() {
  const { status } = useSession()
  
  useEffect(() => {
    let cancelled = false

    async function attemptAutoLogin() {
      if (process.env.NEXT_PUBLIC_BYPASS_AUTH !== 'true' || status !== 'unauthenticated') {
        return
      }

      const providers = await getProviders()
      if (!cancelled && providers?.credentials) {
        signIn('credentials', {
          email: 'dev@example.com',
          password: 'dev',
          redirect: false,
        }).catch(() => {
          // no-op: dev convenience only
        })
      }
    }

    attemptAutoLogin()

    return () => {
      cancelled = true
    }
  }, [status])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <LoadingProvider>
          <AiChatProvider>
            {process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true' && <AutoLogin />}
            {children}
          </AiChatProvider>
        </LoadingProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
