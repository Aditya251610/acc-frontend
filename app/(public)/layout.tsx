import PublicNavbar from "@/components/public-navbar"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className="relative z-20">
        <PublicNavbar />
      </div>
      <main className="relative z-10">{children}</main>
    </>
  )
}
