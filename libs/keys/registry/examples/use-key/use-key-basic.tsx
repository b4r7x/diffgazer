"use client"

import { KeyboardProvider, useKey } from "@diffgazer/keys"
import { useState } from "react"

function Counter() {
  const [count, setCount] = useState(0)

  useKey("ArrowUp", () => setCount((c) => c + 1))
  useKey("ArrowDown", () => setCount((c) => c - 1))
  useKey("Escape", () => setCount(0))

  return (
    <div>
      <p style={{ fontSize: 24, fontFamily: "ui-monospace, monospace", textAlign: "center" }}>{count}</p>
      <p>ArrowUp increments, ArrowDown decrements, Escape resets.</p>
    </div>
  )
}

export default function UseKeyBasic() {
  return (
    <KeyboardProvider>
      <Counter />
    </KeyboardProvider>
  )
}
