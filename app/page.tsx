import PublicNavbar from "@/components/public-navbar"

export default function HomePage() {
  return (
    <>
      <div className="relative z-20">
        <PublicNavbar />
      </div>
      <div className="flex min-h-[80vh] items-center justify-center">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-foreground">
          Welcome to <img src="/acc_logo.png" alt="ACC" className="h-8 w-auto inline-block" />
        </h1>
      </div>
    </>
  )
}
