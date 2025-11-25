"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Copy, FolderPlus, Loader2, PlusCircle, Sparkles } from "lucide-react"
import type { ClassSummary, Skill } from "@/lib/types"
import { Switch } from "@/components/ui/switch"

type InstructorClass = ClassSummary & {
  enrollmentCount: number
  questionCount: number
}

type ClassQuestion = {
  id: string
  prompt: string
  skillId: string
  skillName: string
  difficulty: "easy" | "medium" | "hard"
  createdAt: string
}

type TestCaseDraft = {
  input: string
  expectedOutput: string
  timeoutMs: number
  hidden: boolean
}

const MIN_TEST_CASES = 3
const MAX_TEST_CASES = 10

const createInitialTestCases = (): TestCaseDraft[] =>
  Array.from({ length: MIN_TEST_CASES }, () => ({
    input: "",
    expectedOutput: "",
    timeoutMs: 2000,
    hidden: false,
  }))

export function ClassesManager() {
  const { toast } = useToast()
  const [classes, setClasses] = useState<InstructorClass[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [classDialogOpen, setClassDialogOpen] = useState(false)
  const [newClassName, setNewClassName] = useState("")
  const [questionDrawer, setQuestionDrawer] = useState<{ classId: string; name: string } | null>(null)
  const [questionForm, setQuestionForm] = useState({
    skillId: "",
    difficulty: "medium" as "easy" | "medium" | "hard",
    prompt: "",
    starterCode: "",
    answer: "",
  })
  const [questionLists, setQuestionLists] = useState<Record<string, ClassQuestion[]>>({})
  const [questionLoading, setQuestionLoading] = useState(false)
  const [submittingQuestion, setSubmittingQuestion] = useState(false)
  const [creatingClass, setCreatingClass] = useState(false)
  const [testCases, setTestCases] = useState<TestCaseDraft[]>(createInitialTestCases)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [classesRes, skillsRes] = await Promise.all([fetch("/api/classes"), fetch("/api/skills")])
      if (!classesRes.ok) {
        throw new Error("Unable to load classes")
      }
      if (!skillsRes.ok) {
        throw new Error("Unable to load skills")
      }

      const classesData = await classesRes.json()
      const skillsData = await skillsRes.json()

      setClasses(classesData.classes ?? [])
      setSkills(skillsData.skills ?? [])
      if (!questionForm.skillId && skillsData.skills?.length > 0) {
        setQuestionForm((prev) => ({ ...prev, skillId: skillsData.skills[0].id }))
      }
    } catch (error) {
      toast({
        title: "Unable to load classes",
        description: (error as Error)?.message ?? "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, questionForm.skillId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateClass = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newClassName.trim()) return
    setCreatingClass(true)
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName.trim() }),
      })

      if (!response.ok) throw new Error("Unable to create class")
      toast({ title: "Class created", description: "Invite your students with the new link." })
      setNewClassName("")
      setClassDialogOpen(false)
      fetchData()
    } catch (error) {
      toast({
        title: "Unable to create class",
        description: (error as Error)?.message ?? "Please try again.",
        variant: "destructive",
      })
    } finally {
      setCreatingClass(false)
    }
  }

  const openQuestionDrawer = (klass: InstructorClass) => {
    setQuestionDrawer({ classId: klass.id, name: klass.name })
    setQuestionForm((prev) => ({
      ...prev,
      skillId: prev.skillId || (skills[0]?.id ?? ""),
      prompt: "",
      starterCode: "",
      answer: "",
      difficulty: "medium",
    }))
  }

  const handleQuestionSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!questionDrawer) return
    if (!questionForm.skillId || !questionForm.prompt.trim()) {
      toast({ title: "Missing fields", description: "Skill and prompt are required.", variant: "destructive" })
      return
    }
    if (testCases.length < MIN_TEST_CASES) {
      toast({
        title: "More test cases needed",
        description: `Add at least ${MIN_TEST_CASES} cases so students get meaningful feedback.`,
        variant: "destructive",
      })
      return
    }
    for (let i = 0; i < testCases.length; i += 1) {
      const testCase = testCases[i]
      if (!testCase.input.trim() || !testCase.expectedOutput.trim()) {
        toast({
          title: "Incomplete test case",
          description: `Test case #${i + 1} requires both input and expected output JSON.`,
          variant: "destructive",
        })
        return
      }
      try {
        JSON.parse(testCase.input)
        JSON.parse(testCase.expectedOutput)
      } catch {
        toast({
          title: "Invalid JSON",
          description: `Check the JSON for test case #${i + 1}.`,
          variant: "destructive",
        })
        return
      }
    }
    setSubmittingQuestion(true)
    try {
      const response = await fetch(`/api/classes/${questionDrawer.classId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: questionForm.skillId,
          difficulty: questionForm.difficulty,
          prompt: questionForm.prompt.trim(),
          starterCode: questionForm.starterCode,
          answer: questionForm.answer,
          testCases: testCases.map((testCase) => ({
            input: testCase.input.trim(),
            expectedOutput: testCase.expectedOutput.trim(),
            timeoutMs: testCase.timeoutMs,
            hidden: testCase.hidden,
          })),
        }),
      })

      if (!response.ok) throw new Error("Unable to create question")
      toast({ title: "Question created", description: `${questionDrawer.name} has a new prompt.` })
      setQuestionDrawer(null)
      setQuestionForm((prev) => ({ ...prev, prompt: "", starterCode: "", answer: "" }))
      setTestCases(createInitialTestCases())
      fetchData()
    } catch (error) {
      toast({
        title: "Unable to create question",
        description: (error as Error)?.message ?? "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmittingQuestion(false)
    }
  }

  const copyInviteLink = (inviteCode: string) => {
    const url = `${window.location.origin}/join/${inviteCode}`
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Invite link copied", description: url })
    })
  }

  const loadQuestions = async (klass: InstructorClass) => {
    if (questionLists[klass.id]) {
      return
    }
    setQuestionLoading(true)
    try {
      const response = await fetch(`/api/classes/${klass.id}/questions`)
      if (!response.ok) throw new Error("Unable to load questions")
      const data = await response.json()
      setQuestionLists((prev) => ({
        ...prev,
        [klass.id]: data.questions ?? [],
      }))
    } catch (error) {
      toast({
        title: "Unable to load questions",
        description: (error as Error)?.message ?? "Please try again.",
        variant: "destructive",
      })
    } finally {
      setQuestionLoading(false)
    }
  }

  const difficultyBadge = useCallback((difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-emerald-500/20 text-emerald-200"
      case "hard":
        return "bg-rose-500/20 text-rose-200"
      default:
        return "bg-amber-500/20 text-amber-200"
    }
  }, [])

  const hasClasses = classes.length > 0

  const addTestCase = () => {
    setTestCases((prev) => {
      if (prev.length >= MAX_TEST_CASES) {
        toast({
          title: "Limit reached",
          description: `You can only attach up to ${MAX_TEST_CASES} test cases.`,
        })
        return prev
      }
      return [...prev, { input: "", expectedOutput: "", timeoutMs: 2000, hidden: false }]
    })
  }

  const removeTestCase = (index: number) => {
    setTestCases((prev) => {
      if (prev.length <= MIN_TEST_CASES) {
        toast({
          title: "Need more cases",
          description: `Provide at least ${MIN_TEST_CASES} test cases per question.`,
        })
        return prev
      }
      return prev.filter((_, idx) => idx !== index)
    })
  }

  const updateTestCase = <K extends keyof TestCaseDraft>(index: number, field: K, value: TestCaseDraft[K]) => {
    setTestCases((prev) => prev.map((testCase, idx) => (idx === index ? { ...testCase, [field]: value } : testCase)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Classes</h2>
          <p className="text-sm text-muted-foreground">
            Create classes, share invite links, and author scoped questions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : hasClasses ? (
        <div className="space-y-4">
          {classes.map((klass) => {
            const questions = questionLists[klass.id]
            return (
              <Card key={klass.id} className="glass border-white/10">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      {klass.name}
                      <Badge variant="outline">{klass.enrollmentCount} members</Badge>
                      <Badge variant="outline">{klass.questionCount} questions</Badge>
                    </CardTitle>
                    <CardDescription>Invite code: {klass.inviteCode}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => copyInviteLink(klass.inviteCode)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy invite link
                    </Button>
                    <Button onClick={() => openQuestionDrawer(klass)} disabled={skills.length === 0}>
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Create question
                    </Button>
                    <Button variant="ghost" onClick={() => loadQuestions(klass)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      View questions
                    </Button>
                  </div>
                </CardHeader>
                {questions && (
                  <CardContent className="space-y-3 max-h-72 overflow-y-auto border-t border-white/5 pt-4">
                    {questions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No questions yet for this class.</p>
                    )}
                    {questions.map((question) => (
                      <div key={question.id} className="rounded-lg border border-white/10 p-4">
                        <div className="flex items-center justify-between">
                          <Badge className={difficultyBadge(question.difficulty)}>
                            {question.difficulty.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary">{question.skillName}</Badge>
                        </div>
                        <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{question.prompt}</p>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )
          })}
          <Card className="glass border-dashed border-white/20 text-center">
            <CardContent className="space-y-3 py-8">
              <p className="text-muted-foreground">Need another class? Spin one up anytime.</p>
              <Button onClick={() => setClassDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create class
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="glass border-dashed border-white/20 text-center py-16">
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">No classes yet. Create your first class to get started.</p>
            <Button onClick={() => setClassDialogOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create a class
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateClass}>
            <DialogHeader>
              <DialogTitle>Create a new class</DialogTitle>
              <DialogDescription>Give your class a memorable name for students to recognize.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Label htmlFor="class-name">Class name</Label>
              <Input
                id="class-name"
                value={newClassName}
                onChange={(event) => setNewClassName(event.target.value)}
                placeholder="e.g. Cohort A - Spring"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creatingClass}>
                {creatingClass ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Drawer open={Boolean(questionDrawer)} onOpenChange={(open) => !open && setQuestionDrawer(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Create question for {questionDrawer?.name}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleQuestionSubmit} className="max-h-[70vh] overflow-y-auto px-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skill-select">Skill</Label>
              <Select
                value={questionForm.skillId}
                onValueChange={(value) => setQuestionForm((prev) => ({ ...prev, skillId: value }))}
                disabled={skills.length === 0}
              >
                <SelectTrigger id="skill-select">
                  <SelectValue placeholder="Select a skill" />
                </SelectTrigger>
                <SelectContent>
                  {skills.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={questionForm.difficulty}
                onValueChange={(value) =>
                  setQuestionForm((prev) => ({ ...prev, difficulty: value as "easy" | "medium" | "hard" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                value={questionForm.prompt}
                onChange={(event) => setQuestionForm((prev) => ({ ...prev, prompt: event.target.value }))}
                placeholder="Write the question prompt (supports Markdown)."
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Starter code (optional)</Label>
              <Textarea
                value={questionForm.starterCode}
                onChange={(event) => setQuestionForm((prev) => ({ ...prev, starterCode: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Reference solution (optional)</Label>
              <Textarea
                value={questionForm.answer}
                onChange={(event) => setQuestionForm((prev) => ({ ...prev, answer: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-4">
              <div>
                <Label className="font-semibold text-accent">Automated test cases</Label>
                <p className="text-xs text-muted-foreground">
                  Provide between {MIN_TEST_CASES} and {MAX_TEST_CASES} JSON snippets describing the inputs and expected
                  outputs for your grader.
                </p>
              </div>
              <div className="space-y-3">
                {testCases.map((testCase, index) => (
                  <div
                    key={`test-case-${index}`}
                    className="rounded-xl border border-white/10 bg-background/40 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-accent">Test case #{index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={testCases.length <= MIN_TEST_CASES}
                        onClick={() => removeTestCase(index)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Input JSON</Label>
                      <Textarea
                        value={testCase.input}
                        onChange={(event) => updateTestCase(index, "input", event.target.value)}
                        rows={3}
                        placeholder='{"mode":"function","function":"add_numbers","args":[1,2]}'
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected output JSON</Label>
                      <Textarea
                        value={testCase.expectedOutput}
                        onChange={(event) => updateTestCase(index, "expectedOutput", event.target.value)}
                        rows={2}
                        placeholder="3"
                      />
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <Label>Timeout (ms)</Label>
                        <Input
                          type="number"
                          min={250}
                          max={6000}
                          value={testCase.timeoutMs}
                          onChange={(event) => updateTestCase(index, "timeoutMs", Number(event.target.value) || 0)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`hidden-${index}`}
                          checked={testCase.hidden}
                          onCheckedChange={(checked) => updateTestCase(index, "hidden", checked)}
                        />
                        <Label htmlFor={`hidden-${index}`}>Hidden</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={addTestCase}
                disabled={testCases.length >= MAX_TEST_CASES}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add test case
              </Button>
            </div>
            <DrawerFooter className="flex flex-row gap-3">
              <Button type="submit" disabled={submittingQuestion || !questionDrawer}>
                {submittingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save question"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setQuestionDrawer(null)}>
                Cancel
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
