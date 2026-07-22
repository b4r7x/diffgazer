import { readdir } from "node:fs/promises";

export async function readFileDirectory(
  dirPath: string,
): Promise<Array<{ name: string; kind: "directory" | "file" | "symlink" }>> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map((entry) => {
      let kind: "directory" | "file" | "symlink" = "file";
      if (entry.isSymbolicLink()) {
        kind = "symlink";
      } else if (entry.isDirectory()) {
        kind = "directory";
      }
      return { name: entry.name, kind };
    });
  } catch {
    return [];
  }
}
