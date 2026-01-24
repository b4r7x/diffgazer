# Over-Engineering Audit

**Agent:** `code-review-ai:architect-review`

## Purpose

Detect and fix over-engineering in code, especially AI-generated patterns that add unnecessary complexity.

---

## Philosophy

> "Before you apply any design pattern, identify the problem you are trying to solve. Not every problem requires a design pattern. Sometimes a simple and straightforward solution is better than a complex and abstract one."

**YAGNI:** Don't build for hypothetical future needs. Build for current requirements.

**Rule of Three:** Don't abstract until you have 3 real use cases.

---

## Checklist

### 1. Unnecessary Abstractions

```typescript
// ❌ BAD: Abstraction for single implementation
interface IUserRepository {
  getUser(id: string): Promise<User>
}
class UserRepository implements IUserRepository {
  getUser(id: string): Promise<User> { ... }
}
// Only one implementation exists, will never be swapped

// ✅ GOOD: Direct implementation
class UserRepository {
  getUser(id: string): Promise<User> { ... }
}
// Add interface WHEN you need a second implementation
```

**Check:** Does every interface have 2+ implementations? If not, remove it.

### 2. Premature Generalization

```typescript
// ❌ BAD: Generic where specific would do
function createEntity<T extends BaseEntity>(
  factory: EntityFactory<T>,
  validator: Validator<T>,
  transformer: Transformer<T>
): T { ... }

// Called only once with User type

// ✅ GOOD: Specific until needed
function createUser(data: UserInput): User { ... }
// Generalize WHEN you have 3+ similar use cases
```

**Check:** Is generic code used with more than one type? If not, make it specific.

### 3. Unnecessary Wrappers

```typescript
// ❌ BAD: Wrapper that just passes through
class Logger {
  private winston = createWinston()

  info(msg: string) { this.winston.info(msg) }
  error(msg: string) { this.winston.error(msg) }
  warn(msg: string) { this.winston.warn(msg) }
}

// ✅ GOOD: Use library directly
import { logger } from 'winston'
logger.info('message')

// Only wrap WHEN you need to:
// - Add business logic
// - Abstract for testing
// - Support multiple backends
```

**Check:** Does wrapper add value beyond pass-through? If not, use library directly.

### 4. Factory Pattern Overuse

```typescript
// ❌ BAD: Factory for simple object creation
class UserFactory {
  create(name: string, email: string): User {
    return new User(name, email)
  }
}

// ✅ GOOD: Direct construction
const user = new User(name, email)

// ❌ BAD: Factory with single product
class NotificationFactory {
  create(type: 'email'): EmailNotification {
    return new EmailNotification()
  }
}

// ✅ GOOD: Factory only when multiple products
class NotificationFactory {
  create(type: 'email' | 'sms' | 'push'): Notification {
    switch(type) {
      case 'email': return new EmailNotification()
      case 'sms': return new SmsNotification()
      case 'push': return new PushNotification()
    }
  }
}
```

**Check:** Does factory create 2+ different types? If not, remove it.

### 5. Over-Layered Architecture

```typescript
// ❌ BAD: Too many layers for simple operation
// Controller → Service → Repository → DataMapper → Entity → DTO

class UserController {
  async getUser(id: string) {
    return this.userService.getUser(id)
  }
}
class UserService {
  async getUser(id: string) {
    return this.userRepository.getUser(id)
  }
}
class UserRepository {
  async getUser(id: string) {
    return this.dataMapper.map(await this.db.query(...))
  }
}
// Each layer just calls the next with no logic

// ✅ GOOD: Collapse unnecessary layers
class UserService {
  async getUser(id: string) {
    const row = await this.db.query(...)
    return this.mapToUser(row)
  }
}
```

**Check:** Does each layer add distinct logic? If not, collapse them.

### 6. Excessive Configuration

```typescript
// ❌ BAD: Configuration for things that never change
const config = {
  user: {
    maxNameLength: 100,
    minNameLength: 1,
    allowedCharacters: /^[a-zA-Z\s]+$/,
    nameFieldLabel: 'Name',
    namePlaceholder: 'Enter name',
    // ... 50 more options
  }
}

// ✅ GOOD: Hardcode unless it actually varies
const MAX_NAME_LENGTH = 100

// Only configure WHEN:
// - Value differs per environment
// - Users need to customize
// - Value changes frequently
```

**Check:** Has this config ever been changed? If not, hardcode it.

### 7. Defensive Over-Validation

