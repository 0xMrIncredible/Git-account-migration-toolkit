import type { CheckRepo } from "../types/check.js";

export interface GithubRepoFields {
  name: string;
  full_name: string;
  html_url: string;
  description?: string | null;
  language?: string | null;
  fork?: boolean;
  archived?: boolean;
  stargazers_count?: number;
  forks_count?: number;
  updated_at?: string | null;
  pushed_at?: string | null;
  created_at?: string | null;
  size?: number;
}

export function parseRepoOwner(fullName: string): string {
  const slash = fullName.indexOf("/");
  return slash >= 0 ? fullName.slice(0, slash) : fullName;
}

export function mapGithubRepo(repo: GithubRepoFields, visibility: "public" | "private"): CheckRepo {
  return {
    name: repo.name,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description ?? null,
    language: repo.language ?? null,
    visibility,
    isFork: repo.fork ?? false,
    isArchived: repo.archived ?? false,
    stargazersCount: repo.stargazers_count ?? 0,
    forksCount: repo.forks_count ?? 0,
    updatedAt: repo.updated_at ?? new Date(0).toISOString(),
    pushedAt: repo.pushed_at ?? null,
    createdAt: repo.created_at ?? new Date(0).toISOString(),
    firstCommitAt: null,
    sizeKb: repo.size ?? 0,
  };
}

export function parseRateLimit(headers: Record<string, unknown>): {
  limit: number;
  remaining: number;
  resetAt: string;
} {
  const limit = Number(headers["x-ratelimit-limit"] ?? 0);
  const remaining = Number(headers["x-ratelimit-remaining"] ?? 0);
  const resetUnix = Number(headers["x-ratelimit-reset"] ?? 0);
  return {
    limit,
    remaining,
    resetAt: resetUnix ? new Date(resetUnix * 1000).toISOString() : new Date().toISOString(),
  };
}
