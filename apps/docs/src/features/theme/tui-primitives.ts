interface TuiPrimitive {
	name: string;
	darkValue: string;
	lightValue?: string;
	semantics?: string[];
}

/**
 * Canonical TUI primitive palette: the single source of truth for the dark hex
 * values shared by the color grid, theme playground, and variable diagram. The
 * first entries carry the semantic mappings + light values that drive the
 * variable diagram; `--tui-dim` and `--tui-highlight-fg` are primitives without
 * a semantic token, used only as editable/displayed swatches.
 */
export const TUI_PRIMITIVES: TuiPrimitive[] = [
	{
		name: "--tui-bg",
		darkValue: "#0a0a0a",
		lightValue: "#f7f8f5",
		semantics: ["--background"],
	},
	{
		name: "--tui-fg",
		darkValue: "#e5e5e5",
		lightValue: "#1f2328",
		semantics: ["--foreground"],
	},
	{
		name: "--tui-blue",
		darkValue: "#ccccff",
		lightValue: "#0b63ce",
		semantics: ["--info", "--ring"],
	},
	{
		name: "--tui-green",
		darkValue: "#e5e5e5",
		lightValue: "#0f7a4f",
		semantics: ["--success"],
	},
	{
		name: "--tui-red",
		darkValue: "#ff7b72",
		lightValue: "#c62828",
		semantics: ["--destructive", "--error"],
	},
	{
		name: "--tui-yellow",
		darkValue: "#d29922",
		lightValue: "#8a5a00",
		semantics: ["--warning"],
	},
	{
		name: "--tui-violet",
		darkValue: "#787878",
		lightValue: "#6f42c1",
		semantics: ["--accent", "--action"],
	},
	{
		name: "--tui-border",
		darkValue: "#606060",
		lightValue: "#aeb7c0",
		semantics: ["--border"],
	},
	{
		name: "--tui-muted",
		darkValue: "#787878",
		lightValue: "#69717a",
		semantics: ["--muted"],
	},
	{
		name: "--tui-highlight",
		darkValue: "#ffffff",
		lightValue: "#1f2328",
		semantics: ["--primary"],
	},
	{
		name: "--tui-selection",
		darkValue: "#333333",
		lightValue: "#e8edf3",
		semantics: ["--secondary"],
	},
	{
		name: "--tui-input-bg",
		darkValue: "#0a0a0a",
		lightValue: "#ffffff",
		semantics: ["--card", "--popover", "--input"],
	},
	{ name: "--tui-dim", darkValue: "#9c9c9c" },
	{ name: "--tui-highlight-fg", darkValue: "#000000" },
];

/** Primitives that map to one or more semantic tokens (drives the variable diagram). */
export const MAPPED_TUI_PRIMITIVES = TUI_PRIMITIVES.filter(
	(
		primitive,
	): primitive is TuiPrimitive & { lightValue: string; semantics: string[] } =>
		primitive.semantics !== undefined && primitive.lightValue !== undefined,
);

/**
 * Return the primitives in an explicit display order. The canonical
 * `TUI_PRIMITIVES` order is fixed by the variable diagram's mapped layout, so
 * the swatch grid and editable playground keep their own display order here
 * without duplicating the hex values. Throws if `order` omits or invents a name
 * so a future primitive rename can't silently drop a swatch.
 */
export function orderPrimitives(order: string[]): TuiPrimitive[] {
	const byName = new Map(TUI_PRIMITIVES.map((p) => [p.name, p] as const));
	if (order.length !== TUI_PRIMITIVES.length) {
		throw new Error(
			`Display order lists ${order.length} primitives but TUI_PRIMITIVES has ${TUI_PRIMITIVES.length}.`,
		);
	}
	return order.map((name) => {
		const primitive = byName.get(name);
		if (!primitive) {
			throw new Error(`Unknown TUI primitive in display order: ${name}`);
		}
		return primitive;
	});
}

/** Swatch grid display order (matches the original color-grid Primitives layout). */
export const COLOR_GRID_PRIMITIVE_ORDER = [
	"--tui-bg",
	"--tui-fg",
	"--tui-dim",
	"--tui-blue",
	"--tui-green",
	"--tui-red",
	"--tui-yellow",
	"--tui-violet",
	"--tui-border",
	"--tui-highlight",
	"--tui-highlight-fg",
	"--tui-selection",
	"--tui-muted",
	"--tui-input-bg",
];

/** Editable playground display order (matches the original playground layout). */
export const PLAYGROUND_PRIMITIVE_ORDER = [
	"--tui-bg",
	"--tui-fg",
	"--tui-dim",
	"--tui-blue",
	"--tui-violet",
	"--tui-green",
	"--tui-red",
	"--tui-yellow",
	"--tui-border",
	"--tui-highlight",
	"--tui-highlight-fg",
	"--tui-selection",
	"--tui-muted",
	"--tui-input-bg",
];
