# Architecture Research & Recommendation: Local AI Coding Tool (2026)

> **Research Date**: January 2026  
> **Stack**: TypeScript, Node.js, React, Hono, Ink, TanStack Start

---

## A) Decision: Best Architecture (10 Key Points)

1. **Monorepo Structure**: `apps/cli`, `apps/web`, `apps/server` + `packages/*` using pnpm workspaces with Turborepo for build orchestration

2. **Single Hono Server as Truth**: One Hono server handles all API endpoints, SSE streaming, and serves the static SPA build — no TanStack Start server runtime needed

3. **CLI Starts Server (OpenCode Pattern)**: CLI bootstraps the server on a random port, displays the localhost URL, provides "Open in browser" action — single entry point, simple lifecycle

4. **SSE for Realtime (Not WebSocket)**: Server-Sent Events via Hono's `streamSSE` for server→client updates; POST/JSON for client→server mutations — simpler reconnection, HTTP/2 compatible

5. **TanStack Start in SPA Mode**: Web app is pure client-side SPA built with TanStack Router — server functions disabled, Vite builds static assets served by Hono

6. **Dual-Bus Event System**: Internal event bus for in-process pub/sub + GlobalBus exposing events via SSE `/events` endpoint for remote clients (pattern from OpenCode)

7. **@napi-rs/keyring for Secrets**: Modern keyring-rs binding with no libsecret dependency on Linux — fallback to encrypted file vault when keyring unavailable

8. **Feature-First Module Structure**: Bulletproof-react inspired organization with unidirectional imports: `shared → features → app`

9. **Functional Core, No Classes**: Pure functions for business logic, factory functions for complex initialization — no DI containers or class hierarchies

10. **Security by Default**: Bind `127.0.0.1`, require session token in custom header, no permissive CORS, validate all state-changing requests

---

## B) Why: Arguments, Trade-offs & When to Choose Differently

### SSE vs WebSocket

| Criteria | SSE (Chosen) | WebSocket |
|----------|--------------|-----------|
| Reconnection | Automatic via EventSource API | Manual implementation needed |
| HTTP/2 Multiplexing | Yes | Separate connection |
| Bidirectional | No (use POST for uploads) | Yes |
| Complexity | Simpler protocol | More complex handshake |
| Proxy/Firewall | Better compatibility | May be blocked |

**Choose WebSocket when**: Need true bidirectional streaming (e.g., real-time collaborative editing with OT/CRDT) or binary data streaming.

**Sources**: 
- SSE provides automatic reconnection. If a SSE connection is closed, perhaps due to a network issue, clients will automatically attempt to reconnect to the server. WebSockets do not provide this.
- WebSockets can also integrate into your app's existing TanStack Query setup by sending messages of updates and not data, while TanStack Query handles cache and data revalidation.

### Single Process (CLI+Server) vs Two Processes

| Criteria | Single (Chosen) | Two Processes |
|----------|-----------------|---------------|
| UX | Seamless, one command | Requires separate terminal |
| Port Management | CLI owns it | Race conditions possible |
| Lifecycle | Clean shutdown | Orphan process risk |
| Development | Simpler debugging | More complex |
| Resource | Shared memory | Isolation |

**Choose two processes when**: Server needs to run as daemon/service independent of CLI sessions, or for production multi-tenant deployment.

**Source**: When you run opencode it starts a TUI and a server. Where the TUI is the client that talks to the server. This architecture lets opencode support multiple clients and allows you to interact with opencode programmatically.

### TanStack Start Server Routes vs Hono-Only

| Criteria | Hono-Only (Chosen) | TanStack Server Routes |
|----------|-------------------|------------------------|
| Runtime | Single server process | Requires Start runtime |
| Type Safety | Manual Zod schemas | Built-in from routes |
| SSE/Streaming | Native Hono support | More complex setup |
| Build | Simple Vite SPA | Full-stack build |
| Deployment | Static + API | Needs Node runtime |

**Choose TanStack Server Routes when**: Building traditional web app with SSR/SEO needs, or when type-safe RPC from routes is a core requirement.

**Sources**:
- Deploying a purely client-side SPA to a host or CDN often requires the use of redirects to ensure that urls are properly rewritten to the SPA shell.
- If you know with certainty that you will not need any of the above features, then you may want to consider using TanStack Router alone, which is still a powerful and type-safe SPA routing upgrade.

---

## C) Monorepo Layout

