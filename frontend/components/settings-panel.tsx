"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { X, Settings, Palette, Bell, Shield, Zap, Monitor, Volume2, Globe } from "lucide-react"

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState({
    theme: "dark",
    notifications: true,
    soundEffects: true,
    autoSave: true,
    performanceMode: false,
    language: "en",
    refreshRate: [30],
    volume: [75],
  })

  return (
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
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                    <Settings className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Settings</h2>
                    <p className="text-orange-500 text-sm">AgentOrchestra</p>
                  </div>
                </div>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Appearance Settings */}
              <Card className="bg-white/5 border-white/10 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-orange-500" />
                  <h4 className="text-white font-semibold">Appearance</h4>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white mb-2 block">Theme</Label>
                    <Select
                      value={settings.theme}
                      onValueChange={(value) => setSettings((prev) => ({ ...prev, theme: value }))}
                    >
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white mb-2 block">Language</Label>
                    <Select
                      value={settings.language}
                      onValueChange={(value) => setSettings((prev) => ({ ...prev, language: value }))}
                    >
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Notifications */}
              <Card className="bg-white/5 border-white/10 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-5 h-5 text-orange-500" />
                  <h4 className="text-white font-semibold">Notifications</h4>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">Push Notifications</Label>
                      <p className="text-white/60 text-sm">Receive alerts about agent status</p>
                    </div>
                    <Switch
                      checked={settings.notifications}
                      onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, notifications: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">Sound Effects</Label>
                      <p className="text-white/60 text-sm">Play sounds for notifications</p>
                    </div>
                    <Switch
                      checked={settings.soundEffects}
                      onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, soundEffects: checked }))}
                    />
                  </div>
                  {settings.soundEffects && (
                    <div>
                      <Label className="text-white mb-2 block flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        Volume
                      </Label>
                      <Slider
                        value={settings.volume}
                        onValueChange={(value) => setSettings((prev) => ({ ...prev, volume: value }))}
                        max={100}
                        min={0}
                        step={5}
                        className="mb-2"
                      />
                      <div className="text-orange-500 text-sm">{settings.volume[0]}%</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Performance */}
              <Card className="bg-white/5 border-white/10 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-orange-500" />
                  <h4 className="text-white font-semibold">Performance</h4>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">Auto Save</Label>
                      <p className="text-white/60 text-sm">Automatically save configurations</p>
                    </div>
                    <Switch
                      checked={settings.autoSave}
                      onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoSave: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">Performance Mode</Label>
                      <p className="text-white/60 text-sm">Reduce animations for better performance</p>
                    </div>
                    <Switch
                      checked={settings.performanceMode}
                      onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, performanceMode: checked }))}
                    />
                  </div>
                  <div>
                    <Label className="text-white mb-2 block flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Refresh Rate (seconds)
                    </Label>
                    <Slider
                      value={settings.refreshRate}
                      onValueChange={(value) => setSettings((prev) => ({ ...prev, refreshRate: value }))}
                      max={120}
                      min={5}
                      step={5}
                      className="mb-2"
                    />
                    <div className="text-orange-500 text-sm">{settings.refreshRate[0]}s</div>
                  </div>
                </div>
              </Card>

              {/* Privacy & Security */}
              <Card className="bg-white/5 border-white/10 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <h4 className="text-white font-semibold">Privacy & Security</h4>
                </div>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/20 text-white hover:bg-white/10 bg-transparent"
                  >
                    <Shield className="w-4 h-4 mr-3" />
                    Privacy Settings
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/20 text-white hover:bg-white/10 bg-transparent"
                  >
                    <Globe className="w-4 h-4 mr-3" />
                    Data Export
                  </Button>
                </div>
              </Card>

              <Separator className="bg-white/10 mb-6" />

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-black font-semibold">
                  Save Settings
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10 bg-transparent"
                  onClick={() =>
                    setSettings({
                      theme: "dark",
                      notifications: true,
                      soundEffects: true,
                      autoSave: true,
                      performanceMode: false,
                      language: "en",
                      refreshRate: [30],
                      volume: [75],
                    })
                  }
                >
                  Reset to Defaults
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
