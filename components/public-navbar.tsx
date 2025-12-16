'use client'

import { useState } from "react"
import Link from "next/link"
import {
  Navbar as ResizableNavbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavbarButton,
} from "@/components/ui/resizable-navbar"

const navItems = [
  { name: "Home", link: "/" },
  { name: "Features", link: "/features" },
  { name: "Pricing", link: "/pricing" },
]

export default function PublicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <ResizableNavbar className="top-0">
      <NavBody>
        <Link
          href="/"
          className="relative z-20 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-black dark:text-white"
        >
          <span>ACC</span>
        </Link>

        <NavItems items={navItems} />

        <div className="hidden items-center gap-2 lg:flex">
          <NavbarButton as={Link} href="/login" variant="secondary">
            Login
          </NavbarButton>
          <NavbarButton as={Link} href="/signup" variant="dark">
            Sign Up
          </NavbarButton>
        </div>
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <Link
            href="/"
            className="relative z-20 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-black dark:text-white"
          >
            <span>ACC</span>
          </Link>

          <MobileNavToggle
            isOpen={isMenuOpen}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          />
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
        >
          {navItems.map((item) => (
            <Link
              key={item.link}
              href={item.link}
              onClick={() => setIsMenuOpen(false)}
              className="w-full text-left text-base font-medium text-black hover:text-primary dark:text-white"
            >
              {item.name}
            </Link>
          ))}

          <div className="flex w-full flex-col gap-2">
            <NavbarButton
              as={Link}
              href="/login"
              variant="secondary"
              className="w-full text-left"
              onClick={() => setIsMenuOpen(false)}
            >
              Login
            </NavbarButton>
            <NavbarButton
              as={Link}
              href="/signup"
              variant="dark"
              className="w-full text-left"
              onClick={() => setIsMenuOpen(false)}
            >
              Sign Up
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </ResizableNavbar>
  )
}
