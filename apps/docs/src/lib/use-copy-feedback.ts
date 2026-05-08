import { useEffect, useRef, useState } from "react"

const COPY_FEEDBACK_MS = 2000

type TimerRef = {
  current: ReturnType<typeof setTimeout> | null
}

function clearFeedbackTimer(timerRef: TimerRef) {
  if (timerRef.current === null) return
  clearTimeout(timerRef.current)
  timerRef.current = null
}

export function useCopyFeedback() {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => clearFeedbackTimer(copyTimerRef)
  }, [])

  const showCopied = () => {
    clearFeedbackTimer(copyTimerRef)
    setCopied(true)
    copyTimerRef.current = setTimeout(() => {
      setCopied(false)
      copyTimerRef.current = null
    }, COPY_FEEDBACK_MS)
  }

  return { copied, showCopied }
}
