'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Project {
  id: string
  code: string
  name: string
  projectNumber: string | null
  region: string
  projectNumbers: Array<{
    id: string
    projectNumber: string
    source: string | null
    notes: string | null
  }>
}

export function ProjectNumbersManager() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.role === 'ADMIN' || session?.user?.role === 'PM') {
      fetchProjects()
    } else {
      setLoading(false)
    }
  }, [session])

  const fetchProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects?includeProjectNumbers=true')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load projects'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProjectNumber = async (projectId: string, projectNumberId: string) => {
    if (!confirm('Are you sure you want to delete this project number?')) {
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/project-numbers/${projectNumberId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete project number')
      }

      // Refresh projects
      await fetchProjects()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(`Error: ${errorMessage}`)
    }
  }

  const handleAddProjectNumber = async (projectId: string, projectNumber: string) => {
    if (!projectNumber.trim()) {
      alert('Project number cannot be empty')
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/project-numbers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectNumber: projectNumber.trim().toLowerCase() }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to add project number')
      }

      // Refresh projects
      await fetchProjects()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(`Error: ${errorMessage}`)
    }
  }

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PM')) {
    return null
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm text-red-800">{error}</p>
        <button 
          onClick={fetchProjects} 
          className="mt-4 inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">All Projects</h2>
          <p className="mt-1 text-sm text-gray-600">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={fetchProjects}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                    <span>Code: {project.code}</span>
                    <span>Region: {project.region}</span>
                    <span>
                      Project Numbers: {project.projectNumbers.length}
                    </span>
                  </div>
                  {project.projectNumber && (
                    <div className="mt-1">
                      <span className="text-xs font-medium text-gray-500">Primary: </span>
                      <span className="text-xs font-mono text-gray-700">{project.projectNumber}</span>
                    </div>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedProject === project.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {expandedProject === project.id && (
              <div className="border-t border-gray-200 bg-gray-50 p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Project Numbers</h4>
                  {project.projectNumbers.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No project numbers assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {project.projectNumbers.map((pn) => (
                        <div
                          key={pn.id}
                          className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3"
                        >
                          <div className="flex-1">
                            <span className="font-mono text-sm text-gray-900">{pn.projectNumber}</span>
                            {pn.source && pn.source !== 'weekly_report' && (
                              <span className="ml-2 text-xs text-gray-500">({pn.source})</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteProjectNumber(project.id, pn.id)}
                            className="ml-4 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Add Project Number</h4>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const formData = new FormData(e.currentTarget)
                      const projectNumber = formData.get('projectNumber') as string
                      if (projectNumber) {
                        handleAddProjectNumber(project.id, projectNumber)
                        e.currentTarget.reset()
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      name="projectNumber"
                      placeholder="e.g., 24-3-013-asha"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-md bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Note:</strong> Project numbers are used to match cost report data to projects. 
          When a project has multiple project numbers, financial data from all matching cost report rows 
          will be aggregated (summed) for that project. Project numbers should match Column B from the cost report Excel file.
        </p>
      </div>
    </div>
  )
}

