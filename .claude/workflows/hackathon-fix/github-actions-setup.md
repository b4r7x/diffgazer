# GitHub Actions Setup Guide

## Overview

This guide explains how users can add Stargazer AI Review to their own GitHub repositories.

---

## Quick Setup (2 minutes)

### Step 1: Copy the Workflow File

Copy `.github/workflows/ai-review.yml` to your repository:

```bash
mkdir -p .github/workflows
cp /path/to/stargazer/.github/workflows/ai-review.yml .github/workflows/
```

Or create `.github/workflows/ai-review.yml` manually with the content from this repo.

### Step 2: Add API Key Secret

1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `GEMINI_API_KEY`
4. Value: Your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Step 3: Enable Workflow Permissions

1. Go to **Settings → Actions → General**
2. Under "Workflow permissions", select **Read and write permissions**
3. Check **Allow GitHub Actions to create and approve pull requests**

### Step 4: Push and Test

Create a PR with some code changes. The AI review will run automatically!

---

## How It Works

### Automatic Triggers

| Trigger | Description |
|---------|-------------|
| `pull_request: opened` | New PR opened |
| `pull_request: synchronize` | PR updated with new commits |
| `issue_comment: /ai-review` | Manual trigger via comment |

### What Gets Reviewed

- All changed files in the PR
- Maximum 5000 lines of diff (to avoid API limits)
- Fork PRs require manual trigger by maintainers (security)

### Output

1. **PR Review Comment** - Summary with issue counts by severity
2. **Inline Comments** - On specific lines where issues found
3. **Check Annotations** - In "Files Changed" tab

---

## Customization

### Change Review Profile

Edit the workflow to use different profiles:

```yaml
-d "{\"diff\": $DIFF_CONTENT, \"profile\": \"strict\"}"
```

Available profiles:
| Profile | Lenses | Min Severity |
|---------|--------|--------------|
| `quick` | correctness | high |
| `strict` | correctness, security, tests | all |
| `perf` | correctness, performance | medium |
| `security` | security, correctness | all |

### Use Different AI Provider

1. Change the secret name (e.g., `OPENAI_API_KEY`)
2. Update the environment variable in the workflow:

```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

3. Configure the server to use OpenAI (see server config docs)

### Limit Review to Specific Files

Add a step to filter files:

```yaml
- name: Filter diff
  run: |
    # Only review TypeScript files
    grep -E '^\+\+\+ b/.*\.(ts|tsx)$' pr.diff > filtered.diff || true
    mv filtered.diff pr.diff
```

---

## Security Considerations

### Fork PRs

Fork PRs don't have access to secrets by default. This is intentional!

Options:
1. **Maintainer trigger** - Comment `/ai-review` to run with secrets
2. **workflow_dispatch** - Manual trigger from Actions tab
3. **Environment protection** - Use environments with required reviewers

### Secret Protection

- Never log or expose API keys
- Use GitHub's secret masking
- The workflow already handles this correctly

### Code Injection

The workflow validates:
- Diff size limits (prevent DoS)
- JSON escaping (prevent injection)
- CORS localhost (server-side protection)

---

## Troubleshooting

### "No API key configured"

1. Check secret is named exactly `GEMINI_API_KEY`
2. Verify the key works: `curl https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY`

### "Diff too large"

Reduce PR scope or modify the size limit in workflow:

```yaml
elif [ "$DIFF_LINES" -gt 10000 ]; then  # Increase limit
```

### "Server not ready"

Increase wait time:

```yaml
for i in {1..60}; do  # Wait up to 60 seconds
```

### "Review API returned HTTP 500"

Check server logs. Common causes:
- Invalid diff format
- AI provider rate limiting
- Missing dependencies

---

## Advanced: Self-Hosted Deployment

For organizations wanting to run Stargazer on their own infrastructure:

### Option 1: GitHub Self-Hosted Runners

1. Set up a self-hosted runner
2. Pre-install Stargazer on the runner
3. Modify workflow to skip npm install/build steps

### Option 2: External Service

1. Deploy Stargazer server to a private cloud
2. Modify workflow to call external endpoint
3. Handle authentication via secrets

```yaml
- name: Run AI Review
  env:
    STARGAZER_ENDPOINT: ${{ secrets.STARGAZER_ENDPOINT }}
    STARGAZER_API_KEY: ${{ secrets.STARGAZER_API_KEY }}
  run: |
    curl -X POST "$STARGAZER_ENDPOINT/pr-review" \
      -H "Authorization: Bearer $STARGAZER_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"diff\": $DIFF_CONTENT}"
```

---

## Example Output

### PR Comment

```markdown
## 🔭 Stargazer AI Review

This PR introduces SQL query construction that may be vulnerable to injection.

### Issues Found: 3

| Severity | Count |
|----------|-------|
| high | 2 |
| medium | 1 |

*2 inline comments posted on specific lines.*

---
*Reviewed by Stargazer AI*
```

### Inline Comment

```markdown
🟠 **HIGH**: SQL Injection Risk

User input is concatenated directly into SQL query without sanitization.

**Suggestion:** Use parameterized queries instead.

\```suggestion
const query = 'SELECT * FROM users WHERE username = ?';
return db.query(query, [username]);
\```
```

---

## Support

- Issues: [GitHub Issues](https://github.com/your-org/stargazer/issues)
- Documentation: [Stargazer Docs](./docs/)
