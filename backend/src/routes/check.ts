import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { checkAccount } from "../services/checkAccount.js";

const checkBodySchema = z.object({
  targetUsername: z
    .string()
    .min(1, "GitHub username is required")
    .max(39, "Username is too long"),
  targetToken: z.string().optional(),
});

export async function checkRoutes(app: FastifyInstance) {
  app.post<{ Body: z.infer<typeof checkBodySchema> }>(
    "/api/v1/check",
    async (request, reply) => {
      const parsed = checkBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { targetUsername, targetToken } = parsed.data;

      try {
        const result = await checkAccount(targetUsername, targetToken);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const status = (err as { status?: number }).status;

        if (message.includes("not found")) {
          return reply.status(404).send({ error: message });
        }
        if (status === 403) {
          return reply.status(403).send({
            error: "GitHub API rate limit or forbidden. Try again later or use a token.",
          });
        }
        request.log.error(err);
        return reply.status(500).send({ error: message });
      }
    }
  );
}
