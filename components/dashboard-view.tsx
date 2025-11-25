"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Target, Lightbulb, ArrowRight, Sparkles, BookOpen } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import type { MasteryWithSkill, RecommendationWithSkill } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"

type DashboardViewProps = {
  welcomeMessage?: string
  username: string
}

type UserClass = {
  id: string
  name: string
  role: "student" | "instructor"
  inviteCode?: string
}

export function DashboardView({ welcomeMessage, username }: DashboardViewProps) {
  const [mastery, setMastery] = useState<MasteryWithSkill[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationWithSkill[]>([])
  const [classes, setClasses] = useState<UserClass[]>([])
  const [joinCode, setJoinCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const [masteryRes, recsRes, classesRes] = await Promise.all([
        fetch(`/api/mastery`),
        fetch(`/api/recommendations`),
        fetch(`/api/classes/enrollments`).catch(() => null),
      ])

      if (!masteryRes.ok || !recsRes.ok) {
        throw new Error("Failed to fetch dashboard data")
      }

      const masteryData = await masteryRes.json()
      const recsData = await recsRes.json()
      setMastery(masteryData.mastery)
      setRecommendations(recsData.recommendations)

      if (classesRes && classesRes.ok) {
        const classesData = await classesRes.json()
        setClasses(classesData.classes ?? [])
      } else {
        setClasses([])
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  useEffect(() => {
    if (welcomeMessage) {
      // Remove the query param after showing the banner
      router.replace("/student/dashboard", { scroll: false })
    }
  }, [router, welcomeMessage])

  const handleJoinClass = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    try {
      const response = await fetch(`/api/join/${joinCode.trim()}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error ?? "Invalid invite code")
      }
      toast({ title: "Joined class", description: `Welcome to ${data?.class?.name ?? "the class"}!` })
      setJoinCode("")
      fetchDashboardData()
    } catch (error) {
      toast({
        title: "Unable to join class",
        description: (error as Error)?.message ?? "Please verify the code and try again.",
        variant: "destructive",
      })
    } finally {
      setJoining(false)
    }
  }

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
      {welcomeMessage && (
        <Alert
          data-testid="welcome-banner"
          className="glass-strong border-accent/30 bg-accent/10 text-accent-foreground"
        >
          <Sparkles className="h-5 w-5 text-accent" />
          <AlertTitle>{welcomeMessage}</AlertTitle>
          <AlertDescription>Let&apos;s keep the streak going!</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-4xl font-bold text-accent">
          {welcomeMessage ? welcomeMessage : `Welcome back, ${username}`}
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your progress, manage your classes, and jump into questions whenever you&apos;re ready.
        </p>
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
            Skills Mastery & Practice
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
                  <CardFooter className="flex justify-end">
                    <Button
                      asChild
                      variant="outline"
                      className="gap-2 border-white/20 hover:border-accent/40 hover:bg-primary/30 transition-colors"
                    >
                      <Link href={`/student/practice?skillId=${m.skill.id}`}>
                        Practice skill
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
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
                <CardHeader className="px-6 py-8 md:px-10 md:py-10">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col space-y-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground mb-2">
                          Next best step
                        </p>
                        <CardTitle className="text-2xl md:text-3xl text-accent">Focus on {rec.skill.name}</CardTitle>
                      </div>
                      <CardDescription className="text-base leading-relaxed text-muted-foreground md:text-lg">
                        {rec.rationale}
                      </CardDescription>
                    </div>
                    <div className="flex justify-center pt-2">
                      <Button
                        asChild
                        size="lg"
                        className="w-full max-w-[260px] rounded-full px-8 py-4 text-lg bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
                      >
                        <Link href={`/student/practice?skillId=${rec.skill.id}`}>
                          Practice
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* My Classes */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold text-accent flex items-center gap-3">
          <BookOpen className="h-7 w-7" />
          My Classes
        </h2>

        <div className="flex flex-wrap gap-3">
          {classes.length > 0 ? (
            classes.map((klass) => (
              <div
                key={klass.id}
                className="glass border-white/10 rounded-full px-5 py-3 flex flex-wrap items-center gap-3 text-sm"
              >
                <span className="font-semibold text-accent">{klass.name}</span>
                <span className="text-muted-foreground capitalize">Role: {klass.role}</span>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="rounded-full bg-white/10 text-accent hover:bg-white/20"
                >
                  <Link href={`/student/practice?classId=${klass.id}`}>Go to class</Link>
                </Button>
              </div>
            ))
          ) : (
            <div className="glass border-dashed border-white/10 rounded-full px-5 py-3 text-sm text-muted-foreground">
              No classes yet — ask your instructor for an invite link.
            </div>
          )}
        </div>

        <Card className="glass-strong border-white/10">
          <CardHeader>
            <CardTitle>Join a class</CardTitle>
            <CardDescription>Enter an invite code from your instructor to access class practice.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinClass} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="Enter invite code"
              />
              <Button type="submit" disabled={joining}>
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join class"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
