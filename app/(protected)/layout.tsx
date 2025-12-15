export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="p-6">
      {children}
    </main>
  )
}
