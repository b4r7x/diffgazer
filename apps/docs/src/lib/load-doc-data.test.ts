import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentSourceData } from "@/types/data";
import type { HookSourceData } from "./generated-doc-data";
import { loadDocPageData, loadDocSourceData } from "./load-doc-data";

const componentHighlighted = [
  {
    number: 1,
    content: [
      { text: "export function Select() {}", color: "var(--syntax-keyword)", className: "code-fn" },
    ],
    state: "highlight",
  },
] satisfies ComponentSourceData["source"][string]["highlighted"];
const componentSourceData = {
  source: {
    "@ui/select/select.tsx": {
      raw: "export function Select() {}",
      highlighted: componentHighlighted,
    },
  },
  mergedSource: "export function Select() {}",
  crossDeps: [{ library: "keys", type: "hook", items: ["navigation"] }],
} satisfies ComponentSourceData;

const hookHighlighted = [{ number: 1, content: [{ text: "export function useFocus() {}" }] }];
const hookSourceData = {
  source: {
    raw: "export function useFocus() {}",
    highlighted: hookHighlighted,
  },
} satisfies HookSourceData;
const hookSourceArchive = {
  ...hookSourceData,
  files: [
    {
      path: "src/hooks/use-focus.ts",
      raw: "export function useFocus() {}",
      highlighted: hookHighlighted,
    },
    {
      path: "src/hooks/utils/focus.ts",
      raw: "export function focus() {}",
      highlighted: [{ number: 1, content: [{ text: "export function focus() {}" }] }],
    },
  ],
} satisfies HookSourceData;

function responseWithJson(data: unknown, status = 200): Response {
  const response = new Response(null, { status });
  vi.spyOn(response, "json").mockResolvedValue(data);
  return response;
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generated docs page data loader", () => {
  it("ignores unsafe metadata paths", async () => {
    await expect(loadDocPageData("ui", "components", "../button")).resolves.toBeNull();
    await expect(loadDocPageData("../ui", "components", "button")).resolves.toBeNull();
  });

  it("loads page metadata without source-bearing hook files", async () => {
    const data = await loadDocPageData("ui", "hooks", "controllable-state", {
      throwIfMissing: true,
    });

    expect(data).toMatchObject({
      name: "controllable-state",
      title: "Controllable State",
    });
    expect(data).not.toHaveProperty("source");
    expect(data?.files?.every((file) => typeof file === "string")).toBe(true);
    expect(JSON.stringify(data?.files)).not.toMatch(/raw|highlighted/);
  });

  it("treats missing metadata as optional unless it is required", async () => {
    await expect(
      loadDocPageData("ui", "components", "missing-component-metadata"),
    ).resolves.toBeNull();
    await expect(
      loadDocPageData("ui", "components", "missing-component-metadata", {
        throwIfMissing: true,
      }),
    ).rejects.toThrow("Missing generated docs data: ui/components/missing-component-metadata");
  });
});

