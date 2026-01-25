# Phase 5: GitHub Actions Integration

## Overview

Create GitHub Actions workflow for automated PR review.

**Priority:** MEDIUM
**Dependencies:** Phases 1-4 complete

---

## Context

### What is GitHub Actions Integration?

Automated AI review that runs on every PR:
1. PR opened/updated → Action triggers
2. Get PR diff
3. Run triage with strict profile
4. Post results as:
   - Check annotations (Files changed UI)
   - PR comment with summary

### Why GitHub Actions?

- Automated review on every PR
- Catches issues before human review
- Consistent review quality
- No manual CLI usage needed

### Security Considerations

- Use `pull_request` event (not `pull_request_target`)
- Don't expose secrets to fork PRs
- Option: Manual trigger with `/ai-review` comment

---

## Agent 5.1: PR Review Endpoint

```
subagent_type: "backend-development:backend-architect"

Task: Create server endpoint for PR diff review with annotation output.

Create: apps/server/src/api/routes/pr-review.ts

IMPORTANT:
- Accept raw diff as input
- Return GitHub-compatible annotations format
- Support profile selection

Implementation:

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { triageReview } from '@repo/core/review';
import { getProfile } from '@repo/core/review/profiles';
import { initializeAIClient } from '../../lib/ai-client';

const prReviewRouter = new Hono();

// Request schema
const PrReviewRequestSchema = z.object({
  diff: z.string().min(1),
  profile: z.string().default('strict'),
  lenses: z.array(z.string()).optional(),
  baseRef: z.string().optional(),
  headRef: z.string().optional(),
});

// Response types
interface Annotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: 'notice' | 'warning' | 'failure';
  message: string;
  title: string;
}

interface PrReviewResponse {
  summary: string;
  issueCount: number;
  issues: Array<{
    id: string;
    severity: string;
    title: string;
    file: string;
    line: number;
    message: string;
    suggestion?: string;
  }>;
  annotations: Annotation[];
}

// Severity to annotation level mapping
function severityToLevel(severity: string): Annotation['annotation_level'] {
  switch (severity) {
    case 'blocker':
    case 'high':
      return 'failure';
    case 'medium':
      return 'warning';
    default:
      return 'notice';
  }
}

prReviewRouter.post(
  '/',
  zValidator('json', PrReviewRequestSchema),
  async (c) => {
    const body = c.req.valid('json');

    // Initialize AI client
    const clientResult = await initializeAIClient();
    if (!clientResult.ok) {
      return c.json({ error: 'AI client not configured' }, 500);
    }

    // Get lenses from profile or explicit
    const profile = getProfile(body.profile);
    const lenses = body.lenses ?? profile?.lenses ?? ['correctness', 'security'];

    // Run triage
    const result = await triageReview(clientResult.value, body.diff, {
      lenses,
      severityFilter: profile?.severityFilter,
    });

    if (!result.ok) {
      return c.json({
        error: 'Review failed',
        message: result.error.message
      }, 500);
    }

    const { summary, issues } = result.value;

    // Convert to annotations
    const annotations: Annotation[] = issues
      .filter(issue => issue.location?.file && issue.location?.lineStart)
      .map(issue => ({
        path: issue.location!.file,
        start_line: issue.location!.lineStart!,
        end_line: issue.location!.lineEnd ?? issue.location!.lineStart!,
        annotation_level: severityToLevel(issue.severity),
        title: `[${issue.severity.toUpperCase()}] ${issue.title}`,
        message: [
          issue.symptom ?? issue.description,
          '',
          issue.recommendation ? `Recommendation: ${issue.recommendation}` : '',
        ].filter(Boolean).join('\n'),
      }));

    // Build response
    const response: PrReviewResponse = {
      summary,
      issueCount: issues.length,
      issues: issues.map(issue => ({
        id: issue.id,
        severity: issue.severity,
        title: issue.title,
        file: issue.location?.file ?? 'unknown',
        line: issue.location?.lineStart ?? 0,
        message: issue.symptom ?? issue.description ?? '',
        suggestion: issue.recommendation,
      })),
      annotations,
    };

    return c.json(response);
  }
);

export { prReviewRouter };

Update: apps/server/src/app.ts
- Import and mount: app.route('/pr-review', prReviewRouter)

Steps:
1. Create pr-review.ts
2. Mount route in app.ts
3. Run: npm run type-check
4. Test with curl

Output: PR review endpoint
```

---

## Agent 5.2: GitHub Actions Workflow

