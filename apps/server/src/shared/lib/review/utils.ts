import type { Lens } from "@stargazer/schemas/review";

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function getThinkingMessage(lens: Lens): string {
  switch (lens.id) {
    case "correctness":
      return "Analyzing diff for bugs and logic errors...";
    case "security":
      return "Analyzing diff for security vulnerabilities...";
    case "performance":
      return "Analyzing diff for performance issues...";
    case "simplicity":
      return "Analyzing diff for complexity and maintainability...";
    case "tests":
      return "Analyzing diff for test coverage and quality...";
    default:
      return `Analyzing diff with ${lens.name} lens...`;
  }
}
