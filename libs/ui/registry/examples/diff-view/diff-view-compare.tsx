import { DiffView } from "@/components/ui/diff-view"

const before = `import type { Review } from "../types"

export function calculateScore(review: Review): number {
  return review.findings.length * 10
}

export function isPassingScore(score: number): boolean {
  return score >= 70
}`

const after = `import type { Review } from "../types"

export function calculateScore(review: Review, weights: Record<string, number>): number {
  return review.findings.reduce((total, finding) => {
    const weight = weights[finding.severity] ?? 1
    return total + weight
  }, 0)
}

export function isPassingScore(score: number): boolean {
  return score >= 70
}`

export default function DiffViewCompare() {
  return <DiffView before={before} after={after} mode="split" />
}
