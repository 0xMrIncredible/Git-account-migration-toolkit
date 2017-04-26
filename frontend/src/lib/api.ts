import type { CheckAccountResponse } from "@/types/check";
import type { JobResponse } from "@/types/job";
import type {
  ForkPreviewResponse,
  StartForkPayload,
} from "@/types/fork";
import type { StartMirrorPayload, MirrorPreviewResponse } from "@/types/mirror";
import type { StartRewritePayload, RewritePreviewResponse } from "@/types/rewrite";
import type { RepoFilters } from "@/lib/repoFilters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error(
      `Cannot connect to backend at ${API_BASE}. Start it with: npm run dev:backend`
    );
  }
  return res;
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return data.error ?? `Request failed (${res.status})`;
}

export async function checkAccount(
  targetUsername: string,
  targetToken?: string
): Promise<CheckAccountResponse> {
  const res = await apiFetch("/api/v1/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetUsername,
      ...(targetToken?.trim() ? { targetToken: targetToken.trim() } : {}),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<CheckAccountResponse>;
}

export async function forkPreview(
  target: { username: string; token?: string },
  filters: RepoFilters,
  mine?: { username: string; token: string }
): Promise<ForkPreviewResponse> {
  const res = await apiFetch("/api/v1/fork/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target: {
        username: target.username,
        ...(target.token?.trim() ? { token: target.token.trim() } : {}),
      },
      filters,
      ...(mine?.token?.trim() && mine.username.trim()
        ? { mine: { username: mine.username.trim(), token: mine.token.trim() } }
        : {}),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ForkPreviewResponse>;
}

export async function startForkJob(payload: StartForkPayload): Promise<{ jobId: string }> {
  const res = await apiFetch("/api/v1/fork/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mine: {
        username: payload.mine.username,
        email: payload.mine.email,
        token: payload.mine.token.trim(),
      },
      target: {
        username: payload.target.username,
        ...(payload.target.token?.trim() ? { token: payload.target.token.trim() } : {}),
      },
      filters: payload.filters,
      ...(payload.repoNames?.length ? { repoNames: payload.repoNames } : {}),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ jobId: string }>;
}

export async function getJob(jobId: string): Promise<JobResponse> {
  const res = await apiFetch(`/api/v1/jobs/${jobId}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<JobResponse>;
}

/** @deprecated use getJob */
export const getForkJob = getJob;

export async function mirrorPreview(
  target: { username: string; token?: string },
  filters: RepoFilters,
  mine?: { username: string; token: string }
): Promise<MirrorPreviewResponse> {
  const res = await apiFetch("/api/v1/mirror/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target: {
        username: target.username,
        ...(target.token?.trim() ? { token: target.token.trim() } : {}),
      },
      filters,
      ...(mine?.token?.trim() && mine.username.trim()
        ? { mine: { username: mine.username.trim(), token: mine.token.trim() } }
        : {}),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<MirrorPreviewResponse>;
}

export async function startMirrorJob(payload: StartMirrorPayload): Promise<{ jobId: string }> {
  const res = await apiFetch("/api/v1/mirror/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mine: {
        username: payload.mine.username,
        email: payload.mine.email,
        token: payload.mine.token.trim(),
      },
      target: {
        username: payload.target.username,
        ...(payload.target.token?.trim() ? { token: payload.target.token.trim() } : {}),
      },
      filters: payload.filters,
      rewrite: payload.rewrite,
      ...(payload.repoNames?.length ? { repoNames: payload.repoNames } : {}),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ jobId: string }>;
}

export async function rewritePreview(
  mine: { username: string; token: string },
  filters: RepoFilters
): Promise<RewritePreviewResponse> {
  const res = await apiFetch("/api/v1/rewrite/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mine: {
        username: mine.username.trim(),
        token: mine.token.trim(),
      },
      filters,
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<RewritePreviewResponse>;
}

export async function startRewriteJob(payload: StartRewritePayload): Promise<{ jobId: string }> {
  const res = await apiFetch("/api/v1/rewrite/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mine: {
        username: payload.mine.username,
        email: payload.mine.email,
        token: payload.mine.token.trim(),
      },
      filters: payload.filters,
      rewrite: payload.rewrite,
      ...(payload.repoNames?.length ? { repoNames: payload.repoNames } : {}),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ jobId: string }>;
}
