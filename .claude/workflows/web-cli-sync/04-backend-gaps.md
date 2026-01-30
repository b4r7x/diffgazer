# Backend Gaps Audit

## Purpose
Identify what server endpoints need to be created or modified to support web features that don't exist in CLI.

## Agents Used
| Agent | Purpose |
|-------|---------|
| `feature-dev:code-explorer` | Analyze server routes |
| `backend-development:backend-architect` | Backend architecture |
| `api-architect` | API design for new endpoints |
| `documentation-specialist` | Document gaps |
| `full-stack-orchestration:security-auditor` | Security review |

## Execution Steps

### Phase 1: Server Endpoint Inventory
```
Agent: feature-dev:code-explorer (opus)
Task: Analyze apps/server/src/routes/
Output: All existing endpoints with request/response types
```

### Phase 2: Web Feature Requirements
```
Agent: feature-dev:code-explorer (opus)
Task: Analyze web pages for features that need backend support
Output: Features requiring new/modified endpoints
```

### Phase 3: Gap Analysis
```
Agent: backend-development:backend-architect (opus)
Task: Compare web requirements vs server capabilities
Output: List of missing endpoints
```

### Phase 4: API Design
```
Agent: api-architect (opus)
Task: Design new endpoints for gaps
Output:
- Endpoint specs (method, path, request, response)
- Implementation notes
```

### Phase 5: Security Review
```
Agent: full-stack-orchestration:security-auditor (opus)
Task: Review proposed endpoints for security
Output: Security considerations, CORS, auth requirements
```

### Phase 6: Documentation
```
Agent: documentation-specialist (opus)
Task: Create implementation guide for gaps
```

## Gap Categories

### 1. Web-Only Features (CLI doesn't have)
Features unique to web that need new endpoints:
- Theme preview generation
- Provider presets
- History insights aggregation
- Timeline date grouping

### 2. Enhanced Features (Web needs more than CLI)
Web extends CLI features:
- Search/filter for history
- Batch operations
- Export functionality

### 3. Real-time Features
SSE/WebSocket needs:
- Review streaming (exists but web not connected)
- Live updates

## Expected Output

### Gaps List
| Gap | Type | Endpoint | Priority |
|-----|------|----------|----------|
| History insights | New | GET /history/insights | High |
| Provider presets | New | GET /config/presets | Medium |
| Theme preview | New | POST /settings/theme/preview | Low |
| ... | ... | ... | ... |

### Implementation Specs
For each gap:
```
Endpoint: GET /history/insights
Method: GET
Path: /history/insights
Query: ?from=date&to=date
Response: { severityCounts, topLenses, topIssues, totalDuration }
Notes: Aggregate from existing reviews
```

### Action Items
- [ ] Create endpoint specs
- [ ] Implement in server
- [ ] Add to web API layer
- [ ] Test
