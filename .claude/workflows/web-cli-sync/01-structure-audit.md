# Structure Audit: Web Pages vs CLI Screens

## Type: AUDIT ONLY

## Output: Gap list for review (no implementation)

## Purpose
Compare web (source of truth) page structure with CLI screens. Identify what CLI is missing or has differently.

## Agents Used
| Agent | Purpose |
|-------|---------|
| `feature-dev:code-explorer` | Deep analysis of web pages and CLI screens |
| `feature-dev:code-architect` | Architecture blueprints and mapping |
| `pr-review-toolkit:type-design-analyzer` | Type consistency analysis |

## Execution Steps

### Phase 1: Web Pages Analysis
```
Agent: feature-dev:code-explorer (opus)
Task: Analyze apps/web/src/app/pages/
Output: For each page - route, components, props, API calls, hooks
```

### Phase 2: CLI Screens Analysis
```
Agent: feature-dev:code-explorer (opus)
Task: Analyze apps/cli/src/app/screens/ and apps/cli/src/app/views/
Output: For each screen - what it displays, components, props, API calls
```

### Phase 3: Architecture Mapping
```
Agent: feature-dev:code-architect (opus)
Task: Create mapping table - web page → CLI screen equivalent
Output: Gap analysis - what's missing, what's different
```

### Phase 4: Type Analysis
```
Agent: pr-review-toolkit:type-design-analyzer (opus)
Task: Compare shared types between web and CLI
Output: Type inconsistencies to fix
```

## Expected Output

### Structure Mapping Table
| Web Page | Route | CLI Screen | Status | Gap |
|----------|-------|------------|--------|-----|
| HomePage | / | main-menu-view | ✓ Match | - |
| ReviewPage | /review | review-view | ✓ Match | Missing analysis summary |
| ... | ... | ... | ... | ... |

### Gap List
1. [Page/Screen]: [What's missing]
2. ...

### Action Items
- [ ] Create missing screens
- [ ] Update existing screens
- [ ] Sync component structure
