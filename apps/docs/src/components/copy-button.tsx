import { Button } from "@/components/ui/button/button"
import { useCopyFeedback } from "@/lib/use-copy-feedback"

interface CopyButtonProps {
  text: string
  className?: string
  label?: string
  title?: string
}

export function CopyButton({ text, className, label, title }: CopyButtonProps) {
  const { copied, showCopied } = useCopyFeedback()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    showCopied()
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
