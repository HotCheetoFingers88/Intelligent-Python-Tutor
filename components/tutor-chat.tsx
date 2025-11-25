"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Bot, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

export type HintTier = "simple" | "medium" | "worked_example"

export type ChatMessage = {
  id: string
  author: "tutor" | "system"
  tier?: HintTier
  content: string
  code?: string
  timestamp: Date
}

type TutorChatProps = {
  messages: ChatMessage[]
  onRequestHint: (tier: HintTier) => void
  availableTiers: Record<HintTier, boolean>
  revealedTiers: Set<HintTier>
  onClose?: () => void
}

const tierLabels: Record<HintTier, string> = {
  simple: "Simple",
  medium: "Medium",
  worked_example: "Worked example",
}

export function TutorChat({ messages, onRequestHint, availableTiers, revealedTiers, onClose }: TutorChatProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  return (
    <Card className="glass-strong border-white/10 h-full flex flex-col w-full" role="region" aria-label="Tutor chat">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-accent flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Hint Bot
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">Close tutor chat</span>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-3">
          {(Object.keys(tierLabels) as HintTier[]).map((tier) => (
            <Button
              key={tier}
              variant={revealedTiers.has(tier) ? "secondary" : "outline"}
              size="sm"
              disabled={!availableTiers[tier]}
              className="text-xs uppercase tracking-wide"
              onClick={() => onRequestHint(tier)}
            >
              {tierLabels[tier]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ScrollArea className="h-[420px] pr-3" aria-live="polite">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                  message.author === "tutor"
                    ? "bg-white/5 border border-white/10 text-muted-foreground"
                    : "bg-primary/10 border border-primary/30 text-primary-foreground",
                )}
              >
                {message.tier && (
                  <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                    {tierLabels[message.tier]}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.code && (
                  <div className="mt-3 rounded-lg bg-background/70 p-3 font-mono text-xs text-muted-foreground border border-white/10 relative">
                    <pre>{message.code}</pre>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="gap-1 text-xs absolute top-2 right-2"
                      onClick={() => {
                        navigator.clipboard.writeText(message.code ?? "")
                        setCopiedId(message.id)
                        setTimeout(() => setCopiedId(null), 1500)
                      }}
                    >
                      {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
