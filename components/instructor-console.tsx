"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SkillsManager } from "@/components/skills-manager"
import { QuestionsManager } from "@/components/questions-manager"
import { GraduationCap, FileQuestion } from "lucide-react"

export function InstructorConsole() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-accent">Instructor Console</h1>
        <p className="text-muted-foreground mt-1">Manage skills and questions for your students</p>
      </div>

      <Tabs defaultValue="skills" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 glass border-white/10">
          <TabsTrigger
            value="skills"
            className="flex items-center gap-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
          >
            <GraduationCap className="h-4 w-4" />
            Skills
          </TabsTrigger>
          <TabsTrigger
            value="questions"
            className="flex items-center gap-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
          >
            <FileQuestion className="h-4 w-4" />
            Questions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="mt-6">
          <SkillsManager />
        </TabsContent>

        <TabsContent value="questions" className="mt-6">
          <QuestionsManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
