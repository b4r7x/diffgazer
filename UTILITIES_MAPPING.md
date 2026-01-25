# Stargazer Utilities Mapping

Complete inventory of shared utilities, schemas, and their usage across the codebase.

## Summary Statistics
- **Total Core Utilities**: 35+
- **Total Schema Exports**: 100+
- **Packages**: `@repo/core`, `@repo/schemas`, `@repo/api`
- **Total Import References**: ~250+ across codebase

## Shared Utilities & Usage

### Result Type & Error Handling
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `Result<T, E>` | `packages/core/src/result.ts` | Discriminated union for typed errors; 300x faster than exceptions | 93+ | ✓ HEAVILY USED |
| `ok()`, `err()` | `packages/core/src/result.ts` | Result type constructors | 93+ | ✓ HEAVILY USED |
| `createError()` | `packages/core/src/errors.ts` | Factory for AppError with code, message, details | 5 core uses | ✓ USED |
| `getErrorMessage()` | `packages/core/src/errors.ts` | Safe error string extraction | 15+ | ✓ USED |
| `isNodeError()` | `packages/core/src/errors.ts` | Type guard for Node.js ErrnoException | 2 | ✓ USED |
| `toError()` | `packages/core/src/errors.ts` | Coerce unknown to Error | 1 | ✓ USED |
| `isAbortError()` | `packages/core/src/errors.ts` | Type guard for AbortError | 1 | ✓ USED |

### Validation & JSON Parsing
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `validateSchema()` | `packages/core/src/utils/validation.ts` | Zod schema validation returning Result | 7+ | ✓ USED |
| `parseAndValidate()` | `packages/core/src/utils/validation.ts` | JSON parse + validate in one call | 1 | ✓ USED |
| `safeParseJson()` | `packages/core/src/json.ts` | Safe JSON parsing with markdown stripping | 5+ | ✓ USED |
| `isValidUuid()` | `packages/core/src/utils/validation.ts` | UUID format validation | 0 | ⚠️ EXPORTED, NOT USED |
| `assertValidUuid()` | `packages/core/src/utils/validation.ts` | Throws on invalid UUID | 0 | ⚠️ EXPORTED, NOT USED |
| `isRelativePath()` | `packages/core/src/utils/validation.ts` | Relative path validation | 0 | ⚠️ EXPORTED, NOT USED |
| `isValidProjectPath()` | `packages/core/src/utils/validation.ts` | Project path security validation | 0 | ⚠️ EXPORTED, NOT USED |

### String & Array Utilities
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `truncate()` | `packages/core/src/string.ts` | String truncation with suffix (default "...") | 6 | ✓ USED |
| `truncateToDisplayLength()` | `packages/core/src/string.ts` | Truncate combined strings to max length | 0 | ⚠️ EXPORTED, NOT USED |
| `chunk()` | `packages/core/src/array.ts` | Array chunking into fixed-size subarrays | 2 | ⚠️ UNDER-UTILIZED |
| `formatRelativeTime()` | `packages/core/src/format.ts` | Format ISO date as "Xm ago", "Xh ago", "Xd ago" | 6 | ✓ USED |
| `getScoreColor()` | `packages/core/src/format.ts` | Color mapping for numeric scores | 1 | ✓ USED |

### Sanitization & Security
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `escapeXml()` | `packages/core/src/sanitization.ts` | XML escape for prompt injection protection (CVE-2025-53773) | 15+ | ✓ HEAVILY USED |
| `sanitizeUnicode()` | `packages/core/src/sanitization.ts` | Remove bidirectional & control characters | 2 | ⚠️ UNDER-UTILIZED |

### Advanced Utilities
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `createErrorClassifier()` | `packages/core/src/utils/error-classifier.ts` | Pattern-based error classification | 1 | ✓ USED |
| `createLazyLoader()` | `packages/core/src/utils/lazy-loader.ts` | Lazy module loading with caching | 0 | ⚠️ EXPORTED, NOT USED |
| `createErrorState()` | `packages/core/src/utils/state-helpers.ts` | Error state factory for reducers | 5 | ✓ USED |
| `parsePort()` | `packages/core/src/port.ts` | Parse & validate port number | 2 | ✓ USED |
| `parsePortOrDefault()` | `packages/core/src/port.ts` | Parse port with fallback | 0 | ⚠️ EXPORTED, NOT USED |

### File I/O Utilities (Core)
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `safeReadFile()` | `packages/core/src/fs/operations.ts` | Safe file read with error handling | 0 | ⚠️ EXPORTED, NOT USED |
| `atomicWriteFile()` | `packages/core/src/fs/operations.ts` | Atomic write to prevent corruption | 0 | ⚠️ EXPORTED, NOT USED |
| `ensureDirectory()` | `packages/core/src/fs/operations.ts` | Create directory with parents | 0 | ⚠️ EXPORTED, NOT USED |

