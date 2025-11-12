import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { ProjectsManager } from '@/components/projects-manager'

export default async function ProjectsAdminPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  // Only ADMIN can access this page
  if (session.user.role !== 'ADMIN') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Projects Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create, edit, and manage projects. Add project numbers to track financial data from cost reports.
          </p>
        </div>

        <ProjectsManager />
      </main>
    </div>
  )
}

