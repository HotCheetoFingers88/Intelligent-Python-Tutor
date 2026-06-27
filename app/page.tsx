export const dynamic = "force-dynamic"

import { AppNav } from "@/components/app-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { BookOpen, LayoutDashboard, Sparkles, Code2, Brain, Zap } from "lucide-react"

export default async function HomePage() {
  const user = { id: "cmqvs5up80000fjvolxo09dqc", username: "student_demo", email: "student@demo.com", role: "student" as const }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AppNav user={user} />

      <main className="relative z-10 container mx-auto px-4 py-0">
        <div className="mx-auto max-w-6xl space-y-3 pb-12">
          {/* Hero Section */}
          <section className="text-center space-y-4 py-8 px-8">
            <div className="inline-flex items-center gap-2 rounded-full glass px-6 py-3 text-sm font-medium text-accent border border-white/20 mx-auto">
              <Sparkles className="h-4 w-4" />
              Intelligent Tutoring System
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl text-balance">
              Master Python with{" "}
              <span className="relative inline-block">
                <span className="absolute inset-0 bg-accent/10 blur-2xl" />
                <span className="relative text-accent">ascend.py</span>
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground text-pretty leading-relaxed">
              An intelligent tutoring system that adapts to your learning style, provides personalized feedback, and
              helps you build programming skills efficiently.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button
                asChild
                size="lg"
                variant="outline"
                className="glass border-white/20 hover:bg-white/5 bg-transparent"
              >
                <Link href="/student/dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  View Dashboard
                </Link>
              </Button>
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/10">
                <Link href="/student/practice">
                  <Code2 className="h-4 w-4 mr-2" />
                  Start Practicing
                </Link>
              </Button>
            </div>
          </section>

          {/* Features */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="glass-strong border-white/10 hover:border-accent/30 transition-all group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/20 border border-white/10 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-all">
                  <BookOpen className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-accent">Interactive Practice</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Work through programming challenges with instant feedback and adaptive difficulty
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-strong border-white/10 hover:border-accent/30 transition-all group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/20 border border-white/10 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-all">
                  <Brain className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-accent">Track Progress</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Monitor your mastery across different skills with detailed analytics and insights
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-strong border-white/10 hover:border-accent/30 transition-all group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/20 border border-white/10 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-all">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-accent">Instructor Tools</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Manage skills and questions to create customized learning experiences
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
