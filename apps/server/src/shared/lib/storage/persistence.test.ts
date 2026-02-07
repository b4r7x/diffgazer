import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const { mockMkdir, mockReadFile, mockReaddir, mockUnlink } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockUnlink: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mockMkdir,
  readFile: mockReadFile,
  readdir: mockReaddir,
  unlink: mockUnlink,
}));

vi.mock("../fs.js");

import { atomicWriteFile } from "../fs.js";
import { createCollection } from "./persistence.js";

const TestSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  metadata: z.object({
    id: z.string().uuid(),
    label: z.string(),
  }),
});

const MetadataSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
});

type TestItem = z.infer<typeof TestSchema>;
type TestMetadata = z.infer<typeof MetadataSchema>;

const TEST_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ID_2 = "660e8400-e29b-41d4-a716-446655440001";
const TEST_DIR = "/data/items";

function makeItem(id: string = TEST_ID, name: string = "Test"): TestItem {
  return { id, name, metadata: { id, label: name } };
}

function makeCollection() {
  return createCollection<TestItem, TestMetadata>({
    name: "test-item",
    dir: TEST_DIR,
    filePath: (id) => `${TEST_DIR}/${id}.json`,
    schema: TestSchema,
    metadataSchema: MetadataSchema,
    getMetadata: (item) => item.metadata,
    getId: (item) => item.id,
  });
}

