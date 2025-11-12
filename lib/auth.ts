import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import OktaProvider from 'next-auth/providers/okta'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

const oktaIssuer = process.env.OKTA_ISSUER
const oktaClientId = process.env.OKTA_CLIENT_ID
const oktaClientSecret = process.env.OKTA_CLIENT_SECRET
const oktaConfigured = Boolean(oktaIssuer && oktaClientId && oktaClientSecret)
const enableCredentials = !oktaConfigured || process.env.ENABLE_CREDENTIALS_SIGNIN === 'true'

const providers: NextAuthOptions['providers'] = []

if (oktaConfigured) {
  providers.push(
    OktaProvider({
      clientId: oktaClientId!,
      clientSecret: oktaClientSecret!,
      issuer: oktaIssuer!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username ?? profile.email,
          email: profile.email,
        }
      },
    })
  )
}

if (enableCredentials) {
  providers.push(
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    })
  )
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email ?? token.email
        token.name = user.name ?? token.name

        const lookupEmail = user.email ?? (typeof token.email === 'string' ? token.email : undefined)
        if (lookupEmail) {
          const dbUser = await prisma.user.findUnique({
            where: { email: lookupEmail },
            select: {
              id: true,
              role: true,
            }
          })

          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
          } else if (user.id) {
            token.id = user.id
          }
        } else if (user.id) {
          token.id = user.id
        }

        if (user.role && !token.role) {
          token.role = user.role
        }
      } else if (token.email && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true }
        })

        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id !== undefined) {
          session.user.id = typeof token.id === 'string' ? token.id : String(token.id)
        }
        if (typeof token.role === 'string') {
          session.user.role = token.role
        }
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

