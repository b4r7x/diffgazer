import type { Dirent } from "node:fs";
import { readdirSync, realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_CHUNK_DIRECTORIES = ["public/assets", "server"] as const;
const SOURCE_ARCHIVE_CHUNK_PATTERN = /\.source-[^/]+\.m?js$/;

function isMissingDirectory(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function collectSourceArchiveChunks(buildOutputRoot: string, directory: string): string[] {
  const matches: string[] = [];
  const visit = (currentDirectory: string) => {
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(currentDirectory, { encoding: "utf8", withFileTypes: true });
    } catch (error) {
      if (isMissingDirectory(error)) {
        throw new Error(
          `Missing docs build output directory: ${relative(buildOutputRoot, currentDirectory)}. Run pnpm build first.`,
        );
      }
      throw error;
    }

    for (const entry of entries) {
      const entryPath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (SOURCE_ARCHIVE_CHUNK_PATTERN.test(entry.name)) {
        matches.push(relative(buildOutputRoot, entryPath));
      }
    }
  };

  visit(join(buildOutputRoot, directory));
  return matches;
}

export function findSourceArchiveChunks(buildOutputRoot: string): string[] {
  return SOURCE_CHUNK_DIRECTORIES.flatMap((directory) =>
    collectSourceArchiveChunks(buildOutputRoot, directory),
  );
}

export function verifySourceArchiveOutput(buildOutputRoot: string): void {
  const sourceArchiveChunks = findSourceArchiveChunks(buildOutputRoot);
  if (sourceArchiveChunks.length > 0) {
    throw new Error(
      `Source archives were emitted as JavaScript chunks:\n${sourceArchiveChunks.join("\n")}`,
    );
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    verifySourceArchiveOutput(resolve(import.meta.dirname, "../.output"));
    console.log("[source-archive] ok");
  } catch (error) {
    console.error(`[source-archive] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
