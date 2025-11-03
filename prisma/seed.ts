import { PrismaClient, Role } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting seed...")

  // Create demo users
  const student = await prisma.user.upsert({
    where: { email: "student@demo.com" },
    update: {},
    create: {
      email: "student@demo.com",
      role: Role.STUDENT,
    },
  })

  const instructor = await prisma.user.upsert({
    where: { email: "instructor@demo.com" },
    update: {},
    create: {
      email: "instructor@demo.com",
      role: Role.INSTRUCTOR,
    },
  })

  console.log("Created users:", { student, instructor })

  // Create skills
  const variablesSkill = await prisma.skill.upsert({
    where: { name: "Variables" },
    update: {},
    create: {
      name: "Variables",
      order: 1,
    },
  })

  const loopsSkill = await prisma.skill.upsert({
    where: { name: "Loops" },
    update: {},
    create: {
      name: "Loops",
      order: 2,
    },
  })

  const functionsSkill = await prisma.skill.upsert({
    where: { name: "Functions" },
    update: {},
    create: {
      name: "Functions",
      order: 3,
    },
  })

  console.log("Created skills:", { variablesSkill, loopsSkill, functionsSkill })

  // Create questions
  const questions = [
    {
      prompt: 'Write a Python statement that creates a variable named "age" and assigns it the value 25.',
      starter: "# Create your variable here\n",
      answer: "age = 25",
      difficulty: 1,
      skillId: variablesSkill.id,
    },
    {
      prompt:
        'Create two variables: "first_name" with value "John" and "last_name" with value "Doe". Then print them together.',
      starter: "# Create your variables here\n",
      answer: 'first_name = "John"',
      difficulty: 2,
      skillId: variablesSkill.id,
    },
    {
      prompt: "Write a for loop that prints numbers from 1 to 5.",
      starter: "# Write your loop here\n",
      answer: "for i in range(1, 6):",
      difficulty: 2,
      skillId: loopsSkill.id,
    },
    {
      prompt: "Create a while loop that counts down from 10 to 1 and prints each number.",
      starter: "# Write your while loop here\ncount = 10\n",
      answer: "while count >= 1:",
      difficulty: 3,
      skillId: loopsSkill.id,
    },
    {
      prompt: 'Define a function called "greet" that takes a name parameter and returns "Hello, [name]!"',
      starter: "# Define your function here\n",
      answer: "def greet(name):",
      difficulty: 2,
      skillId: functionsSkill.id,
    },
    {
      prompt: 'Write a function called "add_numbers" that takes two parameters and returns their sum.',
      starter: "# Define your function here\n",
      answer: "def add_numbers",
      difficulty: 2,
      skillId: functionsSkill.id,
    },
  ]

  for (const question of questions) {
    await prisma.question.create({
      data: question,
    })
  }

  console.log("Created questions")
  console.log("Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error("Error during seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
