import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
	assertArtifactSyncOutputs,
	collectArtifactSyncValidationErrors,
	collectMissingWorkspaceArtifactFiles,
	getArtifactLibraries,
	parseDocsLibrariesConfig,
	readDocsLibrariesConfig,
	resolveArtifactSyncMode,
} from "../../../../scripts/monorepo/artifacts/sync.mjs";
import { createTempDirs, writeFile } from "./fixture";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, "../..");
const configPath = resolve(docsRoot, "config/docs-libraries.json");

const { makeTempDir, cleanupTempDirs } = createTempDirs("docs-sync-test-");

afterEach(() => {
	cleanupTempDirs();
});

describe("sync artifacts helper config parsing", () => {
	it("parses docs libraries config and derives enabled artifact libraries", () => {
		const parsed = readDocsLibrariesConfig(configPath);
		const artifactLibraries = getArtifactLibraries(parsed);

		expect(parsed.primaryLibraryId).toBe("ui");
		expect(artifactLibraries).toEqual([
			{
				id: "ui",
				packageName: "@diffgazer/ui",
				workspaceDir: "libs/ui",
			},
			{
				id: "keys",
				packageName: "@diffgazer/keys",
				workspaceDir: "libs/keys",
			},
		]);
	});

	it("rejects malformed artifact library config", () => {
		const rawConfig = JSON.parse(readFileSync(configPath, "utf-8")) as {
			primaryLibraryId: string;
			libraries: Array<Record<string, unknown>>;
		};

		const broken = {
			...rawConfig,
			libraries: rawConfig.libraries.map((library) =>
				library.id === "ui"
					? {
							...library,
							artifactSource: {
								workspaceDir: "libs/ui",
								packageName: "",
							},
						}
					: library,
			),
		};

		expect(() => parseDocsLibrariesConfig(broken)).toThrow(
			"docs libraries config libraries[0].artifactSource.packageName must be a non-empty string",
		);
	});

	it("rejects unsafe artifact library ids and workspace paths", () => {
		const rawConfig = JSON.parse(readFileSync(configPath, "utf-8")) as {
			primaryLibraryId: string;
			libraries: Array<Record<string, unknown>>;
		};

		expect(() =>
			parseDocsLibrariesConfig({
				...rawConfig,
				primaryLibraryId: "../ui",
			}),
		).toThrow(
			"docs libraries config primaryLibraryId must be a safe library id",
		);

		expect(() =>
			parseDocsLibrariesConfig({
				...rawConfig,
				libraries: rawConfig.libraries.map((library) =>
					library.id === "ui"
						? {
								...library,
								artifactSource: {
									workspaceDir: "../libs/ui",
									packageName: "@diffgazer/ui",
								},
							}
						: library,
				),
			}),
		).toThrow(
			"docs libraries config libraries[0].artifactSource.workspaceDir must be a relative path without '..' segments",
		);

		expect(() =>
			parseDocsLibrariesConfig({
				...rawConfig,
				libraries: rawConfig.libraries.map((library) =>
					library.id === "ui"
						? {
								...library,
								artifactSource: {
									workspaceDir: "libs/ui",
									packageName: "../outside",
								},
							}
						: library,
				),
			}),
		).toThrow(
			"docs libraries config libraries[0].artifactSource.packageName must be an npm package name",
		);
	});

	it("switches sync mode based on DIFFGAZER_DEV", () => {
		expect(resolveArtifactSyncMode({})).toBe("package");
		expect(resolveArtifactSyncMode({ DIFFGAZER_DEV: "1" })).toBe("workspace");
	});

	it("auto-falls back to workspace when local artifact packages are not resolvable", () => {
		const mode = resolveArtifactSyncMode(
			{},
			{
				libraries: [
					{
						id: "ui",
						packageName: "@diffgazer/ui",
						workspaceDir: "libs/ui",
					},
					{
						id: "keys",
						packageName: "@diffgazer/keys-artifacts",
						workspaceDir: "libs/keys",
					},
				],
				resolvePackage: (packageName: string) =>
					packageName !== "@diffgazer/ui",
			},
		);

		expect(mode).toBe("workspace");
	});

	it("keeps package mode in CI even when artifact packages are not resolvable", () => {
		const mode = resolveArtifactSyncMode(
			{ CI: "true" },
			{
				libraries: [
					{
						id: "ui",
						packageName: "@diffgazer/ui",
						workspaceDir: "libs/ui",
					},
				],
				resolvePackage: () => false,
			},
		);

		expect(mode).toBe("package");
	});

	it("keeps package mode when local artifact packages are resolvable", () => {
		const mode = resolveArtifactSyncMode(
			{},
			{
				libraries: [
					{
						id: "ui",
						packageName: "@diffgazer/ui",
						workspaceDir: "libs/ui",
					},
				],
				resolvePackage: () => true,
			},
		);

		expect(mode).toBe("package");
	});

	it("reports missing prepared workspace artifact files", () => {
		const tempRoot = makeTempDir();
		const libraries = [
			{
				id: "ui",
				packageName: "@diffgazer/ui",
				workspaceDir: "libs/ui",
			},
			{
				id: "keys",
				packageName: "@diffgazer/keys",
				workspaceDir: "libs/keys",
			},
		];

		writeFile(
			tempRoot,
			"libs/ui/dist/artifacts/artifact-manifest.json",
			JSON.stringify({
				docs: {
					contentDir: "docs",
					generatedDir: "generated",
				},
				registry: {
					publicDir: "registry",
					index: "registry/registry.json",
				},
				generated: {
					componentList: "generated/component-list.json",
				},
			}),
		);
		writeFile(tempRoot, "libs/ui/dist/artifacts/fingerprint.sha256", "abc\n");
		writeFile(tempRoot, "libs/ui/dist/artifacts/docs/meta.json");
		writeFile(tempRoot, "libs/ui/dist/artifacts/registry/registry.json");
		writeFile(tempRoot, "libs/keys/dist/artifacts/artifact-manifest.json");

		expect(collectMissingWorkspaceArtifactFiles(tempRoot, libraries)).toEqual([
			{
				id: "ui",
				path: resolve(tempRoot, "libs/ui/dist/artifacts/generated"),
				relativePath: "libs/ui/dist/artifacts/generated",
			},
			{
				id: "ui",
				path: resolve(
					tempRoot,
					"libs/ui/dist/artifacts/generated/component-list.json",
				),
				relativePath: "libs/ui/dist/artifacts/generated/component-list.json",
			},
			{
				id: "keys",
				path: resolve(tempRoot, "libs/keys/dist/artifacts/fingerprint.sha256"),
				relativePath: "libs/keys/dist/artifacts/fingerprint.sha256",
			},
		]);
	});

	it("rejects escaped prepared workspace artifact paths", () => {
		const tempRoot = makeTempDir();
		const libraries = [
			{
				id: "ui",
				packageName: "@diffgazer/ui",
				workspaceDir: "libs/ui",
			},
		];

		writeFile(
			tempRoot,
			"libs/ui/dist/artifacts/artifact-manifest.json",
			JSON.stringify({
				docs: {
					contentDir: "../outside",
				},
				registry: {
					publicDir: "registry",
				},
			}),
		);
		writeFile(tempRoot, "libs/ui/dist/artifacts/fingerprint.sha256", "abc\n");

		expect(() =>
			collectMissingWorkspaceArtifactFiles(tempRoot, libraries),
		).toThrow(/ui artifact path escapes/);
	});
});

