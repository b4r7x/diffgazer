// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveHeading } from "@/hooks/use-active-heading";

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

type MainContent = {
	main: HTMLElement;
	getScrollTop: () => number;
};

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

function createMainContent({
	top = 0,
	height = 600,
	scrollHeight = 2000,
	initialScrollTop = 0,
}: {
	top?: number;
	height?: number;
	scrollHeight?: number;
	initialScrollTop?: number;
} = {}): MainContent {
	let scrollTop = initialScrollTop;

	const main = document.createElement("main");
	main.id = "main-content";
	Object.defineProperty(main, "getBoundingClientRect", {
		value: () => createRect(top, height),
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
		value: height,
		configurable: true,
	});
	Object.defineProperty(main, "scrollHeight", {
		value: scrollHeight,
		configurable: true,
	});
	Object.defineProperty(main, "scrollTo", {
		value: vi.fn(({ top: nextTop }: ScrollToOptions) => {
			if (typeof nextTop === "number") {
				scrollTop = nextTop;
			}
		}),
		configurable: true,
	});

	document.body.appendChild(main);

	return {
		main,
		getScrollTop: () => scrollTop,
	};
}

function appendHeading({
	id,
	absoluteTop,
	mainTop = 0,
	getScrollTop,
	parent,
}: {
	id: string;
	absoluteTop: number;
	mainTop?: number;
	getScrollTop: () => number;
	parent?: HTMLElement;
}) {
	const heading = document.createElement("h2");
	heading.id = id;
	Object.defineProperty(heading, "getBoundingClientRect", {
		value: () => createRect(mainTop + absoluteTop - getScrollTop()),
		configurable: true,
	});
	(parent ?? document.body).appendChild(heading);
	return heading;
}

function HookHarness({
	ids,
	activation,
	bottomLock = true,
	topOffset = 96,
	children,
}: {
	ids: string[];
	activation?: "top-line" | "viewport-center" | number;
	bottomLock?: boolean;
	topOffset?: number;
	children?: ReactNode;
}) {
	const { activeId } = useActiveHeading({
		ids,
		containerId: "main-content",
		activation,
		bottomLock,
		topOffset,
	});

	return (
		<div>
			<div data-testid="active">{activeId ?? "none"}</div>
			{children}
		</div>
	);
}

function ScrollGuardHarness({ ids }: { ids: string[] }) {
	const { activeId, scrollTo } = useActiveHeading({
		ids,
		containerId: "main-content",
		topOffset: 96,
		scrollOffset: 96,
	});

	return (
		<div>
			<div data-testid="active">{activeId ?? "none"}</div>
			{ids.map((id) => (
				<button key={id} type="button" onClick={() => scrollTo(id)}>
					{`Scroll to ${id}`}
				</button>
			))}
		</div>
	);
}

function ScrollHarness({ id }: { id: string }) {
	const { scrollTo } = useActiveHeading({
		ids: [id],
		containerId: "main-content",
		topOffset: 96,
		scrollOffset: 96,
	});

	return (
		<button type="button" onClick={() => scrollTo(id)}>
			Scroll
		</button>
	);
}

