# Phase 5: GitHub Actions Improvements

## Overview

Enhance GitHub Actions integration with inline PR comments, comment triggers, and better user experience.

**Priority:** MEDIUM
**Dependencies:** Phases 1-4 complete

---

## Context

### Current State
- Workflow exists at `.github/workflows/ai-review.yml`
- Posts annotations and PR comment
- Works for non-fork PRs

### Improvements Needed
1. Inline PR comments (on specific lines)
2. `/ai-review` comment trigger
3. Severity-based review events
4. Better error handling
5. Incremental review support

---

## Agent 5.1: Update PR Review Endpoint for Inline Comments

```
subagent_type: "backend-development:backend-architect"

Task: Extend PR review response to include inline comment format.

Read first:
- apps/server/src/api/routes/pr-review.ts
- packages/schemas/src/triage.ts

Modify: apps/server/src/api/routes/pr-review.ts

Add inline comments to response:

```typescript
// Add to types
interface InlineComment {
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
}

interface PrReviewResponse {
  summary: string;
  issueCount: number;
  issues: SimplifiedIssue[];
  annotations: Annotation[];
  inlineComments: InlineComment[];  // NEW
  reviewEvent: 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES';  // NEW
}

// Add helper function
function issueToInlineComment(issue: TriageIssue): InlineComment | null {
  if (!issue.file || !issue.line_start) return null;

  const severityEmoji: Record<string, string> = {
    blocker: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    nit: '⚪',
  };

  const emoji = severityEmoji[issue.severity] ?? '⚪';

  // Build comment body with markdown
  let body = `${emoji} **${issue.severity.toUpperCase()}**: ${issue.title}\n\n`;

  if (issue.symptom) {
    body += `${issue.symptom}\n\n`;
  }

  if (issue.recommendation) {
    body += `**Suggestion:** ${issue.recommendation}\n\n`;
  }

  // Add code suggestion if patch available
  if (issue.suggested_patch) {
    body += '```suggestion\n';
    body += issue.suggested_patch;
    body += '\n```\n';
  }

  return {
    path: issue.file,
    line: issue.line_start,
    side: 'RIGHT',
    body,
  };
}

// Add function to determine review event
function getReviewEvent(issues: TriageIssue[]): PrReviewResponse['reviewEvent'] {
  const hasBlocker = issues.some(i => i.severity === 'blocker');
  const hasHigh = issues.some(i => i.severity === 'high');

  if (hasBlocker) return 'REQUEST_CHANGES';
  if (hasHigh) return 'COMMENT';
  return 'APPROVE';
}

// Update the main handler to include new fields
const inlineComments = issues
  .map(issueToInlineComment)
  .filter((c): c is InlineComment => c !== null);

const response: PrReviewResponse = {
  summary,
  issueCount: issues.length,
  issues: simplifiedIssues,
  annotations,
  inlineComments,
  reviewEvent: getReviewEvent(issues),
};
```

Steps:
1. Add InlineComment type
2. Add conversion function
3. Add review event logic
4. Update response
5. Run: npm run type-check

Output: Inline comments in response
```

---

## Agent 5.2: Update GitHub Actions for Inline Comments

```
subagent_type: "backend-development:devops-engineer"

Task: Update GitHub Actions to post inline PR review comments.

Modify: .github/workflows/ai-review.yml

Replace the PR comment step with a PR review step:

```yaml
- name: Post PR review with inline comments
  if: steps.check-diff.outputs.skip != 'true' && always()
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');

      if (!fs.existsSync('review.json')) {
        console.log('No review results found');
        return;
      }

      const review = JSON.parse(fs.readFileSync('review.json', 'utf8'));
      const inlineComments = review.inlineComments || [];
      const reviewEvent = review.reviewEvent || 'COMMENT';

      // Build review body
      let body = `## 🔭 Stargazer AI Review\n\n`;
      body += `${review.summary}\n\n`;

      if (review.issueCount === 0) {
        body += `✅ **No issues found!** Great work!\n`;
      } else {
        body += `### Issues Found: ${review.issueCount}\n\n`;

        // Group by severity
        const bySeverity = {};
        for (const issue of review.issues || []) {
          if (!bySeverity[issue.severity]) bySeverity[issue.severity] = [];
          bySeverity[issue.severity].push(issue);
        }

        const severityOrder = ['blocker', 'high', 'medium', 'low', 'nit'];
        const severityEmoji = {
          blocker: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🔵',
          nit: '⚪'
        };

        for (const severity of severityOrder) {
          const issues = bySeverity[severity] || [];
          if (issues.length === 0) continue;

          body += `#### ${severityEmoji[severity]} ${severity.toUpperCase()} (${issues.length})\n\n`;

          for (const issue of issues.slice(0, 10)) {
            const location = issue.file ? `\`${issue.file}:${issue.line || '?'}\`` : '';
            body += `- **${issue.title}** ${location}\n`;
          }

          if (issues.length > 10) {
            body += `  _...and ${issues.length - 10} more_\n`;
          }
          body += '\n';
        }

        body += `\n*See inline comments for details.*\n`;
      }

      body += `\n---\n_Powered by [Stargazer](https://github.com/voitz/stargazer) AI Code Review_`;

      // Prepare comments (max 50 per GitHub limits)
      const comments = inlineComments.slice(0, 50).map(c => ({
        path: c.path,
        line: c.line,
        side: c.side || 'RIGHT',
        body: c.body,
      }));

      try {
        // Post review with inline comments
        await github.rest.pulls.createReview({
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: context.issue.number,
          event: reviewEvent,
          body: body,
          comments: comments,
        });

        console.log(`Posted ${reviewEvent} review with ${comments.length} inline comments`);
      } catch (error) {
        console.error('Failed to post PR review:', error.message);

        // Fallback to regular comment
        try {
          // Find existing bot comment
          const { data: existingComments } = await github.rest.issues.listComments({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: context.issue.number,
          });

          const botComment = existingComments.find(c =>
            c.user.type === 'Bot' && c.body.includes('Stargazer AI Review')
          );

          if (botComment) {
            await github.rest.issues.updateComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: botComment.id,
              body: body,
            });
          } else {
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: body,
            });
          }
        } catch (commentError) {
          console.error('Failed to post comment:', commentError.message);
        }
      }
