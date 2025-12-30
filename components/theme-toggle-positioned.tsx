'use client'

import { usePathname } from 'next/navigation'

import ThemeToggle from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

function isPublicRoute(pathname: string) {
  if (pathname === '/') return true
  return (
    pathname.startsWith('/features') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup')
  )
}

export default function ThemeTogglePositioned({ compact = true }: { compact?: boolean }) {
  const pathname = usePathname() || '/'
  const onPublic = isPublicRoute(pathname)

  return (
    <div
      className={cn(
        'fixed z-50 right-4',
        onPublic ? 'bottom-4' : 'bottom-4 sm:bottom-auto sm:top-4',
      )}
    >
      <ThemeToggle compact={compact} />
    </div>
  )
}
