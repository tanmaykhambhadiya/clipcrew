import Fastify from "fastify";
import cors from "@fastify/cors";
import { routes } from "./routes.generated";
import { parseCookieHeader, requestContext } from "./runtime/context";
import { closePool, sql } from "./db/pool";

const PORT = Number(process.env.PORT ?? 4000);
const ORIGINS = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, trustProxy: true, bodyLimit: 1_048_576 });

// Keep request bodies as raw bytes so route handlers can call request.json() exactly as they did in Next.js.
app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

await app.register(cors, {
  origin: ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  maxAge: 600,
});

// CSRF defence in depth (the cookie is also SameSite=Lax): state-changing requests must come from our frontend.
app.addHook("onRequest", async (req, reply) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = String(req.headers.origin ?? "").replace(/\/+$/, "");
  if (!ORIGINS.includes(origin)) return reply.code(403).send({ ok: false, error: "Request blocked." });
});

app.get("/health", async (_req, reply) => {
  try {
    await sql("select 1");
    return { ok: true };
  } catch {
    return reply.code(503).send({ ok: false });
  }
});

for (const { url, module } of routes) {
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
    const handler = module[method];
    if (!handler) continue;
    app.route({
      method,
      url,
      handler: async (req, reply) => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
        const body = req.body as Buffer | undefined;
        const webReq = new Request(`http://api.internal${req.raw.url}`, {
          method,
          headers,
          body: method === "GET" || !body?.length ? undefined : new Uint8Array(body),
        });
        const store = { incoming: parseCookieHeader(req.headers.cookie), outgoing: [] as string[] };
        let res: Response;
        try {
          res = await requestContext.run(store, async () => handler(webReq, { params: (req.params ?? {}) as Record<string, string> }));
        } catch (err) {
          req.log.error({ err, url: req.url }, "unhandled route error");
          return reply.code(500).send({ ok: false, error: "Something went wrong on our side. Please try again." });
        }
        reply.code(res.status);
        res.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
        });
        if (store.outgoing.length) reply.header("set-cookie", store.outgoing);
        reply.header("cache-control", res.headers.get("cache-control") ?? "no-store");
        return reply.send(Buffer.from(await res.arrayBuffer()));
      },
    });
  }
}

const shutdown = async () => {
  await app.close();
  await closePool();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: PORT, host: "0.0.0.0" });
