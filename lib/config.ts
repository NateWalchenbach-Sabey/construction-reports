import { z } from 'zod'

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  BYPASS_AUTH: process.env.BYPASS_AUTH,
  LOG_LEVEL: process.env.LOG_LEVEL,
  PRISMA_TIMEOUT_MS: process.env.PRISMA_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS: process.env.REQUEST_TIMEOUT_MS,
}

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .string({ required_error: 'DATABASE_URL is required' })
      .trim()
      .min(1, 'DATABASE_URL is required'),
    NEXTAUTH_SECRET: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    BYPASS_AUTH: z.enum(['true', 'false']).optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    PRISMA_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10000),
    REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15000),
  })
  .superRefine((envVars, ctx) => {
    if (!envVars.NEXTAUTH_SECRET || envVars.NEXTAUTH_SECRET.trim().length === 0) {
      if (envVars.NODE_ENV === 'production') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NEXTAUTH_SECRET'],
          message: 'NEXTAUTH_SECRET is required in production',
        })
      } else {
        envVars.NEXTAUTH_SECRET = 'development-secret'
      }
    }

    if (envVars.BYPASS_AUTH === 'true' && envVars.NODE_ENV === 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BYPASS_AUTH'],
        message: 'BYPASS_AUTH cannot be enabled in production',
      })
    }
  })

type EnvVars = z.infer<typeof EnvSchema>

const parsedEnv = EnvSchema.parse(rawEnv) as Required<EnvVars>

export const env = Object.freeze({
  ...parsedEnv,
  isDevelopment: parsedEnv.NODE_ENV === 'development',
  isTest: parsedEnv.NODE_ENV === 'test',
  isProduction: parsedEnv.NODE_ENV === 'production',
})

export type AppEnv = typeof env
