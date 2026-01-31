# Backend Requirements: Agent Activity Display & Real Data Integration

## Context

The web frontend currently displays review/triage features using **hardcoded mock data**. We need real data from the backend to replace these mocks. The CLI already works with real data - we need parity.

**Who uses it:** Developers reviewing code changes via the web UI
**Goal:** Real-time agent activity display and accurate review statistics

---

## Current State: Mock Data Inventory

### 1. Review Page (`apps/web/src/app/pages/review.tsx`)

| Mock Location | Lines | What's Hardcoded |
|---------------|-------|------------------|
| `MOCK_ISSUES` | 18-144 | 6 fake issues with full details |
| `lensStats` | 150-154 | Hardcoded lens statistics (Security: 4, Performance: 5, Style: 3) |
| `stats` | 178 | `runId: "8821"`, `filesAnalyzed: 7` |
| `title` | 304 | `"Analysis #8821"` |

### 2. History Page (`apps/web/src/app/pages/history.tsx`)

| Mock Location | Lines | What's Hardcoded |
|---------------|-------|------------------|
| `MOCK_ISSUES` | 27-76 | 3 fake issues |
| `MOCK_RUNS` | 78-134 | 5 fake history runs |
| `TIMELINE_ITEMS` | 136-141 | 4 fake date buckets |
| `topLenses` | 169 | `["Security", "Auth", "OWASP"]` |
| `duration` | 318 | `"4m 12s"` |

### 3. Home Page (`apps/web/src/app/pages/home.tsx`)

| Mock Location | Lines | What's Hardcoded |
|---------------|-------|------------------|
| `DEMO_CONTEXT` | 19-25 | Fake context with `lastRunId: "8821"`, `lastRunIssueCount: 20` |

### 4. Review Container (`apps/web/src/features/review/components/review-container.tsx`)

| Mock Location | Line | What's Missing |
|---------------|------|----------------|
| `entries={[]}` | 77 | Activity log is empty - agent events not converted to log entries |

---

## Screens/Components Needing Real Data

### Screen 1: Review Progress View

**Purpose:** Show real-time agent activity during code review

**Data I need to display:**
- List of agents currently working (which lens is active)
- What each agent is currently doing (thinking, calling tools, finding issues)
- Progress through the review process (which step: diff, triage, enrich, report)
- Real-time activity log showing agent actions as they happen
- Running count of issues found so far
- Elapsed time since review started

**Current Gap:**
- Backend emits `AgentStreamEvent` (agent_start, agent_thinking, tool_call, etc.)
- Frontend receives these but **never converts them to activity log entries**
- Backend does NOT emit `StepEvent` (step_start, step_complete) despite schemas existing
- Steps remain in "pending" status throughout the review

**Actions:**
- Start review → Real-time streaming of agent activity
- Cancel review → Stop streaming, show partial results

**States to handle:**
- **Streaming:** Agents actively working, log updating
- **Complete:** All agents finished, show final count
- **Error:** Agent or network failure, show what went wrong
- **Empty:** No changes to review

**Business rules:**
- Multiple agents can run in parallel (one per lens)
- Each agent goes through: start → thinking → tool_calls → issue_found → complete
- Step progression: diff → triage → enrich → report

---

### Screen 2: Review Summary View

**Purpose:** Show analysis statistics after review completes

**Data I need to display:**
- Review/run identifier
- Total issues found
- Number of files analyzed
- Count of critical/blocker issues
- Breakdown by severity (blocker, high, medium, low, nit)
- Statistics per lens (which lens found how many issues, change from previous run)
- Top 3 most critical issues for preview
- Duration of the review

**Current Gap:**
- All statistics are hardcoded in `MOCK_ISSUES`
- `lensStats` array is completely fake
- `runId: "8821"` and `filesAnalyzed: 7` are hardcoded

**What I think I need:**
- When triage completes, I need a summary object with all these statistics
- Lens statistics should come from the actual lenses that ran
- "Change" values (e.g., "+2 issues from last run") need comparison with previous review

**Actions:**
- Enter Review → Navigate to issue list
- Export Summary → Download review results
- Back → Return to file selection

**States to handle:**
- **Success:** Show all statistics
- **No Issues:** Review completed with zero issues found
- **Partial:** Some lenses failed but others succeeded

---

### Screen 3: Review Results View (Issue List)

**Purpose:** Browse and triage discovered issues

**Data I need to display:**
- List of all issues from the review
- Each issue: title, severity, category, file, line numbers
- Issue details: rationale, recommendation, suggested patch
- Fix plan with actionable steps
- Code evidence with excerpts
- Trace/explanation of how issue was found

**Current Gap:**
- Using `MOCK_ISSUES` with 6 hardcoded issues
- Real issues come from `state.issues` in triage reducer but summary page ignores them

**Actions:**
- Filter by severity → Show only matching issues
- Select issue → Show full details in right pane
- Navigate issues → j/k keyboard shortcuts
- Switch tabs → Details, Explain, Trace, Patch

**States to handle:**
- **Empty filter:** No issues match current severity filter
- **Loading details:** Fetching additional issue context
- **No patch:** Issue has no suggested fix

---

### Screen 4: History Page

**Purpose:** View past review runs and their results

**Data I need to display:**
- Timeline of past reviews grouped by date
- Each review: ID, timestamp, branch name, provider used, pass/fail status
- Summary of issues found in each review
- Quick access to issues from a selected review
- Insights: top lenses triggered, patterns across runs