describe("useActiveHeading", () => {
	beforeEach(() => {
		MockMutationObserver.instances = [];

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

		Object.defineProperty(window, "MutationObserver", {
			writable: true,
			configurable: true,
			value: MockMutationObserver,
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("tracks active heading with top-line activation while scrolling", async () => {
		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });
		appendHeading({ id: "api", absoluteTop: 420, getScrollTop, parent: main });

		render(<HookHarness ids={["intro", "api"]} />);
		expect(screen.getByTestId("active").textContent).toBe("intro");

		main.scrollTop = 360;
		fireEvent.scroll(main);

		await waitFor(() => {
			expect(screen.getByTestId("active").textContent).toBe("api");
		});
	});

	it("supports viewport-center activation mode", async () => {
		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "intro", absoluteTop: 120, getScrollTop, parent: main });
		appendHeading({ id: "api", absoluteTop: 420, getScrollTop, parent: main });

		render(
			<HookHarness
				ids={["intro", "api"]}
				activation="viewport-center"
			/>,
		);
		expect(screen.getByTestId("active").textContent).toBe("intro");

		main.scrollTop = 160;
		fireEvent.scroll(main);

		await waitFor(() => {
			expect(screen.getByTestId("active").textContent).toBe("api");
		});
	});

	it("locks to the last heading when reaching the bottom with bottomLock enabled", async () => {
		const { main, getScrollTop } = createMainContent({ scrollHeight: 1000 });
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });
		appendHeading({ id: "api", absoluteTop: 950, getScrollTop, parent: main });

		render(<HookHarness ids={["intro", "api"]} />);
		expect(screen.getByTestId("active").textContent).toBe("intro");

		main.scrollTop = 400;
		fireEvent.scroll(main);

		await waitFor(() => {
			expect(screen.getByTestId("active").textContent).toBe("api");
		});
	});

	it("does not force last heading at bottom when bottomLock is disabled", async () => {
		const { main, getScrollTop } = createMainContent({ scrollHeight: 1000 });
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });
		appendHeading({ id: "api", absoluteTop: 950, getScrollTop, parent: main });

		render(<HookHarness ids={["intro", "api"]} bottomLock={false} />);
		expect(screen.getByTestId("active").textContent).toBe("intro");

		main.scrollTop = 400;
		fireEvent.scroll(main);

		await waitFor(() => {
			expect(screen.getByTestId("active").textContent).toBe("intro");
		});
	});

	it("discovers headings added after mount via mutation observer", async () => {
		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });

		render(<HookHarness ids={["intro", "late"]} />);
		expect(screen.getByTestId("active").textContent).toBe("intro");

		appendHeading({ id: "late", absoluteTop: 90, getScrollTop, parent: main });
		MockMutationObserver.instances[0]?.trigger();

		await waitFor(() => {
			expect(screen.getByTestId("active").textContent).toBe("late");
		});
	});

	it("uses auto scroll behavior when prefers-reduced-motion is enabled", async () => {
		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "install", absoluteTop: 420, getScrollTop, parent: main });

		Object.defineProperty(window, "matchMedia", {
			writable: true,
			configurable: true,
			value: vi.fn((query: string) => ({
				matches: query === "(prefers-reduced-motion: reduce)",
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});

		render(<ScrollHarness id="install" />);
		fireEvent.click(screen.getByRole("button", { name: "Scroll" }));

		await waitFor(() => {
			expect(main.scrollTo).toHaveBeenCalledWith({
				behavior: "auto",
				top: 324,
			});
		});
	});

	it("sets activeId immediately on scrollTo and suppresses intermediate updates", async () => {
		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });
		appendHeading({ id: "middle", absoluteTop: 400, getScrollTop, parent: main });
		appendHeading({ id: "target", absoluteTop: 800, getScrollTop, parent: main });

		render(<ScrollGuardHarness ids={["intro", "middle", "target"]} />);

		await waitFor(() => {
			expect(screen.getByTestId("active").textContent).toBe("intro");
		});

		// Click scrollTo for the last heading.
		fireEvent.click(screen.getByRole("button", { name: "Scroll to target" }));

		// activeId should immediately jump to the target — not "middle".
		expect(screen.getByTestId("active").textContent).toBe("target");

		// Simulate intermediate scroll events (as smooth scroll animates).
		main.scrollTop = 200;
		fireEvent.scroll(main);

		// Should still be "target", not recalculated to "middle".
		await waitFor(() => {
			expect(screen.getByTestId("active").textContent).toBe("target");
		});
	});

	it("resumes scroll tracking after programmatic scroll settles", async () => {
		vi.useFakeTimers();

		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });
		appendHeading({ id: "api", absoluteTop: 400, getScrollTop, parent: main });

		render(<ScrollGuardHarness ids={["intro", "api"]} />);

		// Let the initial rAF fire.
		await act(() => vi.advanceTimersByTimeAsync(16));
		expect(screen.getByTestId("active").textContent).toBe("intro");

		// Programmatic scroll to "api".
		fireEvent.click(screen.getByRole("button", { name: "Scroll to api" }));
		expect(screen.getByTestId("active").textContent).toBe("api");

		// Simulate scroll events that would fire during smooth scroll animation.
		// These trigger the settle timer inside scheduleUpdate.
		fireEvent.scroll(main);

		// Advance past the settle delay (150ms) to clear the guard.
		await act(() => vi.advanceTimersByTimeAsync(200));

		// Now manual scrolling should resume tracking.
		main.scrollTop = 0;
		fireEvent.scroll(main);

		// Advance so the rAF from scheduleUpdate fires.
		await act(() => vi.advanceTimersByTimeAsync(16));

		expect(screen.getByTestId("active").textContent).toBe("intro");

		vi.useRealTimers();
	});

	it("activates heading based on numeric activation fraction", async () => {
		vi.useFakeTimers();

		// Container height = 600, so activation=0.5 → line at 300px
		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });
		appendHeading({ id: "api", absoluteTop: 420, getScrollTop, parent: main });

		render(
			<HookHarness ids={["intro", "api"]} activation={0.5} />,
		);

		await act(() => vi.advanceTimersByTimeAsync(16));
		expect(screen.getByTestId("active").textContent).toBe("intro");

		// Scroll so "api" heading (at absolute 420) ends up at y=280
		// which is above the activation line at 300.
		main.scrollTop = 140;
		fireEvent.scroll(main);
		await act(() => vi.advanceTimersByTimeAsync(16));

		expect(screen.getByTestId("active").textContent).toBe("api");

		vi.useRealTimers();
	});

	it("activation=0 activates at the very top of the container", async () => {
		vi.useFakeTimers();

		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });
		appendHeading({ id: "api", absoluteTop: 420, getScrollTop, parent: main });

		render(
			<HookHarness ids={["intro", "api"]} activation={0} />,
		);

		await act(() => vi.advanceTimersByTimeAsync(16));
		// With activation=0, the activation line is at the very top (y=0).
		// "intro" heading is at y=80 which is BELOW the line, so still first element wins.
		expect(screen.getByTestId("active").textContent).toBe("intro");

		// Scroll far enough that "api" heading reaches top edge (y<=0).
		main.scrollTop = 420;
		fireEvent.scroll(main);
		await act(() => vi.advanceTimersByTimeAsync(16));

		expect(screen.getByTestId("active").textContent).toBe("api");

		vi.useRealTimers();
	});

	it("numeric activation places line at the given viewport fraction", async () => {
		vi.useFakeTimers();

		// activation=0.5 with container height=600 places line at y=300.
		// topOffset=96 is irrelevant when activation is numeric.
		const { main, getScrollTop } = createMainContent();
		appendHeading({ id: "intro", absoluteTop: 80, getScrollTop, parent: main });
		appendHeading({ id: "api", absoluteTop: 200, getScrollTop, parent: main });

		render(
			<HookHarness
				ids={["intro", "api"]}
				activation={0.5}
				topOffset={96}
			/>,
		);

		await act(() => vi.advanceTimersByTimeAsync(16));

		// Both headings are above the line at 300:
		// intro at y=80, api at y=200. Last candidate wins → "api".
		expect(screen.getByTestId("active").textContent).toBe("api");

		vi.useRealTimers();
	});
});
