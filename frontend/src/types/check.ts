export interface CheckProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
  htmlUrl: string;
}

export type CompareStatus = "missing" | "forked" | "exists";

export interface CheckRepo {
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  visibility: "public" | "private";
  isFork: boolean;
  isArchived: boolean;
  stargazersCount: number;
  forksCount: number;
  updatedAt: string;
  pushedAt: string | null;
  createdAt: string;
  firstCommitAt?: string | null;
  sizeKb: number;
  compareStatus?: CompareStatus;
  compareUrl?: string;
  compareDetail?: string;
}

export interface LanguageStat {
  language: string;
  count: number;
  percentage: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface CheckAccountResponse {
  profile: CheckProfile;
  repos: CheckRepo[];
  summary: {
    totalRepos: number;
    publicCount: number;
    privateCount: number;
    forkCount: number;
    archivedCount: number;
    languages: LanguageStat[];
  };
  rateLimit: RateLimitInfo;
  tokenInfo: {
    provided: boolean;
    valid: boolean;
    ownerLogin: string | null;
    canSeePrivateRepos: boolean;
    message: string | null;
  };
  warnings: string[];
}