```
tool/
├── apps/
│   ├── cli/                      # Ink-based TUI + server bootstrap
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point (yargs commands)
│   │   │   ├── bootstrap.ts      # Server lifecycle manager
│   │   │   ├── components/       # Ink React components
│   │   │   │   ├── chat.tsx
│   │   │   │   ├── review-view.tsx
│   │   │   │   ├── onboarding.tsx
│   │   │   │   └── status-bar.tsx
│   │   │   ├── hooks/            # CLI-specific hooks
│   │   │   └── commands/         # Command handlers
│   │   │       ├── run.ts
│   │   │       ├── serve.ts
│   │   │       └── auth.ts
│   │   └── package.json
│   │
│   ├── web/                      # TanStack Start SPA
│   │   ├── src/
│   │   │   ├── routes/           # TanStack Router routes
│   │   │   │   ├── __root.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   ├── chat.$sessionId.tsx
│   │   │   │   └── reviews.tsx
│   │   │   ├── features/         # Feature modules
│   │   │   │   ├── chat/
│   │   │   │   ├── review/
│   │   │   │   └── onboarding/
│   │   │   ├── components/       # Shared UI components
│   │   │   └── lib/              # Web utilities
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── server/                   # Hono server (headless)
│       ├── src/
│       │   ├── index.ts          # Server entry
│       │   ├── routes/           # Hono route handlers
│       │   │   ├── sessions.ts
│       │   │   ├── reviews.ts
│       │   │   ├── events.ts     # SSE endpoint
│       │   │   └── config.ts
│       │   ├── middleware/       # Auth, CORS, logging
│       │   └── adapters/         # Node adapter setup
│       └── package.json
│
├── packages/
│   ├── core/                     # Shared business logic
│   │   ├── src/
│   │   │   ├── session/          # Session management
│   │   │   ├── review/           # Code review logic
│   │   │   ├── chat/             # Chat/message handling
│   │   │   └── git/              # Git operations
│   │   └── package.json
│   │
│   ├── providers/                # AI provider adapters
│   │   ├── src/
│   │   │   ├── types.ts          # Provider interface
│   │   │   ├── gemini.ts         # @google/genai adapter
│   │   │   ├── openai.ts         # Future: OpenAI
│   │   │   └── anthropic.ts      # Future: Claude
│   │   └── package.json
│   │
│   ├── schemas/                  # Zod schemas & types
│   │   ├── src/
│   │   │   ├── config.ts
│   │   │   ├── session.ts
│   │   │   ├── message.ts
│   │   │   ├── review.ts
│   │   │   ├── events.ts         # SSE event schemas
│   │   │   └── api.ts            # API request/response
│   │   └── package.json
│   │
│   ├── storage/                  # File-based persistence
│   │   ├── src/
│   │   │   ├── sessions.ts
│   │   │   ├── reviews.ts
│   │   │   ├── config.ts
│   │   │   └── paths.ts          # XDG paths
│   │   └── package.json
│   │
│   ├── secrets/                  # Keyring + vault
│   │   ├── src/
│   │   │   ├── keyring.ts        # @napi-rs/keyring wrapper
│   │   │   ├── vault.ts          # Encrypted file fallback
│   │   │   └── index.ts          # Unified API
│   │   └── package.json
│   │
│   ├── events/                   # Event bus + SSE helpers
│   │   ├── src/
│   │   │   ├── bus.ts            # In-memory event bus
│   │   │   ├── global-bus.ts     # Cross-client broadcast
│   │   │   └── sse.ts            # SSE formatting helpers
│   │   └── package.json
│   │
│   └── ui-shared/                # Shared UI primitives
│       ├── src/
│       │   ├── theme.ts          # Theme definitions
│       │   ├── markdown.ts       # Markdown rendering
│       │   └── typewriter.ts     # Streaming text effect
│       └── package.json
│
├── turbo.json                    # Turborepo config
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

### Naming Conventions

**File Naming**:
- **Component files**: Use kebab-case for all component files (e.g., `chat-view.tsx`, `status-bar.tsx`, `onboarding-flow.tsx`)
- **Non-component files**: Use kebab-case for utilities, hooks, and other modules (e.g., `api-client.ts`, `use-sse.ts`)
- **Index files**: Use `index.ts` for barrel exports
- **Route files**: Follow TanStack Router conventions (e.g., `__root.tsx`, `chat.$sessionId.tsx`)

**Rationale**: Kebab-case provides consistent, URL-friendly file names across all platforms, avoiding case-sensitivity issues between operating systems (macOS/Windows are case-insensitive, Linux is case-sensitive).

### Import Boundaries (Enforced via ESLint)

```
┌─────────────────────────────────────────────────────────┐
│                        apps/*                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │   cli   │  │   web   │  │  server │                 │
│  └────┬────┘  └────┬────┘  └────┬────┘                 │
│       │            │            │                       │
│       └────────────┴────────────┘                       │
│                    │ imports from                       │
├────────────────────┴────────────────────────────────────┤
│                    packages/*                           │
│  ┌────────┐  ┌──────────┐  ┌─────────┐  ┌───────────┐  │
│  │  core  │  │ providers│  │ schemas │  │  storage  │  │
│  └────┬───┘  └────┬─────┘  └────┬────┘  └─────┬─────┘  │
│       │           │             │             │         │
│       └───────────┴─────────────┴─────────────┘         │
│                         │ imports from                  │
│                    ┌────┴────┐                          │
│                    │ schemas │  (lowest level)          │
│                    └─────────┘                          │
└─────────────────────────────────────────────────────────┘
```

**Rules**:
- `apps/*` may import from any `packages/*`
- `packages/core` may import from `schemas`, `storage`, `events`
- `packages/providers` may import only from `schemas`
- `packages/schemas` imports nothing from monorepo (leaf package)
- No cross-imports between `apps/*`

---

## D) Folder & Module Structure (Bulletproof Pattern)

### Backend (apps/server) - Bulletproof Node.js Pattern

```
server/src/
├── index.ts                 # Entry: creates app, starts server
├── app.ts                   # Hono app factory
├── routes/                  # Transport layer (thin)
│   ├── index.ts             # Route aggregation
│   ├── sessions.ts          # /sessions/* handlers
│   ├── reviews.ts           # /reviews/* handlers
│   ├── events.ts            # /events SSE endpoint
│   └── health.ts            # /health
├── middleware/              # Cross-cutting concerns
│   ├── auth.ts              # Token validation
│   ├── cors.ts              # CORS configuration
│   ├── error-handler.ts     # Global error handling
│   └── request-id.ts        # Request tracing
├── services/                # Business logic (calls core)
│   ├── session-service.ts   # Orchestrates session ops
│   ├── review-service.ts    # Orchestrates review ops
│   └── stream-service.ts    # AI streaming orchestration
└── loaders/                 # Bootstrap functions
    ├── index.ts             # Loader aggregation
    ├── config.ts            # Load & validate config
    ├── storage.ts           # Initialize storage
    └── providers.ts         # Initialize AI providers
```

**Source**: The project follows the 3 tier (or layers) pattern for structuring the code and separate the controllers, services and data access layer.

### Frontend (apps/web) - Bulletproof React Pattern

```
web/src/
├── routes/                  # TanStack Router (page-level)
│   ├── __root.tsx           # Root layout + providers
│   ├── index.tsx            # Home/onboarding
│   ├── chat.$sessionId.tsx  # Chat session view
│   └── reviews.tsx          # Reviews list view
├── features/                # Feature modules
│   ├── chat/
│   │   ├── api/             # API calls for chat
│   │   │   └── queries.ts   # TanStack Query hooks
│   │   ├── components/      # Chat-specific components
│   │   │   ├── chat-input.tsx
│   │   │   ├── message-list.tsx
│   │   │   └── streaming-message.tsx
│   │   ├── hooks/           # Feature hooks
│   │   │   └── use-streaming-message.ts
│   │   └── index.ts         # Public API
│   ├── review/
│   │   ├── api/
│   │   ├── components/
│   │   └── index.ts
│   └── onboarding/
│       ├── components/
│       │   ├── provider-select.tsx
│       │   ├── api-key-input.tsx
│       │   └── theme-select.tsx
│       └── index.ts
├── components/              # Shared UI components
│   ├── ui/                  # Primitives (Button, Input, etc.)
│   └── layout/              # Layout components
├── hooks/                   # Shared hooks
│   ├── use-sse.ts           # SSE connection hook
│   └── use-server-state.ts  # Server state sync
├── lib/                     # Utilities
│   ├── api-client.ts        # Fetch wrapper
│   └── sse-client.ts        # EventSource wrapper
└── providers/               # React context providers
    ├── query-provider.tsx
    └── theme-provider.tsx
```

**Source**: For easy scalability and maintenance, organize most of the code within the features folder. Each feature folder should contain code specific to that feature, keeping things neatly separated.

### CLI (apps/cli) - Ink Pattern

```
cli/src/
├── index.ts                 # Entry: yargs setup
├── bootstrap.ts             # Server lifecycle
├── commands/                # Command handlers
│   ├── run.ts               # Default: start TUI
│   ├── serve.ts             # Headless server
│   ├── auth.ts              # Provider auth
│   └── config.ts            # Config management
├── components/              # Ink React components
│   ├── app.tsx              # Root component
│   ├── chat/
│   │   ├── chat-view.tsx
│   │   ├── input.tsx
│   │   └── messages.tsx
│   ├── review/
│   │   ├── review-view.tsx
│   │   └── diff-display.tsx
│   ├── onboarding/
│   │   ├── onboarding-flow.tsx
│   │   └── steps/
│   └── shared/
│       ├── spinner.tsx
│       ├── link.tsx
│       └── status-bar.tsx
├── hooks/                   # CLI-specific hooks
│   ├── use-server-connection.ts
│   └── use-keyboard-shortcuts.ts
└── context/                 # CLI context providers
    ├── server-context.tsx
    └── session-context.tsx
```

---

## E) Secrets: Keyring/Keychain Deep Dive

### How System Keyrings Work

**macOS Keychain**:
- Secrets stored in encrypted SQLite database at `~/Library/Keychains/`
- Protected by user's login password (derived encryption key)
- Access controlled per-app via ACLs (Access Control Lists)
- App reads via Security.framework API — no password prompt if added by same app

**Windows Credential Manager**:
- Secrets in encrypted DPAPI-protected storage
- Tied to user's Windows login credentials
- Access via Windows Credential Vault API
- No prompt for same-user access

**Linux Secret Service (D-Bus)**:
- GNOME Keyring or KWallet implement freedesktop.org Secret Service API
- Communicates over D-Bus session bus
- Requires running secret service daemon
- **Problem**: Not available in headless/WSL environments

**Source**: Mac, Windows, and Linux all offer secure solutions to do this by using an encryption key derived from the user's login. Mac OS has Keychain, Windows has Credentials Manager, and Linux has Gnome Keyring.

### Library Comparison

| Library | Stars | Maintenance | Linux Headless | Native Binding |
|---------|-------|-------------|----------------|----------------|
| keytar | ~1.2k | Deprecated (Atom) | ❌ Requires libsecret | node-gyp |
| @napi-rs/keyring | ~200 | Active (NAPI-RS) | ✅ Uses keyring-rs | napi-rs (Rust) |
| cross-keychain | ~50 | Active | ✅ Fallback to file | Wraps @napi-rs |

**Recommendation**: `@napi-rs/keyring`

**Sources**:
- A better approach is to utilize @napi-rs/keyring which is a thin napi-rs wrapper on top of the keyring-rs crate written in Rust. There, the secret store is implemented natively in Rust as well.
- There is another npm package called @napi-rs/keyring that does what keytar does, but no libsecret requirement.

### Implementation Strategy

```
┌─────────────────────────────────────────────────────────┐
│                   getApiKey(provider)                   │
├─────────────────────────────────────────────────────────┤
│  1. Check environment variable (GEMINI_API_KEY)         │
│     └─ Return if set (CI/Docker override)               │
├─────────────────────────────────────────────────────────┤
│  2. Try system keyring via @napi-rs/keyring             │
│     ├─ Service: "tool-name"                             │
│     ├─ Account: "gemini-api-key"                        │
│     └─ Return if found                                  │
├─────────────────────────────────────────────────────────┤
│  3. Fallback: Encrypted vault file                      │
│     ├─ Location: ~/.config/tool/vault.enc              │
│     ├─ Encryption: AES-256-GCM                          │
│     ├─ Key derivation: scrypt from user password        │
│     └─ Return if found (prompt for vault password)      │
├─────────────────────────────────────────────────────────┤
│  4. Last resort: Check config.json (with warning)       │
│     └─ Only if user explicitly opted in                 │
└─────────────────────────────────────────────────────────┘
```

### Config File Reference Format

```json
// ~/.config/tool/config.json
{
  "theme": "dark",
  "provider": "gemini",
  "secrets": {
    "gemini": {
      "storage": "keyring",     // "keyring" | "vault" | "plaintext"
      "keyringService": "tool",
      "keyringAccount": "gemini-api-key"
    }
  }
}
```

**When keyring fails** (headless Linux, WSL without systemd):
- Detect via try/catch on Entry operations
- Offer interactive vault setup with master password
- Store vault password hint (not password) in config
- Warn user on each session if using plaintext fallback

---

## F) Realtime Spec: SSE Events + Streaming

### SSE Event Protocol

```typescript
// packages/schemas/src/events.ts
import { z } from 'zod';

// Base event structure
export const BaseEventSchema = z.object({
  id: z.string(),           // Unique event ID for replay
  timestamp: z.number(),    // Unix ms
});

// Session events
export const SessionCreatedEvent = BaseEventSchema.extend({
  type: z.literal('session.created'),
  data: z.object({
    sessionId: z.string(),
    title: z.string().optional(),
  }),
});

export const SessionUpdatedEvent = BaseEventSchema.extend({
  type: z.literal('session.updated'),
  data: z.object({
    sessionId: z.string(),
    title: z.string().optional(),
    status: z.enum(['active', 'idle', 'completed']),
  }),
});

// Message streaming events (typewriter effect)
export const MessageStartEvent = BaseEventSchema.extend({
  type: z.literal('message.start'),
  data: z.object({
    sessionId: z.string(),
    messageId: z.string(),
    role: z.enum(['user', 'assistant']),
  }),
});

export const MessageChunkEvent = BaseEventSchema.extend({
  type: z.literal('message.chunk'),
  data: z.object({
    sessionId: z.string(),
    messageId: z.string(),
    chunk: z.string(),       // Text fragment
    index: z.number(),       // Chunk sequence number
  }),
});

export const MessageDoneEvent = BaseEventSchema.extend({
  type: z.literal('message.done'),
  data: z.object({
    sessionId: z.string(),
    messageId: z.string(),
    finalContent: z.string(),
    usage: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
    }).optional(),
  }),
});

// Review events
export const ReviewStartedEvent = BaseEventSchema.extend({
  type: z.literal('review.started'),
  data: z.object({
    reviewId: z.string(),
    target: z.enum(['file', 'git-changes']),
    path: z.string().optional(),
  }),
});

export const ReviewChunkEvent = BaseEventSchema.extend({
  type: z.literal('review.chunk'),
  data: z.object({
    reviewId: z.string(),
    chunk: z.string(),
  }),
});

export const ReviewCompletedEvent = BaseEventSchema.extend({
  type: z.literal('review.completed'),
  data: z.object({
    reviewId: z.string(),
    artifactPath: z.string(), // Path to saved artifact
  }),
});

// Union of all events
export const SSEEvent = z.discriminatedUnion('type', [
  SessionCreatedEvent,
  SessionUpdatedEvent,
  MessageStartEvent,
  MessageChunkEvent,
  MessageDoneEvent,
  ReviewStartedEvent,
  ReviewChunkEvent,
  ReviewCompletedEvent,
]);

export type SSEEvent = z.infer<typeof SSEEvent>;
```

### SSE Wire Format

```
id: evt_abc123
event: message.chunk
data: {"sessionId":"sess_1","messageId":"msg_1","chunk":"Hello","index":0}

id: evt_abc124
event: message.chunk
data: {"sessionId":"sess_1","messageId":"msg_1","chunk":" world","index":1}

id: evt_abc125
event: message.done
data: {"sessionId":"sess_1","messageId":"msg_1","finalContent":"Hello world"}
```

### Reconnection & Keepalive

```typescript
// Server: Send keepalive every 15s
const KEEPALIVE_INTERVAL = 15_000;

// In SSE handler
await stream.writeSSE({ 
  event: 'keepalive', 
  data: JSON.stringify({ timestamp: Date.now() })
});

// Client: Reconnect with Last-Event-ID
const eventSource = new EventSource('/events');

eventSource.onerror = () => {
  // EventSource auto-reconnects with Last-Event-ID header
  // Server uses this to replay missed events
};
```

### Broadcast to Multiple Clients

```typescript
// packages/events/src/global-bus.ts

type Subscriber = (event: SSEEvent) => void;

const subscribers = new Set<Subscriber>();

export const GlobalBus = {
  subscribe(callback: Subscriber): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },

  publish(event: SSEEvent): void {
    subscribers.forEach(cb => cb(event));
  },
};

// In SSE route handler
app.get('/events', async (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = GlobalBus.subscribe(async (event) => {
      await stream.writeSSE({
        id: event.id,
        event: event.type,
        data: JSON.stringify(event.data),
      });
    });

    // Keepalive loop
    while (true) {
      await stream.sleep(15_000);
      await stream.writeSSE({ event: 'keepalive', data: '{}' });
    }
  });
});
```

**Source**: It allows you to stream Server-Sent Events (SSE) seamlessly... The third argument of the streaming helper is an error handler.

### Streaming Typewriter Effect (Web + CLI)

**State Machine**:
```
IDLE → STREAMING → FINALIZING → COMPLETE
         ↑              │
         └──────────────┘ (new message)
```

**Web Implementation**:
```typescript
// features/chat/hooks/use-streaming-message.ts
function useStreamingMessage(sessionId: string) {
  const [messages, setMessages] = useState<Map<string, Message>>();
  const [streamingId, setStreamingId] = useState<string | null>(null);

  useSSE('/events', (event) => {
    switch (event.type) {
      case 'message.start':
        if (event.data.sessionId === sessionId) {
          setStreamingId(event.data.messageId);
          setMessages(prev => prev.set(event.data.messageId, {
            id: event.data.messageId,
            content: '',
            status: 'streaming',
          }));
        }
        break;
      
      case 'message.chunk':
        if (event.data.messageId === streamingId) {
          setMessages(prev => {
            const msg = prev.get(event.data.messageId);
            if (msg) {
              return prev.set(event.data.messageId, {
                ...msg,
                content: msg.content + event.data.chunk,
              });
            }
            return prev;
          });
        }
        break;

      case 'message.done':
        setStreamingId(null);
        setMessages(prev => {
          const msg = prev.get(event.data.messageId);
          if (msg) {
            return prev.set(event.data.messageId, {
              ...msg,
              content: event.data.finalContent,
              status: 'complete',
            });
          }
          return prev;
        });
        break;
    }
  });

  return { messages, isStreaming: !!streamingId };
}
```

---

## G) API Spec: Routes & Commands

### REST Endpoints

```yaml
# Session Management
POST   /sessions                    # Create new session
GET    /sessions                    # List sessions
GET    /sessions/:id                # Get session details
DELETE /sessions/:id                # Delete session

# Messages (within session)
POST   /sessions/:id/messages       # Send user message (triggers AI)
GET    /sessions/:id/messages       # Get message history

# Reviews
POST   /reviews/file                # Review single file
POST   /reviews/git-changes         # Review git diff
GET    /reviews                     # List review artifacts
GET    /reviews/:id                 # Get review artifact

# Configuration
GET    /config                      # Get current config
PATCH  /config                      # Update config
POST   /config/onboarding           # Complete onboarding

# Auth
POST   /auth/provider               # Set provider API key
GET    /auth/status                 # Check auth status

# Server
GET    /health                      # Health check
GET    /events                      # SSE event stream

# Git
GET    /git/status                  # Get git status
GET    /git/diff                    # Get current diff
```

### Example Payloads

**Create Session**:
```typescript
// POST /sessions
// Request
{ "title": "Feature implementation" }

// Response
{
  "id": "sess_abc123",
  "title": "Feature implementation",
  "createdAt": 1705600000000,
  "status": "active"
}
```

**Send Message**:
```typescript
// POST /sessions/sess_abc123/messages
// Request
{
  "content": "Review this function for performance issues",
  "attachments": [
    { "type": "file", "path": "/src/utils/parse.ts" }
  ]
}

// Response (immediate, streaming via SSE)
{
  "messageId": "msg_xyz789",
  "status": "processing"
}
```

**Review Git Changes**:
```typescript
// POST /reviews/git-changes
// Request
{
  "scope": "staged",  // "staged" | "unstaged" | "all"
  "includeUntracked": false
}

// Response
{
  "reviewId": "rev_def456",
  "status": "processing",
  "filesCount": 3
}
```

**Set Provider Key**:
```typescript
// POST /auth/provider
// Request
{
  "provider": "gemini",
  "apiKey": "AIza...",
  "storage": "keyring"  // "keyring" | "vault" | "plaintext"
}

// Response
{
  "success": true,
  "provider": "gemini",
  "storage": "keyring"
}
```

### Security Headers

All state-changing requests require:
```http
X-Session-Token: <random-token-generated-at-server-start>
Content-Type: application/json
```

---

## H) Schemas & Types

### Package Structure

```typescript
// packages/schemas/src/index.ts
export * from './config';
export * from './session';
export * from './message';
export * from './review';
export * from './events';
export * from './api';
export * from './provider';
```

### Core Schemas

```typescript
// packages/schemas/src/config.ts
import { z } from 'zod';

export const ThemeSchema = z.enum(['light', 'dark', 'system']);

export const ProviderSchema = z.enum(['gemini', 'openai', 'anthropic', 'local']);

export const SecretStorageSchema = z.enum(['keyring', 'vault', 'plaintext', 'env']);

export const ProviderConfigSchema = z.object({
  storage: SecretStorageSchema,
  keyringService: z.string().optional(),
  keyringAccount: z.string().optional(),
  envVar: z.string().optional(),
});

export const ConfigSchema = z.object({
  version: z.literal(1),
  theme: ThemeSchema.default('system'),
  provider: ProviderSchema.default('gemini'),
  secrets: z.record(ProviderSchema, ProviderConfigSchema).default({}),
  server: z.object({
    port: z.number().min(1024).max(65535).optional(),
    hostname: z.string().default('127.0.0.1'),
  }).default({}),
  onboardingCompleted: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;
```

```typescript
// packages/schemas/src/session.ts
import { z } from 'zod';

export const SessionStatusSchema = z.enum(['active', 'idle', 'completed', 'error']);

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: SessionStatusSchema,
  provider: z.string(),
  model: z.string(),
  tokenUsage: z.object({
    prompt: z.number(),
    completion: z.number(),
  }).optional(),
});

export type Session = z.infer<typeof SessionSchema>;
```

```typescript
// packages/schemas/src/message.ts
import { z } from 'zod';

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const AttachmentSchema = z.object({
  type: z.enum(['file', 'image', 'code']),
  path: z.string().optional(),
  content: z.string().optional(),
  mimeType: z.string().optional(),
});

export const MessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  attachments: z.array(AttachmentSchema).default([]),
  createdAt: z.number(),
  status: z.enum(['pending', 'streaming', 'complete', 'error']),
  tokenCount: z.number().optional(),
});

export type Message = z.infer<typeof MessageSchema>;
```

```typescript
// packages/schemas/src/review.ts
import { z } from 'zod';

export const ReviewTargetSchema = z.enum(['file', 'git-changes']);

export const GitScopeSchema = z.enum(['staged', 'unstaged', 'all']);

export const ReviewSchema = z.object({
  id: z.string(),
  target: ReviewTargetSchema,
  createdAt: z.number(),
  completedAt: z.number().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'error']),
  
  // For file review
  filePath: z.string().optional(),
  
  // For git changes review
  gitScope: GitScopeSchema.optional(),
  filesReviewed: z.array(z.string()).optional(),
  
  // Result
  artifactPath: z.string().optional(),
  summary: z.string().optional(),
});

export type Review = z.infer<typeof ReviewSchema>;
```

### Schema Versioning Strategy

```typescript
// Migration pattern
const ConfigV1Schema = z.object({ version: z.literal(1), /* ... */ });
const ConfigV2Schema = z.object({ version: z.literal(2), /* ... */ });