describe("generated docs source data loader", () => {
  it("fetches component source from the exact public archive URL", async () => {
    const fetchMock = stubFetch(responseWithJson(componentSourceData));

    const data = await loadDocSourceData("ui", "components", "select", {
      throwIfMissing: true,
    });

    expect(fetchMock).toHaveBeenCalledWith("/source-data/ui/components/select.source.json");
    expect(data).toEqual(componentSourceData);
    expect(data?.source["@ui/select/select.tsx"]?.highlighted).toEqual(componentHighlighted);
    expect(data?.mergedSource).toEqual(componentSourceData.mergedSource);
  });

  it("fetches hook source from the hooks archive path", async () => {
    const fetchMock = stubFetch(responseWithJson(hookSourceData));

    const data = await loadDocSourceData("keys", "hooks", "focus", {
      throwIfMissing: true,
    });

    expect(fetchMock).toHaveBeenCalledWith("/source-data/keys/hooks/focus.source.json");
    expect(data).toEqual(hookSourceData);
    expect(data?.source.highlighted).toEqual(hookHighlighted);
  });

  it("loads and validates every file in a hook source archive", async () => {
    stubFetch(responseWithJson(hookSourceArchive));

    const data = await loadDocSourceData("keys", "hooks", "focus", {
      throwIfMissing: true,
    });

    expect(data?.files).toEqual(hookSourceArchive.files);
  });

  it("rejects malformed files in a hook source archive", async () => {
    stubFetch(
      responseWithJson({
        ...hookSourceArchive,
        files: [{ ...hookSourceArchive.files[0], path: 42 }],
      }),
    );

    await expect(
      loadDocSourceData("keys", "hooks", "focus", { throwIfMissing: true }),
    ).rejects.toThrow("Invalid generated docs data: keys/hooks/focus.source");
  });

  it("rejects unknown or unsafe archive paths before fetching", async () => {
    const fetchMock = stubFetch();

    await expect(loadDocSourceData("unknown", "components", "button")).resolves.toBeNull();
    await expect(loadDocSourceData("ui", "components", "../button")).resolves.toBeNull();
    await expect(loadDocSourceData("../ui", "components", "button")).resolves.toBeNull();
    await expect(
      Reflect.apply(loadDocSourceData, undefined, ["ui", "examples", "button"]),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a missing archive as optional unless it is required", async () => {
    stubFetch(new Response(null, { status: 404 }), new Response(null, { status: 404 }));

    await expect(
      loadDocSourceData("ui", "components", "missing-component-source"),
    ).resolves.toBeNull();
    await expect(
      loadDocSourceData("ui", "components", "missing-component-source", {
        throwIfMissing: true,
      }),
    ).rejects.toThrow("Missing generated docs data: ui/components/missing-component-source.source");
  });

  it("rejects a response whose body is not valid JSON", async () => {
    const response = new Response(null, { status: 200 });
    vi.spyOn(response, "json").mockRejectedValue(new SyntaxError("Unexpected token"));
    stubFetch(response);

    await expect(
      loadDocSourceData("ui", "components", "select", { throwIfMissing: true }),
    ).rejects.toThrow("Invalid generated docs data: ui/components/select.source");
  });

  it("rejects malformed source and allows a later retry", async () => {
    const malformedSource = {
      source: {
        "@ui/select/select.tsx": {
          raw: "export function Select() {}",
          highlighted: "not-an-array",
        },
      },
      mergedSource: "export function Select() {}",
    };
    const fetchMock = stubFetch(
      responseWithJson(malformedSource),
      responseWithJson(componentSourceData),
    );

    await expect(
      loadDocSourceData("ui", "components", "select", { throwIfMissing: true }),
    ).rejects.toThrow("Invalid generated docs data: ui/components/select.source");
    await expect(
      loadDocSourceData("ui", "components", "select", { throwIfMissing: true }),
    ).resolves.toEqual(componentSourceData);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a null line", [null]],
    ["a non-number line number", [{ number: "1", content: "source" }]],
    ["non-string and non-token content", [{ number: 1, content: { text: "source" } }]],
    ["an unknown line state", [{ number: 1, content: "source", state: "changed" }]],
    ["a null token", [{ number: 1, content: [null] }]],
    ["a token without text", [{ number: 1, content: [{ color: "red" }] }]],
    ["a non-string token color", [{ number: 1, content: [{ text: "source", color: 42 }] }]],
    [
      "a non-string token class name",
      [{ number: 1, content: [{ text: "source", className: false }] }],
    ],
  ])("rejects highlighted source containing %s", async (_label, highlighted) => {
    stubFetch(
      responseWithJson({
        source: {
          "@ui/select/select.tsx": {
            raw: "export function Select() {}",
            highlighted,
          },
        },
        mergedSource: "export function Select() {}",
      }),
    );

    await expect(
      loadDocSourceData("ui", "components", "select", { throwIfMissing: true }),
    ).rejects.toThrow("Invalid generated docs data: ui/components/select.source");
  });
});
