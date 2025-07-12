"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart3, Activity, Terminal, X, Maximize2, RefreshCw } from "lucide-react"

const logs = [
  { id: 1, timestamp: "14:32:15", level: "INFO", message: "Agent initialized successfully", agent: "Agent-001" },
  { id: 2, timestamp: "14:32:18", level: "SUCCESS", message: "Task completed: Data analysis", agent: "Agent-003" },
  { id: 3, timestamp: "14:32:22", level: "WARNING", message: "Rate limit approaching", agent: "Agent-002" },
  { id: 4, timestamp: "14:32:25", level: "INFO", message: "New task queued", agent: "Agent-001" },
  { id: 5, timestamp: "14:32:28", level: "ERROR", message: "Connection timeout", agent: "Agent-004" },
]

const performanceMetrics = [
  { name: "CPU Usage", value: 75, color: "bg-orange-500", status: "normal" },
  { name: "Memory", value: 50, color: "bg-green-500", status: "good" },
  { name: "Network", value: 25, color: "bg-blue-500", status: "excellent" },
  { name: "Storage", value: 85, color: "bg-yellow-500", status: "warning" },
]

export function DashboardOverlay() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Enhanced Toggle Button */}
      <motion.div
        className="fixed bottom-8 left-8 z-20 pointer-events-auto"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-full p-4 shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
        >
          <BarChart3 className="w-6 h-6" />
        </Button>
        <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-xs">Live</Badge>
      </motion.div>

      {/* Enhanced Dashboard Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 pointer-events-auto"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 h-2/3 bg-black/90 backdrop-blur-md border-t border-white/20 rounded-t-2xl"
            >
              <div className="p-6 h-full">
                {/* Enhanced Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Mission Control</h2>
                      <p className="text-blue-500 text-sm">Real-time monitoring</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => setIsOpen(false)}
                      variant="ghost"
                      size="sm"
                      className="text-white/60 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  {/* Enhanced Performance Metrics */}
                  <Card className="bg-white/5 border-white/10 p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                      <h3 className="text-lg font-semibold text-white">System Performance</h3>
                      <Badge className="bg-green-500/20 text-green-500 text-xs">Healthy</Badge>
                    </div>

                    <div className="space-y-6">
                      {performanceMetrics.map((metric) => (
                        <div key={metric.name} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 font-medium">{metric.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-xs border-0 ${
                                  metric.status === "excellent"
                                    ? "bg-green-500/20 text-green-400"
                                    : metric.status === "good"
                                      ? "bg-blue-500/20 text-blue-400"
                                      : metric.status === "normal"
                                        ? "bg-orange-500/20 text-orange-400"
                                        : "bg-yellow-500/20 text-yellow-400"
                                }`}
                              >
                                {metric.status}
                              </Badge>
                              <span className="text-white font-bold">{metric.value}%</span>
                            </div>
                          </div>
                          <Progress value={metric.value} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Enhanced Real-time Logs */}
                  <Card className="bg-white/5 border-white/10 p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Terminal className="w-5 h-5 text-green-500" />
                      <h3 className="text-lg font-semibold text-white">Real-time Logs</h3>
                      <Badge className="bg-blue-500/20 text-blue-500 text-xs">Live</Badge>
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 text-sm p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <span className="text-white/40 font-mono text-xs">{log.timestamp}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${
                              log.level === "SUCCESS"
                                ? "border-green-500 text-green-500 bg-green-500/10"
                                : log.level === "WARNING"
                                  ? "border-yellow-500 text-yellow-500 bg-yellow-500/10"
                                  : log.level === "ERROR"
                                    ? "border-red-500 text-red-500 bg-red-500/10"
                                    : "border-blue-500 text-blue-500 bg-blue-500/10"
                            }`}
                          >
                            {log.level}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-white/80 truncate">{log.message}</p>
                            <p className="text-white/40 text-xs">{log.agent}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