function migrateConfig(raw: unknown): Config {
  const base = z.object({ version: z.number() }).parse(raw);
  
  switch (base.version) {
    case 1:
      return migrateV1toV2(ConfigV1Schema.parse(raw));
    case 2:
      return ConfigV2Schema.parse(raw);
    default:
      throw new Error(`Unknown config version: ${base.version}`);
  }
}
```

---

## I) Storage Spec: File Structure

### Directory Layout (XDG Compliant)

```
~/.config/tool/                    # XDG_CONFIG_HOME
├── config.json                    # Main configuration
└── vault.enc                      # Encrypted secrets (fallback)

~/.local/share/tool/               # XDG_DATA_HOME
├── sessions/
│   ├── sess_abc123/
│   │   ├── session.json           # Session metadata
│   │   └── messages/
│   │       ├── msg_001.json
│   │       ├── msg_002.json
│   │       └── ...
│   └── sess_def456/
│       └── ...
├── reviews/
│   ├── rev_xyz789/
│   │   ├── review.json            # Review metadata
│   │   ├── diff.patch             # Git diff snapshot
│   │   └── result.md              # AI review output
│   └── ...
└── git-snapshots/                 # Temporary diff storage
    └── ...

~/.local/state/tool/               # XDG_STATE_HOME
└── logs/
    ├── 2026-01-18T120000.log
    └── ...

