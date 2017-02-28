export type JobStatus = "pending" | "running" | "completed" | "failed";
export type JobItemStatus = "pending" | "running" | "success" | "skipped" | "failed";

export interface JobItem {
  repoName: string;
  status: JobItemStatus;
  message?: string;
  resultUrl?: string;
}

export interface JobFilters {
  visibility: string;
  languages: string[];
  excludeForks: boolean;
  excludeArchived: boolean;
}

export interface RewriteOptions {
  authorName: string;
  authorEmail: string;
  mode: "all" | "matchEmails";
  matchEmails: string[];
}

export interface ForkJob {
  id: string;
  type: "fork";
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  mine: { username: string; email: string };
  target: { username: string };
  filters: JobFilters;
  items: JobItem[];
  warnings: string[];
  error?: string;
}

export interface MirrorJob {
  id: string;
  type: "mirror";
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  mine: { username: string; email: string };
  target: { username: string };
  filters: JobFilters;
  rewrite: RewriteOptions;
  items: JobItem[];
  warnings: string[];
  error?: string;
}

export interface RewriteJob {
  id: string;
  type: "rewrite";
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  mine: { username: string; email: string };
  filters: JobFilters;
  rewrite: RewriteOptions;
  items: JobItem[];
  warnings: string[];
  error?: string;
}

export type AnyJob = ForkJob | MirrorJob | RewriteJob;

export interface JobSummary {
  total: number;
  pending: number;
  running: number;
  success: number;
  skipped: number;
  failed: number;
}

export function summarizeJob(items: JobItem[]): JobSummary {
  return {
    total: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    running: items.filter((i) => i.status === "running").length,
    success: items.filter((i) => i.status === "success").length,
    skipped: items.filter((i) => i.status === "skipped").length,
    failed: items.filter((i) => i.status === "failed").length,
  };
}

export function toPublicJob(job: AnyJob) {
  return {
    ...job,
    summary: summarizeJob(job.items),
  };
}

/** @deprecated use JobItem */
export type ForkJobItem = JobItem;

export function summarizeForkJob(items: JobItem[]): JobSummary {
  return summarizeJob(items);
}
