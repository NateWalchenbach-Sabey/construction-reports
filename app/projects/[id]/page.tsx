import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { ProjectOverview } from '@/components/project-overview'

export default async function ProjectPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  // Check permissions for superintendents
  if (session.user.role === 'SUPERINTENDENT' && 'id' in session.user) {
    const userId = (session.user as { id: string }).id
    const assignment = await prisma.projectAssignment.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: params.id
        }
      }
    })
    if (!assignment) {
      redirect('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProjectOverview projectId={params.id} />
      </main>
    </div>
  )
}

