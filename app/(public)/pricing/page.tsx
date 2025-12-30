import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Plan = {
  name: string
  priceLabel: string
  description: string
  bullets: string[]
  cta: { label: string; href: string; variant?: "default" | "outline" }
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    priceLabel: "Free",
    description: "For personal projects and quick trials.",
    bullets: ["1 workspace", "Basic media uploads", "Documents & comments"],
    cta: { label: "Get started", href: "/signup" },
  },
  {
    name: "Team",
    priceLabel: "Contact us",
    description: "For teams that need shared access and controls.",
    bullets: ["Multiple members", "Role management", "Shared media library"],
    cta: { label: "Sign up", href: "/signup", variant: "outline" },
  },
  {
    name: "Enterprise",
    priceLabel: "Contact us",
    description: "For larger orgs with advanced requirements.",
    bullets: ["Custom policies", "Support", "Deployment options"],
    cta: { label: "Talk to us", href: "/signup", variant: "outline" },
  },
] as const

export default function PricingPage() {
  const radiusCard = 24

  return (
    <div className="container mx-auto px-6 pb-16 pt-24">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-3 text-muted-foreground">
          Pick a plan that fits your workflow. Upgrade anytime.
        </p>
      </section>

      <section className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.name} className="h-full" style={{ borderRadius: radiusCard }}>
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
              <div className="mt-2 text-2xl font-bold">{p.priceLabel}</div>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Button asChild variant={p.cta.variant ?? "default"} className="w-full">
                  <Link href={p.cta.href}>{p.cta.label}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto mt-12 max-w-5xl">
        <div className="border bg-card p-6" style={{ borderRadius: radiusCard }}>
          <h2 className="text-lg font-semibold">Already have an account?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Login to access your dashboard and workspace.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
