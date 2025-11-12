import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { ReportView } from '@/components/report-view'

export default async function ViewReportPage({
  params,
}: {
  params: { id: string; reportId: string }
}) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  // Check permissions
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

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { 
      id: true, 
      code: true, 
      name: true,
      startDate: true,
      scheduledCompletion: true,
      projectBudget: true,
      eac: true,
      budgetVariance: true,
      percentComplete: true,
      tenant: true,
    }
  })

  if (!project) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <ReportView 
          projectId={params.id} 
          project={project}
          reportId={params.reportId}
        />
      </main>
    </div>
  )
}

