"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bot, Network, Activity, Save, TrendingUp, TrendingDown } from "lucide-react"

const metrics = [
  {
    icon: Bot,
    label: "Active Agents",
    value: "24",
    change: "+23%",
    trend: "up",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    description: "Currently running",
  },
  {
    icon: Network,
    label: "Frameworks",
    value: "8",
    change: "+2",
    trend: "up",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Available integrations",
  },
  {
    icon: Activity,
    label: "Executions",
    value: "1.2K",
    change: "+156%",
    trend: "up",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    description: "This month",
  },
  {
    icon: Save,
    label: "Saved Configs",
    value: "12",
    change: "0",
    trend: "neutral",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Ready to deploy",
  },
]

export function MetricsCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
        >
          <Card className="bg-white/5 backdrop-blur-md border-white/10 p-6 text-center hover:bg-white/10 transition-all duration-300 group">
            <div className="flex flex-col items-center space-y-4">
              {/* Icon with enhanced styling */}
              <div
                className={`p-4 rounded-xl ${metric.bgColor} ${metric.color} group-hover:scale-110 transition-transform duration-300`}
              >
                <metric.icon className="w-6 h-6" />
              </div>

              {/* Value and Label */}
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <p className={`text-3xl font-bold ${metric.color}`}>{metric.value}</p>
                  {metric.change !== "0" && (
                    <Badge
                      variant="outline"
                      className={`text-xs border-0 ${
                        metric.trend === "up"
                          ? "bg-green-500/20 text-green-400"
                          : metric.trend === "down"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {metric.trend === "up" && <TrendingUp className="w-3 h-3 mr-1" />}
                      {metric.trend === "down" && <TrendingDown className="w-3 h-3 mr-1" />}
                      {metric.change}
                    </Badge>
                  )}
                </div>
                <p className="text-white/60 text-sm font-medium">{metric.label}</p>
                <p className="text-white/40 text-xs">{metric.description}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