```
subagent_type: "backend-development:backend-architect"

Task: Create GitHub Actions workflow file.

Create: .github/workflows/ai-review.yml

IMPORTANT:
- Use pull_request (safe for forks)
- Support GEMINI_API_KEY as secret
- Output annotations format

Implementation:

name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'PR number to review'
        required: true
        type: number

# Only allow one review per PR at a time
concurrency:
  group: ai-review-${{ github.event.pull_request.number || github.event.inputs.pr_number }}
  cancel-in-progress: true

jobs:
  review:
    runs-on: ubuntu-latest
    # Don't run on fork PRs (no secrets available)
    if: github.event.pull_request.head.repo.full_name == github.repository || github.event_name == 'workflow_dispatch'

    permissions:
      contents: read
      pull-requests: write
      checks: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build

      - name: Get PR diff
        id: diff
        run: |
          if [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
            gh pr diff ${{ github.event.inputs.pr_number }} > pr.diff
          else
            git diff origin/${{ github.base_ref }}...HEAD > pr.diff
          fi
          echo "diff_size=$(wc -c < pr.diff)" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ github.token }}

      - name: Check diff size
        if: steps.diff.outputs.diff_size > 524288
        run: |
          echo "::warning::Diff too large for full review (>512KB). Reviewing partial."
          head -c 524288 pr.diff > pr.diff.tmp && mv pr.diff.tmp pr.diff

      - name: Start review server
        run: |
          npm run -w apps/server start &
          sleep 5
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Run AI Review
        id: review
        run: |
          DIFF_CONTENT=$(cat pr.diff)
          curl -s -X POST http://localhost:7860/pr-review \
            -H "Content-Type: application/json" \
            -d "$(jq -n --arg diff "$DIFF_CONTENT" '{
              diff: $diff,
              profile: "strict"
            }')" > review.json

          # Check for errors
          if jq -e '.error' review.json > /dev/null 2>&1; then
            echo "::error::Review failed: $(jq -r '.error' review.json)"
            exit 1
          fi

          # Output summary
          echo "## AI Review Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          jq -r '.summary' review.json >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Issues found:** $(jq '.issueCount' review.json)" >> $GITHUB_STEP_SUMMARY

          # Extract annotations
          jq '.annotations' review.json > annotations.json

      - name: Post annotations
        if: always() && steps.review.outcome == 'success'
        uses: yuzutech/annotations-action@v0.5.0
        with:
          repo-token: ${{ github.token }}
          input: annotations.json

      - name: Post PR comment
        if: always() && steps.review.outcome == 'success'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const review = JSON.parse(fs.readFileSync('review.json', 'utf8'));

            // Build comment body
            let body = `## 🔭 Stargazer AI Review\n\n`;
            body += `${review.summary}\n\n`;

            if (review.issues.length === 0) {
              body += `✅ No issues found!\n`;
            } else {
              body += `### Issues (${review.issues.length})\n\n`;

              // Group by severity
              const bySeverity = {};
              for (const issue of review.issues) {
                if (!bySeverity[issue.severity]) bySeverity[issue.severity] = [];
                bySeverity[issue.severity].push(issue);
              }

              for (const severity of ['blocker', 'high', 'medium', 'low', 'nit']) {
                const issues = bySeverity[severity] || [];
                if (issues.length === 0) continue;

                const emoji = { blocker: '🔴', high: '🟠', medium: '🟡', low: '🔵', nit: '⚪' }[severity];
                body += `#### ${emoji} ${severity.toUpperCase()} (${issues.length})\n\n`;

                for (const issue of issues.slice(0, 5)) {
                  body += `- **${issue.title}** - \`${issue.file}:${issue.line}\`\n`;
                  if (issue.suggestion) {
                    body += `  > ${issue.suggestion}\n`;
                  }
                }
                if (issues.length > 5) {
                  body += `  _...and ${issues.length - 5} more_\n`;
                }
                body += '\n';
              }
            }

            body += `\n---\n_Powered by [Stargazer](https://github.com/voitz/stargazer)_`;

            // Find existing comment
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const existingComment = comments.find(c =>
              c.user.type === 'Bot' && c.body.includes('Stargazer AI Review')
            );

            if (existingComment) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existingComment.id,
                body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body,
              });
            }

Steps:
1. Create .github/workflows/ if needed
2. Create ai-review.yml
3. Document required secrets

Output: GitHub Actions workflow
```

---

## Agent 5.3: CLI PR Review Command

```
subagent_type: "backend-development:backend-architect"

Task: Add CLI command for PR review with annotation output.

Create: apps/cli/src/features/review/apps/pr-review-app.tsx

For CI/scripting use:
stargazer review --pr --output annotations.json
stargazer review --pr --format json

Implementation:

import { render } from 'ink';
import { Box, Text } from 'ink';
import * as fs from 'node:fs/promises';
import { triageReview } from '@repo/core/review';
import { getProfile } from '@repo/core/review/profiles';
import { initializeAIClient } from '@/lib/api';
import type { TriageIssue } from '@repo/schemas';

interface PrReviewAppOptions {
  diff: string;           // Diff content or file path
  profile?: string;
  lenses?: string[];
  output?: string;        // Output file path
  format?: 'json' | 'annotations' | 'markdown';
}

interface AnnotationOutput {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: 'notice' | 'warning' | 'failure';
  message: string;
  title: string;
}

