"use client"

import * as React from "react"
import Editor from "react-simple-code-editor"
import { highlight, languages } from "prismjs"
import "prismjs/components/prism-python"
import "prismjs/themes/prism-tomorrow.css"

import { cn } from "@/lib/utils"

const fallbackLanguage = languages.python || languages.javascript

type CodeEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function CodeEditor({ value, onChange, placeholder, disabled, className, id }: CodeEditorProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border/60 bg-background/80 font-mono text-sm shadow-inner",
        disabled && "opacity-70",
        className,
      )}
    >
      <Editor
        value={value}
        onValueChange={onChange}
        textareaId={id}
        disabled={disabled}
        placeholder={placeholder}
        highlight={(code) => highlight(code, fallbackLanguage, "python")}
        padding={16}
        tabSize={2}
        insertSpaces
        preClassName="editor-pre"
        className="min-h-[320px] text-foreground outline-none [&_.editor-pre]:whitespace-pre [&_.editor-pre]:break-words"
        style={{
          fontFamily: '"Fira Code", "Fira Mono", Menlo, Monaco, Consolas, "Courier New", monospace',
          lineHeight: "1.5",
        }}
      />
    </div>
  )
}
