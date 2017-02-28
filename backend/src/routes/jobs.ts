import type { FastifyInstance } from "fastify";
import { getJob } from "../store/jobs.js";
import { toPublicJob } from "../types/job.js";

export async function jobRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/v1/jobs/:id", async (request, reply) => {
    const job = getJob(request.params.id);
    if (!job) {
      return reply.status(404).send({ error: "Job not found" });
    }
    return toPublicJob(job);
  });
}
