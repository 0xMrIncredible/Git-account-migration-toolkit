import type { RepoFilters } from "@/lib/repoFilters";

export interface RewriteOptions {
  authorName: string;
  authorEmail: string;
  mode: "all" | "matchEmails";
  matchEmails: string[];
}

export interface MirrorPreviewResponse {
  repos: import("@/types/check").CheckRepo[];
  warnings: string[];
  totalLoaded: number;
  totalMatched: number;
}

export interface StartMirrorPayload {
  mine: { username: string; email: string; token: string };
  target: { username: string; token?: string };
  filters: RepoFilters;
  rewrite: RewriteOptions;
  repoNames?: string[];
}
