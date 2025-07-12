"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Settings, X, Save, RotateCcw, Zap } from "lucide-react"

export function ConfigurationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState({
    agentCount: [3],
    temperature: [0.7],
    maxTokens: [2048],
    enableLogging: true,
    autoRetry: false,
  })

  const resetConfig = () => {
    setConfig({
      agentCount: [3],
      temperature: [0.7],
      maxTokens: [2048],
      enableLogging: true,
      autoRetry: false,
    })
  }

  return (
    <>
      {/* Enhanced Toggle Button */}
      <motion.div
        className="fixed bottom-24 right-8 z-20 pointer-events-auto"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.5 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-black rounded-full p-4 shadow-lg hover:shadow-orange-500/25 transition-all duration-300"
        >
          <Settings className="w-6 h-6" />
        </Button>
        <Badge className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs">Config</Badge>
      </motion.div>

      {/* Enhanced Configuration Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 pointer-events-auto"
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-black/90 backdrop-blur-md border-l border-white/20"
            >
              <div className="p-6 h-full overflow-y-auto">
                {/* Enhanced Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                      <Settings className="w-4 h-4 text-black" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Configuration</h2>
                      <p className="text-orange-500 text-sm">Agent Settings</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="ghost"
                    size="sm"
                    className="text-white/60 hover:text-white rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Enhanced Configuration Options */}
                <div className="space-y-6">
                  {/* Agent Count */}
                  <Card className="bg-white/5 border-white/10 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-white font-medium">Agent Count</Label>
                      <Badge variant="outline" className="border-orange-500/50 text-orange-500">
                        {config.agentCount[0]} agents
                      </Badge>
                    </div>
                    <Slider
                      value={config.agentCount}
                      onValueChange={(value) => setConfig((prev) => ({ ...prev, agentCount: value }))}
                      max={10}
                      min={1}
                      step={1}
                      className="mb-2"
                    />
                    <p className="text-white/60 text-sm">Number of concurrent agents to deploy</p>
                  </Card>

                  {/* Temperature */}
                  <Card className="bg-white/5 border-white/10 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-white font-medium">Temperature</Label>
                      <Badge variant="outline" className="border-blue-500/50 text-blue-500">
                        {config.temperature[0]}
                      </Badge>
                    </div>
                    <Slider
                      value={config.temperature}
                      onValueChange={(value) => setConfig((prev) => ({ ...prev, temperature: value }))}
                      max={2}
                      min={0}
                      step={0.1}
                      className="mb-2"
                    />
                    <p className="text-white/60 text-sm">Controls randomness in AI responses</p>
                  </Card>

                  {/* Max Tokens */}
                  <Card className="bg-white/5 border-white/10 p-6">
                    <Label className="text-white mb-3 block font-medium">Max Tokens</Label>
                    <Input
                      type="number"
                      value={config.maxTokens[0]}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxTokens: [Number.parseInt(e.target.value) || 2048],
                        }))
                      }
                      className="bg-white/10 border-white/20 text-white mb-2"
                    />
                    <p className="text-white/60 text-sm">Maximum tokens per response</p>
                  </Card>

                  {/* Enhanced Switches */}
                  <div className="space-y-4">
                    <Card className="bg-white/5 border-white/10 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white font-medium">Enable Logging</Label>
                          <p className="text-white/60 text-sm">Track agent activities and performance</p>
                        </div>
                        <Switch
                          checked={config.enableLogging}
                          onCheckedChange={(checked) =>
                            setConfig((prev) => ({
                              ...prev,
                              enableLogging: checked,
                            }))
                          }
                        />
                      </div>
                    </Card>

                    <Card className="bg-white/5 border-white/10 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white font-medium">Auto Retry</Label>
                          <p className="text-white/60 text-sm">Automatically retry failed operations</p>
                        </div>
                        <Switch
                          checked={config.autoRetry}
                          onCheckedChange={(checked) =>
                            setConfig((prev) => ({
                              ...prev,
                              autoRetry: checked,
                            }))
                          }
                        />
                      </div>
                    </Card>
                  </div>

                  {/* Enhanced Action Buttons */}
                  <div className="space-y-3">
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-black font-semibold">
                      <Zap className="w-4 h-4 mr-2" />
                      Apply Configuration
                    </Button>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={resetConfig}
                        className="border-white/20 text-white hover:bg-white/10 bg-transparent"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
