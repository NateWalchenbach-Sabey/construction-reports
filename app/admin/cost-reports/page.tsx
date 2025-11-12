import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { CostReportUpload } from '@/components/cost-report-upload'
import { CostReportList } from '@/components/cost-report-list'
import { CostReportMatchStatus } from '@/components/cost-report-match-status'

export default async function CostReportsAdminPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  // Only ADMIN and PM can access this page
  if (session.user.role !== 'ADMIN' && session.user.role !== 'PM') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cost Report Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload and manage cost report files. Each uploaded file is stored and kept for historical reference.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Section */}
          <div>
            <CostReportUpload />
          </div>

          {/* List Section */}
          <div>
            <CostReportList />
          </div>
        </div>

        {/* Matching Status Section */}
        <div className="mt-6">
          <CostReportMatchStatus />
        </div>
      </main>
    </div>
  )
}