```

Steps:
1. Update the Post step
2. Add inline comments handling
3. Add review event logic
4. Add fallback to regular comment
5. Test on a PR

Output: Inline comments posted
```

---

## Agent 5.3: Add Comment Trigger

```
subagent_type: "backend-development:devops-engineer"

Task: Add /ai-review comment trigger to GitHub Actions.

Modify: .github/workflows/ai-review.yml

Add at the top:
```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

permissions:
  contents: read
  checks: write
  pull-requests: write

jobs:
  # Job to check if comment trigger is valid
  check-trigger:
    runs-on: ubuntu-latest
    if: github.event_name == 'issue_comment'
    outputs:
      should_run: ${{ steps.check.outputs.should_run }}
      pr_number: ${{ steps.check.outputs.pr_number }}
    steps:
      - name: Check for /ai-review command
        id: check
        uses: actions/github-script@v7
        with:
          script: |
            const comment = context.payload.comment.body.trim().toLowerCase();
            const isPR = !!context.payload.issue.pull_request;

            // Check if this is a valid trigger
            if (isPR && (comment === '/ai-review' || comment === '/review')) {
              core.setOutput('should_run', 'true');
              core.setOutput('pr_number', context.payload.issue.number);

              // Add reaction to show we're processing
              await github.rest.reactions.createForIssueComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: context.payload.comment.id,
                content: 'rocket',
              });

              console.log('Triggered AI review for PR #' + context.payload.issue.number);
            } else {
              core.setOutput('should_run', 'false');
              console.log('Not a valid trigger: isPR=' + isPR + ', comment=' + comment);
            }

  # Main review job
  review:
    runs-on: ubuntu-latest
    needs: [check-trigger]
    # Run on PR events, or on comment trigger
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && needs.check-trigger.outputs.should_run == 'true')

    steps:
      - name: Get PR number
        id: pr
        run: |
          if [ "${{ github.event_name }}" == "issue_comment" ]; then
            echo "number=${{ needs.check-trigger.outputs.pr_number }}" >> "$GITHUB_OUTPUT"
          else
            echo "number=${{ github.event.pull_request.number }}" >> "$GITHUB_OUTPUT"
          fi

      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: ${{ github.event_name == 'issue_comment' && format('refs/pull/{0}/head', steps.pr.outputs.number) || '' }}

      # ... rest of the workflow
```

Also add a job to handle fork PRs with comment trigger:
```yaml
  # Separate job for fork PRs - only on comment trigger by maintainer
  review-fork:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'issue_comment' &&
      github.event.issue.pull_request &&
      github.event.comment.body == '/ai-review'

    steps:
      - name: Check if user is collaborator
        id: check-collab
        uses: actions/github-script@v7
        with:
          script: |
            try {
              const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
                owner: context.repo.owner,
                repo: context.repo.repo,
                username: context.payload.comment.user.login,
              });
              const hasPermission = ['admin', 'write'].includes(data.permission);
              core.setOutput('has_permission', hasPermission ? 'true' : 'false');
            } catch {
              core.setOutput('has_permission', 'false');
            }

      - name: Run review (if permitted)
        if: steps.check-collab.outputs.has_permission == 'true'
        run: echo "Would run review here..."
        # ... full review steps
```

Steps:
1. Add issue_comment trigger
2. Add check-trigger job
3. Update review job condition
4. Add PR number handling
5. Add fork PR handling
6. Test with comment

Output: Comment trigger working
```