### Review System - Fingerprinting & Deduplication
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `generateFingerprint()` | `packages/core/src/review/fingerprint.ts` | Hash-based issue deduplication key | 1 core use | ✓ USED IN TRIAGE |
| `mergeIssues()` | `packages/core/src/review/fingerprint.ts` | Deduplicate issues by fingerprint, keeping highest severity | 0 | ⚠️ EXPORTED, NOT DIRECTLY USED |
| `normalizeTitle()` | `packages/core/src/review/fingerprint.ts` | Normalize issue title for fingerprinting | 0 | ✓ USED INTERNALLY |
| `getHunkDigest()` | `packages/core/src/review/fingerprint.ts` | SHA1 hash of code hunk | 0 | ✓ USED INTERNALLY |

### Review System - Triage & Analysis
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `triageReview()` | `packages/core/src/review/triage.ts` | Run lenses on diff, aggregate issues | 5+ | ✓ HEAVILY USED |
| `triageReviewStream()` | `packages/core/src/review/triage.ts` | Streaming version with event callbacks | 3+ | ✓ USED |
| `triageWithProfile()` | `packages/core/src/review/triage.ts` | Triage with predefined profile | 1 | ✓ USED |

### Review System - Drilldown & Analysis
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `drilldownIssue()` | `packages/core/src/review/drilldown.ts` | Deep analysis of single issue | 1+ | ✓ USED |
| `drilldownIssueById()` | `packages/core/src/review/drilldown.ts` | Lookup issue by ID then drilldown | 1+ | ✓ USED |
| `drilldownMultiple()` | `packages/core/src/review/drilldown.ts` | Drilldown multiple issues sequentially | 0 | ⚠️ EXPORTED, NOT USED |
| `TraceRecorder` | `packages/core/src/review/trace-recorder.ts` | Record execution traces for debugging | 3+ | ✓ USED |
| `shouldSuggestDrilldown()` | `packages/core/src/review/drilldown-suggester.ts` | Heuristic to suggest drilldown | 0 | ⚠️ EXPORTED, NOT USED |
| `getSuggestionReason()` | `packages/core/src/review/drilldown-suggester.ts` | Explain drilldown suggestion | 0 | ⚠️ EXPORTED, NOT USED |

### Review System - Lenses & Profiles
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `LENSES` | `packages/core/src/review/lenses/index.ts` | Map of all lens definitions | 1 | ✓ USED |
| `LENS_LIST` | `packages/core/src/review/lenses/index.ts` | Array of all lenses | 1 | ✓ USED |
| `getLens()` | `packages/core/src/review/lenses/index.ts` | Get lens by ID | 1 | ✓ USED |
| `getLenses()` | `packages/core/src/review/lenses/index.ts` | Get multiple lenses by ID list | 1 | ✓ USED |
| `PROFILES` | `packages/core/src/review/profiles.ts` | Map of review profiles | 1 | ✓ USED |
| `PROFILE_LIST` | `packages/core/src/review/profiles.ts` | Array of all profiles | 1 | ✓ USED |
| `getProfile()` | `packages/core/src/review/profiles.ts` | Get profile by ID | 1 | ✓ USED |

### Diff Utilities
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `parseDiff()` | `packages/core/src/diff/parser.ts` | Parse git unified diff to structured format | 8+ | ✓ HEAVILY USED |
| `filterDiffByFiles()` | `packages/core/src/diff/parser.ts` | Filter parsed diff to specific files | 2 | ✓ USED |
| `applyPatch()` | `packages/core/src/diff/applier.ts` | Apply unified diff patch to file | 2 | ✓ USED |
| `classifyDiffLine()` | `packages/core/src/diff/parser.ts` | Classify line as added/removed/context | 0 | ⚠️ EXPORTED, NOT DIRECTLY USED |

### Streaming Utilities
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `parseSSEStream()` | `packages/core/src/streaming/sse-parser.ts` | Parse Server-Sent Events stream | 4 | ✓ USED |

### Storage & Persistence
| Utility | Location | Purpose | Import Count | Status |
|---------|----------|---------|--------------|--------|
| `saveTriageReview()` | `packages/core/src/storage/review-storage.ts` | Save triage results to disk | 2 | ✓ USED |
| `triageReviewStore` | `packages/core/src/storage/review-storage.ts` | Collection manager for reviews | 5+ | ✓ USED |
| `saveSessionEvents()` | `packages/core/src/storage/session-events.ts` | JSONL logging of session activity | 1 | ✓ USED |
| `loadSessionEvents()` | `packages/core/src/storage/session-events.ts` | Load JSONL session log | 1 | ✓ USED |

