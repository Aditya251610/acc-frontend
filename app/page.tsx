import PublicNavbar from "@/components/public-navbar"

export default function HomePage() {
  return (
    <>
      <div className="relative z-20">
        <PublicNavbar />
      </div>
      <div className="flex min-h-[80vh] items-center justify-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome to <span className="text-primary">ACC</span>
        </h1>
      </div>
    </>
  )
}