~/.cache/tool/                     # XDG_CACHE_HOME
└── provider-responses/            # Optional response cache
```

**Source**: OpenCode stores all data locally as JSON files in a structured directory hierarchy: ~/.local/share/opencode/ with auth.json for API keys and OAuth tokens, log/ for application logs, and project/ directories containing session/, message/, and part/ subdirectories.

### File Formats

**config.json**:
```json
{
  "version": 1,
  "theme": "dark",
  "provider": "gemini",
  "secrets": {
    "gemini": {
      "storage": "keyring",
      "keyringService": "tool",
      "keyringAccount": "gemini-api-key"
    }
  },
  "server": {
    "hostname": "127.0.0.1"
  },
  "onboardingCompleted": true
}
```

**session.json**:
```json
{
  "id": "sess_abc123",
  "title": "Implement auth feature",
  "createdAt": 1705600000000,
  "updatedAt": 1705601000000,
  "status": "active",
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "tokenUsage": {
    "prompt": 1500,
    "completion": 800
  }
}
```

**review.json**:
```json
{
  "id": "rev_xyz789",
  "target": "git-changes",
  "gitScope": "staged",
  "createdAt": 1705602000000,
  "completedAt": 1705602030000,
  "status": "completed",
  "filesReviewed": [
    "src/auth/login.ts",
    "src/auth/session.ts"
  ],
  "artifactPath": "result.md",
  "summary": "Found 3 potential issues: 2 security, 1 performance"
}
```

---

## J) Security: Threat Model & Mitigations

### Threat Model for Local Tool

| Threat | Vector | Impact | Mitigation |
|--------|--------|--------|------------|
| **Drive-by Request** | Malicious website sends requests to localhost | API key theft, code execution | Session token + custom header |
| **0.0.0.0 Day** | Requests via 0.0.0.0 bypass some protections | Same as above | Bind only 127.0.0.1 |
| **CSRF** | Browser sends credentialed requests | State changes without consent | Require custom header |
| **Plaintext Key** | Config file readable | API key theft | Keyring/vault storage |
| **Network Exposure** | Accidental bind to 0.0.0.0 | Remote access | Default to 127.0.0.1, warn on override |

**Sources**:
- Researchers at Oligo Security have disclosed a logical vulnerability to all major browsers that enables external websites to communicate with (and potentially exploit) software that runs locally on MacOS and Linux.
- Since browser requests automatically include all cookies including session cookies, this attack works unless proper authorization is used, which means that the target site's challenge-response mechanism does not verify the identity and authority of the requester.

### Security Defaults

```typescript
// apps/server/src/middleware/security.ts

