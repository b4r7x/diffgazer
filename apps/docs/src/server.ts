import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { DOCS_SECURITY_HEADERS } from "./security-headers";

export default createServerEntry({
	async fetch(request) {
		const response = await handler.fetch(request);
		const headers = new Headers(response.headers);
		for (const [key, value] of Object.entries(DOCS_SECURITY_HEADERS)) {
			headers.set(key, value);
		}
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	},
});
