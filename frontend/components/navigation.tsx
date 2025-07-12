"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, User, Bell, Search, Menu, Home, BarChart3 } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavigationProps {
  onPanelChange?: (panel: string | null) => void
  activePanel?: string | null
}

export function Navigation({ onPanelChange, activePanel }: NavigationProps) {
  const [notifications] = useState(3)
  const pathname = usePathname()

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute top-0 left-0 right-0 z-20 p-6"
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-black font-bold text-lg">A</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">AgentOrchestra</h1>
            <p className="text-orange-500 text-sm font-medium">AI Agent Orchestration Platform</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className={`text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all ${
                pathname === "/" ? "bg-orange-500/20 text-orange-500" : ""
              }`}
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className={`text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all ${
                pathname === "/dashboard" ? "bg-orange-500/20 text-orange-500" : ""
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>

        {/* Enhanced Navigation Items */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full">
            <Search className="w-4 h-4" />
          </Button>

          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full">
              <Bell className="w-4 h-4" />
            </Button>
            {notifications > 0 && (
              <Badge className="absolute -top-1 -right-1 bg-orange-500 text-black text-xs min-w-5 h-5 flex items-center justify-center p-0">
                {notifications}
              </Badge>
            )}
          </div>

          {/* Profile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPanelChange?.(activePanel === "profile" ? null : "profile")}
            className={`text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all ${
              activePanel === "profile" ? "bg-orange-500/20 text-orange-500" : ""
            }`}
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </Button>

          {/* Settings - Only show on dashboard */}
          {pathname === "/dashboard" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPanelChange?.(activePanel === "settings" ? null : "settings")}
              className={`text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all ${
                activePanel === "settings" ? "bg-orange-500/20 text-orange-500" : ""
              }`}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          )}

          {/* Menu */}
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full">
            <Menu className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.nav>
  )
}
