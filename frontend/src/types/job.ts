export type JobStatus = "pending" | "running" | "completed" | "failed";
export type JobItemStatus = "pending" | "running" | "success" | "skipped" | "failed";

export interface JobItem {
  repoName: string;
  status: JobItemStatus;
  message?: string;
  resultUrl?: string;
  forkUrl?: string;
}

export interface JobSummary {
  total: number;
  pending: number;
  running: number;
  success: number;
  skipped: number;
  failed: number;
}

export interface JobResponse {
  id: string;
  type: "fork" | "mirror" | "rewrite";
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  mine: { username: string; email: string };
  target?: { username: string };
  items: JobItem[];
  warnings: string[];
  error?: string;
  summary: JobSummary;
  rewrite?: {
    authorName: string;
    authorEmail: string;
    mode: "all" | "matchEmails";
    matchEmails: string[];
  };
}
