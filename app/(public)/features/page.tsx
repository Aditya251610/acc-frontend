import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const FEATURES = [
  {
    title: "Role-based access",
    description: "Keep control with workspace roles like owner, admin, editor, reviewer, and viewer.",
  },
  {
    title: "Media upload & download",
    description: "Upload files to a workspace and download them securely when you need them.",
  },
  {
    title: "Documents",
    description: "Create text documents or link documents to uploaded files for structured content.",
  },
  {
    title: "Comments",
    description: "Leave feedback and discuss media or documents with workspace comments.",
  },
  {
    title: "Search & filtering",
    description: "Filter media by filename/type and paginate results for faster browsing.",
  },
  {
    title: "Simple admin workflows",
    description: "Add/remove members, update roles, and manage workspace access in one place.",
  },
] as const

export default function FeaturesPage() {
  const radiusCard = 24

  return (
    <div className="container mx-auto px-6 pb-16 pt-24">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight">Features</h1>
        <p className="mt-3 text-muted-foreground">
          Everything you need to collaborate on media and documents inside a workspace.
        </p>
      </section>

      <section className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} style={{ borderRadius: radiusCard }}>
            <CardHeader>
              <CardTitle className="text-base">{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{f.description}</CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto mt-12 max-w-5xl">
        <div className="border bg-card p-6" style={{ borderRadius: radiusCard }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Start with a workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign up, create a workspace, and invite members.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
