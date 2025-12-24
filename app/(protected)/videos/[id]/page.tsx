'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Video,
  Calendar,
  FileVideo,
  HardDrive,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { ApiError, apiFetch, extractErrorMessage } from '@/lib/api'
import { handleApiError } from '@/lib/handle-api-error'
import CommentsThread from '@/components/comments-thread'
import { useWorkspace } from '@/lib/workspace-context'
import { useAuth } from '@/lib/auth-context'

type VideoDetails = {
  id: string | number
  original_filename: string
  mime_type: string
  size_bytes: number
  created_at: string
  mediaUrl?: string
}

export default function VideoDetailsPage() {
  const params = useParams()
  const { workspaceId, loadingRole, loadingWorkspaces } = useWorkspace()
  const { loading: authLoading, isAuthenticated } = useAuth()
  const [video, setVideo] = useState<VideoDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ready = !authLoading && isAuthenticated && !loadingWorkspaces && !!workspaceId && !loadingRole

  useEffect(() => {
    let objectUrl: string | null = null

    const fetchVideoDetails = async () => {
      try {
        if (authLoading || !isAuthenticated) return

        if (loadingWorkspaces || loadingRole) return

        if (!workspaceId) {
          setError('No workspace selected')
          setLoading(false)
          return
        }

        if (!ready) return

        const response = await apiFetch(`/workspaces/${workspaceId}/media/?page=1&page_size=100&type=video`, {
          method: 'GET',
          auth: true,
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          const err = new ApiError(extractErrorMessage(response.status, body), response.status, body)
          const handled = handleApiError(err)
          if (handled.kind === 'not-found') {
            setError('Video not found')
            setLoading(false)
            return
          }
          setError('Failed to fetch video')
          setLoading(false)
          return
        }

        const payload = await response.json().catch(() => ({}))
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : []

        const videoFile = items.find((item: unknown) => {
          const media = item as { id?: string | number }
          return String(media?.id) === String(params.id)
        })

        if (!videoFile) {
          setError('Video not found')
          setLoading(false)
          return
        }

        const fileResp = await apiFetch(`/workspaces/${workspaceId}/media/${videoFile.id}/download`, {
          method: 'GET',
          auth: true,
        })

        if (fileResp.ok) {
          const blob = await fileResp.blob()
          objectUrl = URL.createObjectURL(blob)
          setVideo({ ...videoFile, mediaUrl: objectUrl })
        } else {
          setVideo(videoFile)
        }

        setLoading(false)
      } catch (e) {
        const handled = handleApiError(e)
        if (handled.kind === 'unauthorized') return
        setError('Failed to load video details')
        setLoading(false)
      }
    }

    fetchVideoDetails()

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [authLoading, isAuthenticated, loadingRole, loadingWorkspaces, params.id, ready, workspaceId])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center py-12">
          <FileVideo className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive rounded-xl">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <FileVideo className="h-12 w-12 text-destructive" />
            <p className="text-destructive">{error}</p>
            <Link
              href="/videos"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Videos
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/videos"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Videos
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-[50%]">
        <Card className="lg:col-span-2 min-w-0" style={{ borderRadius: '1rem' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 min-w-0">
              <Video className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">{video.original_filename}</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="min-w-0" style={{ rowGap: '12px', display: 'grid' }}>
            <div
              style={{ borderRadius: '0.75rem', overflow: 'hidden' }}
            >
              <video
                controls
                preload="metadata"
                style={{ width: '100%', height: 'auto', borderRadius: '0.5rem', maxHeight: '320px', display: 'block', objectFit: 'contain' }}
              >
                <source src={video.mediaUrl} type={video.mime_type} />
                Your browser does not support the video element.
              </video>
            </div>

            <div className="grid" style={{ gap: '12px', paddingTop: '8px' }}>
              <InfoRow
                icon={<FileVideo />}
                label="File Type"
                value={video.mime_type}
              />
              <InfoRow
                icon={<HardDrive />}
                label="File Size"
                value={formatBytes(video.size_bytes)}
              />
              <InfoRow
                icon={<Calendar />}
                label="Uploaded"
                value={formatDate(video.created_at)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="" style={{ borderRadius: '1rem' }}>
          <CardHeader>
            <CardTitle className="text-base">Video Information</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 min-w-0">
            <InfoBlock label="Filename" value={video.original_filename} />
            <InfoBlock label="ID" value={String(video.id)} mono />
            <InfoBlock
              label="Format"
              value={video.mime_type.split('/')[1]?.toUpperCase()}
            />

            <div className="mt-6 bg-primary/10 p-4" style={{ borderRadius: '0.5rem' }}>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-primary">
                    Encrypted Storage
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This video is securely encrypted on the server
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <CommentsThread targetType="media" targetId={video.id} title="Media comments" />
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 bg-muted/50 p-4 min-w-0" style={{ borderRadius: '0.5rem' }}>
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{value}</p>
      </div>
    </div>
  )
}

function InfoBlock({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
      <p
        className={`text-sm break-words ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}
