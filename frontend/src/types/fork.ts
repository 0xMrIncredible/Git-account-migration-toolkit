import type { CheckRepo } from "@/types/check";
import type { RepoFilters } from "@/lib/repoFilters";

export interface ForkPreviewResponse {
  repos: CheckRepo[];
  warnings: string[];
  totalLoaded: number;
  totalMatched: number;
}

export interface ForkJobItem {
  repoName: string;
  status: "pending" | "running" | "success" | "skipped" | "failed";
  message?: string;
  forkUrl?: string;
}

export interface ForkJobResponse {
  id: string;
  type: "fork";
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  mine: { username: string; email: string };
  target: { username: string };
  filters: RepoFilters;
  items: ForkJobItem[];
  warnings: string[];
  error?: string;
  summary: {
    total: number;
    pending: number;
    running: number;
    success: number;
    skipped: number;
    failed: number;
  };
}

export interface ForkCredentials {
  mine: { username: string; email: string; token: string };
  target: { username: string; token?: string };
}

export interface StartForkPayload extends ForkCredentials {
  filters: RepoFilters;
  repoNames?: string[];
}
