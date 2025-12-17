'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Music, FileAudio, AlertCircle, Ellipsis, Pencil, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"

type AudioFile = {
  id?: string | number
  name?: string
  original_filename?: string
  url?: string
  mime_type?: string
  mediaUrl?: string
  loadError?: boolean
}

export default function AudiosPage() {
  const [audios, setAudios] = useState<AudioFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string[] = []

    const getAudios = async () => {
      try {
        const token = localStorage.getItem("authToken")
        const response = await fetch("http://localhost:8000/files", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!response.ok) throw new Error(`Failed to fetch audios: ${response.status}`)

        const payload = await response.json()
        const items = Array.isArray(payload?.items) ? payload.items : []

        const mp3s = items.filter((item: AudioFile) => {
          const mime = item.mime_type?.toLowerCase() ?? ""
          return mime === "audio/mpeg" || mime === "audio/mp3" || mime.includes("audio")
        })

        const filesWithMediaUrl = await Promise.all(
          mp3s.map(async (item: any) => {
            if (!item.original_filename) {
              console.warn("Audio missing original_filename", item)
              return { ...item, loadError: true }
            }

            const downloadUrl = `http://localhost:8000/files/download/${encodeURIComponent(
              item.original_filename,
            )}`

            console.log("Fetching audio from:", downloadUrl)

            try {
              const fileResp = await fetch(downloadUrl, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              })
              
              console.log("Audio fetch response:", fileResp.status, fileResp.headers.get('content-type'))
              
              if (!fileResp.ok) {
                throw new Error(`Failed to fetch audio: ${fileResp.status} ${fileResp.statusText}`)
              }
              
              const blob = await fileResp.blob()
              console.log("Audio blob size:", blob.size, "type:", blob.type)
              
              const objectUrl = URL.createObjectURL(blob)
              revoked.push(objectUrl)
              return { ...item, mediaUrl: objectUrl }
            } catch (err) {
              console.error("Error loading audio file:", item.original_filename, err)
              return { ...item, mediaUrl: downloadUrl, loadError: true }
            }
          }),
        )

        setAudios(filesWithMediaUrl)
      } catch (err) {
        console.error("Error fetching audios:", err)
        setError("No audios available right now.")
      } finally {
        setLoading(false)
      }
    }

    getAudios()

    return () => {
      revoked.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Audios</h1>
        <p className="mt-2 text-muted-foreground">
          Manage and listen to your audio content
        </p>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileAudio className="h-5 w-5 animate-pulse" />
              <p className="text-sm">Loading audios…</p>
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
          {audios.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileAudio className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No audio files found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload an audio file to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {audios.map((audio) => (
                <Card key={audio.id ?? audio.url ?? audio.name} className="overflow-hidden">
                  <CardHeader className="pb-1 flex justify-end">
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
                        <DropdownMenuItem onClick={() => console.log('edit', audio)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => console.log('delete', audio)}>
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4">
                    <div className="w-full bg-muted p-3 overflow-hidden" style={{ borderRadius: '0.5rem' }}>
                      <audio
                        controls
                        className="h-9 w-full"
                        style={{ borderRadius: '0.5rem' }}
                        preload="metadata"
                        crossOrigin="anonymous"
                      >
                        <source src={audio.mediaUrl ?? audio.url} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="truncate text-base">
                        {audio.original_filename ?? audio.name ?? "Untitled"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Music className="h-3 w-3" />
                        <span className="text-xs">Audio</span>
                      </CardDescription>
                    </div>
                    {audio.loadError && (
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
