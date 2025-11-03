export interface User {
  id: string
  email: string
  role: "STUDENT" | "INSTRUCTOR"
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
  difficulty: number
  skillId: string
  createdAt: Date
}

export interface Attempt {
  id: string
  userId: string
  questionId: string
  correct: boolean
  elapsedMs: number
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
