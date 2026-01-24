import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "@repo/schemas/session";
import type { AIClient, StreamCallbacks } from "@repo/core/ai";
import { ErrorCode } from "@repo/schemas/errors";

const mockSessionStore = vi.hoisted(() => ({
  read: vi.fn(),
}));

const mockAddMessage = vi.hoisted(() => vi.fn());

const mockInitializeAIClient = vi.hoisted(() => vi.fn());

vi.mock("@repo/core/storage", () => ({
  sessionStore: mockSessionStore,
  addMessage: mockAddMessage,
}));

vi.mock("../lib/ai-client.js", () => ({
  initializeAIClient: mockInitializeAIClient,
}));

let prepareChatContext: typeof import("./chat.js").prepareChatContext;
let saveUserMessage: typeof import("./chat.js").saveUserMessage;
let streamChatToSSE: typeof import("./chat.js").streamChatToSSE;

describe("Chat Service", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const chatMod = await import("./chat.js");
    prepareChatContext = chatMod.prepareChatContext;
    saveUserMessage = chatMod.saveUserMessage;
    streamChatToSSE = chatMod.streamChatToSSE;
  });

  describe("prepareChatContext", () => {
    it("loads session and initializes AI client", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          title: "Test Session",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: vi.fn(),
        generate: vi.fn(),
      };

      mockSessionStore.read.mockResolvedValue({ ok: true, value: mockSession });
      mockInitializeAIClient.mockResolvedValue({ ok: true, value: mockClient });

      const result = await prepareChatContext("session-123");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.session).toEqual(mockSession);
        expect(result.value.aiClient).toEqual(mockClient);
      }
      expect(mockSessionStore.read).toHaveBeenCalledWith("session-123");
      expect(mockInitializeAIClient).toHaveBeenCalled();
    });

    it("returns error when session not found", async () => {
      mockSessionStore.read.mockResolvedValue({ ok: false, error: { message: "Not found" } });

      const result = await prepareChatContext("nonexistent-session");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.SESSION_NOT_FOUND);
        expect(result.error.message).toBe("Session not found");
      }
    });

    it("returns error when AI client initialization fails", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      mockSessionStore.read.mockResolvedValue({ ok: true, value: mockSession });
      mockInitializeAIClient.mockResolvedValue({
        ok: false,
        error: { message: "API key missing", code: ErrorCode.API_KEY_MISSING },
      });

      const result = await prepareChatContext("session-123");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.API_KEY_MISSING);
      }
    });
  });

  describe("saveUserMessage", () => {
    it("adds message to session", async () => {
      mockAddMessage.mockResolvedValue({
        ok: true,
        value: {
          id: "msg-123",
          role: "user",
          content: "Hello",
          createdAt: "2024-01-01T00:00:00Z",
        },
      });

      const result = await saveUserMessage("session-123", "Hello");

      expect(result.ok).toBe(true);
      expect(mockAddMessage).toHaveBeenCalledWith("session-123", "user", "Hello");
    });

    it("returns error when message save fails", async () => {
      mockAddMessage.mockResolvedValue({
        ok: false,
        error: { message: "Write failed" },
      });

      const result = await saveUserMessage("session-123", "Hello");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.MESSAGE_SAVE_ERROR);
        expect(result.error.message).toBe("Failed to save message");
      }
    });
  });

  describe("streamChatToSSE", () => {
    it("escapes XML in user messages (CVE-2025-53773)", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockGenerateStream = vi
        .fn()
        .mockImplementation(async (prompt: string, callbacks: StreamCallbacks) => {
          expect(prompt).toContain("&lt;malicious&gt;");
          expect(prompt).not.toContain("<malicious>");
          await callbacks.onComplete("Response", { truncated: false });
        });

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      await streamChatToSSE(
        "session-123",
        "<malicious>prompt injection</malicious>",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockGenerateStream).toHaveBeenCalled();
    });

    it("escapes XML in conversation history (CVE-2025-53773)", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 2,
        },
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "<script>alert('xss')</script>",
            createdAt: "2024-01-01T00:00:00Z",
          },
          {
            id: "msg-2",
            role: "assistant",
            content: "Safe response",
            createdAt: "2024-01-01T00:01:00Z",
          },
        ],
      };

      const mockGenerateStream = vi
        .fn()
        .mockImplementation(async (prompt: string, callbacks: StreamCallbacks) => {
          expect(prompt).toContain("&lt;script&gt;");
          expect(prompt).not.toContain("<script>");
          await callbacks.onComplete("Response", { truncated: false });
        });

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      await streamChatToSSE(
        "session-123",
        "Normal message",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockGenerateStream).toHaveBeenCalled();
    });

    it("streams chunks via SSE", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockGenerateStream = vi
        .fn()
        .mockImplementation(async (_prompt: string, callbacks: StreamCallbacks) => {
          await callbacks.onChunk("Hello ");
          await callbacks.onChunk("world");
          await callbacks.onComplete("Hello world", { truncated: false });
        });

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      await streamChatToSSE(
        "session-123",
        "Test message",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "chunk",
        data: JSON.stringify({ type: "chunk", content: "Hello " }),
      });
      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "chunk",
        data: JSON.stringify({ type: "chunk", content: "world" }),
      });
    });

    it("sends complete event with metadata", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockGenerateStream = vi
        .fn()
        .mockImplementation(async (_prompt: string, callbacks: StreamCallbacks) => {
          await callbacks.onComplete("Complete response", { truncated: true });
        });

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      await streamChatToSSE(
        "session-123",
        "Test message",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "complete",
        data: JSON.stringify({
          type: "complete",
          content: "Complete response",
          truncated: true,
        }),
      });
    });

    it("saves assistant message on completion", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockGenerateStream = vi
        .fn()
        .mockImplementation(async (_prompt: string, callbacks: StreamCallbacks) => {
          await callbacks.onComplete("AI response", { truncated: false });
        });

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      mockAddMessage.mockResolvedValue({ ok: true, value: {} });

      await streamChatToSSE(
        "session-123",
        "Test message",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockAddMessage).toHaveBeenCalledWith("session-123", "assistant", "AI response");
    });

    it("sends error event on AI failure", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockGenerateStream = vi
        .fn()
        .mockImplementation(async (_prompt: string, callbacks: StreamCallbacks) => {
          await callbacks.onError(new Error("AI service unavailable"));
        });

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      await streamChatToSSE(
        "session-123",
        "Test message",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: JSON.stringify({
          type: "error",
          error: { message: "AI service unavailable", code: ErrorCode.AI_ERROR },
        }),
      });
    });

    it("handles stream errors gracefully", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockGenerateStream = vi.fn().mockRejectedValue(new Error("Stream error"));

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      await streamChatToSSE(
        "session-123",
        "Test message",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: JSON.stringify({
          type: "error",
          error: { message: "Stream error", code: ErrorCode.STREAM_ERROR },
        }),
      });
    });

    it("includes conversation history in prompt", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 2,
        },
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Previous question",
            createdAt: "2024-01-01T00:00:00Z",
          },
          {
            id: "msg-2",
            role: "assistant",
            content: "Previous answer",
            createdAt: "2024-01-01T00:01:00Z",
          },
        ],
      };

      const mockGenerateStream = vi
        .fn()
        .mockImplementation(async (prompt: string, callbacks: StreamCallbacks) => {
          expect(prompt).toContain("Previous conversation:");
          expect(prompt).toContain("USER: Previous question");
          expect(prompt).toContain("ASSISTANT: Previous answer");
          expect(prompt).toContain("USER: New question");
          await callbacks.onComplete("Response", { truncated: false });
        });

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      await streamChatToSSE(
        "session-123",
        "New question",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockGenerateStream).toHaveBeenCalled();
    });

    it("handles Unicode sanitization", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockGenerateStream = vi
        .fn()
        .mockImplementation(async (_prompt: string, callbacks: StreamCallbacks) => {
          await callbacks.onComplete("Response", { truncated: false });
        });

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockResolvedValue(undefined),
      };

      await streamChatToSSE(
        "session-123",
        "Message with emoji 🚀 and special chars",
        { session: mockSession, aiClient: mockClient },
        mockStream
      );

      expect(mockGenerateStream).toHaveBeenCalled();
    });

    it("throws error when stream is already closed", async () => {
      const mockSession: Session = {
        metadata: {
          id: "session-123",
          projectPath: "/test/project",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          messageCount: 0,
        },
        messages: [],
      };

      const mockGenerateStream = vi.fn().mockRejectedValue(new Error("Stream closed"));

      const mockClient: AIClient = {
        provider: "anthropic",
        generateStream: mockGenerateStream,
        generate: vi.fn(),
      };

      const mockStream = {
        writeSSE: vi.fn().mockRejectedValue(new Error("Stream closed")),
      };

      await expect(
        streamChatToSSE(
          "session-123",
          "Test message",
          { session: mockSession, aiClient: mockClient },
          mockStream
        )
      ).rejects.toThrow("Stream closed");
    });
  });
});
