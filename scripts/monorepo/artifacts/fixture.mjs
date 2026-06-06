import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

export function createTempDirs(prefix) {
	const tempDirs = [];

	return {
		makeTempDir() {
			const dir = mkdtempSync(resolve(tmpdir(), prefix));
			tempDirs.push(dir);
			return dir;
		},
		cleanupTempDirs() {
			for (const dir of tempDirs.splice(0)) {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	};
}

export function writeFile(root, relPath, content = "{}\n") {
	const absPath = resolve(root, relPath);
	mkdirSync(dirname(absPath), { recursive: true });
	writeFileSync(absPath, content);
}
