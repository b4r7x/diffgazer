import { z } from "zod";

const FocusCommandSchema = z.object({
  type: z.literal("focus"),
  filter: z.string().min(1),
});

const IgnoreCommandSchema = z.object({
  type: z.literal("ignore"),
  pattern: z.string().min(1),
});

const RefineCommandSchema = z.object({
  type: z.literal("refine"),
  issueId: z.string().min(1),
});

const AskCommandSchema = z.object({
  type: z.literal("ask"),
  question: z.string().min(1),
});

const StopCommandSchema = z.object({
  type: z.literal("stop"),
});

export const FeedbackCommandSchema = z.discriminatedUnion("type", [
  FocusCommandSchema,
  IgnoreCommandSchema,
  RefineCommandSchema,
  AskCommandSchema,
  StopCommandSchema,
]);
export type FeedbackCommand = z.infer<typeof FeedbackCommandSchema>;

const COMMAND_PATTERNS: ReadonlyArray<{
  regex: RegExp;
  parse: (match: RegExpMatchArray) => FeedbackCommand | null;
}> = [
  {
    regex: /^focus\s+(.+)$/i,
    parse: (match) => {
      const filter = match[1]?.trim();
      return filter ? { type: "focus", filter } : null;
    },
  },
  {
    regex: /^ignore\s+(.+)$/i,
    parse: (match) => {
      const pattern = match[1]?.trim();
      return pattern ? { type: "ignore", pattern } : null;
    },
  },
  {
    regex: /^refine\s+(.+)$/i,
    parse: (match) => {
      const issueId = match[1]?.trim();
      return issueId ? { type: "refine", issueId } : null;
    },
  },
  {
    regex: /^ask\s+(.+)$/i,
    parse: (match) => {
      const question = match[1]?.trim();
      return question ? { type: "ask", question } : null;
    },
  },
  {
    regex: /^stop$/i,
    parse: () => ({ type: "stop" }),
  },
];

export function parseFeedbackCommand(input: string): FeedbackCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const { regex, parse } of COMMAND_PATTERNS) {
    const match = trimmed.match(regex);
    if (match) {
      const command = parse(match);
      if (!command) return null;
      const result = FeedbackCommandSchema.safeParse(command);
      return result.success ? result.data : null;
    }
  }

  return null;
}