export async function runPrReview(options: PrReviewAppOptions): Promise<number> {
  const { diff, profile = 'strict', lenses, output, format = 'json' } = options;

  // Read diff
  let diffContent: string;
  try {
    // Check if it's a file path
    const stat = await fs.stat(diff).catch(() => null);
    if (stat?.isFile()) {
      diffContent = await fs.readFile(diff, 'utf-8');
    } else {
      diffContent = diff;
    }
  } catch {
    console.error('Failed to read diff');
    return 1;
  }

  // Initialize client
  const clientResult = await initializeAIClient();
  if (!clientResult.ok) {
    console.error('AI client not configured:', clientResult.error.message);
    return 1;
  }

  // Get profile lenses
  const profileConfig = getProfile(profile);
  const selectedLenses = lenses ?? profileConfig?.lenses ?? ['correctness', 'security'];

  // Run review
  console.error(`Running review with ${selectedLenses.join(', ')} lenses...`);
  const result = await triageReview(clientResult.value, diffContent, {
    lenses: selectedLenses,
    severityFilter: profileConfig?.severityFilter,
  });

  if (!result.ok) {
    console.error('Review failed:', result.error.message);
    return 1;
  }

  const { summary, issues } = result.value;

  // Format output
  let outputContent: string;

  if (format === 'annotations') {
    const annotations = issuesToAnnotations(issues);
    outputContent = JSON.stringify(annotations, null, 2);
  } else if (format === 'markdown') {
    outputContent = issuesToMarkdown(summary, issues);
  } else {
    outputContent = JSON.stringify({
      summary,
      issueCount: issues.length,
      issues: issues.map(i => ({
        id: i.id,
        severity: i.severity,
        title: i.title,
        file: i.location?.file,
        line: i.location?.lineStart,
        message: i.symptom ?? i.description,
        suggestion: i.recommendation,
      })),
      annotations: issuesToAnnotations(issues),
    }, null, 2);
  }

  // Write output
  if (output) {
    await fs.writeFile(output, outputContent);
    console.error(`Output written to ${output}`);
  } else {
    console.log(outputContent);
  }

  // Return exit code based on severity
  const hasBlocker = issues.some(i => i.severity === 'blocker');
  const hasHigh = issues.some(i => i.severity === 'high');

  if (hasBlocker) return 2;
  if (hasHigh) return 1;
  return 0;
}

function issuesToAnnotations(issues: TriageIssue[]): AnnotationOutput[] {
  return issues
    .filter(i => i.location?.file && i.location?.lineStart)
    .map(issue => ({
      path: issue.location!.file,
      start_line: issue.location!.lineStart!,
      end_line: issue.location!.lineEnd ?? issue.location!.lineStart!,
      annotation_level: severityToLevel(issue.severity),
      title: `[${issue.severity.toUpperCase()}] ${issue.title}`,
      message: [issue.symptom, issue.recommendation].filter(Boolean).join('\n\n'),
    }));
}

function severityToLevel(severity: string): AnnotationOutput['annotation_level'] {
  if (severity === 'blocker' || severity === 'high') return 'failure';
  if (severity === 'medium') return 'warning';
  return 'notice';
}

function issuesToMarkdown(summary: string, issues: TriageIssue[]): string {
  let md = `# AI Code Review\n\n${summary}\n\n`;
  md += `## Issues (${issues.length})\n\n`;

  for (const issue of issues) {
    md += `### ${issue.title}\n`;
    md += `**Severity:** ${issue.severity} | **File:** ${issue.location?.file}:${issue.location?.lineStart}\n\n`;
    if (issue.symptom) md += `${issue.symptom}\n\n`;
    if (issue.recommendation) md += `**Recommendation:** ${issue.recommendation}\n\n`;
    md += '---\n\n';
  }

  return md;
}

Update main CLI to accept --pr flag.

Steps:
1. Create pr-review-app.tsx
2. Add CLI argument parsing in main entry
3. Run: npm run type-check

Output: CLI PR review command
```

---

## Setup Instructions

### Required Secrets

In GitHub repository settings → Secrets and variables → Actions:

1. `GEMINI_API_KEY` - Google AI Studio API key
2. `OPENAI_API_KEY` (optional) - OpenAI API key
3. `ANTHROPIC_API_KEY` (optional) - Anthropic API key

### Testing Locally

```bash
# Get diff
git diff main...HEAD > pr.diff

# Run review
npm run -w apps/server start &
curl -X POST http://localhost:7860/pr-review \
  -H "Content-Type: application/json" \
  -d "{\"diff\": $(cat pr.diff | jq -Rs .), \"profile\": \"strict\"}"
```

---

## Validation Checklist

- [ ] `/pr-review` endpoint returns valid JSON
- [ ] Annotations format matches GitHub schema
- [ ] Workflow runs on PR
- [ ] Annotations appear in Files changed
- [ ] PR comment is created/updated
- [ ] Exit codes work correctly (0=clean, 1=high, 2=blocker)
