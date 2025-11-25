"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import type { QuestionWithSkill } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CodeEditor } from "@/components/ui/code-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { TutorChat, HintTier, ChatMessage as TutorChatMessage } from "@/components/tutor-chat"

const TIER_ORDER: HintTier[] = ["simple", "medium", "worked_example"]
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Code2,
  RotateCcw,
  BookOpen,
  Brain,
  Copy,
  Bot,
} from "lucide-react"

type FeedbackState = {
  correct: boolean
  message: string
  hint?: string
  workedExample?: string
  encouragement?: string
  tone?: string
  nextAction: "advance" | "retry" | "focus_skill"
  feedbackType: string
  mastery?: number
  consecutiveIncorrect?: number
}

type QuestionMeta = {
  targetSkillId: string
  selectionReason: string
  mastery: number
  consecutiveIncorrect: number
  totalAttempts: number
  difficulty: "easy" | "medium" | "hard"
}

const selectionNarratives: Record<string, string> = {
  lowest_mastery: "This skill currently has the lowest mastery, so we're focusing here first.",
  repeat_until_mastered: "We're staying on this concept until a confident solve pushes mastery past 60%.",
  ml_recommendation: "Based on your recent progress, the tutor recommends reinforcing this concept next.",
  requested_focus: "We're spending a bit more time here to reinforce the concept.",
}


function decodeStarter(template: string) {
  return template.replace(/\\n/g, "\n").replace(/\r\n?/g, "\n")
}

type PracticeInterfaceProps = {
  initialClassId?: string
}

type ClassOption = {
  id: string
  name: string
  role: "student" | "instructor"
}

type TestStatus = "pass" | "fail" | "timeout" | "error"

type TestResultRow = {
  index: number
  label: string
  hidden: boolean
  status: TestStatus
  stdout?: string | null
  stderr?: string | null
  actual?: string | null
  expected?: string | null
  inputSummary?: string | null
}

