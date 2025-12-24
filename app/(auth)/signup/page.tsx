"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

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
import axios from "axios"
import { toast } from "sonner"
import { apiUrl } from "@/lib/api"

const signupSchema = z.object({
  username: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type SignupFormValues = z.infer<typeof signupSchema>

export default function SignupPage() {

  const router = useRouter()

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: SignupFormValues) {
    try {
      await axios.post(apiUrl("/auth/"), values)
      // mark success and redirect to login
      localStorage.setItem('signupSuccess', 'true')
      router.push("/login")
    } catch (error: unknown) {
      // Robust error handling for axios/network/server errors
      const isAxios = axios.isAxiosError(error)
      const status = isAxios ? error.response?.status : undefined
      const data = isAxios ? error.response?.data : undefined

      // Log for debugging (still safe)
      console.warn(
        "Signup failed:",
        isAxios ? (data || error.message) : error instanceof Error ? error.message : error,
      )

      // Conflict - user exists
      if (status === 409 || /already exist/i.test(String(data?.detail || data || ''))) {
        toast.error('User already exist')
        router.push('/login')
        return
      }

      // Validation errors (400) - show messages if available
      if (status === 400 && data) {
        // common shapes: { detail: 'msg' } or { errors: [...] } or { field: ['err'] }
        if (typeof data.detail === 'string') {
          toast.error(data.detail)
        } else if (Array.isArray(data.errors) && data.errors.length) {
          toast.error(String(data.errors[0]))
        } else if (typeof data === 'object') {
          // pick first field error
          const first = Object.values(data)[0]
          if (Array.isArray(first) && first.length) toast.error(String(first[0]))
          else toast.error(String(first))
        } else {
          toast.error(
            (error instanceof Error ? error.message : undefined) || 'Signup failed',
          )
        }
        return
      }

      // Fallback message
      const detail =
        isAxios &&
        data &&
        typeof data === "object" &&
        "detail" in data
          ? String((data as Record<string, unknown>).detail)
          : undefined

      toast.error(detail || (error instanceof Error ? error.message : undefined) || 'Signup failed')
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div style={{ borderRadius: '1rem' }} className="w-full max-w-md border bg-card p-6 space-y-6 shadow-lg">
        
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="text-muted-foreground">
            Enter your details to get started
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} />
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

            <Button type="submit" className="w-full text-white" style={{ borderRadius: '0.5rem', backgroundColor: '#6F26D4' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5B1FB2'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6F26D4'}>
              Sign up
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
