'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export function CostReportUpload() {
  const { data: session } = useSession()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  // Only show for ADMIN and PM
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PM')) {
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
        setError('Invalid file type. Please select an Excel file (.xlsx or .xls)')
        setFile(null)
        return
      }
      // Validate file size (50MB max)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File too large. Maximum size is 50MB')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
      setSuccess(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/cost-report/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload cost report')
      }

      setSuccess(`Cost report "${data.costReport.fileName}" uploaded successfully!`)
      setFile(null)
      // Reset file input
      const fileInput = document.getElementById('cost-report-file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      // Refresh the page after a short delay to show updated data
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload cost report'
      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Upload Cost Report</h3>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="cost-report-file" className="block text-sm font-medium text-gray-700 mb-2">
            Select Cost Report File
          </label>
          <input
            id="cost-report-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">
            Supported formats: .xlsx, .xls (Max size: 50MB)
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Filename should include date (e.g., &quot;Cost Report Summary 10.15.25.xlsx&quot;)
          </p>
        </div>

        {file && (
          <div className="rounded-md bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">Selected file:</p>
            <p className="text-sm text-blue-700">{file.name}</p>
            <p className="text-xs text-blue-600 mt-1">
              Size: {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-3">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload Cost Report'}
        </button>
      </div>

      <div className="mt-4 border-t pt-4">
        <p className="text-xs text-gray-500">
          <strong>Note:</strong> Uploading a new cost report will make it the active report. 
          Previous reports are kept for historical reference but marked as inactive.
        </p>
      </div>
    </div>
  )
}