---

## Agent 5.4: Add Workflow Status Updates

```
subagent_type: "backend-development:devops-engineer"

Task: Add status updates during the review process.

Modify: .github/workflows/ai-review.yml

Add status comments to show progress:

```yaml
- name: Post "review started" status
  if: steps.check-diff.outputs.skip != 'true'
  uses: actions/github-script@v7
  with:
    script: |
      // Find existing status comment or create new
      const { data: comments } = await github.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
      });

      const statusComment = comments.find(c =>
        c.user.type === 'Bot' && c.body.includes('🔭 AI Review Status')
      );

      const body = `### 🔭 AI Review Status\n\n` +
        `⏳ **Review in progress...**\n\n` +
        `- Analyzing ${process.env.DIFF_LINES || 'N/A'} lines of changes\n` +
        `- Using profile: \`strict\`\n\n` +
        `_Started at ${new Date().toISOString()}_`;

      if (statusComment) {
        await github.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: statusComment.id,
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
  env:
    DIFF_LINES: ${{ steps.diff.outputs.lines }}

# After review completes, update the status comment
- name: Update status to complete
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      // Delete or update the status comment
      const { data: comments } = await github.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
      });

      const statusComment = comments.find(c =>
        c.user.type === 'Bot' && c.body.includes('🔭 AI Review Status')
      );

      if (statusComment) {
        // Delete it since the main review comment has the results
        await github.rest.issues.deleteComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: statusComment.id,
        });
      }
```

Steps:
1. Add status comment step
2. Add completion cleanup
3. Test workflow

Output: Status updates during review
```

---

## Agent 5.5: Document GitHub Actions Setup

```
subagent_type: "documentation-specialist"

Task: Create documentation for GitHub Actions setup.

Create: docs/github-actions-setup.md

```markdown
# GitHub Actions Setup for Stargazer AI Review

## Quick Start

1. **Add the workflow file** (already done if you cloned the repo):
   ```
   .github/workflows/ai-review.yml
   ```

2. **Configure secrets** in your repository settings:
   - Go to Settings → Secrets and variables → Actions
   - Add one of these API keys:
     - `GEMINI_API_KEY` (recommended - free tier available)
     - `OPENAI_API_KEY`
     - `ANTHROPIC_API_KEY`

3. **Create a PR** and watch the magic happen!

## Features

### Automatic Review
Reviews run automatically on:
- PR opened
- New commits pushed to PR

### Comment Trigger
Trigger a review manually by commenting:
```
/ai-review
```
or
```
/review
```

### Inline Comments
Issues are posted as inline comments on the specific lines:
- 🔴 BLOCKER - Requests changes
- 🟠 HIGH - Comments
- 🟡 MEDIUM - Notices
- 🔵 LOW - Notices
- ⚪ NIT - Optional

### Code Suggestions
When a fix is available, you'll see a "suggestion" block that you can apply with one click.

## Configuration

### Review Profile
Default profile is `strict` (correctness + security + tests).

To change, edit the workflow:
```yaml
-d '{"diff": $DIFF_CONTENT, "profile": "quick"}'
```

Available profiles:
- `strict` - Full review (default)
- `quick` - Only high severity correctness issues
- `security` - Security focused
- `perf` - Performance focused

### Diff Size Limit
Maximum diff size is 5000 lines by default.

### Skip Review
Add `[skip review]` to your commit message to skip AI review.

## Security Notes

### Fork PRs
For security, automatic reviews don't run on fork PRs.

Maintainers can trigger manually with `/ai-review`.

### Secrets
- Never commit API keys
- Use GitHub Secrets for all keys
- Keys are not exposed in logs

## Troubleshooting

### "AI client not configured"
- Check that the API key secret is set correctly
- Verify the key is valid by testing locally

### "Diff too large"
- The PR has too many changes
- Consider splitting into smaller PRs
- Or increase the limit in the workflow

### Review not appearing
- Check the Actions tab for errors
- Verify the workflow file is correct
- Check repository permissions

## Cost Estimates

Using Gemini Flash (free tier):
- ~100 reviews/month included
- Additional: ~$0.01 per review

Using OpenAI GPT-4:
- ~$0.10-0.50 per review depending on diff size

Using Anthropic Claude:
- ~$0.05-0.20 per review
```

Steps:
1. Create docs directory if needed
2. Create setup documentation
3. Add troubleshooting section
4. Add cost estimates

Output: GitHub Actions documentation
```

---

## Validation Checklist

- [ ] /pr-review endpoint includes inlineComments
- [ ] /pr-review endpoint includes reviewEvent
- [ ] Workflow posts inline comments on PR
- [ ] `/ai-review` comment triggers review
- [ ] Status updates show during review
- [ ] Fork PRs handled with maintainer trigger
- [ ] Documentation created
- [ ] Works with GEMINI_API_KEY secret