describe("sync artifacts helper output validation", () => {
	it("accepts the current checked-in generated namespace outputs", () => {
		const parsed = readDocsLibrariesConfig(configPath);
		const artifactLibraries = getArtifactLibraries(parsed);

		expect(() =>
			assertArtifactSyncOutputs({
				docsRoot,
				primaryLibraryId: parsed.primaryLibraryId,
				libraries: artifactLibraries,
			}),
		).not.toThrow();
	});

	it("reports missing namespace outputs and primary mismatch", () => {
		const tempRoot = makeTempDir();

		writeFile(tempRoot, "content/docs/meta.json");
		writeFile(tempRoot, "registry/registry.json");
		writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
		writeFile(tempRoot, "content/docs/ui/meta.json");
		writeFile(tempRoot, "public/r/ui/registry.json");
		mkdirSync(resolve(tempRoot, "src/generated/ui"), { recursive: true });

		const errors = collectArtifactSyncValidationErrors({
			docsRoot: tempRoot,
			primaryLibraryId: "keys",
			libraries: [
				{
					id: "ui",
					packageName: "@diffgazer/ui",
					workspaceDir: "libs/ui",
				},
			],
		});

		expect(errors).toContain(
			'Primary library "keys" is not present in enabled artifact libraries: ui',
		);
		expect(errors).toContain("Generated namespace is empty: src/generated/ui");
	});

	it("rejects unsafe namespace output ids before resolving output paths", () => {
		const tempRoot = makeTempDir();

		const errors = collectArtifactSyncValidationErrors({
			docsRoot: tempRoot,
			primaryLibraryId: "ui",
			libraries: [
				{
					id: "../ui",
					packageName: "@diffgazer/ui",
					workspaceDir: "libs/ui",
				},
			],
		});

		expect(errors).toEqual(['Library id "../ui" must be a safe library id']);
	});

	it("reports generated sync output drift against loaded artifacts", () => {
		const tempRoot = makeTempDir();
		const artifactRoot = resolve(tempRoot, "artifact");

		writeFile(tempRoot, "content/docs/meta.json");
		writeFile(tempRoot, "registry/registry.json");
		writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
		writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
		writeFile(tempRoot, "content/docs/ui/meta.json");
		writeFile(tempRoot, "content/docs/ui/index.mdx", "# Intro\n");
		writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
		writeFile(tempRoot, "src/generated/ui/component-list.json", '["stale"]\n');

		writeFile(artifactRoot, "docs/meta.json");
		writeFile(artifactRoot, "docs/index.mdx", "# Intro\n");
		writeFile(artifactRoot, "registry/registry.json", '{"items":[]}\n');
		writeFile(artifactRoot, "generated/component-list.json", "[]\n");

		const errors = collectArtifactSyncValidationErrors({
			docsRoot: tempRoot,
			primaryLibraryId: "ui",
			libraries: [
				{
					id: "ui",
					packageName: "@diffgazer/ui",
					workspaceDir: "libs/ui",
				},
			],
			artifacts: [
				{
					id: "ui",
					artifactRoot,
					manifest: {
						docs: {
							contentDir: "docs",
							generatedDir: "generated",
						},
						registry: {
							publicDir: "registry",
						},
					},
					generatedFiles: ["generated/component-list.json"],
				},
			],
		});

		expect(errors).toContain(
			"ui generated sync: artifact differs from source for component-list.json",
		);
	});

	it("accepts secondary demo index imports rewritten to docs example namespace", () => {
		const tempRoot = makeTempDir();
		const artifactRoot = resolve(tempRoot, "artifact");

		writeFile(tempRoot, "content/docs/meta.json");
		writeFile(tempRoot, "registry/registry.json");
		writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
		writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
		writeFile(tempRoot, "content/docs/ui/meta.json");
		writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
		writeFile(tempRoot, "src/generated/ui/component-list.json", "[]\n");
		writeFile(tempRoot, "content/docs/keys/meta.json");
		writeFile(tempRoot, "public/r/keys/registry.json", '{"items":[]}\n');
		writeFile(
			tempRoot,
			"src/generated/keys/demo-index.ts",
			'export const demos = { "use-key-basic": () => import("../../../registry/examples/keys/use-key/use-key-basic") }\n',
		);
		writeFile(
			tempRoot,
			"registry/examples/keys/use-key/use-key-basic.tsx",
			"export default function Demo() { return null }\n",
		);

		writeFile(artifactRoot, "docs/meta.json");
		writeFile(artifactRoot, "registry/registry.json", '{"items":[]}\n');
		writeFile(
			artifactRoot,
			"generated/demo-index.ts",
			'export const demos = { "use-key-basic": () => import("../../registry/examples/use-key/use-key-basic") }\n',
		);
		writeFile(
			artifactRoot,
			"source/registry/examples/use-key/use-key-basic.tsx",
			"export default function Demo() { return null }\n",
		);

		const errors = collectArtifactSyncValidationErrors({
			docsRoot: tempRoot,
			primaryLibraryId: "ui",
			libraries: [
				{
					id: "ui",
					packageName: "@diffgazer/ui",
					workspaceDir: "libs/ui",
				},
				{
					id: "keys",
					packageName: "@diffgazer/keys",
					workspaceDir: "libs/keys",
				},
			],
			artifacts: [
				{
					id: "keys",
					artifactRoot,
					manifest: {
						docs: {
							contentDir: "docs",
						},
						registry: {
							publicDir: "registry",
						},
						source: {
							registryDir: "source/registry",
						},
					},
					generatedFiles: ["generated/demo-index.ts"],
				},
			],
		});

		expect(errors).toEqual([]);
	});

	it("reports missing secondary copied examples", () => {
		const tempRoot = makeTempDir();
		const artifactRoot = resolve(tempRoot, "artifact");

		writeFile(tempRoot, "content/docs/meta.json");
		writeFile(tempRoot, "registry/registry.json");
		writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
		writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
		writeFile(tempRoot, "content/docs/ui/meta.json");
		writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
		writeFile(tempRoot, "src/generated/ui/component-list.json", "[]\n");
		writeFile(tempRoot, "content/docs/keys/meta.json");
		writeFile(tempRoot, "public/r/keys/registry.json", '{"items":[]}\n');
		writeFile(tempRoot, "src/generated/keys/demo-index.ts", "export {}\n");

		writeFile(artifactRoot, "docs/meta.json");
		writeFile(artifactRoot, "registry/registry.json", '{"items":[]}\n');
		writeFile(artifactRoot, "generated/demo-index.ts", "export {}\n");
		writeFile(
			artifactRoot,
			"source/registry/examples/use-key/use-key-basic.tsx",
			"export default function Demo() { return null }\n",
		);

		const errors = collectArtifactSyncValidationErrors({
			docsRoot: tempRoot,
			primaryLibraryId: "ui",
			libraries: [
				{
					id: "ui",
					packageName: "@diffgazer/ui",
					workspaceDir: "libs/ui",
				},
				{
					id: "keys",
					packageName: "@diffgazer/keys",
					workspaceDir: "libs/keys",
				},
			],
			artifacts: [
				{
					id: "keys",
					artifactRoot,
					manifest: {
						docs: {
							contentDir: "docs",
						},
						registry: {
							publicDir: "registry",
						},
						source: {
							registryDir: "source/registry",
						},
					},
					generatedFiles: ["generated/demo-index.ts"],
				},
			],
		});

		expect(errors).toContain(
			"keys examples sync: missing artifact directory " +
				resolve(tempRoot, "registry/examples/keys"),
		);
	});

	it("rejects loaded artifact paths that escape the artifact root", () => {
		const tempRoot = makeTempDir();
		const artifactRoot = resolve(tempRoot, "artifact");

		writeFile(tempRoot, "content/docs/meta.json");
		writeFile(tempRoot, "registry/registry.json");
		writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
		writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
		writeFile(tempRoot, "content/docs/ui/meta.json");
		writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
		writeFile(tempRoot, "src/generated/ui/component-list.json", "[]\n");

		const errors = collectArtifactSyncValidationErrors({
			docsRoot: tempRoot,
			primaryLibraryId: "ui",
			libraries: [
				{
					id: "ui",
					packageName: "@diffgazer/ui",
					workspaceDir: "libs/ui",
				},
			],
			artifacts: [
				{
					id: "ui",
					artifactRoot,
					manifest: {
						docs: {
							contentDir: "../outside",
							generatedDir: "generated",
						},
						registry: {
							publicDir: "registry",
						},
					},
					generatedFiles: ["generated/component-list.json"],
				},
			],
		});

		expect(errors).toContain(
			`ui docs content artifact path escapes ${artifactRoot}: ../outside`,
		);
	});
});
