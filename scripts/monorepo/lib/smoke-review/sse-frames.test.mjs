import assert from "node:assert/strict";
import { test } from "node:test";
import { createSseFrameParser } from "./sse-frames.mjs";

test("SSE parser reassembles a frame split across chunks", () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.feed("event: complete\nda"), []);
  assert.deepEqual(parser.feed('ta: {"a":1}\n\n'), [{ event: "complete", data: '{"a":1}' }]);
});

test("SSE parser emits multiple frames from one chunk", () => {
  const parser = createSseFrameParser();
  const frames = parser.feed(
    'event: step_start\ndata: {"a":1}\n\nevent: complete\ndata: {"b":2}\n\n',
  );
  assert.deepEqual(frames, [
    { event: "step_start", data: '{"a":1}' },
    { event: "complete", data: '{"b":2}' },
  ]);
});

test("SSE parser joins multi-line data and handles CRLF", () => {
  const parser = createSseFrameParser();
  const frames = parser.feed("event: chunk\r\ndata: first\r\ndata: second\r\n\r\n");
  assert.deepEqual(frames, [{ event: "chunk", data: "first\nsecond" }]);
});

test("SSE parser does not emit a trailing partial frame", () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.feed('event: complete\ndata: {"a":1}\n'), []);
});

test("SSE parser ignores comment and id lines", () => {
  const parser = createSseFrameParser();
  const frames = parser.feed(": keep-alive\nid: 3\nevent: chunk\ndata: x\n\n");
  assert.deepEqual(frames, [{ event: "chunk", data: "x" }]);
});
