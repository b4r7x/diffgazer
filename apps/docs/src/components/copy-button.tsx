import { Button } from "@/components/ui/button/button"
import { toast } from "@/components/ui/toast"
import { useCopyFeedback } from "@/lib/use-copy-feedback"

interface CopyButtonProps {
  text: string
  className?: string
  label?: string
  title?: string
  successMessage?: string
}

async function writeToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  try {
    const ok = document.execCommand("copy")
    if (!ok) throw new Error("execCommand copy returned false")
  } finally {
    document.body.removeChild(textarea)
  }
}

export function CopyButton({ text, className, label, title, successMessage }: CopyButtonProps) {
  const { copied, showCopied } = useCopyFeedback()

  const handleCopy = async () => {
    try {
      await writeToClipboard(text)
      showCopied()
      toast.success(successMessage ?? "Copied to clipboard")
    } catch (error) {
      console.error("CopyButton: failed to write to clipboard", error)
      toast.error("Couldn't copy to clipboard")
    }
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
