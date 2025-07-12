"use client"

import { Suspense, useState } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { Navigation } from "@/components/navigation"
import { LoadingSpinner } from "@/components/loading-spinner"
import { MetricsCards } from "@/components/metrics-cards"
import { FrameworkGrid } from "@/components/framework-grid"
import { ConfigurationPanel } from "@/components/configuration-panel"
import { DashboardOverlay } from "@/components/dashboard-overlay"
import { ProfilePanel } from "@/components/profile-panel"
import { SettingsPanel } from "@/components/settings-panel"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Bot, Network, Settings, BarChart3, TrendingUp, Server, Clock } from "lucide-react"

const SceneCanvas = dynamic(() => import("@/components/scene-canvas"), { ssr: false })

export default function Dashboard() {
  const [activePanel, setActivePanel] = useState<string | null>(null)

  return (
    <div className="relative w-full min-h-screen bg-black">
      {/* 3D Background Canvas – client only */}
      <div className="fixed inset-0 opacity-30">
        <SceneCanvas />
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 w-full min-h-screen">
        <Navigation onPanelChange={setActivePanel} activePanel={activePanel} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="pt-24 pb-8 px-6"
        >
          <div className="max-w-7xl mx-auto">
            {/* Dashboard Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">
                    <span className="text-orange-500">Agent</span> Dashboard
                  </h1>
                  <p className="text-white/60">Monitor and manage your AI agent orchestration</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                    Live
                  </Badge>
                  <Button
                    variant="outline"
                    className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10 bg-transparent"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                </div>
              </div>
            </div>

            {/* Enhanced Metrics Overview */}
            <div className="mb-8">
              <MetricsCards />
            </div>

            {/* Main Dashboard Content */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-white/5 border-white/10">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="agents"
                  className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Agents
                </TabsTrigger>
                <TabsTrigger
                  value="frameworks"
                  className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500"
                >
                  <Network className="w-4 h-4 mr-2" />
                  Frameworks
                </TabsTrigger>
                <TabsTrigger
                  value="monitoring"
                  className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500"
                >
                  <Server className="w-4 h-4 mr-2" />
                  Monitoring
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Performance Overview */}
                  <Card className="bg-white/5 backdrop-blur-md border-white/10 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-white">System Performance</h3>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Real-time</Badge>
                    </div>
                    <div className="space-y-4">
                      {[
                        { label: "CPU Usage", value: 68, color: "bg-orange-500" },
                        { label: "Memory", value: 45, color: "bg-blue-500" },
                        { label: "Network", value: 23, color: "bg-green-500" },
                        { label: "Storage", value: 78, color: "bg-purple-500" },
                      ].map((metric) => (
                        <div key={metric.label} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/80">{metric.label}</span>
                            <span className="text-white font-medium">{metric.value}%</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${metric.value}%` }}
                              transition={{ duration: 1, delay: 0.2 }}
                              className={`h-2 rounded-full ${metric.color}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Recent Activity */}
                  <Card className="bg-white/5 backdrop-blur-md border-white/10 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
                      <Button variant="ghost" size="sm" className="text-orange-500 hover:bg-orange-500/10">
                        View All
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {[
                        {
                          action: "Agent deployed successfully",
                          time: "2 minutes ago",
                          status: "success",
                          icon: Bot,
                        },
                        {
                          action: "Configuration updated",
                          time: "5 minutes ago",
                          status: "info",
                          icon: Settings,
                        },
                        {
                          action: "Performance threshold reached",
                          time: "12 minutes ago",
                          status: "warning",
                          icon: TrendingUp,
                        },
                        {
                          action: "New framework integrated",
                          time: "1 hour ago",
                          status: "success",
                          icon: Network,
                        },
                      ].map((activity, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div
                            className={`p-2 rounded-full ${
                              activity.status === "success"
                                ? "bg-green-500/20 text-green-400"
                                : activity.status === "warning"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            <activity.icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white text-sm">{activity.action}</p>
                            <p className="text-white/60 text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {activity.time}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Quick Actions */}
                <Card className="bg-white/5 backdrop-blur-md border-white/10 p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">Quick Actions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Deploy Agent", icon: Bot, color: "from-orange-500 to-red-500" },
                      { label: "Add Framework", icon: Network, color: "from-blue-500 to-purple-500" },
                      { label: "View Logs", icon: Activity, color: "from-green-500 to-teal-500" },
                      { label: "Configure", icon: Settings, color: "from-purple-500 to-pink-500" },
                    ].map((action, index) => (
                      <motion.div
                        key={action.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Button
                          variant="outline"
                          className="w-full h-20 flex-col gap-2 border-white/20 hover:bg-white/10 group bg-transparent"
                        >
                          <div
                            className={`p-3 rounded-xl bg-gradient-to-r ${action.color} group-hover:scale-110 transition-transform`}
                          >
                            <action.icon className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-white/80 text-sm">{action.label}</span>
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="agents" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Agent Status Cards */}
                  {[
                    { name: "GPT-4 Assistant", status: "Running", framework: "OpenAI", uptime: "99.9%" },
                    { name: "Data Analyzer", status: "Idle", framework: "LangChain", uptime: "98.5%" },
                    { name: "Task Scheduler", status: "Running", framework: "CrewAI", uptime: "99.2%" },
                    { name: "Content Generator", status: "Stopped", framework: "AutoGPT", uptime: "97.8%" },
                    { name: "Code Reviewer", status: "Running", framework: "LangGraph", uptime: "99.7%" },
                    { name: "Email Processor", status: "Running", framework: "TaskWeaver", uptime: "98.9%" },
                  ].map((agent, index) => (
                    <motion.div
                      key={agent.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="bg-white/5 backdrop-blur-md border-white/10 p-6 hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-white font-semibold">{agent.name}</h4>
                          <Badge
                            className={`${
                              agent.status === "Running"
                                ? "bg-green-500/20 text-green-400 border-green-500/50"
                                : agent.status === "Idle"
                                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                                  : "bg-red-500/20 text-red-400 border-red-500/50"
                            }`}
                          >
                            {agent.status}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/60">Framework:</span>
                            <span className="text-white">{agent.framework}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">Uptime:</span>
                            <span className="text-green-400">{agent.uptime}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-white/20 text-white hover:bg-white/10 bg-transparent"
                          >
                            Configure
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10 bg-transparent"
                          >
                            <Activity className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="frameworks">
                <FrameworkGrid />
              </TabsContent>

              <TabsContent value="monitoring">
                <DashboardOverlay />
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>

        {/* Configuration Panel */}
        <ConfigurationPanel />

        {/* Profile Panel */}
        <ProfilePanel isOpen={activePanel === "profile"} onClose={() => setActivePanel(null)} />

        {/* Settings Panel */}
        <SettingsPanel isOpen={activePanel === "settings"} onClose={() => setActivePanel(null)} />
      </div>

      {/* Loading Spinner */}
      <Suspense fallback={<LoadingSpinner />}>
        <div />
      </Suspense>
    </div>
  )
}
