import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import type { PluginOption } from "vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { getPreRenderPages as enumeratePreRenderPages } from "./scripts/generate-sitemap.ts";
import * as MdxConfig from "./source.config";
import { docsDataRebuild } from "./vite-plugin-docs-rebuild";

function getPreRenderPages(): Array<{ path: string }> {
	return enumeratePreRenderPages().map(({ path }) => ({ path }));
}

function uiRegistryPath(subpath: string): string {
	return resolve(import.meta.dirname, "../../libs/ui/registry", subpath);
}

const config = defineConfig(() => {
	const isVitest = Boolean(process.env.VITEST);
	const prerenderEnabled = !isVitest && process.env.DOCS_PRERENDER !== "0";

	const plugins: PluginOption[] = [
		mdx(MdxConfig),
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		docsDataRebuild(),
		!isVitest
			? tanstackStart({
					prerender: {
						enabled: prerenderEnabled,
						crawlLinks: false,
					},
					pages: getPreRenderPages(),
				})
			: null,
		!isVitest ? nitro() : null,
		viteReact(),
	];

	return {
		test: isVitest
			? {
					environment: "jsdom",
					setupFiles: ["./src/test-setup.ts"],
				}
			: undefined,
		server: {
			port: 3000,
		},
		build: {
			chunkSizeWarningLimit: 1_500,
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (
							id.includes("/node_modules/react/") ||
							id.includes("/node_modules/react-dom/")
						)
							return "vendor-react";
						if (id.includes("/node_modules/@tanstack/react-router/"))
							return "vendor-router";
					},
				},
			},
		},
		ssr: {
			noExternal: ["@diffgazer/keys"],
		},
		resolve: {
			// The generated demo examples under registry/examples (lazily imported by
			// the docs demo loader) are shadcn copy-source authored against the
			// @/components/ui, @/hooks, and @/lib aliases. Point them at the real
			// libs/ui/registry source so demos resolve without a duplicated mirror.
			alias: {
				"@/components/ui": uiRegistryPath("ui"),
				"@/hooks": uiRegistryPath("hooks"),
				"@/lib/utils": uiRegistryPath("lib/utils"),
				"@/lib/aria": uiRegistryPath("lib/aria"),
				"@/lib/compose-refs": uiRegistryPath("lib/compose-refs"),
				"@/lib/diff": uiRegistryPath("lib/diff"),
				"@/lib/floating-position": uiRegistryPath("lib/floating-position"),
				"@/lib/floating-position-constants": uiRegistryPath(
					"lib/floating-position-constants",
				),
				"@/lib/input-variants": uiRegistryPath("lib/input-variants"),
				"@/lib/search": uiRegistryPath("lib/search"),
				"@/lib/segmented-variants": uiRegistryPath("lib/segmented-variants"),
				"@/lib/selectable-collection": uiRegistryPath(
					"lib/selectable-collection",
				),
				"@/lib/selectable-variants": uiRegistryPath("lib/selectable-variants"),
				"@/lib/step-status": uiRegistryPath("lib/step-status"),
				"@/lib/stepper-variants": uiRegistryPath("lib/stepper-variants"),
				"@/lib/typeahead": uiRegistryPath("lib/typeahead"),
				"@diffgazer/keys": resolve(import.meta.dirname, "../../libs/keys/src"),
				"@": resolve(import.meta.dirname, "./src"),
			},
			dedupe: ["react", "react-dom"],
		},
		plugins,
	};
});

export default config;