**Current Gap:**
- `MOCK_RUNS` contains 5 fake history entries
- `TIMELINE_ITEMS` has fake date groupings
- `topLenses` and insights are hardcoded
- Duration is hardcoded `"4m 12s"`

**What I think I need:**
- List of past reviews with metadata
- Ability to load issues for a specific review
- Aggregated statistics across reviews (which lenses fire most often)

**Actions:**
- Select date → Filter runs to that day
- Select run → Show run details and issues
- View full review → Navigate to full issue list

**States to handle:**
- **No history:** First time user, no past reviews
- **Loading:** Fetching review history
- **Error:** Storage unavailable

**Business rules:**
- Reviews are stored locally (no cloud sync)
- Old reviews may be cleaned up based on retention policy

---

### Screen 5: Home Page Context

**Purpose:** Show current workspace context and last run status

**Data I need to display:**
- Current trusted directory
- Active provider and model
- Last review run ID
- Issue count from last run

**Current Gap:**
- `DEMO_CONTEXT` is entirely hardcoded
- No actual fetching of workspace context

**What I think I need:**
- Current configuration (provider, model)
- Most recent review result (if any)

---

## Data Flow Gaps

### Gap 1: Step Events Not Emitted

**Frontend expects:** `step_start`, `step_complete`, `step_error` events
**Backend emits:** Nothing for steps

**Impact:** Progress steps (diff → triage → enrich → report) never update from "pending"

**Schemas exist at:** `packages/schemas/src/step-event.ts`
**Reducer handles at:** `packages/core/src/review/triage-state.ts:99-111`

**What I need:** Backend to emit step events at appropriate points in the triage flow

---

### Gap 2: Agent Events Not Converted to Activity Log

**What happens now:**
1. Backend emits `AgentStreamEvent` (agent_start, agent_thinking, tool_call, etc.)
2. Frontend receives and stores these in reducer
3. Events are NEVER converted to `LogEntryData[]` for ActivityLog component
4. ActivityLog receives empty array: `entries={[]}`

**What I need:**
- Either: Backend sends pre-formatted log entries
- Or: Frontend converts AgentStreamEvents to log entries (this is a frontend task)

**Location:** `apps/web/src/features/review/components/review-container.tsx:77`

---

### Gap 3: Lens Statistics Not Provided

**What I need after triage completes:**
- Per-lens issue counts
- Per-lens status (success/failed/skipped)
- Comparison with previous run (if available)

**What I get now:**
- `orchestrator_complete` event with `totalIssues` only
- No per-lens breakdown
- No comparison data

---

### Gap 4: Review History Not Persisted/Queryable

**What I need:**
- List past reviews with metadata (date, branch, provider, duration)
- Load issues for a specific past review
- Aggregate statistics across reviews

**What exists:**
- Reviews saved to `~/.stargazer/triage-reviews/` as JSON files
- No query endpoint to list/filter/aggregate reviews

---

### Gap 5: Duration Not Tracked

**What I need:**
- How long the review took
- Start and end timestamps

**What I get:**
- Events have timestamps but no explicit duration calculation
- Frontend has Timer component but backend doesn't send duration

---

## Uncertainties

- [ ] **Step events:** Should backend emit these, or should frontend infer step progress from agent events?
- [ ] **Lens statistics:** Should this be part of `orchestrator_complete` event or separate endpoint?
- [ ] **History comparison:** How do we identify "previous run" for comparison? By branch? By time?
- [ ] **Duration:** Should backend calculate and return duration, or should frontend calculate from timestamps?
- [ ] **Session events:** `use-session-events.ts` and `use-session-recorder.ts` are stubbed with "NOT_IMPLEMENTED" - are these needed?

---

## Questions for Backend

1. **Step events:** Would it make sense to emit `step_start`/`step_complete` events during triage? The schemas and frontend handling already exist.

2. **Lens breakdown:** Should `orchestrator_complete` include per-lens statistics, or should there be a separate summary endpoint?

3. **History endpoint:** Is there an existing way to query saved reviews, or do we need a new endpoint for listing/filtering review history?

4. **Duration tracking:** Should the backend track and return review duration, or is this a frontend concern?

5. **Comparison data:** For "change from last run" statistics, how should we identify which previous run to compare against?

6. **Activity log format:** Should backend emit pre-formatted log entries, or should frontend handle the `AgentStreamEvent → LogEntryData` transformation?

Open to suggestions on simpler approaches. Push back if any of this complicates things unnecessarily.

---

## Discussion Log

*(Backend responses and decisions will be added here)*

---

## Appendix: Schema References

### Agent Events (already emitted)
- `packages/schemas/src/agent-event.ts:74-139`
- Types: agent_start, agent_thinking, tool_call, tool_result, issue_found, agent_complete, orchestrator_complete

### Step Events (schemas exist, not emitted)
- `packages/schemas/src/step-event.ts:21-48`
- Types: step_start, step_complete, step_error
- Steps: diff, triage, enrich, report

### UI Schemas
- `packages/schemas/src/ui.ts:92-105` - LogEntryData for activity log
- `packages/schemas/src/ui.ts:52-60` - LensStats for statistics

### Existing Backend Emission Points
- `apps/server/src/review/triage.ts:239-305` - Agent events emitted here
- `apps/server/src/review/triage.ts:362-367` - orchestrator_complete emitted here
- `apps/server/src/services/triage.ts:129` - Final complete event with reviewId