export function PracticeInterface({ initialClassId }: PracticeInterfaceProps) {
  const [question, setQuestion] = useState<QuestionWithSkill | null>(null)
  const [meta, setMeta] = useState<QuestionMeta | null>(null)
  const [answer, setAnswer] = useState("")
  const [starterCode, setStarterCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [lockedSkillId, setLockedSkillId] = useState<string | null>(null)
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState(initialClassId ?? "all")
  const [testResults, setTestResults] = useState<TestResultRow[]>([])
  const [chatMessages, setChatMessages] = useState<TutorChatMessage[]>([])
  const [attempted, setAttempted] = useState(false)
  const [hints, setHints] = useState<Record<HintTier, string> | null>(null)
  const [revealedTiers, setRevealedTiers] = useState<Set<HintTier>>(new Set())
  const [showTutorChat, setShowTutorChat] = useState(false)
  const [allowedHintTiers, setAllowedHintTiers] = useState<Set<HintTier> | null>(null)
  const hasTutorMessages = chatMessages.length > 0
  const tierOrder = TIER_ORDER
  const statusMeta: Record<"pass" | "fail", { label: string; className: string }> = {
    pass: { label: "Pass", className: "bg-emerald-500/20 text-emerald-100 border border-emerald-400/40" },
    fail: { label: "Fail", className: "bg-rose-500/15 text-rose-200 border border-rose-400/40" },
  }

  const appendTutorMessage = useCallback((message: Omit<TutorChatMessage, "id" | "timestamp">) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(),
        author: message.author ?? "tutor",
        tier: message.tier,
        content: message.content,
        code: message.code,
      },
    ])
  }, [])

  const loadHints = useCallback(async (questionId: string) => {
    try {
      const response = await fetch(`/api/questions/${questionId}/hints`)
      if (!response.ok) {
        throw new Error("Unable to load hints")
      }
      const data = await response.json()
      setHints(data)
    } catch (error) {
      console.warn("[Practice] unable to fetch hints", error)
      setHints(null)
    }
  }, [])

  const revealHint = useCallback(
    (tier: HintTier) => {
      if (!hints || !hints[tier]) {
        return
      }
      setRevealedTiers((prev) => {
        if (prev.has(tier)) return prev
        const next = new Set(prev)
        next.add(tier)
        return next
      })

      const payload = hints[tier] as string
      let text = payload
      let code: string | undefined
      if (tier === "worked_example") {
        const match = payload.match(/```(?:\w+)?\n([\s\S]*?)```/)
        if (match) {
          code = match[1].trim()
          text = payload.replace(match[0], "").trim()
        } else if (question?.answer) {
          code = question.answer.trim()
        }
        if (!text) {
          text = "Here's a sample approach you can compare against."
        }
      }
      appendTutorMessage({
        author: "tutor",
        tier,
        content: text,
        code,
      })
    },
    [appendTutorMessage, hints, question?.answer],
  )

  const autoRevealForStreak = useCallback((_: number | undefined) => undefined, [])

  const testSummary = useMemo(() => {
    if (testResults.length === 0) {
      return null
    }
    const passed = testResults.filter((result) => result.status === "pass").length
    const visible = testResults.filter((result) => !result.hidden)
    return {
      total: testResults.length,
      passed,
      label:
        passed === testResults.length
          ? "All tests passed"
          : `${testResults.length - passed} test${testResults.length - passed === 1 ? "" : "s"} failing`,
      visibleCount: visible.length,
    }
  }, [testResults])

  const testSummaryVariant = useMemo(() => {
    if (!testSummary) return "bg-muted/30 text-muted-foreground border border-white/10"
    if (testSummary.passed === testSummary.total) {
      return "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30"
    }
    if (testSummary.passed === 0) {
      return "bg-rose-500/15 text-rose-200 border border-rose-400/30"
    }
    return "bg-amber-500/15 text-amber-200 border border-amber-400/30"
  }, [testSummary])

  const testsFailing = useMemo(() => {
    if (!testSummary) return null
    return testSummary.total - testSummary.passed
  }, [testSummary])

  const availableTiers = useMemo(() => {
    const base = {
      simple: Boolean(hints?.simple),
      medium: Boolean(hints?.medium),
      worked_example: Boolean(hints?.worked_example),
    }
    if (!allowedHintTiers) return base
    return {
      simple: base.simple && allowedHintTiers.has("simple"),
      medium: base.medium && allowedHintTiers.has("medium"),
      worked_example: base.worked_example && allowedHintTiers.has("worked_example"),
    }
  }, [allowedHintTiers, hints])

  const nextTierToOffer = useMemo(
    () => tierOrder.find((tier) => availableTiers[tier] && !revealedTiers.has(tier)),
    [availableTiers, revealedTiers, tierOrder],
  )

  const summarizeOutput = (text?: string | null) => {
    if (!text) return null
    const trimmed = text.trim()
    if (!trimmed) return "(no output)"
    return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed
  }

  const summarizeError = (text?: string | null) => {
    if (!text) return null
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) return null
    const last = lines[lines.length - 1]
    return last
  }

  const describeTest = (result: TestResultRow) => {
    const expectedText = result.expected ?? result.inputSummary ?? null
    const actualText = result.actual ?? summarizeOutput(result.stdout)
    const details: string[] = []

    if (expectedText) {
      details.push(`Expected: ${expectedText}`)
    }

    let actualLine: string | null = null
    if (result.status === "timeout") {
      actualLine = "Actual: timed out before producing output"
    } else {
      const errorSummary = summarizeError(result.stderr)
      if (errorSummary) {
        actualLine = `Actual: ${errorSummary}`
      } else if (actualText) {
        actualLine = `Actual: ${actualText}`
      } else if (result.status !== "pass") {
        actualLine = "Actual: (no output captured)"
      }
    }

    if (actualLine) {
      details.push(actualLine)
    }

    if (details.length === 0) {
      return result.status === "pass"
        ? "Requirement satisfied."
        : "Expected result didn’t match what your code produced."
    }

    return details.join(" · ")
  }
  const { toast } = useToast()
  const firstLoadRef = useRef(true)
  const classFilterInitRef = useRef(true)
  const searchParams = useSearchParams()
  const router = useRouter()
  const skillFromQuery = useMemo(() => searchParams.get("skillId"), [searchParams])

  const fetchNextQuestion = useCallback(
    async (options?: { focusSkillId?: string }) => {
      setLoading(true)
      setFeedback(null)

      try {
        const query = new URLSearchParams()
        if (options?.focusSkillId) {
          query.set("skillId", options.focusSkillId)
        }
        if (selectedClassId && selectedClassId !== "all") {
          query.set("classId", selectedClassId)
        }

        const queryString = query.toString()
        const response = await fetch(`/api/next-question${queryString ? `?${queryString}` : ""}`)
        if (response.status === 401) {
          router.push("/login")
          return
        }
        if (!response.ok) {
          throw new Error("Failed to fetch question")
        }

        const data = await response.json()
        setQuestion(data.question)
        if (data.meta) {
          console.info("[Practice] Loaded question", {
            questionId: data.question.id,
            skill: data.question.skill?.name,
            selectionReason: data.meta.selectionReason,
            pKnown: data.meta.pKnown,
            totalAttempts: data.meta.totalAttempts,
          })
        }

        setMeta(
          data.meta
            ? {
                ...data.meta,
                totalAttempts: data.meta.totalAttempts ?? 0,
                difficulty: data.question.difficulty,
              }
            : null,
        )

        const starter = data.question.starter ? decodeStarter(data.question.starter) : ""
        setStarterCode(starter)
        setAnswer(starter)
        setAttempts(0)
        setStartTime(Date.now())
        setTestResults([])
        setAttempted(false)
        setChatMessages([])
        setRevealedTiers(new Set())
        setShowTutorChat(false)
        setAllowedHintTiers(null)
        setHints(null)
        loadHints(data.question.id)
      } catch (error) {
        toast({
          title: "Unable to load question",
          description: "We hit an issue fetching the next challenge. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    },
    [loadHints, router, selectedClassId, toast],
  )

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      if (skillFromQuery) {
        setLockedSkillId(skillFromQuery)
        fetchNextQuestion({ focusSkillId: skillFromQuery })
      } else {
        fetchNextQuestion({ focusSkillId: "skill_conditionals" })
      }
      return
    }

    if (skillFromQuery && skillFromQuery !== lockedSkillId) {
      setLockedSkillId(skillFromQuery)
      fetchNextQuestion({ focusSkillId: skillFromQuery })
    } else if (!skillFromQuery && lockedSkillId) {
      setLockedSkillId(null)
      fetchNextQuestion()
    }
  }, [fetchNextQuestion, skillFromQuery, lockedSkillId])

  useEffect(() => {
    let cancelled = false
    fetch("/api/classes/enrollments")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.classes) return
        setClassOptions(data.classes)
        if (initialClassId && data.classes.some((klass: any) => klass.id === initialClassId)) {
          setSelectedClassId(initialClassId)
        }
      })
      .catch(() => {
        // ignore errors
      })
    return () => {
      cancelled = true
    }
  }, [initialClassId])

  useEffect(() => {
    if (classFilterInitRef.current) {
      classFilterInitRef.current = false
      return
    }
    fetchNextQuestion()
  }, [fetchNextQuestion, selectedClassId])

  useEffect(() => {
    if (showTutorChat && !hasTutorMessages) {
      appendTutorMessage({
        author: "system",
        content:
          "Hint Bot is your on-demand tutor. Request a Simple hint for a light nudge, Medium for deeper strategy, or a Worked Example when you want to study a full solution.",
      })
    }
  }, [appendTutorMessage, hasTutorMessages, showTutorChat])

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return

    setSubmitting(true)
    const elapsedMs = Date.now() - startTime

    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          code: answer,
          elapsedMs,
        }),
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        let detail = "Failed to submit answer"
        try {
          const errorPayload = await response.json()
          if (typeof errorPayload?.error === "string") {
            detail = errorPayload.error
          }
        } catch {
          // ignore
        }
        throw new Error(detail)
      }

      const data = await response.json()
      setAttempts((count) => count + 1)
      setAttempted(true)
      if (Array.isArray(data.tests)) {
        setTestResults(data.tests as TestResultRow[])
      }
      if (Array.isArray(data.allowedHintTiers) && data.allowedHintTiers.length > 0) {
        setAllowedHintTiers(new Set(data.allowedHintTiers as HintTier[]))
      } else {
        setAllowedHintTiers(null)
      }

      setFeedback({
        correct: data.correct,
        message: data.feedback,
        hint: data.hint ?? undefined,
        workedExample: data.workedExample ?? undefined,
        encouragement: data.encouragement ?? undefined,
        tone: data.tone ?? undefined,
        nextAction: data.nextAction || (data.correct ? "advance" : "retry"),
        feedbackType: data.feedbackType || (data.correct ? "praise" : "hint"),
        mastery: data.mastery,
        consecutiveIncorrect: data.consecutiveIncorrect,
      })

      console.info("[Practice] Submission result", {
        questionId: question.id,
        correct: data.correct,
        feedbackType: data.feedbackType,
        mastery: data.mastery,
        nextAction: data.nextAction,
      })

      if (data.correct) {
        appendTutorMessage({
          author: "tutor",
          content: "Nice! Every requirement passed. When you're ready, take on the next challenge.",
        })
        setRevealedTiers(new Set())
      } else {
        autoRevealForStreak(data.consecutiveIncorrect)
      }

      setMeta((prev) =>
        prev
          ? {
              ...prev,
              mastery: typeof data.mastery === "number" ? data.mastery : prev.mastery,
              consecutiveIncorrect:
                typeof data.consecutiveIncorrect === "number"
                  ? data.consecutiveIncorrect
                  : prev.consecutiveIncorrect,
            }
          : prev,
      )
      setStartTime(Date.now())
    } catch (error) {
      const description = error instanceof Error ? error.message : "We couldn't check that answer. Give it another shot in a moment."
      toast({
        title: "Submission failed",
        description,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    fetchNextQuestion({ focusSkillId: lockedSkillId ?? undefined })
  }

  const masteryPercent = useMemo(() => {
    if (!meta) return 0
    return Math.round((meta.mastery ?? 0) * 100)
  }, [meta])

  const reasonMessage = useMemo(() => {
    if (!meta || !question || feedback?.correct) return ""
    const narrative = selectionNarratives[meta.selectionReason] ??
      "The tutor selected this skill to support your progress."
    return `Mastery for ${question.skill.name} is ${masteryPercent}%. ${narrative}`
  }, [meta, question, masteryPercent, feedback?.correct])
  const canAdvance = Boolean(feedback?.correct)
  const showWorkedExample = Boolean(
    !feedback?.correct &&
      feedback?.workedExample &&
      feedback?.feedbackType === "worked_example",
  )
  const workedExampleText = feedback?.workedExample ? decodeStarter(feedback.workedExample) : ""
  const difficultyMeta = useMemo(() => {
    if (!question) {
      return {
        label: "",
        badgeClass: "",
        textClass: "",
      }
    }
    switch (question.difficulty) {
      case "easy":
        return {
          label: "Easy",
          badgeClass: "bg-emerald-400/15 text-emerald-200 border border-emerald-300/30",
          textClass: "text-emerald-300",
        }
      case "hard":
        return {
          label: "Hard",
          badgeClass: "bg-rose-400/15 text-rose-200 border border-rose-300/30",
          textClass: "text-rose-300",
        }
      default:
        return {
          label: "Medium",
          badgeClass: "bg-amber-400/15 text-amber-200 border border-amber-300/30",
          textClass: "text-amber-300",
        }
    }
  }, [question])

  const handleCopyWorkedExample = useCallback(
    async (code: string) => {
      try {
        await navigator.clipboard.writeText(code)
        toast({
          title: "Copied to clipboard",
          description: "You can paste the worked example into the editor or elsewhere.",
        })
      } catch (error) {
        toast({
          title: "Copy failed",
          description: "We couldn't copy that snippet. Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  if (loading && !question) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!question) {
    return (
      <Card className="glass-strong border-white/10">
        <CardHeader>
          <CardTitle className="text-xl text-accent">No Questions Available</CardTitle>
          <CardDescription className="text-muted-foreground">
            There are no questions available at this time. Sync the seed script to load demo content.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className={cn("space-y-6 w-full max-w-5xl", showTutorChat ? "" : "mx-auto")}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-accent">Practice Workspace</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Track mastery across skills, surface low-confidence areas, and follow the tutor’s adaptive guidance.
            </p>
          </div>
          {question && (
            <div className="text-left md:text-right md:ml-auto">
              <div className="inline-flex items-center gap-4 rounded-full glass px-7 py-3 text-xl font-semibold text-accent border border-white/20">
                <Code2 className="h-6 w-6" />
                {question.skill.name}
              </div>
            </div>
          )}
        </div>

        {classOptions.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Label className="text-sm text-muted-foreground">Class filter</Label>
            <Select value={selectedClassId} onValueChange={(value) => setSelectedClassId(value)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Personal practice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Personal practice</SelectItem>
                {classOptions.map((klass) => (
                  <SelectItem key={klass.id} value={klass.id}>
                    {klass.name} ({klass.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className={cn("lg:flex lg:items-start lg:gap-6", { "lg:justify-center": !showTutorChat })}>
        <div className="flex-1 max-w-5xl space-y-8">
          <Card className="glass-strong border-white/10">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-3xl font-semibold text-accent whitespace-pre-line leading-tight">
                  {question.prompt}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Use the editor below to craft your solution. Re-run your code as many times as you need. The tutor will adapt based on your attempts.
                </CardDescription>
              </div>
              {meta && (
                <div className="min-w-[260px] rounded-lg border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed">
                  <div className="space-y-4">
                    {difficultyMeta.label && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2 text-muted-foreground text-sm">
                          <BookOpen className="h-4 w-4 text-accent" />
                          Difficulty
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm font-semibold whitespace-nowrap leading-none",
                            difficultyMeta.badgeClass,
                          )}
                        >
                          {difficultyMeta.label}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Brain className="h-4 w-4 text-accent" />
                        Skill mastery
                      </span>
                      <span className="font-semibold text-accent">{masteryPercent}%</span>
                    </div>
                    {reasonMessage && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <span className="font-semibold text-accent">Why this skill</span>
                        <p>{reasonMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background/60">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Code2 className="h-4 w-4 text-accent" />
                  Code Editor
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setAnswer(starterCode)}
                    disabled={submitting || answer === starterCode}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  {attempted && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 border-white/20 hover:border-white/40"
                      disabled={!availableTiers.simple && !availableTiers.medium && !availableTiers.worked_example}
                      onClick={() => {
                        setShowTutorChat(true)
                      }}
                    >
                      <Bot className="h-4 w-4" />
                      Ask Hint Bot
                    </Button>
                  )}
                </div>
              </div>
              <CodeEditor
                key={question.id}
                value={answer}
                onChange={setAnswer}
                placeholder="Write your Python solution here..."
                disabled={submitting && !feedback}
              />
            </div>
  
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !answer.trim() || feedback?.correct}
                className="flex-1 bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : feedback && !feedback.correct ? (
                  <>
                    Re-run answer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Run & Check
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
  
              <Button
                variant="outline"
                onClick={handleNext}
                className="flex-1 gap-2"
                disabled={loading || submitting || !canAdvance}
              >
                Next question
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
  
            {feedback && (
              <div className="space-y-4">
                <Alert
                  variant={feedback.correct ? "default" : "destructive"}
                  className={cn(
                    "border",
                    feedback.correct
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                      : "border-destructive/40 bg-destructive/10",
                  )}
                >
                  {feedback.correct ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <AlertTitle className="font-semibold">
                    {feedback.correct ? "All tests passed" : "Let's try again"}
                  </AlertTitle>
                  <AlertDescription className="text-sm">
                    {feedback.correct
                      ? "Nice! Every test case succeeded. Continue when you're ready."
                      : testsFailing !== null
                        ? `${testsFailing} test case${testsFailing === 1 ? "" : "s"} still failing. Review the summary below and adjust your code before re-running.`
                        : "Some tests are still failing. Review the summary below and adjust your code before re-running."}
                  </AlertDescription>
                </Alert>
                {showWorkedExample && feedback.workedExample && (
                  <Alert className="border border-primary/40 bg-primary/10">
                    <div className="flex w-full items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Code2 className="h-5 w-5 text-primary" />
                        <AlertTitle className="font-semibold text-primary">Worked example</AlertTitle>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => void handleCopyWorkedExample(workedExampleText)}
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                    <AlertDescription>
                      <pre className="mt-2 overflow-x-auto rounded-md bg-background/70 p-3 font-mono text-sm leading-relaxed text-foreground">
                        {workedExampleText}
                      </pre>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
  
            {testResults.length > 0 && (
              <Card className="glass border-white/10">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl text-accent">Test cases</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Each run executes all test cases for this prompt.
                    </CardDescription>
                  </div>
                  {testSummary && (
                    <div
                      className={cn(
                        "rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide inline-flex items-center gap-2",
                        testSummaryVariant,
                      )}
                    >
                      {testSummary.passed}/{testSummary.total} passed
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {testResults.map((result) => (
                    <div
                      key={result.index}
                      className="rounded-xl border border-white/10 bg-background/40 p-4 space-y-2"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-foreground">{result.label}</p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                            statusMeta[result.status === "pass" ? "pass" : "fail"].className,
                          )}
                        >
                          {result.status === "pass" && <CheckCircle2 className="h-4 w-4" />}
                          {result.status !== "pass" && <XCircle className="h-4 w-4" />}
                          {statusMeta[result.status === "pass" ? "pass" : "fail"].label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{describeTest(result)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </CardContent>
          </Card>
        </div>

        {showTutorChat && (
          <div className="mt-6 lg:mt-0 w-full lg:w-[380px] xl:w-[420px]">
            <TutorChat
              messages={chatMessages}
              onRequestHint={revealHint}
              availableTiers={availableTiers}
              revealedTiers={revealedTiers}
              onClose={() => setShowTutorChat(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
