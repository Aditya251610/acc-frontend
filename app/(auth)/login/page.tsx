"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import axios from "axios"

const loginSchema = z.object({
  username: z.string().min(5, "Enter a valid username"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showSessionExpired, setShowSessionExpired] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if session expired
    const expired = localStorage.getItem('sessionExpired')
    if (expired === 'true') {
      setShowSessionExpired(true)
      localStorage.removeItem('sessionExpired')
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => setShowSessionExpired(false), 5000)
    }
  }, [])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  
async function onSubmit(values: LoginFormValues) {
  // Build form data
  const params = new URLSearchParams();
  params.append("username", values.username);
  params.append("password", values.password);

  try {
    const response = await axios.post(
      "http://localhost:8000/auth/token",
      params,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    console.log("Login Successful:", response.data);
    localStorage.setItem("authToken", response.data.access_token)
    // Trigger auth state update
    window.dispatchEvent(new Event('authChange'))
    router.push("/dashboard")
  } catch (error: any) {
    console.error(
      "Login failed:",
           error.response?.status,
      error.response?.data ?? error.message
    );
  }
}

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        {showSessionExpired && (
          <Alert variant="destructive" style={{ borderRadius: '0.75rem' }}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Session Expired</AlertTitle>
            <AlertDescription>
              Your session has expired. Please login again to continue.
            </AlertDescription>
          </Alert>
        )}
        
        <div style={{ borderRadius: '1rem' }} className="border bg-card p-6 space-y-6 shadow-lg">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold">Login</h1>
            <p className="text-muted-foreground">
              Enter your email and password
            </p>
          </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="JohnDoe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" style={{ borderRadius: '0.5rem' }}>
              Login
            </Button>
          </form>
        </Form>

          <p className="text-center text-sm">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
