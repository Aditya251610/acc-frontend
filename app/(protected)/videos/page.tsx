'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, FileVideo, AlertCircle, Ellipsis, Pencil, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"

type VideoFile = {
  id?: string | number
  name?: string
  original_filename?: string
  url?: string
  mime_type?: string
  mediaUrl?: string
  loadError?: boolean
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string[] = []

    const getVideos = async () => {
      try {
        const token = localStorage.getItem("authToken")
        const response = await fetch("http://localhost:8000/files", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!response.ok) throw new Error(`Failed to fetch videos: ${response.status}`)

        const payload = await response.json()
        const items = Array.isArray(payload?.items) ? payload.items : []

        const mp4s = items.filter((item: VideoFile) => {
          const mime = item.mime_type?.toLowerCase() ?? ""
          return mime === "video/mp4" || mime.includes("video")
        })

        const filesWithMediaUrl = await Promise.all(
          mp4s.map(async (item: any) => {
            if (!item.original_filename) {
              console.warn("Video missing original_filename", item)
              return { ...item, loadError: true }
            }

            const downloadUrl = `http://localhost:8000/files/download/${encodeURIComponent(
              item.original_filename,
            )}`

            console.log("Fetching video from:", downloadUrl)

            try {
              const fileResp = await fetch(downloadUrl, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              })
              
              console.log("Video fetch response:", fileResp.status, fileResp.headers.get('content-type'))
              
              if (!fileResp.ok) {
                throw new Error(`Failed to fetch video: ${fileResp.status} ${fileResp.statusText}`)
              }
              
              const blob = await fileResp.blob()
              console.log("Video blob size:", blob.size, "type:", blob.type)
              
              const objectUrl = URL.createObjectURL(blob)
              revoked.push(objectUrl)
              return { ...item, mediaUrl: objectUrl }
            } catch (err) {
              console.error("Error loading video file:", item.original_filename, err)
              return { ...item, mediaUrl: downloadUrl, loadError: true }
            }
          }),
        )

        setVideos(filesWithMediaUrl)
      } catch (err) {
        console.error("Error fetching videos:", err)
        setError("Unable to load videos right now.")
      } finally {
        setLoading(false)
      }
    }

    getVideos()

    return () => {
      revoked.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
        <p className="mt-2 text-muted-foreground">
          Manage and view your video content
        </p>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileVideo className="h-5 w-5 animate-pulse" />
              <p className="text-sm">Loading videos…</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 py-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {videos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileVideo className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No video files found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload a video to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <Card key={video.id ?? video.url ?? video.name} className="overflow-hidden">
                  <CardHeader className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="More options"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                        >
                          <Ellipsis className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={6}>
                        <DropdownMenuItem onClick={() => console.log('edit', video)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => console.log('delete', video)}>
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-2">
                    <div className="relative aspect-video w-full overflow-hidden bg-muted" style={{ borderRadius: '0.5rem' }}>
                      <video
                        controls
                        className="h-full w-full object-contain"
                        style={{ borderRadius: '0.5rem' }}
                        preload="metadata"
                        crossOrigin="anonymous"
                      >
                        <source src={video.mediaUrl ?? video.url} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="truncate text-base">
                        {video.original_filename ?? video.name ?? "Untitled"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        <span className="text-xs">Video</span>
                      </CardDescription>
                    </div>
                    {video.loadError && (
                      <div className="flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 dark:bg-yellow-950/20">
                        <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">
                          Playback may be limited
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
