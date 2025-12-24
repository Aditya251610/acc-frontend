'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clearAuthToken, clearWorkspaceId, getAuthToken, getAuthUserId } from '@/lib/api'

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  token: string | null
  userId: string | null
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper to decode JWT and check expiry
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000 // Convert to milliseconds
    return Date.now() >= exp
  } catch {
    return true // Invalid token format
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const logout = useCallback(() => {
    clearAuthToken()
    clearWorkspaceId()
    setToken(null)
    setIsAuthenticated(false)
    setLoading(false)
    if (!pathname?.startsWith('/login') && !pathname?.startsWith('/signup')) {
      router.push('/login')
    }
  }, [pathname, router])

  const checkAuth = useCallback(() => {
    const nextToken = getAuthToken()
    
    if (!nextToken) {
      setIsAuthenticated(false)
      setToken(null)
      setLoading(false)
      return
    }

    // Check if token is expired
    if (isTokenExpired(nextToken)) {
      clearAuthToken()
      clearWorkspaceId()
      localStorage.setItem('sessionExpired', 'true')
      setIsAuthenticated(false)
      setToken(null)
      setLoading(false)
      
      // Only redirect if not already on auth pages
      if (!pathname?.startsWith('/login') && !pathname?.startsWith('/signup')) {
        router.push('/login')
      }
      return
    }

    setIsAuthenticated(true)
    setToken(nextToken)
    setLoading(false)
  }, [pathname, router])

  useEffect(() => {
    const t = setTimeout(checkAuth, 0)

    // Check token expiry every minute
    const interval = setInterval(checkAuth, 60000)
    
    // Listen for storage changes (useful for multi-tab scenarios)
    window.addEventListener('storage', checkAuth)
    
    // Custom event for same-tab changes
    window.addEventListener('authChange', checkAuth)
    
    return () => {
      clearTimeout(t)
      clearInterval(interval)
      window.removeEventListener('storage', checkAuth)
      window.removeEventListener('authChange', checkAuth)
    }
  }, [checkAuth])

  const userId = useMemo(() => {
    if (!token) return null
    return getAuthUserId()
  }, [token])

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, token, userId, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
