import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { previewRewrite, startRewriteJob } from "../services/rewriteContributionsService.js";

const repoFiltersSchema = z.object({
  visibility: z.enum(["all", "public", "private"]).default("all"),
  languages: z.array(z.string()).default([]),
  excludeForks: z.boolean().default(false),
  excludeArchived: z.boolean().default(false),
});

const rewriteSchema = z.object({
  authorName: z.string().min(1),
  authorEmail: z.string().email(),
  mode: z.enum(["all", "matchEmails"]).default("matchEmails"),
  matchEmails: z.array(z.string().email()).min(1),
});

const previewBodySchema = z.object({
  mine: z.object({
    username: z.string().min(1).max(39),
    token: z.string().min(1),
  }),
  filters: repoFiltersSchema,
});

const rewriteJobBodySchema = z.object({
  mine: z.object({
    username: z.string().min(1).max(39),
    email: z.string().email(),
    token: z.string().min(1),
  }),
  filters: repoFiltersSchema,
  rewrite: rewriteSchema,
  repoNames: z.array(z.string()).optional(),
});

export async function rewriteRoutes(app: FastifyInstance) {
  app.post("/api/v1/rewrite/preview", async (request, reply) => {
    const parsed = previewBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      return await previewRewrite(parsed.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("not found") || message.includes("Token")) {
        return reply.status(400).send({ error: message });
      }
      request.log.error(err);
      return reply.status(500).send({ error: message });
    }
  });

  app.post("/api/v1/rewrite/jobs", async (request, reply) => {
    const parsed = rewriteJobBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      return await startRewriteJob(parsed.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (
        message.includes("Token") ||
        message.includes("No repositories") ||
        message.includes("Git is not installed") ||
        message.includes("old email")
      ) {
        return reply.status(400).send({ error: message });
      }
      request.log.error(err);
      return reply.status(500).send({ error: message });
    }
  });
}