// 1. Bind only to localhost
const DEFAULT_HOSTNAME = '127.0.0.1'; // NOT 0.0.0.0

// 2. Generate session token on startup
const sessionToken = crypto.randomBytes(32).toString('hex');
// Display to user: "Session token: abc123... (required for API access)"

// 3. Require custom header for state-changing requests
app.use(async (c, next) => {
  const method = c.req.method;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = c.req.header('X-Session-Token');
    if (token !== sessionToken) {
      return c.json({ error: 'Invalid session token' }, 401);
    }
  }
  return next();
});

// 4. No permissive CORS by default
app.use(cors({
  origin: (origin) => {
    // Only allow same-origin (null origin for file:// or localhost)
    if (!origin) return true;
    const url = new URL(origin);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  },
  credentials: false, // No cookies
}));

// 5. Explicit opt-in for network exposure
if (config.server.hostname === '0.0.0.0') {
  console.warn('⚠️  WARNING: Server bound to all interfaces!');
  console.warn('   This exposes the server to your local network.');
  console.warn('   Only do this if you understand the security implications.');
}
```

### When It's Safe to Relax

| Flag | Use Case | Risk | Requirement |
|------|----------|------|-------------|
| `--hostname 0.0.0.0` | Access from mobile/other device | LAN exposure | Show warning, require `--i-understand-the-risks` |
| `--cors-origin *` | External web client | CSRF from any site | Must combine with strong auth |
| `--no-token` | Development/testing | Any process can access | Never in production |

---

## K) Roadmap: MVP → Future

### MVP (Phase 1)
- [ ] Monorepo scaffolding with pnpm + Turborepo
- [ ] Shared schemas package with Zod
- [ ] Basic Hono server with health endpoint
- [ ] SSE event streaming infrastructure
- [ ] Keyring integration (@napi-rs/keyring)
- [ ] Onboarding flow (theme + Gemini API key)
- [ ] CLI bootstrap + TUI shell (Ink)
- [ ] Single chat session (create, send message, receive stream)
- [ ] Basic web UI (TanStack Start SPA)
- [ ] Session persistence (JSON files)

### Phase 2: Full Feature Set
- [ ] Multiple sessions with history
- [ ] File review feature
- [ ] Git changes review (staged/unstaged diff)
- [ ] Review artifacts storage
- [ ] CLI ↔ Web realtime sync
- [ ] Improved typewriter streaming
- [ ] Reconnection with event replay
- [ ] Config migrations

### Phase 3: Multi-Provider
- [ ] OpenAI provider adapter
- [ ] Anthropic provider adapter
- [ ] Local model support (Ollama)
- [ ] Provider switching in UI
- [ ] Model selection per session
- [ ] Cost tracking per provider

### Phase 4: Polish & Ecosystem
- [ ] File watcher for git changes
- [ ] VS Code extension
- [ ] Desktop app (Tauri wrapper)
- [ ] Plugin system
- [ ] MCP (Model Context Protocol) support
- [ ] Session sharing/export

### Future Considerations
- Multi-user (requires auth beyond token)
- Cloud sync
- Team features
- Custom tools/agents

---

## References

1. OpenCode Architecture - https://deepwiki.com/sst/opencode
2. OpenCode Server Docs - https://opencode.ai/docs/server/
3. TanStack Start SPA Mode - https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode
4. Hono SSE Streaming - https://hono.dev/docs/helpers/streaming
5. @napi-rs/keyring - https://github.com/Brooooooklyn/keyring-node
6. 0.0.0.0 Day Vulnerability - https://www.oligo.security/blog/0-0-0-0-day-exploiting-localhost-apis-from-the-browser
7. CSRF Prevention - https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
8. Bulletproof React - https://github.com/alan2207/bulletproof-react
9. Bulletproof Node.js - https://github.com/santiq/bulletproof-nodejs
10. @google/genai SDK - https://github.com/googleapis/js-genai
11. Ink (React for CLI) - https://github.com/vadimdemedes/ink
12. Monorepo Architecture 2025 - https://feature-sliced.design/blog/frontend-monorepo-explained
