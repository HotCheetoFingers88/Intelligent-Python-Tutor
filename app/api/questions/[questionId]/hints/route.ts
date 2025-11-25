import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ questionId: string }>
}

export async function GET(_: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const { questionId } = resolvedParams

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      prompt: true,
      starter: true,
      answer: true,
      hintSimple: true,
      hintMedium: true,
      workedExample: true,
    },
  })

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 })
  }

  const fallbackSimple =
    question.hintSimple ??
    `Focus on translating this prompt literally: ${question.prompt.replace(/\s+/g, " ").trim()}`
  const fallbackMedium =
    question.hintMedium ??
    "Step through the code with a sample input and ensure each branch matches what the prompt describes."
  const fallbackWorked =
    question.workedExample ??
    (question.answer
      ? `Here is one way to implement it:\n\n\`\`\`python\n${question.answer}\n\`\`\``
      : "No worked example is available yet.")

  return NextResponse.json({
    simple: fallbackSimple,
    medium: fallbackMedium,
    worked_example: fallbackWorked,
  })
}
