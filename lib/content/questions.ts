import { promises as fs } from "fs"
import path from "path"

type BaseTestCase = {
  hidden?: boolean
  timeoutMs?: number
  globals?: Record<string, unknown>
}

type AssertTestCase = BaseTestCase & {
  type: "assert"
  expression: string
  stdin?: string
}

type FunctionTestCase = BaseTestCase & {
  type: "function"
  function: string
  args?: unknown[]
  kwargs?: Record<string, unknown>
  expected: unknown
}

type ContentTestCase = AssertTestCase | FunctionTestCase

export type ContentQuestion = {
  id: string
  skill_id: string
  prompt: string
  starter?: string
  answer?: string
  difficulty: number
  tests?: ContentTestCase[]
}

let questionCache: Map<string, ContentQuestion> | null = null

async function loadQuestions(): Promise<Map<string, ContentQuestion>> {
  if (questionCache) {
    return questionCache
  }

  const filePath = path.join(process.cwd(), "content", "questions.json")
  const file = await fs.readFile(filePath, "utf8")
  const parsed: ContentQuestion[] = JSON.parse(file)
  questionCache = new Map(parsed.map((question) => [question.id, question]))
  return questionCache
}

export async function getContentQuestionById(id: string): Promise<ContentQuestion | undefined> {
  const cache = await loadQuestions()
  return cache.get(id)
}
