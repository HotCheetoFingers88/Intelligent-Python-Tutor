"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactNode } from "react"

type LogoutButtonProps = {
  className?: string
  variant?: ComponentProps<typeof Button>["variant"]
  size?: ComponentProps<typeof Button>["size"]
  children?: ReactNode
}

export function LogoutButton({
  className,
  variant = "outline",
  size = "sm",
  children,
}: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()

  const handleLogout = () => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/logout", { method: "POST" })
        if (!response.ok) {
          throw new Error("Failed to log out")
        }
        router.push("/")
        router.refresh()
      } catch (error) {
        toast({
          title: "Unable to log out",
          description: (error as Error)?.message ?? "Please try again.",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleLogout}
      disabled={isPending}
      className={cn("gap-2", className)}
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      <span>{children ?? "Log Out"}</span>
    </Button>
  )
}