---

## Canonical Type Locations (Schemas)

All canonical types should be imported from `@repo/schemas`:

| Type Group | Location | Notes |
|-----------|----------|-------|
| **Triage Types** | `@repo/schemas/triage` | `TriageIssue`, `TriageResult`, `TriageSeverity`, `EvidenceRef`, `FixPlanStep` |
| **Lens Types** | `@repo/schemas/lens` | `Lens`, `LensId`, `ReviewProfile`, `ProfileId`, `DrilldownResult` |
| **Git Types** | `@repo/schemas/git` | Diff and git operation types |
| **Config Types** | `@repo/schemas/config` | `UserConfig`, `AIProvider`, `ModelInfo`, `SaveConfigRequest` |
| **Settings Types** | `@repo/schemas/settings` | User preferences, theme, controls mode |
| **Session Types** | `@repo/schemas/session` | Session metadata and state |
| **Feedback Types** | `@repo/schemas/feedback` | User feedback on issues |
| **Agent Event Types** | `@repo/schemas/agent-event` | `AgentStreamEvent`, `AgentId`, agent metadata |
| **Stream Event Types** | `@repo/schemas/stream-events` | Streaming event discriminators |
| **Error Types** | `@repo/schemas/errors` | Error codes and error schemas |

---

## Usage Patterns & Findings

### ✓ Well-Utilized
1. **Result Type** (93+ imports) - Core pattern throughout
2. **escapeXml** (15+ imports) - Critical for prompt injection protection
3. **parseDiff** (8+ imports) - Essential for git diff operations
4. **triageReview** (5+ imports) - Main triage entry point
5. **formatRelativeTime** (6+ imports) - Timestamps across CLI

### ⚠️ Under-Utilized
1. **chunk()** - Only 2 uses; AI SDK might benefit from batching
2. **sanitizeUnicode()** - Only 2 uses; `escapeXml` covers most cases
3. **truncateToDisplayLength()** - Never used; duplicate concept with `truncate()`
4. **File I/O Utilities** (safeReadFile, atomicWriteFile, ensureDirectory) - 0 uses; storage layer handles this
5. **Lazy Loader** - 0 uses; no optional module loading pattern in use
6. **Path Validators** (isRelativePath, isValidProjectPath) - 0 uses despite availability
7. **Drilldown Suggester** - 0 uses; could improve UX if enabled

### Potential Opportunities
- **chunk()** could be used in batch processing for multiple drilldowns
- **sanitizeUnicode()** could be applied to user-provided feedback text
- **createLazyLoader()** could defer loading of optional providers
- **truncateToDisplayLength()** is redundant with `truncate()`; consider deprecation
- **File I/O utilities** are available but not used; monorepo favors abstracted storage layer

### Import Direction (Respected)
```
apps/cli → packages/core → packages/schemas (leaves)
apps/server → packages/core → packages/schemas (leaves)
packages/core → packages/schemas (OK)
Feature features do not cross-import (composed in app layer)
```

---

## Code Quality Assessment

| Category | Score | Notes |
|----------|-------|-------|
| Utility Discoverability | 8/10 | Well-organized but some utilities underdocumented |
| Reuse Rate | 7/10 | Core patterns (Result, escapeXml) heavily used; others sit idle |
| API Consistency | 9/10 | Factory patterns, Result type, error classifiers all consistent |
| Documentation | 6/10 | CLAUDE.md lists utilities but drilldown-suggester, lazy-loader not mentioned |
| Type Safety | 10/10 | All utilities use strict TypeScript; no `any` except boundaries |

---

## Recommendations

### Priority 1 (This Sprint)
- [ ] Review `chunk()` for unused parallel-processing opportunity in drilldown batching
- [ ] Document `sanitizeUnicode()` usage in feedback handler
- [ ] Confirm if `createLazyLoader()` is needed for future provider plugins

### Priority 2 (Next Sprint)
- [ ] Deprecate `truncateToDisplayLength()` if `truncate()` covers all cases
- [ ] Add integration test for `parseAndValidate()` to increase adoption
- [ ] Document path validators usage pattern if they're intentionally reserved

### Priority 3 (Backlog)
- [ ] Enable `shouldSuggestDrilldown()` heuristic in CLI UX
- [ ] Migrate file I/O if storage layer switches patterns
- [ ] Profile performance of `generateFingerprint()` hash algorithms
