import { useState } from "react"
import { Button } from "@/components/ui/button/button"

interface CopyButtonProps {
  text: string
  className?: string
  label?: string
  title?: string
}

export function CopyButton({ text, className, label, title }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const buttonLabel = copied ? "[ok]" : label ? `[${label}]` : "[cp]"

  return (
    <Button
      variant="ghost"
      size={label ? "sm" : "icon"}
      onClick={handleCopy}
      className={className}
      title={title}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      <span className="text-xs font-mono">
        {buttonLabel}
      </span>
    </Button>
  )
}
