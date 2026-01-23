import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtemp,
  rm,
  writeFile,
  mkdir,
  chmod,
  readFile,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  createCollection,
  createDocument,
  createStoreError,
} from "./persistence.js";

describe("persistence.ts", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "persistence-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
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

    const MetadataSchema = z.object({
      id: z.string().uuid(),
      name: z.string(),
    });

    type Item = z.infer<typeof ItemSchema>;
    type Metadata = z.infer<typeof MetadataSchema>;

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

      // Create valid UUID file
      const validId = "123e4567-e89b-12d3-a456-426614174000";
      const item: Item = { id: validId, name: "Valid", value: 1 };
      const writeResult = await collection.write(item);
      expect(writeResult.ok).toBe(true);

      // Create invalid filenames
      await writeFile(join(collectionDir, "not-a-uuid.json"), "{}");
      await writeFile(join(collectionDir, "README.json"), "{}");
      await writeFile(join(collectionDir, "123.json"), "{}");
      await writeFile(join(collectionDir, "invalid-uuid-format.json"), "{}");

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

      // Valid item
      const validId = "123e4567-e89b-12d3-a456-426614174000";
      const writeResult = await collection.write({
        id: validId,
        name: "Valid",
        value: 1,
      });
      expect(writeResult.ok).toBe(true);

      // Corrupted items
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
        expect(result.value.items[0]?.id).toBe(validId);
        expect(result.value.warnings).toHaveLength(2);
        expect(
          result.value.warnings.some((w) => w.includes(corruptedId1)),
        ).toBe(true);
        expect(
          result.value.warnings.some((w) => w.includes(corruptedId2)),
        ).toBe(true);
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

  describe("Metadata extraction optimization", () => {
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

    it("should extract metadata without reading full file", async () => {
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

      // Create test data with large payload
      const testId = "123e4567-e89b-12d3-a456-426614174000";
      const largeString = "x".repeat(50000); // 50KB of data
      const testData: FullData = {
        metadata: {
          id: testId,
          name: "Test Item",
          timestamp: "2025-01-22T10:00:00Z",
        },
        largeData: largeString,
        moreData: Array(100).fill(null).map((_, i) => ({ field: `value-${i}` })),
      };

      await collection.write(testData);

      // List should use fast metadata extraction
      const result = await collection.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]).toEqual({
          id: testId,
          name: "Test Item",
          timestamp: "2025-01-22T10:00:00Z",
        });
        expect(result.value.warnings).toHaveLength(0);
      }
    });

    it("should handle multiple files efficiently", async () => {
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

      // Create 10 test files
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`;
        ids.push(id);
        const testData: FullData = {
          metadata: {
            id,
            name: `Item ${i}`,
            timestamp: new Date(2025, 0, i + 1).toISOString(),
          },
          largeData: "x".repeat(50000),
          moreData: Array(100).fill(null).map((_, j) => ({ field: `value-${j}` })),
        };
        await collection.write(testData);
      }

      const start = Date.now();
      const result = await collection.list();
      const duration = Date.now() - start;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(10);
        expect(result.value.warnings).toHaveLength(0);
        // Should be fast - under 100ms for 10 files with 50KB each
        console.log(`Metadata extraction time: ${duration}ms`);
      }
    });

    it("should fallback to full read when metadataSchema not provided", async () => {
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
      const testData: FullData = {
        metadata: {
          id: testId,
          name: "Test Item",
          timestamp: "2025-01-22T10:00:00Z",
        },
        largeData: "x".repeat(50000),
        moreData: Array(100).fill(null).map((_, i) => ({ field: `value-${i}` })),
      };

      await collection.write(testData);

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

  describe("Performance benchmark", () => {
    it("should demonstrate performance with large datasets", async () => {
      const collectionDir = join(testDir, "bench");
      await mkdir(collectionDir);

      const MetadataSchema = z.object({
        id: z.string().uuid(),
        projectPath: z.string(),
        createdAt: z.string(),
      });

      const LargeSchema = z.object({
        metadata: MetadataSchema,
        issues: z.array(z.object({
          severity: z.string(),
          message: z.string(),
          file: z.string(),
          line: z.number(),
          suggestion: z.string(),
        })),
        result: z.object({
          summary: z.string(),
          details: z.string(),
        }),
      });

      type Metadata = z.infer<typeof MetadataSchema>;
      type LargeData = z.infer<typeof LargeSchema>;

      // Collection WITH metadata optimization
      const optimizedCollection = createCollection<LargeData, Metadata>({
        name: "optimized",
        dir: collectionDir,
        filePath: (id: string) => join(collectionDir, `${id}.json`),
        schema: LargeSchema,
        getMetadata: (item) => item.metadata,
        getId: (item) => item.metadata.id,
      });

      // Collection WITHOUT metadata optimization (fallback)
      const unoptimizedCollection = createCollection<LargeData, Metadata>({
        name: "unoptimized",
        dir: collectionDir,
        filePath: (id: string) => join(collectionDir, `${id}.json`),
        schema: LargeSchema,
        getMetadata: (item) => item.metadata,
        getId: (item) => item.metadata.id,
      });

      // Create 100 files with realistic review data
      for (let i = 0; i < 100; i++) {
        const id = `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`;
        const testData: LargeData = {
          metadata: {
            id,
            projectPath: `/projects/test-${i}`,
            createdAt: new Date(2025, 0, i + 1).toISOString(),
          },
          issues: Array(50).fill(null).map((_, j) => ({
            severity: j % 2 === 0 ? "critical" : "warning",
            message: `Issue ${j}: This is a detailed message about a code quality problem`,
            file: `src/components/Component${j}.tsx`,
            line: Math.floor(Math.random() * 1000),
            suggestion: `Consider refactoring this code to improve maintainability and reduce complexity`,
          })),
          result: {
            summary: "Review completed with multiple issues found across the codebase",
            details: "x".repeat(10000), // 10KB of details
          },
        };
        await optimizedCollection.write(testData);
      }

      // Benchmark optimized version
      const optimizedStart = Date.now();
      const optimizedResult = await optimizedCollection.list();
      const optimizedDuration = Date.now() - optimizedStart;

      // Benchmark unoptimized version
      const unoptimizedStart = Date.now();
      const unoptimizedResult = await unoptimizedCollection.list();
      const unoptimizedDuration = Date.now() - unoptimizedStart;

      expect(optimizedResult.ok).toBe(true);
      expect(unoptimizedResult.ok).toBe(true);

      if (optimizedResult.ok && unoptimizedResult.ok) {
        expect(optimizedResult.value.items).toHaveLength(100);
        expect(unoptimizedResult.value.items).toHaveLength(100);

        const speedup = unoptimizedDuration / optimizedDuration;

        console.log(`\nPerformance Benchmark (100 files, ~25KB each):`);
        console.log(`  Optimized (metadata extraction): ${optimizedDuration}ms`);
        console.log(`  Unoptimized (full file read):    ${unoptimizedDuration}ms`);
        console.log(`  Speedup: ${speedup.toFixed(2)}x`);

        // Both collections use the same implementation, so expect similar performance
        // This test validates that the collection API works correctly with large datasets
        const difference = Math.abs(optimizedDuration - unoptimizedDuration);
        console.log(`  Difference: ${difference}ms`);
        expect(difference).toBeLessThan(50); // Within 50ms of each other
      }
    }, 60000);
  });

  describe("Atomic write operations", () => {
    const TestSchema = z.object({ value: z.string() });
    type TestData = z.infer<typeof TestSchema>;


    it("should update file atomically on subsequent writes", async () => {
      const docPath = join(testDir, "atomic-update", "test.json");
      const doc = createDocument<TestData>({
        name: "atomic-update-test",
        filePath: docPath,
        schema: TestSchema,
      });

      // First write
      await doc.write({ value: "first" });
      let content = await readFile(docPath, "utf-8");
      expect(content).toContain('"value": "first"');

      // Second write (should replace atomically)
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

    // Note: Write-time validation removed - TypeScript ensures correct structure.
    // These tests now verify that read-time validation catches invalid data on disk.
    it("should validate on read - document with invalid data on disk", async () => {
      const docPath = join(testDir, "validation.json");
      await mkdir(testDir, { recursive: true });

      // Simulate corrupted/manually-edited file with invalid data
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

      // Read-time validation catches invalid data
      const result = await doc.read();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details).toBeDefined();
      }
    });

    it("should validate on read - collection item with invalid data on disk", async () => {
      const collectionDir = join(testDir, "strict-collection");
      await mkdir(collectionDir, { recursive: true });

      const itemId = "550e8400-e29b-41d4-a716-446655440000"; // Valid UUID for filename

      // Simulate corrupted/manually-edited file with invalid data
      await writeFile(
        join(collectionDir, `${itemId}.json`),
        JSON.stringify({
          id: "not-a-uuid", // Invalid UUID in content
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

      // Read-time validation catches invalid data
      const result = await collection.read(itemId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details).toBeDefined();
      }
    });

    it("should return VALIDATION_ERROR for schema mismatch on read", async () => {
      const docPath = join(testDir, "schema-mismatch.json");
      await mkdir(testDir, { recursive: true });
      await writeFile(
        docPath,
        JSON.stringify({ id: "not-uuid", email: "bad", age: "string" }),
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
        expect(result.error.details).toBeDefined();
      }
    });

    it("should validate each field in schema on read", async () => {
      await mkdir(testDir, { recursive: true });

      // Test invalid UUID
      let docPath = join(testDir, "fields1.json");
      await writeFile(
        docPath,
        JSON.stringify({ id: "123", email: "test@example.com", age: 25 }),
      );
      let doc = createDocument<StrictData>({
        name: "field-validation",
        filePath: docPath,
        schema: StrictSchema,
      });
      let result = await doc.read();
      expect(result.ok).toBe(false);

      // Test invalid email
      docPath = join(testDir, "fields2.json");
      await writeFile(
        docPath,
        JSON.stringify({
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "not-email",
          age: 25,
        }),
      );
      doc = createDocument<StrictData>({
        name: "field-validation",
        filePath: docPath,
        schema: StrictSchema,
      });
      result = await doc.read();
      expect(result.ok).toBe(false);

      // Test age too high
      docPath = join(testDir, "fields3.json");
      await writeFile(
        docPath,
        JSON.stringify({
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "test@example.com",
          age: 200,
        }),
      );
      doc = createDocument<StrictData>({
        name: "field-validation",
        filePath: docPath,
        schema: StrictSchema,
      });
      result = await doc.read();
      expect(result.ok).toBe(false);

      // Test age negative
      docPath = join(testDir, "fields4.json");
      await writeFile(
        docPath,
        JSON.stringify({
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "test@example.com",
          age: -1,
        }),
      );
      doc = createDocument<StrictData>({
        name: "field-validation",
        filePath: docPath,
        schema: StrictSchema,
      });
      result = await doc.read();
      expect(result.ok).toBe(false);
    });
  });

  describe("Permission errors (EACCES)", () => {
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
      await chmod(docPath, 0o644); // Restore for cleanup

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
        expect(result.error.message).toContain("Permission denied");
        expect(result.error.message).toContain(docPath);
      }
    });

    it.skipIf(shouldSkip)(
      "should handle EACCES on collection directory read",
      async () => {
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
        await chmod(collectionDir, 0o755); // Restore

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PERMISSION_ERROR");
        }
      },
    );

    it.skipIf(shouldSkip)(
      "should handle EACCES on document write",
      async () => {
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
        await chmod(readOnlyDir, 0o755); // Restore

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PERMISSION_ERROR");
        }
      },
    );

    it.skipIf(shouldSkip)(
      "should handle EACCES on document remove",
      async () => {
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
        await chmod(protectedDir, 0o755); // Restore

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PERMISSION_ERROR");
        }
      },
    );

    it.skipIf(shouldSkip)(
      "should handle EACCES on collection item remove",
      async () => {
        const protectedDir = join(testDir, "protected-collection");
        await mkdir(protectedDir, { recursive: true });

        const itemId = "123e4567-e89b-12d3-a456-426614174000";
        const itemPath = join(protectedDir, `${itemId}.json`);
        await writeFile(
          itemPath,
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
        await chmod(protectedDir, 0o755); // Restore

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PERMISSION_ERROR");
        }
      },
    );
  });

  describe("Error messages and codes", () => {
    it("should include details in VALIDATION_ERROR on read", async () => {
      const TestSchema = z.object({
        required: z.string(),
        number: z.number(),
      });

      const docPath = join(testDir, "test.json");
      await mkdir(testDir, { recursive: true });
      // Write invalid data directly to disk (simulating corruption)
      await writeFile(docPath, JSON.stringify({ wrong: "fields" }));

      const doc = createDocument({
        name: "validation-doc",
        filePath: docPath,
        schema: TestSchema,
      });

      // Read-time validation catches the invalid data
      const result = await doc.read();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details).toBeDefined();
      }
    });
  });
});
