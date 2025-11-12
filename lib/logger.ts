/**
 * Simple logger utility for structured logging
 * Provides INFO, DEBUG, WARN, ERROR levels
 */

import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'
import { env } from './config'

type LogLevelName = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  traceId?: string
  [key: string]: unknown
}

const levelOrder: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const levelFromEnv = (env.LOG_LEVEL ?? (env.isProduction ? 'info' : 'debug')) as LogLevelName

const contextStorage = new AsyncLocalStorage<LogContext>()

function serializeArgs(args: unknown[]): Record<string, unknown> {
  if (args.length === 0) {
    return {}
  }

  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    const value = args[0] as Record<string, unknown>
    if (value instanceof Error) {
      return {
        error: {
          message: value.message,
          name: value.name,
          stack: value.stack,
        },
      }
    }
    return value
  }

  return {
    data: args.map(arg => {
      if (arg instanceof Error) {
        return {
          message: arg.message,
          name: arg.name,
          stack: arg.stack,
        }
      }
      return arg
    }),
  }
}

class Logger {
  constructor(private readonly minLevel: number) {}

  private emit(level: LogLevelName, message: string, args: unknown[]) {
    if (levelOrder[level] < this.minLevel) {
      return
    }

    const timestamp = new Date().toISOString()
    const context = contextStorage.getStore() ?? {}
    const payload = {
      timestamp,
      level,
      message,
      ...context,
      ...serializeArgs(args),
    }

    console.log(JSON.stringify(payload))
  }

  debug(message: string, ...args: unknown[]) {
    this.emit('debug', message, args)
  }

  info(message: string, ...args: unknown[]) {
    this.emit('info', message, args)
  }

  warn(message: string, ...args: unknown[]) {
    this.emit('warn', message, args)
  }

  error(message: string, ...args: unknown[]) {
    this.emit('error', message, args)
  }

  withContext(additional: LogContext = {}) {
    const current = contextStorage.getStore() ?? {}
    const merged = { ...current, ...additional }
    return {
      debug: (msg: string, ...args: unknown[]) =>
        contextStorage.run(merged, () => this.emit('debug', msg, args)),
      info: (msg: string, ...args: unknown[]) =>
        contextStorage.run(merged, () => this.emit('info', msg, args)),
      warn: (msg: string, ...args: unknown[]) =>
        contextStorage.run(merged, () => this.emit('warn', msg, args)),
      error: (msg: string, ...args: unknown[]) =>
        contextStorage.run(merged, () => this.emit('error', msg, args)),
    }
  }
}

export const logger = new Logger(levelOrder[levelFromEnv])

export function runWithRequestContext<T>(context: LogContext, fn: () => Promise<T> | T): Promise<T> | T {
  return contextStorage.run(context, fn)
}

export function addContext(additional: LogContext) {
  const current = contextStorage.getStore() ?? {}
  contextStorage.enterWith({ ...current, ...additional })
}

export function getTraceId(): string {
  const context = contextStorage.getStore()
  if (context?.traceId && typeof context.traceId === 'string') {
    return context.traceId
  }
  const traceId = randomUUID()
  addContext({ traceId })
  return traceId
}

export function extractTraceId(headerValue?: string | null): string {
  return headerValue && headerValue.trim().length > 0 ? headerValue : randomUUID()
}

