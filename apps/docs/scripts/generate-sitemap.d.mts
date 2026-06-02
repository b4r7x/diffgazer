export interface PreRenderPage {
	path: string;
	source: string | null;
}

export function getPreRenderPages(): PreRenderPage[];
export function writeSitemap(outDir?: string): {
	target: string;
	robotsTarget: string;
	count: number;
};
