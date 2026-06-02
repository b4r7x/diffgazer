import { useEffect, useState } from "react";
import { type DemoMap, demoLoaders } from "@/generated/demo-loaders";

export type { DemoMap };

const EMPTY_DEMOS: DemoMap = {};

export function useDemos(libraryId: string): DemoMap {
	const [demos, setDemos] = useState<DemoMap>(EMPTY_DEMOS);

	useEffect(() => {
		let active = true;
		const loader = demoLoaders[libraryId];

		setDemos(EMPTY_DEMOS);
		if (!loader) return;

		loader()
			.then((m) => {
				if (active) setDemos(m.demos);
			})
			.catch((err) => {
				if (!active) return;
				// Missing/broken demo bundles must not crash the docs page; render an
				// invisible fallback so the surrounding MDX content stays readable.
				if (import.meta.env.DEV) console.warn("Failed to load demos:", err);
				setDemos(EMPTY_DEMOS);
			});

		return () => {
			active = false;
		};
	}, [libraryId]);

	return demos;
}
