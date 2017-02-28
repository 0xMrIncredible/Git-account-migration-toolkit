import { randomUUID } from "node:crypto";
import type { CheckRepo } from "../types/check.js";
import type { AnyJob, ForkJob, MirrorJob, RewriteJob, JobItem } from "../types/job.js";

const forkJobs = new Map<string, ForkJob>();
const mirrorJobs = new Map<string, MirrorJob>();
const rewriteJobs = new Map<string, RewriteJob>();

interface JobCredentials {
  mineToken: string;
  targetToken?: string;
}

interface ForkJobCredentials extends JobCredentials {
  repoMeta: Map<string, CheckRepo>;
}

interface MirrorJobCredentials extends JobCredentials {
  repoMeta: Map<string, CheckRepo>;
}

interface RewriteJobCredentials {
  mineToken: string;
  repoMeta: Map<string, CheckRepo>;
}

const forkCredentials = new Map<string, ForkJobCredentials>();
const mirrorCredentials = new Map<string, MirrorJobCredentials>();
const rewriteCredentials = new Map<string, RewriteJobCredentials>();
export function createForkJob(job: Omit<ForkJob, "id" | "createdAt" | "status">): ForkJob {
  const full: ForkJob = {
    ...job,
    id: randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  forkJobs.set(full.id, full);
  return full;
}

export function createMirrorJob(job: Omit<MirrorJob, "id" | "createdAt" | "status">): MirrorJob {
  const full: MirrorJob = {
    ...job,
    id: randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  mirrorJobs.set(full.id, full);
  return full;
}

export function createRewriteJob(job: Omit<RewriteJob, "id" | "createdAt" | "status">): RewriteJob {
  const full: RewriteJob = {
    ...job,
    id: randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  rewriteJobs.set(full.id, full);
  return full;
}

export function getJob(id: string): AnyJob | undefined {
  return forkJobs.get(id) ?? mirrorJobs.get(id) ?? rewriteJobs.get(id);
}

export function getForkJob(id: string): ForkJob | undefined {
  return forkJobs.get(id);
}

export function getMirrorJob(id: string): MirrorJob | undefined {
  return mirrorJobs.get(id);
}

export function getRewriteJob(id: string): RewriteJob | undefined {
  return rewriteJobs.get(id);
}

export function updateForkJob(id: string, patch: Partial<ForkJob>): ForkJob | undefined {
  const job = forkJobs.get(id);
  if (!job) return undefined;
  const updated = { ...job, ...patch };
  forkJobs.set(id, updated);
  return updated;
}

export function updateMirrorJob(id: string, patch: Partial<MirrorJob>): MirrorJob | undefined {
  const job = mirrorJobs.get(id);
  if (!job) return undefined;
  const updated = { ...job, ...patch };
  mirrorJobs.set(id, updated);
  return updated;
}

export function updateRewriteJob(id: string, patch: Partial<RewriteJob>): RewriteJob | undefined {
  const job = rewriteJobs.get(id);
  if (!job) return undefined;
  const updated = { ...job, ...patch };
  rewriteJobs.set(id, updated);
  return updated;
}

export function setForkCredentials(id: string, creds: ForkJobCredentials): void {
  forkCredentials.set(id, creds);
}

export function getForkCredentials(id: string): ForkJobCredentials | undefined {
  return forkCredentials.get(id);
}

export function clearForkCredentials(id: string): void {
  forkCredentials.delete(id);
}

export function setMirrorCredentials(id: string, creds: MirrorJobCredentials): void {
  mirrorCredentials.set(id, creds);
}

export function getMirrorCredentials(id: string): MirrorJobCredentials | undefined {
  return mirrorCredentials.get(id);
}

export function clearMirrorCredentials(id: string): void {
  mirrorCredentials.delete(id);
}

export function setRewriteCredentials(id: string, creds: RewriteJobCredentials): void {
  rewriteCredentials.set(id, creds);
}

export function getRewriteCredentials(id: string): RewriteJobCredentials | undefined {
  return rewriteCredentials.get(id);
}

export function clearRewriteCredentials(id: string): void {
  rewriteCredentials.delete(id);
}

export function updateForkItem(
  jobId: string,
  repoName: string,
  patch: Partial<JobItem>
): void {
  updateJobItem("fork", jobId, repoName, patch);
}

export function updateMirrorItem(
  jobId: string,
  repoName: string,
  patch: Partial<JobItem>
): void {
  updateJobItem("mirror", jobId, repoName, patch);
}

export function updateRewriteItem(
  jobId: string,
  repoName: string,
  patch: Partial<JobItem>
): void {
  updateJobItem("rewrite", jobId, repoName, patch);
}

function updateJobItem(
  kind: "fork" | "mirror" | "rewrite",
  jobId: string,
  repoName: string,
  patch: Partial<JobItem>
): void {
  const store =
    kind === "fork" ? forkJobs : kind === "mirror" ? mirrorJobs : rewriteJobs;
  const job = store.get(jobId);
  if (!job) return;
  job.items = job.items.map((item) =>
    item.repoName === repoName ? { ...item, ...patch } : item
  );
  store.set(jobId, job as ForkJob & MirrorJob & RewriteJob);
}
