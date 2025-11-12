'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/navbar'
import { LoadingSpinner } from '@/components/loading-spinner'
import { useLoading } from '@/components/loading-provider'

interface Project {
  id: string
  code: string
  name: string
  region: string
}

export default function NewReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { setLoading: setGlobalLoading } = useLoading()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchProjects()
    }
  }, [status, router])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      // API route has caching headers, so responses will be cached by the browser
      const res = await fetch('/api/projects')
      const data = await res.json()
      
      if (Array.isArray(data)) {
        // Sort projects alphabetically by name
        const sorted = [...data].sort((a, b) => 
          a.name.localeCompare(b.name)
        )
        setProjects(sorted)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const handleProjectSelect = (projectId: string) => {
    if (projectId) {
      router.push(`/projects/${projectId}/reports/new`)
    }
  }

  if (status === 'loading' || !session) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Report</h1>
          <p className="text-gray-600 mb-6">Select a project to create a new report</p>

          {loading ? (
            <LoadingSpinner />
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No projects available</p>
              <p className="mt-2 text-sm text-gray-400">
                Contact an administrator to create projects.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="project-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Project
                </label>
                <select
                  id="project-select"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value)
                    handleProjectSelect(e.target.value)
                  }}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Choose a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.code})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Projects are sorted alphabetically by name
                </p>
              </div>

              {selectedProjectId && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <Link
                    href={`/projects/${selectedProjectId}/reports/new`}
                    prefetch={true}
                    onClick={() => {
                      setGlobalLoading(true)
                      // Let the link navigate normally
                    }}
                    className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 inline-block text-center"
                  >
                    Continue to Report Form
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
