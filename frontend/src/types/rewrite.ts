import type { RepoFilters } from "@/lib/repoFilters";

export interface RewriteOptions {
  authorName: string;
  authorEmail: string;
  mode: "matchEmails";
  matchEmails: string[];
}

export interface RewritePreviewResponse {
  repos: import("@/types/check").CheckRepo[];
  warnings: string[];
  totalLoaded: number;
  totalMatched: number;
}

export interface StartRewritePayload {
  mine: { username: string; email: string; token: string };
  filters: RepoFilters;
  rewrite: RewriteOptions;
  repoNames?: string[];
}
