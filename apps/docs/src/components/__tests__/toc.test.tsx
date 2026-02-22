// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TableOfContents } from "fumadocs-core/toc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TableOfContentsPanel } from "@/components/toc";

class MockMutationObserver {
	static instances: MockMutationObserver[] = [];
	callback: MutationCallback;
	constructor(callback: MutationCallback) {
		this.callback = callback;
		MockMutationObserver.instances.push(this);
	}
	observe = vi.fn();
	disconnect = vi.fn();
	takeRecords = vi.fn(() => []);

	trigger() {
		this.callback([], this);
	}
}

function createMainContent(initialScrollTop = 0): HTMLElement {
	let scrollTop = initialScrollTop;
	const main = document.createElement("main");
	main.id = "main-content";
	Object.defineProperty(main, "getBoundingClientRect", {
		value: () => createRect(0, 600),
		configurable: true,
	});
	Object.defineProperty(main, "scrollTop", {
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value;
		},
		configurable: true,
	});
	Object.defineProperty(main, "clientHeight", {
		value: 600,
		configurable: true,
	});
	Object.defineProperty(main, "scrollHeight", {
		value: 2000,
		configurable: true,
	});

	Object.defineProperty(main, "scrollTo", {
		value: vi.fn(({ top }: ScrollToOptions) => {
			if (typeof top === "number") {
				scrollTop = top;
			}
		}),
		configurable: true,
	});

	document.body.appendChild(main);
	return main;
}

function createRect(top: number, height = 24): DOMRect {
	return {
		x: 0,
		y: top,
		width: 100,
		height,
		top,
		right: 100,
		bottom: top + height,
		left: 0,
		toJSON: () => ({}),
	} as DOMRect;
}

describe("TableOfContentsPanel", () => {
	let replaceStateSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		MockMutationObserver.instances = [];
		replaceStateSpy = vi.spyOn(window.history, "replaceState");

		Object.defineProperty(window, "MutationObserver", {
			writable: true,
			configurable: true,
			value: MockMutationObserver,
		});

		Object.defineProperty(window, "requestAnimationFrame", {
			writable: true,
			configurable: true,
			value: (cb: FrameRequestCallback) => {
				return window.setTimeout(() => cb(0), 0);
			},
		});

		Object.defineProperty(window, "cancelAnimationFrame", {
			writable: true,
			configurable: true,
			value: (id: number) => window.clearTimeout(id),
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("updates hash via history.replaceState on toc click", () => {
		createMainContent();

		const heading = document.createElement("h2");
		heading.id = "quick-start";
		Object.defineProperty(heading, "getBoundingClientRect", {
			value: () => createRect(180, 24),
			configurable: true,
		});
		document.body.appendChild(heading);

		const toc: TableOfContents = [
			{ depth: 2, url: "#quick-start", title: "Quick Start" },
		];

		render(<TableOfContentsPanel toc={toc} />);

		fireEvent.click(screen.getByRole("link", { name: "Quick Start" }));

		expect(replaceStateSpy).toHaveBeenCalled();
		expect(window.location.hash).toBe("#quick-start");
	});

	it("scrolls the docs container to heading top minus offset on click", async () => {
		const main = createMainContent();

		const heading = document.createElement("h2");
		heading.id = "install";
		Object.defineProperty(heading, "getBoundingClientRect", {
			value: () => createRect(420),
			configurable: true,
		});
		document.body.appendChild(heading);

		const toc: TableOfContents = [
			{ depth: 2, url: "#install", title: "Install" },
		];

		render(<TableOfContentsPanel toc={toc} />);
		fireEvent.click(screen.getByRole("link", { name: "Install" }));

		await waitFor(() => {
			expect(main.scrollTo).toHaveBeenCalledWith({
				behavior: "smooth",
				top: 324,
			});
		});
	});

	it("does not intercept modifier clicks", () => {
		const main = createMainContent();
		const heading = document.createElement("h2");
		heading.id = "quick-start";
		Object.defineProperty(heading, "getBoundingClientRect", {
			value: () => createRect(180, 24),
			configurable: true,
		});
		document.body.appendChild(heading);

		const toc: TableOfContents = [
			{ depth: 2, url: "#quick-start", title: "Quick Start" },
		];

		render(<TableOfContentsPanel toc={toc} />);
		fireEvent.click(screen.getByRole("link", { name: "Quick Start" }), {
			metaKey: true,
		});

		expect(main.scrollTo).not.toHaveBeenCalled();
		expect(replaceStateSpy).not.toHaveBeenCalled();
	});

	it("highlights the clicked toc item immediately without flickering", async () => {
		const main = createMainContent();

		const h1 = document.createElement("h2");
		h1.id = "intro";
		Object.defineProperty(h1, "getBoundingClientRect", {
			value: () => createRect(80, 24),
			configurable: true,
		});
		document.body.appendChild(h1);

		const h2 = document.createElement("h2");
		h2.id = "middle";
		Object.defineProperty(h2, "getBoundingClientRect", {
			value: () => createRect(400, 24),
			configurable: true,
		});
		document.body.appendChild(h2);

		const h3 = document.createElement("h2");
		h3.id = "target";
		Object.defineProperty(h3, "getBoundingClientRect", {
			value: () => createRect(800, 24),
			configurable: true,
		});
		document.body.appendChild(h3);

		const toc: TableOfContents = [
			{ depth: 2, url: "#intro", title: "Intro" },
			{ depth: 2, url: "#middle", title: "Middle" },
			{ depth: 2, url: "#target", title: "Target" },
		];

		render(<TableOfContentsPanel toc={toc} />);

		// Wait for initial render to settle.
		await waitFor(() => {
			expect(
				screen.getByRole("link", { name: "Intro" }).getAttribute("aria-current"),
			).toBe("location");
		});

		// Click the last item.
		fireEvent.click(screen.getByRole("link", { name: "Target" }));

		// Target should be immediately highlighted.
		expect(
			screen.getByRole("link", { name: "Target" }).getAttribute("aria-current"),
		).toBe("location");

		// Simulate an intermediate scroll event during smooth scrolling.
		main.scrollTop = 200;
		fireEvent.scroll(main);

		// Should still be "Target", not "Middle".
		await waitFor(() => {
			expect(
				screen.getByRole("link", { name: "Target" }).getAttribute("aria-current"),
			).toBe("location");
		});
	});
});
