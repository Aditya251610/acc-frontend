'use client'

import { useState } from 'react'
import { FileUpload } from '@/components/ui/file-upload'
import { Loader2 } from 'lucide-react'

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleFileSelect = (newFiles: File[]) => {
    setFiles(newFiles)
    setMessage(null)
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one file' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('authToken')
      let uploadedCount = 0
      const errors: string[] = []

      // Upload each file individually
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        try {
          const response = await fetch('http://localhost:8000/files/upload', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: formData,
          })

          if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            errors.push(`${file.name}: ${error.detail || response.statusText}`)
          } else {
            uploadedCount++
          }
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`)
        }
      }

      if (uploadedCount > 0) {
        const msg = `Successfully uploaded ${uploadedCount} file(s)`
        setMessage({ type: 'success', text: errors.length > 0 ? `${msg}. Errors: ${errors.join('; ')}` : msg })
        setFiles([])
      } else {
        setMessage({ type: 'error', text: `All uploads failed: ${errors.join('; ')}` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div
        style={{ borderRadius: '1rem' }}
        className="w-full max-w-2xl border bg-card p-8 space-y-6 shadow-lg"
      >
        <div style={{ borderRadius: '0.75rem' }}>
          <FileUpload onChange={handleFileSelect} />
        </div>

        {files.length > 0 && (
          <div
            style={{ borderRadius: '0.5rem' }}
            className="bg-muted p-4 space-y-2"
          >
            <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {files.map((file, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span>•</span>
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {message && (
          <div
            style={{ borderRadius: '0.5rem' }}
            className={`p-4 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          style={{
            borderRadius: '0.5rem',
            backgroundColor: '#6F26D4',
          }}
          className="w-full h-10 flex items-center justify-center gap-2 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            'Upload Files'
          )}
        </button>
      </div>
    </div>
  )
}
