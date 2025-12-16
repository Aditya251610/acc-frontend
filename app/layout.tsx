import "./globals.css"
import { BackgroundRippleEffect } from "@/components/ui/background-ripple-effect"
import { AuthProvider } from "@/lib/auth-context"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="relative min-h-screen overflow-hidden">
        <AuthProvider>
          <div className="absolute inset-0 z-0 pointer-events-none">
            <BackgroundRippleEffect />
          </div>

          <main className="relative z-10">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
