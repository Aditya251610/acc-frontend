'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Music, Calendar, FileAudio, HardDrive, Clock } from 'lucide-react'
import Link from 'next/link'
import { ApiError, apiFetch, extractErrorMessage } from '@/lib/api'
import { handleApiError } from '@/lib/handle-api-error'
import CommentsThread from '@/components/comments-thread'
import { useWorkspace } from '@/lib/workspace-context'
import { useAuth } from '@/lib/auth-context'
import { getOrFetchMediaUrl } from '@/lib/media-cache'

type AudioDetails = {
  id: string | number
  original_filename: string
  mime_type: string
  size_bytes: number
  created_at: string
  mediaUrl?: string
}

export default function AudioDetailsPage() {
  const params = useParams()
  const { workspaceId, loadingRole, loadingWorkspaces } = useWorkspace()
  const { loading: authLoading, isAuthenticated } = useAuth()
  const [audio, setAudio] = useState<AudioDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ready = !authLoading && isAuthenticated && !loadingWorkspaces && !!workspaceId && !loadingRole

  useEffect(() => {
    let cancelled = false

    const fetchAudioDetails = async () => {
      try {
        if (authLoading || !isAuthenticated) return

        if (loadingWorkspaces || loadingRole) return

        if (!workspaceId) {
          setError('No workspace selected')
          setLoading(false)
          return
        }

        if (!ready) return

        const response = await apiFetch(`/workspaces/${workspaceId}/media/?page=1&page_size=100&type=audio`, {
          method: 'GET',
          auth: true,
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          const err = new ApiError(extractErrorMessage(response.status, body), response.status, body)
          const handled = handleApiError(err)
          if (handled.kind === 'not-found') {
            setError('Audio not found')
            setLoading(false)
            return
          }
          setError('Failed to fetch audio')
          setLoading(false)
          return
        }

        const payload = await response.json().catch(() => ({}))
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : []

        // Find audio by ID matching the id param
        const audioFile = items.find((item: unknown) => {
          const media = item as { id?: string | number }
          return String(media?.id) === String(params.id)
        })

        if (!audioFile) {
          setError('Audio not found')
          setLoading(false)
          return
        }

        try {
          const url = await getOrFetchMediaUrl(workspaceId, audioFile.id)
          if (!cancelled) setAudio({ ...audioFile, mediaUrl: url })
        } catch {
          if (!cancelled) setAudio(audioFile)
        }

        setLoading(false)
      } catch (e) {
        const handled = handleApiError(e)
        if (handled.kind === 'unauthorized') return
        setError('Failed to load audio details')
        setLoading(false)
      }
    }

    fetchAudioDetails()

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, loadingRole, loadingWorkspaces, params.id, ready, workspaceId])

  if (loading) {
    return (
      <div className="container mx-auto">
        <div className="flex items-center justify-center py-12">
          <FileAudio className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !audio) {
    return (
      <div className="container mx-auto">
        <Card style={{ borderRadius: '1rem' }} className="border-destructive">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <FileAudio className="h-12 w-12 text-destructive" />
            <p className="text-destructive">{error || 'Audio not found'}</p>
            <Link
              href="/audios"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Audios
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <Link
          href="/audios"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Audios
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Player Card */}
        <Card style={{ borderRadius: '1rem' }} className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex min-w-0 items-center gap-2">
              <Music className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate">{audio.original_filename}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              style={{ borderRadius: '0.75rem' }}
              className="w-full bg-muted p-6"
            >
              <audio
                controls
                className="h-12 w-full"
                style={{ borderRadius: '0.5rem' }}
                preload="metadata"
                crossOrigin="anonymous"
              >
                <source src={audio.mediaUrl} type={audio.mime_type} />
                Your browser does not support the audio element.
              </audio>
            </div>

            <div className="grid gap-4 pt-4">
              <div
                style={{ borderRadius: '0.5rem' }}
                className="flex items-center gap-3 bg-muted/50 p-4"
              >
                <FileAudio className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">File Type</p>
                  <p className="text-xs text-muted-foreground">{audio.mime_type}</p>
                </div>
              </div>

              <div
                style={{ borderRadius: '0.5rem' }}
                className="flex items-center gap-3 bg-muted/50 p-4"
              >
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">File Size</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(audio.size_bytes)}</p>
                </div>
              </div>

              <div
                style={{ borderRadius: '0.5rem' }}
                className="flex items-center gap-3 bg-muted/50 p-4"
              >
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Uploaded</p>
                  <p className="text-xs text-muted-foreground">{formatDate(audio.created_at)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Info */}
        <Card style={{ borderRadius: '1rem' }}>
          <CardHeader>
            <CardTitle className="text-base">Audio Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Filename</p>
              <p className="text-sm break-all">{audio.original_filename}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">ID</p>
              <p className="text-xs font-mono break-all">{audio.id}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Format</p>
              <p className="text-sm">{audio.mime_type.split('/')[1]?.toUpperCase() || 'AUDIO'}</p>
            </div>

            <div
              style={{ borderRadius: '0.5rem' }}
              className="bg-primary/10 p-4 mt-6"
            >
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-primary">Encrypted Storage</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This audio is securely encrypted on the server
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <CommentsThread targetType="media" targetId={audio.id} title="Media comments" />
        </div>
      </div>
    </div>
  )
}
