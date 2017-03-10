import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { previewMirror, startMirrorJob } from "../services/mirrorService.js";

const repoFiltersSchema = z.object({
  visibility: z.enum(["all", "public", "private"]).default("all"),
  languages: z.array(z.string()).default([]),
  excludeForks: z.boolean().default(false),
  excludeArchived: z.boolean().default(false),
});

const rewriteSchema = z.object({
  authorName: z.string().min(1),
  authorEmail: z.string().email(),
  mode: z.enum(["all", "matchEmails"]).default("all"),
  matchEmails: z.array(z.string()).default([]),
});

const previewBodySchema = z.object({
  target: z.object({
    username: z.string().min(1).max(39),
    token: z.string().optional(),
  }),
  filters: repoFiltersSchema,
  mine: z
    .object({
      username: z.string().min(1).max(39),
      token: z.string().min(1),
    })
    .optional(),
});

const mirrorJobBodySchema = z.object({
  mine: z.object({
    username: z.string().min(1).max(39),
    email: z.string().email(),
    token: z.string().min(1),
  }),
  target: z.object({
    username: z.string().min(1).max(39),
    token: z.string().optional(),
  }),
  filters: repoFiltersSchema,
  rewrite: rewriteSchema,
  repoNames: z.array(z.string()).optional(),
});

export async function mirrorRoutes(app: FastifyInstance) {
  app.post("/api/v1/mirror/preview", async (request, reply) => {
    const parsed = previewBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      return await previewMirror(parsed.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("not found")) {
        return reply.status(404).send({ error: message });
      }
      request.log.error(err);
      return reply.status(500).send({ error: message });
    }
  });

  app.post("/api/v1/mirror/jobs", async (request, reply) => {
    const parsed = mirrorJobBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      return await startMirrorJob(parsed.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("not found")) {
        return reply.status(404).send({ error: message });
      }
      if (
        message.includes("Token") ||
        message.includes("No repositories") ||
        message.includes("Git is not installed")
      ) {
        return reply.status(400).send({ error: message });
      }
      request.log.error(err);
      return reply.status(500).send({ error: message });
    }
  });
}
