# Adding Features

This guide explains how to add new features to Stargazer following established patterns.

## Feature Architecture

Features follow the Bulletproof React pattern:

```
features/<feature-name>/
├── api/
│   ├── index.ts        # API exports
│   └── <feature>-api.ts # API calls
├── components/
│   ├── index.ts        # Component exports
│   └── <component>.tsx
├── hooks/
│   ├── index.ts        # Hook exports
│   └── use-<feature>.ts
└── index.ts            # Public API
```

## Step-by-Step Guide

### 1. Define Schema

First, define types in `packages/schemas/src/`:

```typescript
// packages/schemas/src/my-feature.ts
import { z } from "zod";
import { createDomainErrorCodes, createDomainErrorSchema } from "./errors.js";

// Domain types
export const MyFeatureItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pending", "complete"]),
});
export type MyFeatureItem = z.infer<typeof MyFeatureItemSchema>;

// Error codes
export const MY_FEATURE_SPECIFIC_CODES = ["ITEM_NOT_FOUND"] as const;
export const MY_FEATURE_ERROR_CODES = createDomainErrorCodes(MY_FEATURE_SPECIFIC_CODES);
export const MyFeatureErrorSchema = createDomainErrorSchema(MY_FEATURE_SPECIFIC_CODES);
export type MyFeatureError = z.infer<typeof MyFeatureErrorSchema>;
```

Export from index:

```typescript
// packages/schemas/src/index.ts
export * from "./my-feature.js";
```

### 2. Add Server Route

Create route handler:

```typescript
// apps/server/src/api/routes/my-feature.ts
import { Hono } from "hono";
import { successResponse, errorResponse } from "../../lib/response.js";
import { ErrorCode } from "@repo/schemas/errors";

export const myFeature = new Hono();

myFeature.get("/", async (c) => {
  const items = await getItems();
  return successResponse(c, { items });
});

myFeature.post("/", async (c) => {
  const body = await c.req.json();
  const result = await createItem(body);

  if (!result.ok) {
    return errorResponse(c, result.error.message, result.error.code, 400);
  }

  return successResponse(c, result.value, 201);
});
```

Register route:

```typescript
// apps/server/src/api/routes/index.ts
import { myFeature } from "./my-feature.js";

routes.route("/my-feature", myFeature);
```

### 3. Add CLI Feature

#### API Layer

```typescript
// apps/cli/src/features/my-feature/api/my-feature-api.ts
import { getBaseUrl } from "@/lib/api";
import type { MyFeatureItem } from "@repo/schemas/my-feature";

const api = createApiClient({ baseUrl: getBaseUrl() });

export const myFeatureApi = {
  list: () => api.get<{ items: MyFeatureItem[] }>("/my-feature"),
  create: (data: CreateRequest) => api.post<MyFeatureItem>("/my-feature", data),
};
```

#### Hook

```typescript
// apps/cli/src/features/my-feature/hooks/use-my-feature.ts
import { useState, useCallback } from "react";
import { myFeatureApi } from "../api/my-feature-api.js";
import type { MyFeatureItem, MyFeatureError } from "@repo/schemas/my-feature";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: MyFeatureItem[] }
  | { status: "error"; error: MyFeatureError };

export function useMyFeature() {
  const [state, setState] = useState<State>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { items } = await myFeatureApi.list();
      setState({ status: "success", data: items });
    } catch (error) {
      setState({ status: "error", error: { message: String(error), code: "INTERNAL_ERROR" } });
    }
  }, []);

  return { state, load };
}
```

#### Component

```typescript
// apps/cli/src/features/my-feature/components/my-feature-list.tsx
import React from "react";
import { Box, Text } from "ink";
import type { MyFeatureItem } from "@repo/schemas/my-feature";

interface Props {
  items: MyFeatureItem[];
}

export function MyFeatureList({ items }: Props) {
  return (
    <Box flexDirection="column">
      {items.map((item) => (
        <Box key={item.id}>
          <Text>{item.name}</Text>
          <Text dimColor> - {item.status}</Text>
        </Box>
      ))}
    </Box>
  );
}
```

#### Public API

```typescript
// apps/cli/src/features/my-feature/index.ts
export { myFeatureApi } from "./api/my-feature-api.js";
export { useMyFeature } from "./hooks/use-my-feature.js";
export { MyFeatureList } from "./components/my-feature-list.js";
```

### 4. Integrate into App

Add to main app or create a view:

```typescript
// apps/cli/src/app/views/my-feature-view.tsx
import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useMyFeature, MyFeatureList } from "@/features/my-feature";
import { Spinner } from "@/components";

export function MyFeatureView() {
  const { state, load } = useMyFeature();

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <Box>
        <Spinner />
        <Text> Loading...</Text>
      </Box>
    );
  }

  if (state.status === "error") {
    return <Text color="red">Error: {state.error.message}</Text>;
  }

  if (state.status === "success") {
    return <MyFeatureList items={state.data} />;
  }

  return null;
}
```

## Best Practices

### Use Result Type

```typescript
import { ok, err, type Result } from "@repo/core";

async function createItem(data: CreateRequest): Promise<Result<Item, ItemError>> {
  if (!data.name) {
    return err({ code: "VALIDATION_ERROR", message: "Name required" });
  }
  const item = await save(data);
  return ok(item);
}
```

### Validate with Zod

```typescript
import { validateSchema } from "@repo/core";
import { MyFeatureItemSchema } from "@repo/schemas/my-feature";

const result = validateSchema(data, MyFeatureItemSchema, (msg) => msg);
if (!result.ok) {
  return err({ code: "VALIDATION_ERROR", message: result.error });
}
```

### Error Classification

```typescript
import { createErrorClassifier } from "@repo/core";

const classifyError = createErrorClassifier([
  { patterns: ["not found"], code: "NOT_FOUND", message: "Item not found" },
  { patterns: ["permission"], code: "FORBIDDEN", message: "Access denied" },
], "UNKNOWN", (msg) => `Unexpected: ${msg}`);
```

### No Manual Memoization

React 19 auto-memoizes. Only use useCallback when:
- Function passed to memo() component
- Function used as dependency of another Hook

## Testing

### Unit Tests

```typescript
// apps/cli/src/features/my-feature/hooks/use-my-feature.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react-hooks";
import { useMyFeature } from "./use-my-feature";

describe("useMyFeature", () => {
  it("loads items successfully", async () => {
    const { result } = renderHook(() => useMyFeature());

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.state.status).toBe("success");
  });
});
```

### Run Tests

```bash
npx vitest run apps/cli/src/features/my-feature
```

## Checklist

- [ ] Schema defined in `packages/schemas/`
- [ ] Exported from `packages/schemas/src/index.ts`
- [ ] Server route created
- [ ] Route registered in `routes/index.ts`
- [ ] CLI API layer created
- [ ] CLI hook created
- [ ] CLI component created
- [ ] Feature exported from `index.ts`
- [ ] Integrated into app
- [ ] Tests written
- [ ] Type check passes: `npm run type-check`

## Cross-References

- [Monorepo Structure](../architecture/monorepo-structure.md) - Package organization
- [Packages: Core](../packages/core.md) - Shared utilities
- [Packages: Schemas](../packages/schemas.md) - Schema patterns
