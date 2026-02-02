# @repo/api

Type-safe API client for CLI-server communication. Provides a fetch wrapper with centralized error handling and CSRF protection.

## Installation

```typescript
import { createApiClient, type ApiClient } from "@repo/api";
```

## Usage

### Create Client

```typescript
const api = createApiClient({
  baseUrl: "http://localhost:3000",
});
```

### HTTP Methods

```typescript
// GET request
const sessions = await api.get<Session[]>("/sessions");

// GET with query parameters
const config = await api.get<Config>("/config", { provider: "gemini" });

// POST request
const session = await api.post<Session>("/sessions", { projectPath: "/path" });

// PUT request
await api.put("/sessions/123", { name: "Updated" });

// DELETE request
await api.delete("/sessions/123");
```

### Streaming (SSE)

```typescript
// Get raw Response for streaming
const response = await api.stream("/review/stream", {
  params: { staged: "true" },
  signal: abortController.signal,
});

// Process SSE stream
const reader = response.body?.getReader();
// ... process chunks
```

### Low-Level Request

```typescript
// Full control over request
const response = await api.request("PATCH", "/sessions/123", {
  body: { status: "active" },
  params: { force: "true" },
  signal: abortController.signal,
});
```

## API Reference

### createApiClient

```typescript
function createApiClient(config: ApiClientConfig): ApiClient;

interface ApiClientConfig {
  baseUrl: string;
}
```

### ApiClient

```typescript
interface ApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  stream(path: string, options?: StreamOptions): Promise<Response>;
  request(method: string, path: string, options?: RequestOptions): Promise<Response>;
}

interface StreamOptions {
  params?: Record<string, string>;
  signal?: AbortSignal;
}

interface RequestOptions {
  body?: unknown;
  params?: Record<string, string>;
  signal?: AbortSignal;
}
```

### ApiError

```typescript
interface ApiError extends Error {
  status: number;
  code?: string;
}
```

## Error Handling

All methods throw `ApiError` on HTTP errors:

```typescript
try {
  const data = await api.get("/config");
} catch (error) {
  if (error instanceof Error && 'status' in error) {
    const apiError = error as ApiError;
    console.error(`HTTP ${apiError.status}: ${apiError.message}`);
    console.error(`Error code: ${apiError.code}`);
  }
}
```

### Error Response Format

Server errors are parsed from JSON response:

```json
{
  "error": {
    "message": "Configuration not found",
    "code": "NOT_FOUND"
  }
}
```

## Headers

All requests include:

```
Content-Type: application/json
Accept: application/json
```

This provides CSRF protection (browsers require preflight for non-standard Content-Type).

## Design Decisions

### Why a Wrapper?

1. **Centralized Error Handling**: All API errors handled consistently
2. **Type Safety**: Generic methods provide typed responses
3. **CSRF Protection**: Consistent Content-Type header
4. **Testability**: Easy to mock for tests

### Why Not Use fetch Directly?

Direct fetch in components leads to:
- Duplicated error handling
- Inconsistent headers
- No centralized retry/timeout logic
- Harder to test

## Example: Review Flow

```typescript
const api = createApiClient({ baseUrl: address });

// Check config
const { configured } = await api.get<ConfigCheckResponse>("/config/check");
if (!configured) {
  // Show onboarding
}

// Start review stream
const response = await api.stream("/review/stream", {
  params: { staged: "true" },
});

// Process SSE
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value, { stream: true });
  // Parse SSE events...
}
```

## Cross-References

- [Packages: Core](./core.md) - Error types, Result pattern
- [Apps: CLI](../apps/cli.md) - API client usage
- [Architecture: Data Flow](../architecture/data-flow.md) - Request flows
