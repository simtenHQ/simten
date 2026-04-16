import { Container, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";

// --- Container Definition ---

export class SynthContainer extends Container<Env> {
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
	const container = getContainer(c.env.SYNTH_CONTAINER);
	const resp = await container.fetch("http://container/health");
	return new Response(resp.body, resp);
});

// Synth endpoint
app.post("/synth", async (c) => {
	const contentType = c.req.header("Content-Type");
	if (!contentType?.includes("application/json")) {
		return c.json({ success: false, error: "Content-Type must be application/json" }, 400);
	}

	const contentLength = parseInt(c.req.header("Content-Length") ?? "0", 10);
	if (contentLength > 120 * 1024) {
		return c.json({ success: false, error: "Request too large" }, 413);
	}

	let body: { verilog?: string; files?: Record<string, string>; top?: string; target?: string };
	try {
		body = await c.req.json();
	} catch {
		return c.json({ success: false, error: "Invalid JSON" }, 400);
	}

	if (typeof body.verilog !== "string" || body.verilog.length === 0) {
		return c.json({ success: false, error: "verilog source is required" }, 400);
	}

	if (typeof body.top !== "string" || body.top.length === 0) {
		return c.json({ success: false, error: "top module name is required" }, 400);
	}

	const container = getContainer(c.env.SYNTH_CONTAINER);
	const resp = await container.fetch("http://container/synth", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			verilog: body.verilog,
			files: body.files ?? {},
			top: body.top,
			target: body.target ?? "generic",
		}),
	});

	return new Response(resp.body, {
		status: resp.status,
		headers: { "Content-Type": "application/json" },
	});
});

// Build endpoint (nextpnr-ecp5 + ecppack)
app.post("/build", async (c) => {
	const contentType = c.req.header("Content-Type");
	if (!contentType?.includes("application/json")) {
		return c.json({ success: false, error: "Content-Type must be application/json" }, 400);
	}

	let body: { netlist?: string; top?: string; lpf?: string; device?: string; package?: string };
	try {
		body = await c.req.json();
	} catch {
		return c.json({ success: false, error: "Invalid JSON" }, 400);
	}

	if (typeof body.netlist !== "string" || body.netlist.length === 0) {
		return c.json({ success: false, error: "netlist is required" }, 400);
	}

	if (typeof body.top !== "string" || body.top.length === 0) {
		return c.json({ success: false, error: "top module name is required" }, 400);
	}

	const container = getContainer(c.env.SYNTH_CONTAINER);
	const resp = await container.fetch("http://container/build", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			netlist: body.netlist,
			top: body.top,
			lpf: body.lpf ?? "",
			device: body.device ?? "LFE5U-85F",
			package: body.package ?? "CABGA381",
		}),
	});

	return new Response(resp.body, {
		status: resp.status,
		headers: { "Content-Type": "application/json" },
	});
});

export default app;
