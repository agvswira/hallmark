import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

// The public REST APIs send no CORS headers, so the browser reaches them through a
// proxy: the dev/preview server here, and a rewrite in vercel.json in production.
const rest = (target: string) => ({
  target,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/lcd-(testnet|mainnet)/, ""),
});
const proxy = {
  "/lcd-testnet": rest("https://api-testnet.qore.host"),
  "/lcd-mainnet": rest("https://api.qore.host"),
};

/**
 * Serves the Vercel Functions in api/ during development: /api/<name> loads api/<name>.ts
 * and calls its exported GET/POST handler with a web-standard Request.
 */
function apiRoutes(): Plugin {
  let server: ViteDevServer;
  return {
    name: "hallmark-api-routes",
    configureServer(s) {
      server = s;
      s.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const m = url.pathname.match(/^\/api\/([a-z-]+)$/);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`);
          const handler = mod[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const request = new Request(new URL(req.url ?? "/", `http://${req.headers.host}`), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server-only variables (no VITE_ prefix) for the API routes in development.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), apiRoutes()],
    server: { port: 5173, proxy },
    preview: { proxy },
    ssr: { noExternal: ["@hallmark/verifier"] },
  };
});