```typescript
// ❌ BAD: Validating at every layer
class UserController {
  createUser(data: unknown) {
    const validated = userSchema.parse(data)  // Validate
    return this.userService.createUser(validated)
  }
}
class UserService {
  createUser(data: UserInput) {
    const validated = userSchema.parse(data)  // Validate again!
    return this.userRepository.save(validated)
  }
}
class UserRepository {
  save(user: User) {
    if (!user.name) throw new Error('...')  // Validate again!!
    // ...
  }
}

// ✅ GOOD: Validate once at boundary
class UserController {
  createUser(data: unknown) {
    const validated = userSchema.parse(data)  // Validate ONCE
    return this.userService.createUser(validated)
  }
}
class UserService {
  createUser(data: UserInput) {  // Trust the type
    return this.userRepository.save(data)
  }
}
```

**Check:** Is same data validated multiple times? Validate once at system boundary.

### 8. Premature DRY

```typescript
// ❌ BAD: Forcing DRY with awkward abstraction
function processEntity(
  entity: User | Product | Order,
  type: 'user' | 'product' | 'order'
) {
  if (type === 'user') { /* user-specific */ }
  if (type === 'product') { /* product-specific */ }
  // ... messy conditionals
}

// ✅ GOOD: Duplication is better than wrong abstraction
function processUser(user: User) { ... }
function processProduct(product: Product) { ... }
function processOrder(order: Order) { ... }

// Wait for patterns to emerge, THEN extract
```

**Check:** Is "shared" code full of conditionals? Split it back up.

### 9. AI-Specific Patterns

AI tends to generate:

| Pattern | Why It's Over-Engineered | Fix |
|---------|-------------------------|-----|
| Interface for single class | "Future flexibility" | Remove interface |
| Generic with one type param | "Reusability" | Make specific |
| Factory for simple objects | "Testability" | Direct construction |
| Config for constants | "Flexibility" | Hardcode |
| Multiple validation layers | "Safety" | Validate at boundary |
| Wrapper around library | "Abstraction" | Use library directly |
| Strategy pattern for one strategy | "Extensibility" | Inline the logic |
| Builder for simple objects | "Readability" | Use constructor |

---

## Commands

```bash
# Find interfaces with single implementation
grep -rn "implements \w\+" apps/ packages/ --include="*.ts" | cut -d: -f3 | sort | uniq -c | grep "^\s*1 "

# Find factories that might be unnecessary
grep -rn "Factory" apps/ packages/ --include="*.ts" -l

# Find wrappers (classes with single private field + pass-through methods)
grep -rn "private readonly \w\+ =" apps/ packages/ --include="*.ts"

# Find config files with many options
find apps/ packages/ -name "config*.ts" -o -name "*.config.ts" | xargs wc -l | sort -n

# Find generic types with single usage
grep -rn "<T>" apps/ packages/ --include="*.ts" -l

# Find multiple parse/validate calls
grep -rn "\.parse\|\.safeParse\|validate" apps/ packages/ --include="*.ts" | cut -d: -f1 | sort | uniq -c | sort -rn

# Find builder patterns
grep -rn "Builder\|\.build()" apps/ packages/ --include="*.ts"
```

---

## Output

| Issue | File | Line | Pattern | Fix |
|-------|------|------|---------|-----|
| Single-impl interface | user-repo.ts | 5 | IUserRepository | Remove interface, use class directly |
| Unnecessary factory | user-factory.ts | 1-20 | UserFactory | Replace with direct `new User()` |
| Pass-through wrapper | logger.ts | 1-30 | Logger class | Use winston directly |
| Premature generic | entity-service.ts | 15 | `<T extends Entity>` | Make specific: `UserService` |
| Over-validation | user-controller.ts, user-service.ts | 10, 25 | Duplicate parse | Remove parse from service |
| Over-configured | config.ts | 1-100 | 50+ options | Hardcode static values |

---

## When Abstraction IS Justified

Don't remove abstractions that:

1. **Have 2+ implementations** - Real polymorphism
2. **Enable testing** - Mocking external services
3. **Cross system boundaries** - API contracts, database interfaces
4. **Are part of public API** - Library consumers need stability
5. **Follow established ADRs** - See `.claude/docs/decisions.md`

---

## Sources

- [YAGNI - Martin Fowler](https://martinfowler.com/bliki/Yagni.html)
- [Modern Software Over-Engineering Mistakes](https://medium.com/@rdsubhas/10-modern-software-engineering-mistakes-bc67fbef4fc8)
- [6 Warning Signs of Over-Engineering](https://leaddev.com/software-quality/the-6-warning-signs-of-overengineering)
- [Dangers of Over-Abstraction](https://hemaks.org/posts/the-dangers-of-over-abstraction-when-yagni-principle-wins/)
- [Do You Really Need That Abstraction?](https://codeopinion.com/do-you-really-need-that-abstraction-or-generic-code-yagni/)
- [AI vs Human Code Generation Report](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report)
