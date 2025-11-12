'use client'

import { useEffect, useMemo, useState } from 'react'
import { signIn, getProviders, type ClientSafeProvider } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type ProvidersMap = Record<string, ClientSafeProvider>

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [providerError, setProviderError] = useState('')
  const [providers, setProviders] = useState<ProvidersMap | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    getProviders()
      .then((result) => {
        if (mounted) {
          setProviders(result ?? null)
        }
      })
      .catch(() => {
        if (mounted) {
          setProviderError('Unable to load sign-in options. Please try again later.')
        }
      })
      .finally(() => {
        if (mounted) {
          setProvidersLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const oktaProvider = useMemo(() => providers?.okta, [providers])
  const credentialsProvider = useMemo(() => providers?.credentials, [providers])

  const showCredentialsForm = Boolean(credentialsProvider)

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credentialsProvider) {
      return
    }

    setError('')
    setLoading(true)

    try {
      const result = await signIn(credentialsProvider.id, {
        email: email || 'dev@example.com',
        password: password || 'dev',
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOktaSignIn = () => {
    setError('')
    setProviderError('')
    signIn('okta', { callbackUrl: '/' }).catch(() => {
      setProviderError('Unable to reach Okta. Please try again or contact IT.')
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Construction Reports
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        {providerError && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{providerError}</p>
          </div>
        )}

        {providersLoading && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
            Loading sign-in options...
          </div>
        )}

        {!providersLoading && !oktaProvider && !showCredentialsForm && (
          <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-900">
            No sign-in providers are configured. Contact an administrator.
          </div>
        )}

        {oktaProvider && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleOktaSignIn}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              Continue with Okta
            </button>
            <p className="text-xs text-center text-gray-500">
              You will be redirected to Okta to authenticate with your company account.
            </p>
          </div>
        )}

        {showCredentialsForm && (
          <form className="mt-8 space-y-6" onSubmit={handleCredentialsSignIn}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="relative block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="relative block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Legacy credential access is typically only enabled for local development or fallback scenarios.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

