const FAUCET_ORIGIN = "https://usdh.com";

export default defineEventHandler(async (event: any) => {
	const url = getRequestURL(event);
	const targetUrl = `${FAUCET_ORIGIN}${url.pathname}${url.search}`;

	const body = event.method !== "GET" ? await readBody(event) : undefined;

	const response = await fetch(targetUrl, {
		method: event.method,
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});

	return response.json();
});
