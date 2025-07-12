"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { X, User, Mail, Calendar, MapPin, Award, Activity, Settings, LogOut, Edit } from "lucide-react"

interface ProfilePanelProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
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
                    <User className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Profile</h2>
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

              {/* Profile Info */}
              <Card className="bg-white/5 border-white/10 p-6 mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src="/placeholder-user.jpg" />
                    <AvatarFallback className="bg-orange-500 text-black font-bold text-xl">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white">John Doe</h3>
                    <p className="text-white/60">AI Engineer</p>
                    <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/50 mt-2">Pro Plan</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 text-white/80">
                    <Mail className="w-4 h-4 text-orange-500" />
                    john.doe@example.com
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    Joined March 2024
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    San Francisco, CA
                  </div>
                </div>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="bg-white/5 border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-orange-500 mb-1">24</div>
                  <div className="text-white/60 text-sm">Active Agents</div>
                </Card>
                <Card className="bg-white/5 border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-500 mb-1">8</div>
                  <div className="text-white/60 text-sm">Frameworks</div>
                </Card>
              </div>

              {/* Achievements */}
              <Card className="bg-white/5 border-white/10 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-orange-500" />
                  <h4 className="text-white font-semibold">Achievements</h4>
                </div>
                <div className="space-y-3">
                  {[
                    { title: "First Agent Deployed", desc: "Successfully deployed your first AI agent", earned: true },
                    { title: "Framework Master", desc: "Integrated 5+ different frameworks", earned: true },
                    { title: "Performance Pro", desc: "Maintained 99%+ uptime for 30 days", earned: false },
                  ].map((achievement, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          achievement.earned ? "bg-orange-500/20 text-orange-500" : "bg-white/10 text-white/40"
                        }`}
                      >
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${achievement.earned ? "text-white" : "text-white/60"}`}>
                          {achievement.title}
                        </p>
                        <p className="text-xs text-white/40">{achievement.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Separator className="bg-white/10 mb-6" />

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start border-white/20 text-white hover:bg-white/10 bg-transparent"
                >
                  <Activity className="w-4 h-4 mr-3" />
                  Activity History
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-white/20 text-white hover:bg-white/10 bg-transparent"
                >
                  <Settings className="w-4 h-4 mr-3" />
                  Account Settings
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-red-500/50 text-red-400 hover:bg-red-500/10 bg-transparent"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Sign Out
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
