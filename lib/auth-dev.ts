// Development mode: bypass authentication
// Set BYPASS_AUTH=true in .env to use this

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const devAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize() {
        // Always authorize in dev mode - no credentials needed
        return {
          id: 'dev-user-id',
          email: 'dev@example.com',
          name: 'Dev User',
          role: 'ADMIN',
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = 'role' in user ? (user as { role: string }).role : 'ADMIN'
      } else {
        // If no user in token, set defaults
        token.id = token.id || 'dev-user-id'
        token.email = token.email || 'dev@example.com'
        token.name = token.name || 'Dev User'
        token.role = token.role || 'ADMIN'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as { id?: string; email?: string | null; name?: string | null; role?: string }
        user.id = token.id as string || 'dev-user-id'
        user.email = token.email as string || 'dev@example.com'
        user.name = token.name as string || 'Dev User'
        user.role = token.role as string || 'ADMIN'
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret',
}
