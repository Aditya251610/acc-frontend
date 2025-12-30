import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PublicHomePage() {
  const radiusPill = 9999
  const radiusCard = 24
  const radiusInner = 18

  return (
    <div className="container mx-auto px-6 pb-16 pt-24">
      <section className="mx-auto max-w-5xl">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div
              className="inline-flex items-center gap-2 border bg-card px-3 py-1 text-xs text-muted-foreground"
              style={{ borderRadius: radiusPill }}
            >
              Workspace-first collaboration
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Avid Content Core for teams that ship content
            </h1>

            <p className="mt-4 text-base text-muted-foreground">
              ACC brings your media, documents, and feedback into one place: upload files, create
              docs, discuss with comments, and manage access with workspace roles.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">Create account</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">Login</Link>
              </Button>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <span>Roles: owner • admin • editor • reviewer • viewer</span>
            </div>
          </div>

          <div className="relative">
            <div className="border bg-card p-6" style={{ borderRadius: radiusCard }}>
              <div className="flex items-center gap-3">
                <Image
                  src="/acc_logo.png"
                  alt="ACC"
                  width={128}
                  height={32}
                  className="h-8 w-auto"
                  priority
                />
                <div className="text-sm font-semibold">Avid Content Core</div>
              </div>

              <div className="mt-6 grid gap-3">
                <div className="border bg-background p-4" style={{ borderRadius: radiusInner }}>
                  <div className="text-sm font-semibold">Media</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Upload audio, video and files — download when needed.
                  </div>
                </div>
                <div className="border bg-background p-4" style={{ borderRadius: radiusInner }}>
                  <div className="text-sm font-semibold">Documents</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Create text docs or link docs to uploaded media.
                  </div>
                </div>
                <div className="border bg-background p-4" style={{ borderRadius: radiusInner }}>
                  <div className="text-sm font-semibold">Comments</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Capture feedback right next to the content.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        <Card style={{ borderRadius: radiusCard }}>
          <CardHeader>
            <CardTitle className="text-base">Workspaces</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Keep projects separated and controlled with workspace membership.
          </CardContent>
        </Card>
        <Card style={{ borderRadius: radiusCard }}>
          <CardHeader>
            <CardTitle className="text-base">Upload & organize</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Store media in one library, filter by type, and paginate results.
          </CardContent>
        </Card>
        <Card style={{ borderRadius: radiusCard }}>
          <CardHeader>
            <CardTitle className="text-base">Feedback built-in</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Discuss content with comments tied directly to each media item.
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto mt-12 max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border bg-card p-6" style={{ borderRadius: radiusCard }}>
            <h2 className="text-lg font-semibold">How it works</h2>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>Create an account and generate a workspace.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>Upload media and create documents for your project.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>Invite members and assign roles for controlled access.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>Collect feedback using comments where the work lives.</span>
              </li>
            </ol>
            <div className="mt-6 flex gap-3">
              <Button asChild>
                <Link href="/features">Explore features</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>

          <div className="border bg-card p-6" style={{ borderRadius: radiusCard }}>
            <h2 className="text-lg font-semibold">Built for real permissions</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              ACC uses role-based access so the right people can upload, review, and manage
              workspace membership.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="border bg-background p-4" style={{ borderRadius: radiusInner }}>
                <div className="text-sm font-semibold">Owners & admins</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Manage members, roles, and workspace settings.
                </div>
              </div>
              <div className="border bg-background p-4" style={{ borderRadius: radiusInner }}>
                <div className="text-sm font-semibold">Editors & reviewers</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Contribute content and collaborate with comments.
                </div>
              </div>
              <div className="border bg-background p-4" style={{ borderRadius: radiusInner }}>
                <div className="text-sm font-semibold">Viewers</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Access shared content with least privilege.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-5xl">
        <div className="border bg-card p-6" style={{ borderRadius: radiusCard }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Start your first workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an account and begin organizing content today.
              </p>
            </div>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
