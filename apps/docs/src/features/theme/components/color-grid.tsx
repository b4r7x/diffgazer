import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { useCopyFeedback } from "@/lib/use-copy-feedback";

interface ColorSwatch {
	variable: string;
	cssVar: string;
	hex: string;
}

const PRIMITIVES: ColorSwatch[] = [
	{ variable: "--tui-bg", cssVar: "var(--tui-bg)", hex: "#0a0a0a" },
	{ variable: "--tui-fg", cssVar: "var(--tui-fg)", hex: "#e5e5e5" },
	{ variable: "--tui-dim", cssVar: "var(--tui-dim)", hex: "#9c9c9c" },
	{ variable: "--tui-blue", cssVar: "var(--tui-blue)", hex: "#ccccff" },
	{ variable: "--tui-green", cssVar: "var(--tui-green)", hex: "#e5e5e5" },
	{ variable: "--tui-red", cssVar: "var(--tui-red)", hex: "#ff7b72" },
	{ variable: "--tui-yellow", cssVar: "var(--tui-yellow)", hex: "#d29922" },
	{ variable: "--tui-violet", cssVar: "var(--tui-violet)", hex: "#787878" },
	{ variable: "--tui-border", cssVar: "var(--tui-border)", hex: "#606060" },
	{
		variable: "--tui-highlight",
		cssVar: "var(--tui-highlight)",
		hex: "#ffffff",
	},
	{
		variable: "--tui-highlight-fg",
		cssVar: "var(--tui-highlight-fg)",
		hex: "#000000",
	},
	{
		variable: "--tui-selection",
		cssVar: "var(--tui-selection)",
		hex: "#333333",
	},
	{ variable: "--tui-muted", cssVar: "var(--tui-muted)", hex: "#787878" },
	{ variable: "--tui-input-bg", cssVar: "var(--tui-input-bg)", hex: "#0a0a0a" },
];

const SEMANTIC: ColorSwatch[] = [
	{ variable: "--primary", cssVar: "var(--primary)", hex: "tui-fg" },
	{ variable: "--secondary", cssVar: "var(--secondary)", hex: "tui-selection" },
	{ variable: "--accent", cssVar: "var(--accent)", hex: "tui-highlight" },
	{ variable: "--destructive", cssVar: "var(--destructive)", hex: "tui-red" },
	{ variable: "--success", cssVar: "var(--success)", hex: "tui-green" },
	{ variable: "--warning", cssVar: "var(--warning)", hex: "tui-yellow" },
	{ variable: "--error", cssVar: "var(--error)", hex: "tui-red" },
	{ variable: "--info", cssVar: "var(--info)", hex: "tui-blue" },
	{ variable: "--muted", cssVar: "var(--muted)", hex: "tui-muted" },
	{ variable: "--border", cssVar: "var(--border)", hex: "tui-border" },
	{ variable: "--background", cssVar: "var(--background)", hex: "tui-bg" },
	{ variable: "--foreground", cssVar: "var(--foreground)", hex: "tui-fg" },
];

const STATUS_VARIANTS: ColorSwatch[] = [
	{
		variable: "--success-subtle",
		cssVar: "var(--success-subtle)",
		hex: "#e5e5e51a",
	},
	{ variable: "--success-fg", cssVar: "var(--success-fg)", hex: "tui-green" },
	{
		variable: "--success-border",
		cssVar: "var(--success-border)",
		hex: "tui-green",
	},
	{
		variable: "--success-strong",
		cssVar: "var(--success-strong)",
		hex: "tui-green",
	},
	{
		variable: "--warning-subtle",
		cssVar: "var(--warning-subtle)",
		hex: "#d299220d",
	},
	{ variable: "--warning-fg", cssVar: "var(--warning-fg)", hex: "tui-yellow" },
	{
		variable: "--warning-border",
		cssVar: "var(--warning-border)",
		hex: "tui-yellow",
	},
	{
		variable: "--warning-strong",
		cssVar: "var(--warning-strong)",
		hex: "tui-yellow",
	},
	{
		variable: "--error-subtle",
		cssVar: "var(--error-subtle)",
		hex: "#ff7b721a",
	},
	{ variable: "--error-fg", cssVar: "var(--error-fg)", hex: "tui-red" },
	{ variable: "--error-border", cssVar: "var(--error-border)", hex: "tui-red" },
	{ variable: "--error-strong", cssVar: "var(--error-strong)", hex: "tui-red" },
	{ variable: "--info-subtle", cssVar: "var(--info-subtle)", hex: "#ccccff1a" },
	{ variable: "--info-fg", cssVar: "var(--info-fg)", hex: "tui-blue" },
	{ variable: "--info-border", cssVar: "var(--info-border)", hex: "tui-blue" },
	{ variable: "--info-strong", cssVar: "var(--info-strong)", hex: "tui-blue" },
	{
		variable: "--neutral-subtle",
		cssVar: "var(--neutral-subtle)",
		hex: "#6666661a",
	},
	{ variable: "--neutral-fg", cssVar: "var(--neutral-fg)", hex: "tui-muted" },
	{
		variable: "--neutral-border",
		cssVar: "var(--neutral-border)",
		hex: "tui-border",
	},
	{
		variable: "--neutral-strong",
		cssVar: "var(--neutral-strong)",
		hex: "tui-muted",
	},
];

export function ColorGrid() {
	return (
		<div className="space-y-8">
			<SwatchGroup title="Primitives" swatches={PRIMITIVES} />
			<SwatchGroup title="Semantic Colors" swatches={SEMANTIC} />
			<SwatchGroup title="Status Variants" swatches={STATUS_VARIANTS} />
		</div>
	);
}

function SwatchGroup({
	title,
	swatches,
}: {
	title: string;
	swatches: ColorSwatch[];
}) {
	return (
		<div>
			<SectionHeader as="h3" className="mb-3">
				{title}
			</SectionHeader>
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
				{swatches.map((swatch) => (
					<SwatchCard key={swatch.variable} swatch={swatch} />
				))}
			</div>
		</div>
	);
}

function SwatchCard({ swatch }: { swatch: ColorSwatch }) {
	const { copied, showCopied } = useCopyFeedback();

	const handleClick = async () => {
		await navigator.clipboard.writeText(swatch.cssVar);
		showCopied();
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			className="text-left group border border-border hover:border-foreground transition-colors duration-150"
			aria-label={`Copy ${swatch.variable} CSS variable`}
		>
			<div
				className="w-full h-12 border-b border-border"
				style={{ backgroundColor: swatch.cssVar }}
			/>
			<div className="p-2">
				<div className="text-[11px] font-mono text-foreground truncate">
					{swatch.variable}
				</div>
				<div className="text-[10px] font-mono text-muted-foreground">
					{copied ? "Copied!" : swatch.hex}
				</div>
			</div>
		</button>
	);
}
