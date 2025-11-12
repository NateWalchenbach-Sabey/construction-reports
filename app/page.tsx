import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Dashboard } from '@/components/dashboard'

// Development mode: bypass auth
const useDevMode = process.env.BYPASS_AUTH === 'true'

export default async function HomePage() {
  let session = null
  
  if (!useDevMode) {
    const { authOptions } = await import('@/lib/auth')
    session = await getServerSession(authOptions)
    
    if (!session) {
      redirect('/login')
    }
  } else {
    // Mock session for dev mode
    session = {
      user: {
        id: 'dev-user-id',
        email: 'dev@example.com',
        name: 'Dev User',
        role: 'ADMIN'
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative">
        <Dashboard />
      </main>
    </div>
  )
}
