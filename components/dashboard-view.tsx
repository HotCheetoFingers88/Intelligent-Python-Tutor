"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Target, Lightbulb, ArrowRight, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import type { MasteryWithSkill, RecommendationWithSkill } from "@/lib/types"

export function DashboardView() {
  const [mastery, setMastery] = useState<MasteryWithSkill[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationWithSkill[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Hardcoded user ID for demo
  const userId = "user_student_1"

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const [masteryRes, recsRes] = await Promise.all([
        fetch(`/api/mastery?userId=${userId}`),
        fetch(`/api/recommendations?userId=${userId}`),
      ])

      if (!masteryRes.ok || !recsRes.ok) {
        throw new Error("Failed to fetch dashboard data")
      }

      const masteryData = await masteryRes.json()
      const recsData = await recsRes.json()

      setMastery(masteryData.mastery)
      setRecommendations(recsData.recommendations)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, userId])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const getMasteryLevel = (pKnown: number) => {
    if (pKnown >= 0.8) return { label: "Mastered", color: "text-green-600" }
    if (pKnown >= 0.6) return { label: "Proficient", color: "text-blue-600" }
    if (pKnown >= 0.4) return { label: "Learning", color: "text-yellow-600" }
    return { label: "Beginner", color: "text-gray-600" }
  }

  const getOverallProgress = () => {
    if (mastery.length === 0) return 0
    const total = mastery.reduce((sum, m) => sum + m.pKnown, 0)
    return Math.round((total / mastery.length) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-accent">Your Dashboard</h1>
        <p className="text-muted-foreground mt-1">Track your progress and get personalized recommendations</p>
      </div>

      {/* Overall Progress */}
      <Card className="glass-strong border-accent/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-primary/5" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-accent text-2xl">
                <TrendingUp className="h-6 w-6" />
                Overall Progress
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Your learning journey across all skills
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-accent">{getOverallProgress()}%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <Progress value={getOverallProgress()} className="h-4 bg-primary/30" />
        </CardContent>
      </Card>

      {/* Skills Mastery */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-accent flex items-center gap-3">
            <Target className="h-7 w-7" />
            Skills Mastery
          </h2>
        </div>

        {mastery.length === 0 ? (
          <Card className="glass-strong border-white/10">
            <CardContent className="py-16 text-center">
              <Sparkles className="h-12 w-12 text-accent mx-auto mb-4" />
              <p className="text-muted-foreground mb-6 text-lg">
                No mastery data yet. Start practicing to see your progress!
              </p>
              <Button
                asChild
                className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20"
              >
                <Link href="/student/practice">Start Practicing</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {mastery.map((m) => {
              const level = getMasteryLevel(m.pKnown)
              const percentage = Math.round(m.pKnown * 100)

              return (
                <Card key={m.id} className="glass-strong border-white/10 hover:border-accent/30 transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-xl text-accent">{m.skill.name}</CardTitle>
                        <Badge variant="outline" className={`${level.color} glass border-white/20`}>
                          {level.label}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-accent">{percentage}%</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Progress value={percentage} className="h-3 bg-primary/30" />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-accent flex items-center gap-3">
          <Lightbulb className="h-7 w-7" />
          Personalized Recommendations
        </h2>

        {recommendations.length === 0 ? (
          <Card className="glass-strong border-white/10">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground text-lg">
                Complete more practice sessions to receive personalized recommendations.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <Card key={rec.id} className="glass-strong border-white/10 hover:border-accent/30 transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <CardTitle className="text-xl text-accent">Focus on {rec.skill.name}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                        {rec.rationale}
                      </CardDescription>
                    </div>
                    <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <Link href="/student/practice">
                        Practice
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
