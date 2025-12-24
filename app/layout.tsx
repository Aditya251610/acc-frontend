import "./globals.css"
import { BackgroundRippleEffect } from "@/components/ui/background-ripple-effect"
import { AuthProvider } from "@/lib/auth-context"
import { Montserrat, Poppins, DM_Sans, Nunito } from "next/font/google"
import { Toaster } from "sonner"

const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-montserrat" })
const poppins = Poppins({ subsets: ["latin"], weight: ["600"], variable: "--font-poppins" })
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-dm-sans" })
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-nunito" })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${montserrat.variable} ${poppins.variable} ${dmSans.variable} ${nunito.variable}`}
    >
      <body className="relative min-h-screen overflow-x-hidden overflow-y-auto" suppressHydrationWarning>
        <AuthProvider>
          <div className="absolute inset-0 z-0 pointer-events-none">
            <BackgroundRippleEffect />
          </div>

          <main className="relative z-10">
            {children}
          </main>
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  )
}
