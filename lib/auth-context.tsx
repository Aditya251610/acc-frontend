'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
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
  const router = useRouter()
  const pathname = usePathname()

  const checkAuth = () => {
    const token = localStorage.getItem('authToken')
    
    if (!token) {
      setIsAuthenticated(false)
      setLoading(false)
      return
    }

    // Check if token is expired
    if (isTokenExpired(token)) {
      localStorage.removeItem('authToken')
      localStorage.setItem('sessionExpired', 'true')
      setIsAuthenticated(false)
      setLoading(false)
      
      // Only redirect if not already on auth pages
      if (!pathname?.startsWith('/login') && !pathname?.startsWith('/signup')) {
        router.push('/login')
      }
      return
    }

    setIsAuthenticated(true)
    setLoading(false)
  }

  useEffect(() => {
    checkAuth()
    
    // Check token expiry every minute
    const interval = setInterval(checkAuth, 60000)
    
    // Listen for storage changes (useful for multi-tab scenarios)
    window.addEventListener('storage', checkAuth)
    
    // Custom event for same-tab changes
    window.addEventListener('authChange', checkAuth)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', checkAuth)
      window.removeEventListener('authChange', checkAuth)
    }
  }, [pathname, router])

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading }}>
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
