import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, chmod, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { createCollection, createDocument } from "./persistence.js";
import { createStorageTestContext } from "../../__test__/testing.js";

describe("persistence.ts", () => {
  let testDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const context = await createStorageTestContext("persistence");
    testDir = context.testDir;
    cleanup = context.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("Document operations", () => {
    const TestSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    type TestData = z.infer<typeof TestSchema>;

    it("should write and read document successfully", async () => {
      const docPath = join(testDir, "config", "settings.json");
      const doc = createDocument<TestData>({
        name: "settings",
        filePath: docPath,
        schema: TestSchema,
      });

      const testData: TestData = { name: "test", value: 42 };
      const writeResult = await doc.write(testData);
      expect(writeResult.ok).toBe(true);

      const readResult = await doc.read();
      expect(readResult.ok).toBe(true);
      if (readResult.ok) {
        expect(readResult.value).toEqual(testData);
      }
    });

    it("should return NOT_FOUND for missing document", async () => {
      const docPath = join(testDir, "missing.json");
      const doc = createDocument<TestData>({
        name: "missing-doc",
        filePath: docPath,
        schema: TestSchema,
      });

      const result = await doc.read();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain("missing-doc not found");
      }
    });

    it("should handle malformed JSON in document", async () => {
      const docPath = join(testDir, "malformed.json");
      await mkdir(testDir, { recursive: true });
      await writeFile(docPath, "{ invalid json }");

      const doc = createDocument<TestData>({
        name: "malformed-doc",
        filePath: docPath,
        schema: TestSchema,
      });

      const result = await doc.read();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PARSE_ERROR");
      }
    });

    it("should remove document successfully", async () => {
      const docPath = join(testDir, "remove-me.json");
      const doc = createDocument<TestData>({
        name: "removable",
        filePath: docPath,
        schema: TestSchema,
      });

      await doc.write({ name: "test", value: 1 });
      const removeResult = await doc.remove();
      expect(removeResult.ok).toBe(true);

      const readResult = await doc.read();
      expect(readResult.ok).toBe(false);
    });

    it("should handle remove on non-existent document gracefully", async () => {
      const docPath = join(testDir, "never-existed.json");
      const doc = createDocument<TestData>({
        name: "ghost",
        filePath: docPath,
        schema: TestSchema,
      });

      const result = await doc.remove();
      expect(result.ok).toBe(true);
    });
  });

  describe("Collection operations", () => {
    const ItemSchema = z.object({
      id: z.string().uuid(),
      name: z.string(),
      value: z.number(),
    });

    type Item = z.infer<typeof ItemSchema>;
    type Metadata = { id: string; name: string };

    it("should write and read collection item", async () => {
      const collectionDir = join(testDir, "items");
      const collection = createCollection<Item, Metadata>({
        name: "item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => ({ id: item.id, name: item.name }),
        getId: (item) => item.id,
      });

      const item: Item = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Item",
        value: 42,
      };

      const writeResult = await collection.write(item);
      expect(writeResult.ok).toBe(true);

      const readResult = await collection.read(item.id);
      expect(readResult.ok).toBe(true);
      if (readResult.ok) {
        expect(readResult.value).toEqual(item);
      }
    });

    it("should filter non-UUID filenames in list", async () => {
      const collectionDir = join(testDir, "mixed-files");
      const collection = createCollection<Item, Metadata>({
        name: "item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => ({ id: item.id, name: item.name }),
        getId: (item) => item.id,
      });

      const validId = "123e4567-e89b-12d3-a456-426614174000";
      await collection.write({ id: validId, name: "Valid", value: 1 });

      await writeFile(join(collectionDir, "not-a-uuid.json"), "{}");
      await writeFile(join(collectionDir, "README.json"), "{}");

      const result = await collection.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]?.id).toBe(validId);
      }
    });

    it("should return warnings for corrupted files", async () => {
      const collectionDir = join(testDir, "corrupted");
      const collection = createCollection<Item, Metadata>({
        name: "item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => ({ id: item.id, name: item.name }),
        getId: (item) => item.id,
      });

      const validId = "123e4567-e89b-12d3-a456-426614174000";
      await collection.write({ id: validId, name: "Valid", value: 1 });

      const corruptedId1 = "223e4567-e89b-12d3-a456-426614174000";
      await writeFile(
        join(collectionDir, `${corruptedId1}.json`),
        "{ invalid json }",
      );

      const corruptedId2 = "323e4567-e89b-12d3-a456-426614174000";
      await writeFile(
        join(collectionDir, `${corruptedId2}.json`),
        JSON.stringify({ id: corruptedId2, name: "Missing value field" }),
      );

      const result = await collection.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.warnings).toHaveLength(2);
      }
    });

    it("should remove collection item", async () => {
      const collectionDir = join(testDir, "removable");
      const collection = createCollection<Item, Metadata>({
        name: "item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => ({ id: item.id, name: item.name }),
        getId: (item) => item.id,
      });

      const id = "123e4567-e89b-12d3-a456-426614174000";
      await collection.write({ id, name: "Remove Me", value: 1 });

      const removeResult = await collection.remove(id);
      expect(removeResult.ok).toBe(true);
      if (removeResult.ok) {
        expect(removeResult.value.existed).toBe(true);
      }

      const readResult = await collection.read(id);
      expect(readResult.ok).toBe(false);
    });

    it("should return existed=false when removing non-existent item", async () => {
      const collectionDir = join(testDir, "remove-nonexistent");
      const collection = createCollection<Item, Metadata>({
        name: "item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => ({ id: item.id, name: item.name }),
        getId: (item) => item.id,
      });

      const result = await collection.remove(
        "123e4567-e89b-12d3-a456-426614174000",
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.existed).toBe(false);
      }
    });

    it("should return empty list for non-existent directory", async () => {
      const collectionDir = join(testDir, "never-created");
      const collection = createCollection<Item, Metadata>({
        name: "item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => ({ id: item.id, name: item.name }),
        getId: (item) => item.id,
      });

      const result = await collection.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toEqual([]);
        expect(result.value.warnings).toEqual([]);
      }
    });

    it("should return NOT_FOUND with ID for missing item", async () => {
      const collectionDir = join(testDir, "read-missing");
      const ItemSchema = z.object({ id: z.string().uuid(), value: z.string() });

      const collection = createCollection({
        name: "test-item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => ({ id: item.id }),
        getId: (item) => item.id,
      });

      const missingId = "123e4567-e89b-12d3-a456-426614174000";
      const result = await collection.read(missingId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain(missingId);
      }
    });
  });

  describe("Metadata extraction", () => {
    it("should extract metadata from large files", async () => {
      const MetadataSchema = z.object({
        id: z.string().uuid(),
        name: z.string(),
        timestamp: z.string(),
      });

      const FullSchema = z.object({
        metadata: MetadataSchema,
        largeData: z.string(),
        moreData: z.array(z.object({ field: z.string() })),
      });

      type Metadata = z.infer<typeof MetadataSchema>;
      type FullData = z.infer<typeof FullSchema>;

      const collectionDir = join(testDir, "items");
      await mkdir(collectionDir);

      const collection = createCollection<FullData, Metadata>({
        name: "test-item",
        dir: collectionDir,
        filePath: (id: string) => join(collectionDir, `${id}.json`),
        schema: FullSchema,
        getMetadata: (item) => item.metadata,
        getId: (item) => item.metadata.id,
      });

      const testId = "123e4567-e89b-12d3-a456-426614174000";
      await collection.write({
        metadata: { id: testId, name: "Test Item", timestamp: "2025-01-22T10:00:00Z" },
        largeData: "x".repeat(50000),
        moreData: Array(100).fill(null).map((_, i) => ({ field: `value-${i}` })),
      });

      const result = await collection.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]).toEqual({
          id: testId,
          name: "Test Item",
          timestamp: "2025-01-22T10:00:00Z",
        });
      }
    });
  });

  describe("Atomic write operations", () => {
    it("should update file atomically on subsequent writes", async () => {
      const TestSchema = z.object({ value: z.string() });
      const docPath = join(testDir, "atomic-update", "test.json");
      const doc = createDocument({
        name: "atomic-update-test",
        filePath: docPath,
        schema: TestSchema,
      });

      await doc.write({ value: "first" });
      let content = await readFile(docPath, "utf-8");
      expect(content).toContain('"value": "first"');

      await doc.write({ value: "second" });
      content = await readFile(docPath, "utf-8");
      expect(content).toContain('"value": "second"');
      expect(content).not.toContain('"value": "first"');
    });
  });

  describe("Validation errors", () => {
    const StrictSchema = z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      age: z.number().min(0).max(150),
    });

    type StrictData = z.infer<typeof StrictSchema>;

    it("should validate document on read", async () => {
      const docPath = join(testDir, "validation.json");
      await mkdir(testDir, { recursive: true });

      await writeFile(
        docPath,
        JSON.stringify({
          id: "not-a-uuid",
          email: "invalid-email",
          age: 200,
        }),
      );

      const doc = createDocument<StrictData>({
        name: "strict-doc",
        filePath: docPath,
        schema: StrictSchema,
      });

      const result = await doc.read();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details).toEqual(expect.any(String));
        expect(result.error.details).toContain("uuid");
      }
    });

    it("should validate collection item on read", async () => {
      const collectionDir = join(testDir, "strict-collection");
      await mkdir(collectionDir, { recursive: true });

      const itemId = "550e8400-e29b-41d4-a716-446655440000";

      await writeFile(
        join(collectionDir, `${itemId}.json`),
        JSON.stringify({
          id: "not-a-uuid",
          email: "bad-email",
          age: -5,
        }),
      );

      const collection = createCollection<StrictData, { id: string }>({
        name: "strict-item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: StrictSchema,
        getMetadata: (item) => ({ id: item.id }),
        getId: (item) => item.id,
      });

      const result = await collection.read(itemId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details).toEqual(expect.any(String));
        expect(result.error.details).toContain("uuid");
      }
    });
  });

  describe("Permission errors", () => {
    const shouldSkip = process.platform === "win32";

    it.skipIf(shouldSkip)("should handle EACCES on document read", async () => {
      const docPath = join(testDir, "no-read.json");
      await mkdir(testDir, { recursive: true });
      await writeFile(docPath, JSON.stringify({ value: "test" }));
      await chmod(docPath, 0o000);

      const TestSchema = z.object({ value: z.string() });
      const doc = createDocument({
        name: "no-access",
        filePath: docPath,
        schema: TestSchema,
      });

      const result = await doc.read();
      await chmod(docPath, 0o644);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });

    it.skipIf(shouldSkip)("should handle EACCES on collection list", async () => {
      const collectionDir = join(testDir, "no-access-dir");
      await mkdir(collectionDir, { recursive: true });
      await chmod(collectionDir, 0o000);

      const ItemSchema = z.object({ id: z.string() });
      const collection = createCollection({
        name: "item",
        dir: collectionDir,
        filePath: (id) => join(collectionDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => item,
        getId: (item) => item.id,
      });

      const result = await collection.list();
      await chmod(collectionDir, 0o755);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });

    it.skipIf(shouldSkip)("should handle EACCES on document write", async () => {
      const readOnlyDir = join(testDir, "readonly");
      await mkdir(readOnlyDir, { recursive: true });
      await chmod(readOnlyDir, 0o555);

      const docPath = join(readOnlyDir, "test.json");
      const TestSchema = z.object({ value: z.string() });
      const doc = createDocument({
        name: "readonly-doc",
        filePath: docPath,
        schema: TestSchema,
      });

      const result = await doc.write({ value: "test" });
      await chmod(readOnlyDir, 0o755);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });

    it.skipIf(shouldSkip)("should handle EACCES on document remove", async () => {
      const protectedDir = join(testDir, "protected");
      await mkdir(protectedDir, { recursive: true });

      const docPath = join(protectedDir, "protected.json");
      await writeFile(docPath, JSON.stringify({ value: "test" }));
      await chmod(protectedDir, 0o555);

      const TestSchema = z.object({ value: z.string() });
      const doc = createDocument({
        name: "protected-doc",
        filePath: docPath,
        schema: TestSchema,
      });

      const result = await doc.remove();
      await chmod(protectedDir, 0o755);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });

    it.skipIf(shouldSkip)("should handle EACCES on collection remove", async () => {
      const protectedDir = join(testDir, "protected-collection");
      await mkdir(protectedDir, { recursive: true });

      const itemId = "123e4567-e89b-12d3-a456-426614174000";
      await writeFile(
        join(protectedDir, `${itemId}.json`),
        JSON.stringify({ id: itemId, value: "test" }),
      );
      await chmod(protectedDir, 0o555);

      const ItemSchema = z.object({ id: z.string(), value: z.string() });
      const collection = createCollection({
        name: "protected-item",
        dir: protectedDir,
        filePath: (id) => join(protectedDir, `${id}.json`),
        schema: ItemSchema,
        getMetadata: (item) => item,
        getId: (item) => item.id,
      });

      const result = await collection.remove(itemId);
      await chmod(protectedDir, 0o755);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });
  });
});
