"use client"

import { motion } from "framer-motion"

export function LoadingSpinner() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="text-center">
        <motion.div
          className="w-16 h-16 border-4 border-white/20 border-t-orange-500 rounded-full mx-auto mb-4"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/60">
          Loading AI Orchestration Platform...
        </motion.p>
      </div>
    </div>
  )
}
