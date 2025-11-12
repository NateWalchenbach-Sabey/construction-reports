import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost/test-db',
    NEXTAUTH_SECRET: 'test-secret',
  }
  vi.resetModules()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('lib/logger', () => {
  it('includes traceId in structured log output', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { logger, runWithRequestContext } = await import('@/lib/logger')

    await runWithRequestContext({ traceId: 'trace-123' }, async () => {
      logger.info('test message', { feature: 'logger-test' })
    })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const logged = consoleSpy.mock.calls[0]?.[0] as string
    expect(logged).toContain('"traceId":"trace-123"')
    expect(logged).toContain('"feature":"logger-test"')

    consoleSpy.mockRestore()
  })

  it('generates a traceId when none is present', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { logger, getTraceId } = await import('@/lib/logger')

    const traceId = getTraceId()
    logger.info('another message')

    const logged = consoleSpy.mock.calls[0]?.[0] as string
    expect(logged).toContain('"traceId"')
    expect(traceId).toMatch(/^[0-9a-f-]{36}$/)

    consoleSpy.mockRestore()
  })
})
