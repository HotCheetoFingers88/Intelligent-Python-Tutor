"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import type { QuestionWithSkill } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CodeEditor } from "@/components/ui/code-editor"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Code2,
  RotateCcw,
  Lightbulb,
  BookOpen,
  Brain,
  Copy,
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
  difficulty: number
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

export function PracticeInterface() {
  const [question, setQuestion] = useState<QuestionWithSkill | null>(null)
  const [meta, setMeta] = useState<QuestionMeta | null>(null)
  const [answer, setAnswer] = useState("")
  const [starterCode, setStarterCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [startTime, setStartTime] = useState<number>(0)
  const { toast } = useToast()
  const firstLoadRef = useRef(true)
  const persistentHintRef = useRef<string | null>(null)

  // Hardcoded demo user
  const userId = "user_student_1"

  const fetchNextQuestion = useCallback(
    async (options?: { focusSkillId?: string }) => {
      setLoading(true)
      setFeedback(null)
      persistentHintRef.current = null

      try {
        const query = new URLSearchParams({ userId })
        if (options?.focusSkillId) {
          query.set("skillId", options.focusSkillId)
        }

        const response = await fetch(`/api/next-question?${query.toString()}`)
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
    [toast, userId],
  )

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      fetchNextQuestion({ focusSkillId: "skill_conditionals" })
    }
  }, [fetchNextQuestion])

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return

    setSubmitting(true)
    const elapsedMs = Date.now() - startTime

    try {
      const response = await fetch("/api/submit-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          questionId: question.id,
          answer,
          elapsedMs,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit answer")
      }

      const data = await response.json()
      setAttempts((count) => count + 1)

      let hintToUse: string | undefined = data.hint ?? undefined
      if (data.correct) {
        persistentHintRef.current = null
      } else if (typeof data.consecutiveIncorrect === "number") {
        if (data.consecutiveIncorrect <= 1) {
          if (data.hint) {
            persistentHintRef.current = data.hint
          }
        } else {
          if (!persistentHintRef.current && data.hint) {
            persistentHintRef.current = data.hint
          }
          if (persistentHintRef.current) {
            hintToUse = persistentHintRef.current
          }
        }
      }

      setFeedback({
        correct: data.correct,
        message: data.feedback,
        hint: hintToUse,
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
      toast({
        title: "Submission failed",
        description: "We couldn't check that answer. Give it another shot in a moment.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    const focusSkillId =
      feedback?.nextAction === "focus_skill" && question ? question.skillId : undefined
    fetchNextQuestion({ focusSkillId })
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
  const canAdvance = feedback?.nextAction === "advance" || feedback?.correct
  const needsFocusedRetry = feedback?.nextAction === "focus_skill"
  const showHint = Boolean(feedback?.hint && !feedback?.correct)
  const showWorkedExample = Boolean(
    !feedback?.correct &&
      feedback?.workedExample &&
      feedback?.feedbackType === "worked_example",
  )
  const workedExampleText = feedback?.workedExample ? decodeStarter(feedback.workedExample) : ""

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
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-accent">Practice Workspace</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Track mastery across skills, surface low-confidence areas, and follow the tutor’s adaptive guidance.
          </p>
        </div>
        {question && (
          <div className="text-right">
            <div className="inline-flex items-center gap-4 rounded-full glass px-7 py-3 text-xl font-semibold text-accent border border-white/20">
              <Code2 className="h-6 w-6" />
              {question.skill.name}
            </div>
          </div>
        )}
      </div>

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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Brain className="h-4 w-4 text-accent" />
                      Skill mastery
                    </span>
                    <span className="font-semibold text-accent">{masteryPercent}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <BookOpen className="h-4 w-4 text-accent" />
                      Skill focus
                    </span>
                    <span className="text-lg font-semibold text-primary">{question.skill.name}</span>
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
              variant={needsFocusedRetry ? "secondary" : "outline"}
              onClick={handleNext}
              className="flex-1 gap-2"
              disabled={loading || (!canAdvance && !needsFocusedRetry)}
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
                  {feedback.correct ? "Great job!" : "Let's try again"}
                </AlertTitle>
                <AlertDescription className="space-y-2 text-sm">
                  <p>{feedback.message}</p>
                  {feedback.encouragement && <p className="text-muted-foreground">{feedback.encouragement}</p>}
                </AlertDescription>
              </Alert>

              {showHint && (
                <Alert className="border border-amber-400/40 bg-amber-400/10">
                  <Lightbulb className="h-5 w-5 text-amber-300" />
                  <AlertTitle className="font-semibold text-amber-200">Hint</AlertTitle>
                  <AlertDescription className="text-sm text-amber-100">{feedback.hint}</AlertDescription>
                </Alert>
              )}

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
        </CardContent>
      </Card>
    </div>
  )
}
