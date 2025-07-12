"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { HeroSection } from "@/components/hero-section"
import { Navigation } from "@/components/navigation"
import { LoadingSpinner } from "@/components/loading-spinner"

const SceneCanvas = dynamic(() => import("@/components/scene-canvas"), { ssr: false })

export default function Home() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D Background Canvas – client only */}
      <SceneCanvas />

      {/* UI Overlay */}
      <div className="relative z-10 w-full h-full">
        <Navigation />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="flex items-center justify-center h-full px-4"
        >
          {/* Centered Hero Section */}
          <HeroSection />
        </motion.div>
      </div>

      {/* Loading Spinner */}
      <Suspense fallback={<LoadingSpinner />}>
        <div />
      </Suspense>
    </div>
  )
}
