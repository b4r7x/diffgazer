import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createCollection } from "./persistence.js";

const TestSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  metadata: z.object({
    id: z.uuid(),
    label: z.string(),
  }),
});

const MetadataSchema = z.object({
  id: z.uuid(),
  label: z.string(),
});

type TestItem = z.infer<typeof TestSchema>;
type TestMetadata = z.infer<typeof MetadataSchema>;

const TEST_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ID_2 = "660e8400-e29b-41d4-a716-446655440001";

let tempRoot: string;
let collectionDir: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "diffgazer-persistence-"));
  collectionDir = join(tempRoot, "items");
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

function makeItem(id: string = TEST_ID, name: string = "Test"): TestItem {
  return { id, name, metadata: { id, label: name } };
}

function makeCollection(dir: string = collectionDir) {
  return createCollection<TestItem, TestMetadata>({
    name: "test-item",
    dir,
    filePath: (id) => join(dir, `${id}.json`),
    schema: TestSchema,
    metadataSchema: MetadataSchema,
    getMetadata: (item) => item.metadata,
    getId: (item) => item.id,
  });
}

async function writeRawItem(id: string, content: string): Promise<void> {
  await makeCollection().ensureDir();
  await writeFile(join(collectionDir, `${id}.json`), content, "utf-8");
}

describe("createCollection", () => {
  it("writes, reads, lists, and removes real JSON files", async () => {
    const collection = makeCollection();
    const writeResult = await collection.write(makeItem());

    expect(writeResult.ok).toBe(true);
    await expect(readFile(join(collectionDir, `${TEST_ID}.json`), "utf-8")).resolves.toBe(
      `${JSON.stringify(makeItem(), null, 2)}\n`,
    );

    const readResult = await collection.read(TEST_ID);
    expect(readResult).toEqual({ ok: true, value: makeItem() });

    const listResult = await collection.list();
    expect(listResult).toEqual({
      ok: true,
      value: { items: [makeItem().metadata], warnings: [] },
    });

    await expect(collection.remove(TEST_ID)).resolves.toEqual({
      ok: true,
      value: { existed: true },
    });
    await expect(collection.remove(TEST_ID)).resolves.toEqual({
      ok: true,
      value: { existed: false },
    });
  });

  it("returns NOT_FOUND for missing reads and an empty list for missing directories", async () => {
    const collection = makeCollection();

    const readResult = await collection.read(TEST_ID);
    const listResult = await collection.list();

    expect(readResult.ok).toBe(false);
    if (!readResult.ok) expect(readResult.error.code).toBe("NOT_FOUND");
    expect(listResult).toEqual({ ok: true, value: { items: [], warnings: [] } });
  });

  it("reports parse and validation failures from persisted files", async () => {
    const collection = makeCollection();

    await writeRawItem(TEST_ID, "{invalid json");
    const corruptResult = await collection.read(TEST_ID);
    expect(corruptResult.ok).toBe(false);
    if (!corruptResult.ok) expect(corruptResult.error.code).toBe("PARSE_ERROR");

    await writeRawItem(TEST_ID, JSON.stringify({ wrong: "shape" }));
    const invalidResult = await collection.read(TEST_ID);
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) expect(invalidResult.error.code).toBe("VALIDATION_ERROR");
  });

  it("filters non-reviewable files and collects warnings for corrupt items during listing", async () => {
    const collection = makeCollection();
    await collection.write(makeItem(TEST_ID, "Item1"));
    await collection.write(makeItem(TEST_ID_2, "Item2"));
    await writeFile(join(collectionDir, "not-a-uuid.json"), "{}", "utf-8");
    await writeFile(join(collectionDir, "readme.txt"), "ignored", "utf-8");
    await writeRawItem("770e8400-e29b-41d4-a716-446655440002", "{corrupt}");

    const result = await collection.list();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toEqual([
        { id: TEST_ID, label: "Item1" },
        { id: TEST_ID_2, label: "Item2" },
      ]);
      expect(result.value.warnings).toHaveLength(1);
      expect(result.value.warnings[0]).toContain("770e8400-e29b-41d4-a716-446655440002");
    }
  });

  it("lists a legacy review whose metadata carries retired vocabulary", async () => {
    const LegacyItemSchema = z.object({
      id: z.uuid(),
      metadata: z.object({
        id: z.uuid(),
        label: z.enum(["current"]),
      }),
    });
    const LegacyMetadataSchema = LegacyItemSchema.shape.metadata;
    const collection = createCollection<
      z.infer<typeof LegacyItemSchema>,
      z.infer<typeof LegacyMetadataSchema>
    >({
      name: "test-item",
      dir: collectionDir,
      filePath: (id) => join(collectionDir, `${id}.json`),
      schema: LegacyItemSchema,
      metadataSchema: LegacyMetadataSchema,
      getMetadata: (item) => item.metadata,
      getId: (item) => item.id,
      coerceMetadata: (metadata) => {
        if (typeof metadata !== "object" || metadata === null) return metadata;
        return { ...(metadata as Record<string, unknown>), label: "current" };
      },
    });
    await collection.ensureDir();
    await writeFile(
      join(collectionDir, `${TEST_ID}.json`),
      JSON.stringify({ id: TEST_ID, metadata: { id: TEST_ID, label: "retired" } }),
      "utf-8",
    );

    const result = await collection.list();

    expect(result).toEqual({
      ok: true,
      value: { items: [{ id: TEST_ID, label: "current" }], warnings: [] },
    });
  });

  it("uses getMetadata when no metadata schema is provided", async () => {
    const collection = createCollection<TestItem, TestMetadata>({
      name: "test-item",
      dir: collectionDir,
      filePath: (id) => join(collectionDir, `${id}.json`),
      schema: TestSchema,
      getMetadata: (item) => item.metadata,
      getId: (item) => item.id,
    });

    await collection.write(makeItem());

    const result = await collection.list();
    expect(result).toEqual({
      ok: true,
      value: { items: [makeItem().metadata], warnings: [] },
    });
  });

  it("returns WRITE_ERROR when the collection directory cannot be created", async () => {
    const blockedPath = join(tempRoot, "blocked");
    await writeFile(blockedPath, "not a directory", "utf-8");

    const result = await makeCollection(join(blockedPath, "items")).write(makeItem());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WRITE_ERROR");
  });
});
