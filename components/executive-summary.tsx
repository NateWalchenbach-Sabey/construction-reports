'use client'

import { useState } from 'react'

interface Project {
  id: string
  name: string
  code: string
  region: string
}

interface ExecutiveSummaryProps {
  projects: Project[]
  weekEnding: string
}

export function ExecutiveSummary({ weekEnding }: ExecutiveSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    if (!isExpanded && !summary && !loading) {
      // Fetch summary when expanding for the first time
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/reports/executive-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekEnding }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate executive summary')
        }

        const data = await response.json()
        setSummary(data.summary)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load executive summary'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="my-8 max-w-4xl mx-auto">
      <button
        onClick={handleToggle}
        className="w-full text-left text-lg font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 hover:bg-blue-100 transition-colors"
      >
        Executive Summary (AI generated) {isExpanded ? '[-]' : '[+]'}
      </button>
      
      {isExpanded && (
        <div className="mt-4 border border-blue-200 rounded-lg bg-blue-50 p-5">
          {loading && (
            <div className="text-center py-8 text-gray-600">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2">Generating executive summary...</p>
            </div>
          )}
          
          {error && (
            <div className="text-red-600 text-center py-4">
              <p>Error: {error}</p>
              <p className="text-sm mt-2">Make sure OPENAI_API_KEY is set in your environment variables.</p>
            </div>
          )}
          
          {summary && !loading && (
            <div
              className="prose prose-sm max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: summary }}
            />
          )}
        </div>
      )}
    </div>
  )
}

