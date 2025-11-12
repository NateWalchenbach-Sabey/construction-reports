import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { devAuthOptions } from '@/lib/auth-dev'

// Development mode: bypass database auth
const useDevMode = process.env.BYPASS_AUTH === 'true'

const handler = useDevMode ? NextAuth(devAuthOptions) : NextAuth(authOptions)

export { handler as GET, handler as POST }
