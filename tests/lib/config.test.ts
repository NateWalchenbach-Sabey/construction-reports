import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('lib/config', () => {
  it('fails fast when DATABASE_URL is missing', async () => {
    process.env.NODE_ENV = 'development'
    process.env.NEXTAUTH_SECRET = 'test-secret'

    await expect(import('@/lib/config')).rejects.toThrow(/Invalid input/)
  })

  it('provides a development default for NEXTAUTH_SECRET when not supplied', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'postgresql://localhost/test-db'

    const { env } = await import('@/lib/config')

    expect(env.NEXTAUTH_SECRET).toBe('development-secret')
    expect(env.isDevelopment).toBe(true)
  })

  it('rejects enabling BYPASS_AUTH in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.DATABASE_URL = 'postgresql://localhost/prod-db'
    process.env.NEXTAUTH_SECRET = 'super-secret'
    process.env.BYPASS_AUTH = 'true'

    await expect(import('@/lib/config')).rejects.toThrow(/BYPASS_AUTH cannot be enabled in production/)
  })
})
