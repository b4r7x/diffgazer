import { describe, expect, it } from "vitest";
import { recoverJsonObject, recoverJsonObjects } from "./recover-json.js";

const REVIEW = { issues: [{ id: "issue-1", title: "Fenced finding" }] };

describe("recoverJsonObject", () => {
  it("recovers an object wrapped in a ```json fence", () => {
    const content = `\`\`\`json\n${JSON.stringify(REVIEW)}\n\`\`\``;
    expect(recoverJsonObject(content)).toEqual(REVIEW);
  });

  it("recovers an object wrapped in a bare ``` fence", () => {
    const content = `\`\`\`\n${JSON.stringify(REVIEW)}\n\`\`\``;
    expect(recoverJsonObject(content)).toEqual(REVIEW);
  });

  it("recovers an object surrounded by prose preamble and postamble", () => {
    const content = `Here is the review you asked for:\n${JSON.stringify(REVIEW)}\nLet me know if you need anything else.`;
    expect(recoverJsonObject(content)).toEqual(REVIEW);
  });

  it("recovers a fenced object surrounded by prose", () => {
    const content = `Sure! Here it is:\n\`\`\`json\n${JSON.stringify(REVIEW)}\n\`\`\`\nDone.`;
    expect(recoverJsonObject(content)).toEqual(REVIEW);
  });

  it("keeps braces and quotes inside JSON strings intact", () => {
    const review = {
      issues: [{ id: "issue-1", rationale: 'code like `if (a) { return "}"; }` is fine' }],
    };
    const content = `Analysis follows.\n${JSON.stringify(review)}\nEnd of analysis.`;
    expect(recoverJsonObject(content)).toEqual(review);
  });

  it("picks the largest balanced object when several are present", () => {
    const small = { ok: true };
    const content = `${JSON.stringify(small)} and the real answer ${JSON.stringify(REVIEW)}`;
    expect(recoverJsonObject(content)).toEqual(REVIEW);
  });

  it("returns null for prose without any JSON object", () => {
    expect(recoverJsonObject("not-json")).toBeNull();
    expect(recoverJsonObject("still-not-json")).toBeNull();
  });

  it("returns null for an unbalanced object (truncated output)", () => {
    expect(recoverJsonObject('{"issues":[{"id":"issue-1","title":"cut off mid str')).toBeNull();
    expect(recoverJsonObject("{")).toBeNull();
  });

  it("returns null when the only balanced candidate is invalid JSON", () => {
    expect(recoverJsonObject("{unquoted: keys}")).toBeNull();
  });

  it("does not repair trailing commas", () => {
    expect(recoverJsonObject('{"issues":[],}')).toBeNull();
  });

  it("returns null for a top-level array", () => {
    expect(recoverJsonObject("[1,2,3]")).toBeNull();
  });
});

describe("recoverJsonObjects", () => {
  it("collects the complete objects of a top-level object the model never closed", () => {
    const content = '{"issues":[{"id":"a"},{"id":"b"},{"id":"c","title":"cut off mid str';

    expect(recoverJsonObjects(content)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("never emits an object nested inside one it already kept", () => {
    const content = '{"issues":[{"id":"a","evidence":[{"type":"code","excerpt":"x"}]},{"id":"b"';

    expect(recoverJsonObjects(content)).toEqual([
      { id: "a", evidence: [{ type: "code", excerpt: "x" }] },
    ]);
  });

  it("returns the whole answer as one object when it closed", () => {
    expect(recoverJsonObjects(JSON.stringify(REVIEW))).toEqual([REVIEW]);
  });

  it("reads through a fence and keeps braces inside strings intact", () => {
    const content = '```json\n{"issues":[{"id":"a","rationale":"a } brace"},{"id":"b"';

    expect(recoverJsonObjects(content)).toEqual([{ id: "a", rationale: "a } brace" }]);
  });

  it("falls back to the children when the enclosing object does not parse", () => {
    const content = '{"issues":[{"id":"a"},{"id":"b"},]}';

    expect(recoverJsonObjects(content)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("returns nothing for prose without a complete object", () => {
    expect(recoverJsonObjects('not json {"id":"cut')).toEqual([]);
  });
});
