import Fastify from "fastify";
import cors from "@fastify/cors";
import { checkRoutes } from "./routes/check.js";
import { forkRoutes } from "./routes/fork.js";
import { mirrorRoutes } from "./routes/mirror.js";
import { rewriteRoutes } from "./routes/rewrite.js";
import { jobRoutes } from "./routes/jobs.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const app = Fastify({
  logger: true,
  requestTimeout: 120_000,
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN
    ? [process.env.CORS_ORIGIN, ...DEV_ORIGINS]
    : DEV_ORIGINS,
  methods: ["GET", "POST", "OPTIONS"],
});

await app.register(checkRoutes);
await app.register(forkRoutes);
await app.register(mirrorRoutes);
await app.register(rewriteRoutes);
await app.register(jobRoutes);

app.get("/health", async () => ({ ok: true }));

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`Backend listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
