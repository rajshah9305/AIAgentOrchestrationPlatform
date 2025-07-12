"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Star, X, Zap, TrendingUp } from "lucide-react"

const frameworks = [
  {
    id: 1,
    name: "AutoGPT",
    type: "single-agent",
    difficulty: "beginner",
    rating: 4.1,
    growth: "+42%",
    description: "Autonomous GPT-4 agent that chains together LLM thoughts to autonomously achieve goals.",
    features: ["Autonomous execution", "Goal-oriented", "Memory management"],
    color: "bg-green-500",
    category: "Automation",
  },
  {
    id: 2,
    name: "TaskWeaver",
    type: "single-agent",
    difficulty: "beginner",
    rating: 4.1,
    growth: "+12%",
    description: "AI-powered task management system that creates, prioritizes, and executes tasks.",
    features: ["Task creation", "Prioritization", "Execution loop"],
    color: "bg-orange-500",
    category: "Task Management",
  },
  {
    id: 3,
    name: "LangGraph",
    type: "multi-agent",
    difficulty: "advanced",
    rating: 4.6,
    growth: "+57%",
    description: "Library for building stateful, multi-actor applications with LLMs using graph-based workflows.",
    features: ["Graph workflows", "State management", "Multi-actor"],
    color: "bg-purple-500",
    category: "Workflow",
  },
  {
    id: 4,
    name: "CrewAI",
    type: "multi-agent",
    difficulty: "intermediate",
    rating: 4.2,
    growth: "+16%",
    description: "Multi-agent framework for role-playing autonomous cooperative agents.",
    features: ["Role-playing", "Cooperative agents", "Communication protocols"],
    color: "bg-teal-500",
    category: "Collaboration",
  },
  {
    id: 5,
    name: "OpenAgents",
    type: "multi-agent",
    difficulty: "intermediate",
    rating: 4.6,
    growth: "+48%",
    description: "Open platform for using and hosting language agents in the wild.",
    features: ["Open platform", "Agent hosting", "Tool integration"],
    color: "bg-blue-500",
    category: "Platform",
  },
]

export function FrameworkGrid() {
  const [isVisible, setIsVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedDifficulty, setSelectedDifficulty] = useState("all")
  const [sortBy, setSortBy] = useState("rating")

  const filteredFrameworks = frameworks
    .filter((framework) => {
      const matchesSearch =
        framework.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        framework.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = selectedType === "all" || framework.type === selectedType
      const matchesDifficulty = selectedDifficulty === "all" || framework.difficulty === selectedDifficulty
      return matchesSearch && matchesType && matchesDifficulty
    })
    .sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "growth") return Number.parseFloat(b.growth) - Number.parseFloat(a.growth)
      return 0
    })

  return (
    <>
      {/* Enhanced Toggle Button */}
      <motion.div
        className="fixed top-1/2 right-8 transform -translate-y-1/2 z-20 pointer-events-auto"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1 }}
      >
        <Button
          onClick={() => setIsVisible(!isVisible)}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full p-4 shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
        >
          <Filter className="w-5 h-5" />
        </Button>
        <Badge className="absolute -top-2 -left-2 bg-orange-500 text-black text-xs">Frameworks</Badge>
      </motion.div>

      {/* Enhanced Framework Selection Overlay */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 pointer-events-auto"
          >
            <div className="container mx-auto px-4 py-8 h-full overflow-y-auto">
              {/* Enhanced Header */}
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-bold text-white">Select Your AI Framework</h2>
                    <p className="text-purple-500">AgentOrchestra Platform</p>
                  </div>
                </div>
                <p className="text-white/60 max-w-2xl mx-auto">
                  Choose from our comprehensive collection of AI agent frameworks, each designed for different use cases
                  and complexity levels.
                </p>
              </motion.div>

              {/* Enhanced Search and Filters */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col lg:flex-row gap-4 mb-8 max-w-6xl mx-auto"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-5 h-5" />
                  <Input
                    placeholder="Search frameworks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="flex gap-3">
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Agent Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="single-agent">Single Agent</SelectItem>
                      <SelectItem value="multi-agent">Multi Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                    <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rating">Rating</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>

              {/* Enhanced Framework Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
              >
                {filteredFrameworks.map((framework, index) => (
                  <motion.div
                    key={framework.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 hover:bg-white/15 transition-all duration-300 h-full group hover:scale-105">
                      <div className="flex flex-col h-full">
                        {/* Enhanced Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-xl ${framework.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                            >
                              {framework.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-white group-hover:text-orange-500 transition-colors">
                                {framework.name}
                              </h3>
                              <Badge variant="outline" className="border-white/20 text-white/60 text-xs">
                                {framework.category}
                              </Badge>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`${
                              framework.difficulty === "beginner"
                                ? "bg-green-500/20 text-green-500"
                                : framework.difficulty === "intermediate"
                                  ? "bg-yellow-500/20 text-yellow-500"
                                  : "bg-red-500/20 text-red-500"
                            }`}
                          >
                            {framework.difficulty}
                          </Badge>
                        </div>

                        {/* Enhanced Content */}
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-3">
                            <Badge variant="outline" className="border-white/20 text-white/60">
                              {framework.type}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-orange-500 fill-current" />
                              <span className="text-white/80 font-medium">{framework.rating}</span>
                            </div>
                            <div className="flex items-center gap-1 text-green-500">
                              <TrendingUp className="w-3 h-3" />
                              <span className="text-sm font-medium">{framework.growth}</span>
                            </div>
                          </div>

                          <p className="text-white/60 text-sm mb-4 line-clamp-3">{framework.description}</p>

                          <div className="space-y-2 mb-6">
                            <p className="text-white/80 text-sm font-medium">Key Features:</p>
                            <div className="flex flex-wrap gap-1">
                              {framework.features.map((feature) => (
                                <Badge
                                  key={feature}
                                  variant="outline"
                                  className="border-white/20 text-white/60 text-xs"
                                >
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Enhanced CTA */}
                        <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-black font-semibold group-hover:shadow-lg group-hover:shadow-orange-500/25 transition-all duration-300">
                          <Zap className="w-4 h-4 mr-2" />
                          Select Framework
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>

              {/* Enhanced Close Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="fixed top-8 right-8"
              >
                <Button
                  onClick={() => setIsVisible(false)}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 rounded-full p-3"
                >
                  <X className="w-5 h-5" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