describe("createCollection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("read", () => {
    it("should read and parse a valid item", async () => {
      const item = makeItem();
      mockReadFile.mockResolvedValue(JSON.stringify(item));
      const collection = makeCollection();

      const result = await collection.read(TEST_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(TEST_ID);
        expect(result.value.name).toBe("Test");
      }
    });

    it("should return NOT_FOUND for missing file", async () => {
      const error = new Error("ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockReadFile.mockRejectedValue(error);
      const collection = makeCollection();

      const result = await collection.read(TEST_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return PERMISSION_ERROR for EACCES", async () => {
      const error = new Error("EACCES") as NodeJS.ErrnoException;
      error.code = "EACCES";
      mockReadFile.mockRejectedValue(error);
      const collection = makeCollection();

      const result = await collection.read(TEST_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });

    it("should return PARSE_ERROR for corrupt JSON", async () => {
      mockReadFile.mockResolvedValue("{invalid json");
      const collection = makeCollection();

      const result = await collection.read(TEST_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PARSE_ERROR");
      }
    });

    it("should return VALIDATION_ERROR for schema mismatch", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ wrong: "shape" }));
      const collection = makeCollection();

      const result = await collection.read(TEST_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("write", () => {
    it("should ensure directory and write item", async () => {
      mockMkdir.mockResolvedValue(undefined);
      vi.mocked(atomicWriteFile).mockResolvedValue(undefined);
      const collection = makeCollection();
      const item = makeItem();

      const result = await collection.write(item);

      expect(result.ok).toBe(true);
      expect(mockMkdir).toHaveBeenCalledWith(TEST_DIR, { recursive: true });
      expect(vi.mocked(atomicWriteFile)).toHaveBeenCalledWith(
        `${TEST_DIR}/${TEST_ID}.json`,
        expect.stringContaining('"name": "Test"')
      );
    });

    it("should return PERMISSION_ERROR when mkdir fails with EACCES", async () => {
      const error = new Error("EACCES") as NodeJS.ErrnoException;
      error.code = "EACCES";
      mockMkdir.mockRejectedValue(error);
      const collection = makeCollection();

      const result = await collection.write(makeItem());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });

    it("should return WRITE_ERROR when atomic write fails", async () => {
      mockMkdir.mockResolvedValue(undefined);
      vi.mocked(atomicWriteFile).mockRejectedValue(new Error("disk full"));
      const collection = makeCollection();

      const result = await collection.write(makeItem());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("WRITE_ERROR");
      }
    });
  });

  describe("list", () => {
    it("should return empty items when directory does not exist", async () => {
      const error = new Error("ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockReaddir.mockRejectedValue(error);
      const collection = makeCollection();

      const result = await collection.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toEqual([]);
        expect(result.value.warnings).toEqual([]);
      }
    });

    it("should return PERMISSION_ERROR when readdir fails with EACCES", async () => {
      const error = new Error("EACCES") as NodeJS.ErrnoException;
      error.code = "EACCES";
      mockReaddir.mockRejectedValue(error);
      const collection = makeCollection();

      const result = await collection.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });

    it("should filter out non-JSON and non-UUID files", async () => {
      mockReaddir.mockResolvedValue([
        `${TEST_ID}.json`,
        "not-a-uuid.json",
        "readme.txt",
        `${TEST_ID_2}.json`,
      ]);
      const item1 = makeItem(TEST_ID, "Item1");
      const item2 = makeItem(TEST_ID_2, "Item2");
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes(TEST_ID)) return JSON.stringify(item1);
        if (path.includes(TEST_ID_2)) return JSON.stringify(item2);
        throw new Error("unexpected");
      });
      const collection = makeCollection();

      const result = await collection.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(2);
      }
    });

    it("should collect warnings for corrupt items without failing", async () => {
      mockReaddir.mockResolvedValue([`${TEST_ID}.json`]);
      mockReadFile.mockResolvedValue("{corrupt}");
      const collection = makeCollection();

      const result = await collection.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(0);
        expect(result.value.warnings).toHaveLength(1);
        expect(result.value.warnings[0]).toContain(TEST_ID);
      }
    });

    it("should extract metadata using metadataSchema when provided", async () => {
      mockReaddir.mockResolvedValue([`${TEST_ID}.json`]);
      const item = makeItem();
      mockReadFile.mockResolvedValue(JSON.stringify(item));
      const collection = makeCollection();

      const result = await collection.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]?.id).toBe(TEST_ID);
        expect(result.value.items[0]?.label).toBe("Test");
      }
    });

    it("should use getMetadata when no metadataSchema is provided", async () => {
      const collection = createCollection<TestItem, TestMetadata>({
        name: "test-item",
        dir: TEST_DIR,
        filePath: (id) => `${TEST_DIR}/${id}.json`,
        schema: TestSchema,
        getMetadata: (item) => item.metadata,
        getId: (item) => item.id,
      });
      mockReaddir.mockResolvedValue([`${TEST_ID}.json`]);
      const item = makeItem();
      mockReadFile.mockResolvedValue(JSON.stringify(item));

      const result = await collection.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]?.id).toBe(TEST_ID);
      }
    });
  });

  describe("remove", () => {
    it("should return existed=true when file was deleted", async () => {
      mockUnlink.mockResolvedValue(undefined);
      const collection = makeCollection();

      const result = await collection.remove(TEST_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.existed).toBe(true);
      }
    });

    it("should return existed=false when file does not exist", async () => {
      const error = new Error("ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockUnlink.mockRejectedValue(error);
      const collection = makeCollection();

      const result = await collection.remove(TEST_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.existed).toBe(false);
      }
    });

    it("should return PERMISSION_ERROR for EACCES on delete", async () => {
      const error = new Error("EACCES") as NodeJS.ErrnoException;
      error.code = "EACCES";
      mockUnlink.mockRejectedValue(error);
      const collection = makeCollection();

      const result = await collection.remove(TEST_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });

    it("should return WRITE_ERROR for unexpected errors on delete", async () => {
      mockUnlink.mockRejectedValue(new Error("unknown error"));
      const collection = makeCollection();

      const result = await collection.remove(TEST_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("WRITE_ERROR");
      }
    });
  });

  describe("ensureDir", () => {
    it("should create directory recursively", async () => {
      mockMkdir.mockResolvedValue(undefined);
      const collection = makeCollection();

      const result = await collection.ensureDir();

      expect(result.ok).toBe(true);
      expect(mockMkdir).toHaveBeenCalledWith(TEST_DIR, { recursive: true });
    });

    it("should return WRITE_ERROR for mkdir failures", async () => {
      mockMkdir.mockRejectedValue(new Error("disk error"));
      const collection = makeCollection();

      const result = await collection.ensureDir();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("WRITE_ERROR");
      }
    });
  });
});
