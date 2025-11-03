"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, Trash2, Code2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import type { Question, Skill } from "@/lib/types"

interface QuestionWithSkillName extends Question {
  skillName: string
}

export function QuestionsManager() {
  const [questions, setQuestions] = useState<QuestionWithSkillName[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithSkillName | null>(null)
  const [formData, setFormData] = useState({
    prompt: "",
    starter: "",
    answer: "",
    difficulty: "1",
    skillId: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [questionsRes, skillsRes] = await Promise.all([fetch("/api/questions"), fetch("/api/skills")])

      if (!questionsRes.ok || !skillsRes.ok) throw new Error("Failed to fetch data")

      const questionsData = await questionsRes.json()
      const skillsData = await skillsRes.json()

      setQuestions(questionsData.questions)
      setSkills(skillsData.skills)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingQuestion ? `/api/questions/${editingQuestion.id}` : "/api/questions"
      const method = editingQuestion ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: formData.prompt,
          starter: formData.starter || null,
          answer: formData.answer || null,
          difficulty: Number.parseInt(formData.difficulty),
          skillId: formData.skillId,
        }),
      })

      if (!response.ok) throw new Error("Failed to save question")

      toast({
        title: "Success",
        description: `Question ${editingQuestion ? "updated" : "created"} successfully.`,
      })

      setDialogOpen(false)
      setEditingQuestion(null)
      setFormData({ prompt: "", starter: "", answer: "", difficulty: "1", skillId: "" })
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save question. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (question: QuestionWithSkillName) => {
    setEditingQuestion(question)
    setFormData({
      prompt: question.prompt,
      starter: question.starter || "",
      answer: question.answer || "",
      difficulty: question.difficulty.toString(),
      skillId: question.skillId,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) {
      return
    }

    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete question")

      toast({
        title: "Success",
        description: "Question deleted successfully.",
      })

      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete question. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingQuestion(null)
    setFormData({ prompt: "", starter: "", answer: "", difficulty: "1", skillId: "" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Questions</h2>
          <p className="text-sm text-muted-foreground">Manage practice questions for each skill</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() =>
                setFormData({ prompt: "", starter: "", answer: "", difficulty: "1", skillId: skills[0]?.id || "" })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingQuestion ? "Edit Question" : "Add New Question"}</DialogTitle>
                <DialogDescription>
                  {editingQuestion ? "Update the question details below." : "Create a new practice question."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="skill">Skill</Label>
                  <Select
                    value={formData.skillId}
                    onValueChange={(value) => setFormData({ ...formData, skillId: value })}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="prompt">Question Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder="e.g., Write a function that returns the sum of two numbers"
                    required
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="starter">Starter Code (Optional)</Label>
                  <Textarea
                    id="starter"
                    value={formData.starter}
                    onChange={(e) => setFormData({ ...formData, starter: e.target.value })}
                    placeholder="e.g., def add(a, b):"
                    className="font-mono text-sm"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="answer">Expected Answer (Optional)</Label>
                  <Textarea
                    id="answer"
                    value={formData.answer}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    placeholder="e.g., def add(a, b):\n    return a + b"
                    className="font-mono text-sm"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty (1-3)</Label>
                  <Select
                    value={formData.difficulty}
                    onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Easy</SelectItem>
                      <SelectItem value="2">2 - Medium</SelectItem>
                      <SelectItem value="3">3 - Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No questions yet. Add your first question to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => (
            <Card key={question.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <Code2 className="h-3 w-3 mr-1" />
                        {question.skillName}
                      </Badge>
                      <Badge variant="secondary">Difficulty: {question.difficulty}/3</Badge>
                    </div>
                    <CardTitle className="text-base leading-relaxed">{question.prompt}</CardTitle>
                    {question.starter && (
                      <CardDescription className="font-mono text-xs bg-muted p-2 rounded">
                        {question.starter}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(question)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(question.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
