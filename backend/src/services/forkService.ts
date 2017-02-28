import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Octokit } from "@octokit/rest";
import {
  assertGitAvailable,
  extractGitError,
  removeUnpushableRefs,
  runGit,
} from "../lib/gitRunner.js";
import { buildGithubRepoUrl } from "../lib/githubUrl.js";
import { parseRepoOwner } from "../lib/githubRepo.js";
import { filterRepos } from "./filterRepos.js";
import { listTargetRepos, verifyTokenOwner } from "./listTargetRepos.js";
import type { RepoFilters } from "./filterRepos.js";
import type { CheckRepo } from "../types/check.js";
import {
  clearForkCredentials,
  createForkJob,
  getForkCredentials,
  getForkJob,
  setForkCredentials,
  updateForkItem,
  updateForkJob,
} from "../store/jobs.js";
import type { JobItem } from "../types/job.js";
import { enrichReposWithCompareStatus } from "./compareRepos.js";
import { enrichReposWithFirstCommitDate } from "./enrichFirstCommit.js";

const FORK_DELAY_MS = 1200;

export interface ForkPreviewInput {
  target: { username: string; token?: string };
  filters: RepoFilters;
  mine?: { username: string; token: string };
}

export interface ForkPreviewResult {
  repos: CheckRepo[];
  warnings: string[];
  totalLoaded: number;
  totalMatched: number;
}

export async function previewFork(input: ForkPreviewInput): Promise<ForkPreviewResult> {
  const { repos, warnings } = await listTargetRepos(
    input.target.username,
    input.target.token
  );
  let filtered = filterRepos(repos, input.filters);
  const allWarnings = [...warnings];

  if (input.mine?.token && input.mine?.username) {
    const compared = await enrichReposWithCompareStatus(
      filtered,
      input.mine,
      input.target.username
    );
    filtered = compared.repos;
    allWarnings.push(...compared.warnings);
  }

  const tokenForCommits = input.mine?.token ?? input.target.token;
  const withDates = await enrichReposWithFirstCommitDate(filtered, tokenForCommits);
  filtered = withDates.repos;
  allWarnings.push(...withDates.warnings);

  return {
    repos: filtered,
    warnings: allWarnings,
    totalLoaded: repos.length,
    totalMatched: filtered.length,
  };
}

export interface StartForkJobInput {
  mine: { username: string; email: string; token: string };
  target: { username: string; token?: string };
  filters: RepoFilters;
  repoNames?: string[];
}

export async function startForkJob(input: StartForkJobInput): Promise<{ jobId: string }> {
  await verifyTokenOwner(input.mine.token, input.mine.username);

  const { repos, warnings } = await listTargetRepos(
    input.target.username,
    input.target.token
  );
  let matched = filterRepos(repos, input.filters);

  if (input.repoNames?.length) {
    const selected = new Set(input.repoNames);
    matched = matched.filter((r) => selected.has(r.name));
  }

  if (matched.length === 0) {
    throw new Error("No repositories match the selected filters.");
  }

  const items: JobItem[] = matched.map((r) => ({
    repoName: r.name,
    status: "pending",
  }));

  const job = createForkJob({
    type: "fork",
    mine: { username: input.mine.username, email: input.mine.email },
    target: { username: input.target.username.trim().replace(/^@/, "") },
    filters: input.filters,
    items,
    warnings,
  });

  setForkCredentials(job.id, {
    mineToken: input.mine.token,
    targetToken: input.target.token,
    repoMeta: new Map(matched.map((r) => [r.name, r])),
  });

  queueMicrotask(() => {
    runForkJob(job.id).catch((err) => {
      updateForkJob(job.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Fork job failed",
      });
      clearForkCredentials(job.id);
    });
  });

  return { jobId: job.id };
}

