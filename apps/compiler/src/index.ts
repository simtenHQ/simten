import { Container, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";

// --- Container Definition ---

export class CompilerContainer extends Container<Env> {
	defaultPort = 8080;
	sleepAfter = "2m";
}

// --- Worker (API Gateway) ---

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use("*", async (c, next) => {
	await next();
	c.res.headers.set("Access-Control-Allow-Origin", c.req.header("Origin") ?? "*");
	c.res.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
	c.res.headers.set("Access-Control-Allow-Headers", "Content-Type");
	c.res.headers.set("Access-Control-Max-Age", "86400");
});

app.options("*", (c) => new Response(null, { status: 204 }));

// Health check
app.get("/", async (c) => {
	const container = getContainer(c.env.COMPILER_CONTAINER);
	const resp = await container.fetch("http://container/health");
	return new Response(resp.body, resp);
});

// Compile endpoint
app.post("/compile", async (c) => {
	// Validate content type
	const contentType = c.req.header("Content-Type");
	if (!contentType?.includes("application/json")) {
		return c.json({ success: false, error: "Content-Type must be application/json" }, 400);
	}

	// Size check (50KB source + overhead)
	const contentLength = parseInt(c.req.header("Content-Length") ?? "0", 10);
	if (contentLength > 60 * 1024) {
		return c.json({ success: false, error: "Request too large" }, 413);
	}

	// Parse and validate request
	let body: { source?: string; language?: string; linkerScript?: string };
	try {
		body = await c.req.json();
	} catch {
		return c.json({ success: false, error: "Invalid JSON" }, 400);
	}

	if (typeof body.source !== "string" || body.source.length === 0) {
		return c.json({ success: false, error: "source is required" }, 400);
	}

	const language = body.language ?? "c";
	if (!["c", "cpp", "rust", "asm"].includes(language)) {
		return c.json(
			{ success: false, error: `Unsupported language: "${language}". Supported: c, cpp, rust, asm` },
			400,
		);
	}

	// Forward to container (pass through optional linkerScript)
	const container = getContainer(c.env.COMPILER_CONTAINER);
	const payload: Record<string, string> = { source: body.source, language };
	if (body.linkerScript) {
		payload.linkerScript = body.linkerScript;
	}
	const resp = await container.fetch("http://container/compile", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	return new Response(resp.body, {
		status: resp.status,
		headers: { "Content-Type": "application/json" },
	});
});

export default app;
