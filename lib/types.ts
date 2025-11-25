export interface User {
  id: string
  email: string
  username: string
  role: "student" | "instructor"
  createdAt: Date
}

export interface Skill {
  id: string
  name: string
  order: number
  createdAt: Date
}

export interface Question {
  id: string
  prompt: string
  starter: string | null
  answer: string | null
  difficulty: "easy" | "medium" | "hard"
  skillId: string
  classId: string
  createdById: string
  createdAt: Date
}

export interface TestCase {
  id: string
  questionId: string
  input: string
  expectedOutput: string
  timeoutMs: number
  hidden: boolean
  createdAt: Date
}

export interface Attempt {
  id: string
  userId: string
  questionId: string
  correct: boolean
  elapsedMs: number
  details?: unknown
  createdAt: Date
}

export interface Mastery {
  id: string
  userId: string
  skillId: string
  pKnown: number
  updatedAt: Date
}

export interface Recommendation {
  id: string
  userId: string
  skillId: string
  rationale: string
  createdAt: Date
}

export interface QuestionWithSkill extends Question {
  skill: Skill
}

export interface MasteryWithSkill extends Mastery {
  skill: Skill
}

export interface RecommendationWithSkill extends Recommendation {
  skill: Skill
}

export interface ClassSummary {
  id: string
  name: string
  inviteCode: string
  createdAt: Date
}

export interface Enrollment {
  id: string
  classId: string
  userId: string
  role: "student" | "instructor"
  createdAt: Date
}
