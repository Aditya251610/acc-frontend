"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SignupPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="text-muted-foreground">
            Enter your details to get started
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" />
          </div>

          <Button className="w-full">Sign up</Button>
        </div>

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
