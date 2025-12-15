import Link from "next/link"

// TEMP — replace with real auth later
const isAuthenticated = false

export default function Navbar() {
  return (
    <header className="w-full border-b bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <span className="font-semibold text-primary">YourOrg</span>

        {isAuthenticated ? (
          // PROTECTED NAV
          <nav className="flex gap-6 text-sm font-medium">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/videos">Videos</Link>
            <Link href="/audios">Audios</Link>
          </nav>
        ) : (
          // BRANDING NAV
          <nav className="flex gap-6 text-sm">
            <Link href="/">Home</Link>
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Login</Link>
          </nav>
        )}
      </div>
    </header>
  )
}