async function runForkJob(jobId: string): Promise<void> {
  const job = getForkJob(jobId);
  const creds = getForkCredentials(jobId);
  if (!job || !creds) return;

  updateForkJob(jobId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  const octokit = new Octokit({ auth: creds.mineToken });
  const target = job.target.username;

  for (const item of job.items) {
    updateForkItem(jobId, item.repoName, { status: "running" });

    const meta = creds.repoMeta.get(item.repoName);
    const sourceOwner = meta ? parseRepoOwner(meta.fullName) : target;

    try {
      const res = await octokit.repos.createFork({
        owner: sourceOwner,
        repo: item.repoName,
      });
      updateForkItem(jobId, item.repoName, {
        status: "success",
        resultUrl: res.data.html_url,
        message: "Forked successfully",
      });
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const apiMessage =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (err instanceof Error ? err.message : "Fork failed");
      const message = formatForkError(apiMessage, status, meta, target, item.repoName);

      if (status === 422) {
        const existing = await findExistingFork(
          octokit,
          job.mine.username,
          sourceOwner,
          item.repoName
        );
        updateForkItem(jobId, item.repoName, {
          status: "skipped",
          resultUrl: existing ?? undefined,
          message: existing ? "Already forked" : message,
        });
      } else if (status === 403) {
        updateForkItem(jobId, item.repoName, {
          status: "failed",
          message: "Forbidden — check token scopes (repo) and fork permissions",
        });
      } else if (status === 404 && creds.targetToken?.trim()) {
        updateForkItem(jobId, item.repoName, {
          message: "GitHub fork API unavailable — copying via git…",
        });
        const copied = await forkViaGit({
          jobId,
          mineToken: creds.mineToken,
          mineUsername: job.mine.username,
          targetToken: creds.targetToken,
          sourceOwner,
          repoName: item.repoName,
          isPrivate: meta?.visibility === "private",
        });
        updateForkItem(jobId, item.repoName, {
          status: copied.ok ? "success" : "failed",
          resultUrl: copied.resultUrl,
          message: copied.message,
        });
      } else {
        updateForkItem(jobId, item.repoName, {
          status: "failed",
          message:
            status === 404
              ? `${message} Restricted accounts need the target token (already used for preview). If this persists, use Mirror instead.`
              : message,
        });
      }
    }

    await sleep(FORK_DELAY_MS);
  }

  const finalJob = getForkJob(jobId);
  const failedCount = finalJob?.items.filter((i) => i.status === "failed").length ?? 0;
  updateForkJob(jobId, {
    status: failedCount > 0 ? "failed" : "completed",
    completedAt: new Date().toISOString(),
    error:
      failedCount > 0 ? `${failedCount} repository fork(s) failed` : undefined,
  });
  clearForkCredentials(jobId);
}

async function forkViaGit(input: {
  jobId: string;
  mineToken: string;
  mineUsername: string;
  targetToken: string;
  sourceOwner: string;
  repoName: string;
  isPrivate: boolean;
}): Promise<{ ok: boolean; resultUrl?: string; message: string }> {
  const resultUrl = `https://github.com/${input.mineUsername}/${input.repoName}`;
  const workRoot = join(tmpdir(), "git-migrate", "fork", input.jobId);
  const repoDir = join(workRoot, `${input.repoName}.git`);

  try {
    await assertGitAvailable();

    const targetOctokit = new Octokit({ auth: input.targetToken.trim() });
    try {
      await targetOctokit.repos.get({
        owner: input.sourceOwner,
        repo: input.repoName,
      });
    } catch {
      return {
        ok: false,
        message:
          "Source repo not reachable with the target token — check token scopes (repo)",
      };
    }

    await mkdir(workRoot, { recursive: true });

    const cloneUrl = buildGithubRepoUrl(
      input.sourceOwner,
      input.repoName,
      input.targetToken
    );
    await runGit(["clone", "--mirror", cloneUrl, repoDir], workRoot);

    const mineOctokit = new Octokit({ auth: input.mineToken });
    await ensureMineRepo(mineOctokit, input.mineUsername, input.repoName, input.isPrivate);

    await removeUnpushableRefs(repoDir);

    const pushUrl = buildGithubRepoUrl(
      input.mineUsername,
      input.repoName,
      input.mineToken
    );
    await runGit(["push", "--mirror", pushUrl], repoDir);

    return {
      ok: true,
      resultUrl,
      message:
        "Copied to your account via git (restricted source — not linked as a GitHub fork)",
    };
  } catch (err: unknown) {
    return { ok: false, message: extractGitError(err) };
  } finally {
    await rm(repoDir, { recursive: true, force: true }).catch(() => undefined);
    await rm(workRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function ensureMineRepo(
  octokit: Octokit,
  owner: string,
  repoName: string,
  isPrivate: boolean
): Promise<void> {
  try {
    await octokit.repos.get({ owner, repo: repoName });
    return;
  } catch (err: unknown) {
    if ((err as { status?: number }).status !== 404) throw err;
  }

  try {
    await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
      auto_init: false,
    });
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 422) return;
    throw err;
  }
}

function formatForkError(
  apiMessage: string,
  status: number | undefined,
  meta: CheckRepo | undefined,
  targetUsername: string,
  repoName: string
): string {
  if (status !== 404) return apiMessage;

  const sourceOwner = meta ? parseRepoOwner(meta.fullName) : targetUsername;
  if (meta?.visibility === "private") {
    return `${apiMessage} — private repo; your token may need access to @${sourceOwner}/${repoName}`;
  }
  if (sourceOwner.toLowerCase() !== targetUsername.toLowerCase()) {
    return `${apiMessage} — source is @${sourceOwner}/${repoName}, not @${targetUsername}/${repoName}`;
  }
  return apiMessage;
}

async function findExistingFork(
  octokit: Octokit,
  mineUsername: string,
  targetOwner: string,
  repoName: string
): Promise<string | null> {
  try {
    const res = await octokit.repos.get({ owner: mineUsername, repo: repoName });
    const repo = res.data as typeof res.data & {
      fork?: boolean;
      source?: { full_name?: string };
    };
    if (
      repo.fork &&
      repo.source?.full_name?.toLowerCase() === `${targetOwner}/${repoName}`.toLowerCase()
    ) {
      return repo.html_url;
    }
  } catch {
    /* ignore lookup errors */
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
