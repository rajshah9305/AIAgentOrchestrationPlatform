"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Play, Zap, ArrowRight } from "lucide-react"
import Link from "next/link"

export function HeroSection() {
  return (
    <div className="text-center max-w-4xl mx-auto">
      {/* Main Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="text-6xl md:text-8xl font-bold mb-6 leading-tight"
      >
        <span className="text-orange-500">Orchestrate</span>
        <br />
        <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
          AI Agents
        </span>
      </motion.h1>

      {/* Description */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="space-y-4 mb-12"
      >
        <p className="text-xl text-white/80 max-w-2xl mx-auto">
          Deploy, configure, and monitor AI agents across multiple frameworks with enterprise-grade reliability.
        </p>
        <p className="text-lg text-orange-500 font-medium">Build intelligent systems that work together seamlessly.</p>
      </motion.div>

      {/* Enhanced CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-4 justify-center items-center"
      >
        <Link href="/dashboard">
          <Button
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-black font-semibold px-8 py-4 text-lg rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-orange-500/25"
          >
            <Zap className="w-5 h-5 mr-2" />
            Start Building
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>

        <Button
          variant="outline"
          size="lg"
          className="border-white/20 text-white hover:bg-white/10 px-8 py-4 text-lg rounded-full backdrop-blur-sm transition-all duration-300 bg-transparent hover:border-orange-500/50"
        >
          <Play className="w-5 h-5 mr-2" />
          View Demo
        </Button>
      </motion.div>
    </div>
  )
}
