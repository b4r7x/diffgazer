# Schemas Audit (Zod Best Practices)

**Agent:** `pr-review-toolkit:type-design-analyzer`

## Purpose
Validate Zod schemas in `packages/schemas/` against best practices.

---

## Checklist

### 1. Use `safeParse()` over `parse()`

```typescript
// ❌ Bad - throws on error
const result = schema.parse(data)

// ✅ Good - returns discriminated union
const result = schema.safeParse(data)
if (!result.success) {
  return err(result.error)
}
return ok(result.data)
```

**Check:** Search for `.parse(` usage - should use `.safeParse(` with Result<T,E> pattern.

### 2. Use Type Inference

```typescript
// ❌ Bad - duplicate type definition
interface User {
  name: string
  email: string
}
const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
})

// ✅ Good - infer from schema
const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
})
type User = z.infer<typeof UserSchema>
```

**Check:** Types should be inferred with `z.infer<>`, not manually defined.

### 3. Use Refinements for Custom Validation

```typescript
// ✅ Good - custom validation with refinement
const PasswordSchema = z.string().refine(
  (val) => val.length >= 8 && /[A-Z]/.test(val),
  { message: 'Password must be 8+ chars with uppercase' }
)
```

**Check:** Custom validation uses `.refine()` or `.superRefine()`.

### 4. Format Errors for API Responses

```typescript
// ❌ Bad - raw Zod errors to client
return c.json({ error: result.error.issues }, 400)

// ✅ Good - formatted errors
const formatted = result.error.issues.map(i => ({
  field: i.path.join('.'),
  message: i.message,
}))
return c.json({ errors: formatted }, 400)
```

**Check:** Errors are formatted before returning to clients.

### 5. Schema Organization

```
packages/schemas/src/
├── index.ts           # Barrel export
├── config.ts          # Config schemas
├── review.ts          # Review domain
├── session.ts         # Session domain
└── [domain].ts        # One file per domain
```

**Check:**
- Flat structure (no subfolders)
- One file per domain
- Schemas exported from index.ts

### 6. Naming Conventions

```typescript
// ✅ Good
const ReviewSchema = z.object({...})
const ReviewInputSchema = z.object({...})  // For input validation
const ReviewResponseSchema = z.object({...})  // For API responses

type Review = z.infer<typeof ReviewSchema>
```

**Check:**
- Schema names end with `Schema`
- Input/Response variants clearly named
- Types inferred, not manually defined

### 7. Don't Overvalidate Internal Code

```typescript
// ❌ Bad - validating internal function arguments
function processReview(review: Review) {
  const validated = ReviewSchema.parse(review) // Unnecessary
}

// ✅ Good - validate at boundaries only
function handleRequest(c: Context) {
  const result = ReviewSchema.safeParse(await c.req.json())
  // ...
}
```

**Check:** Validation only at system boundaries (API, user input, external data).

---

## Commands

```bash
# Find .parse() usage (should be .safeParse())
grep -r "\.parse(" packages/schemas/src/

# Find manual type definitions that could use z.infer
grep -r "^interface\|^type" packages/schemas/src/ | grep -v "z.infer"

# Check for flat structure
find packages/schemas/src -type d -mindepth 1
```

---

## Output

| Issue | File | Line | Fix |
|-------|------|------|-----|
| Uses .parse() | review.ts | 45 | Change to .safeParse() |
| Manual type | session.ts | 12 | Use z.infer<typeof SessionSchema> |
| Nested folder | types/ | - | Flatten to single files |

---

## Sources
- [Zod Documentation](https://zod.dev/)
- [Schema validation with Zod - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/zod-explained/)
- [Zod + TypeScript Guide](https://www.telerik.com/blogs/zod-typescript-schema-validation-made-easy)
