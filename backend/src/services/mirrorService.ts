import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Octokit } from "@octokit/rest";
import { buildGithubRepoUrl } from "../lib/githubUrl.js";
import { parseRepoOwner } from "../lib/githubRepo.js";
import { assertGitAvailable, extractGitError, gitOutputLooksPartiallyPushed, removeUnpushableRefs, rewriteGitHistory, runGit } from "../lib/gitRunner.js";
import { filterRepos } from "./filterRepos.js";
import { listTargetRepos, verifyTokenOwner } from "./listTargetRepos.js";
import type { RepoFilters } from "./filterRepos.js";
import type { CheckRepo } from "../types/check.js";
import type { RewriteOptions } from "../types/job.js";
import {
  clearMirrorCredentials,
  createMirrorJob,
  getMirrorCredentials,
  getMirrorJob,
  setMirrorCredentials,
  updateMirrorItem,
  updateMirrorJob,
} from "../store/jobs.js";
import type { JobItem } from "../types/job.js";
import { enrichReposWithCompareStatus } from "./compareRepos.js";
import { enrichReposWithFirstCommitDate } from "./enrichFirstCommit.js";

const MIRROR_DELAY_MS = 2000;

export interface MirrorPreviewInput {
  target: { username: string; token?: string };
  filters: RepoFilters;
  mine?: { username: string; token: string };
}

export interface MirrorPreviewResult {
  repos: CheckRepo[];
  warnings: string[];
  totalLoaded: number;
  totalMatched: number;
}

export async function previewMirror(input: MirrorPreviewInput): Promise<MirrorPreviewResult> {
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

export interface StartMirrorJobInput {
  mine: { username: string; email: string; token: string };
  target: { username: string; token?: string };
  filters: RepoFilters;
  rewrite: RewriteOptions;
  repoNames?: string[];
}

export async function startMirrorJob(input: StartMirrorJobInput): Promise<{ jobId: string }> {
  await verifyTokenOwner(input.mine.token, input.mine.username);
  await assertGitAvailable();

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

  const job = createMirrorJob({
    type: "mirror",
    mine: { username: input.mine.username, email: input.mine.email },
    target: { username: input.target.username.trim().replace(/^@/, "") },
    filters: input.filters,
    rewrite: input.rewrite,
    items,
    warnings,
  });

  setMirrorCredentials(job.id, {
    mineToken: input.mine.token,
    targetToken: input.target.token,
    repoMeta: new Map(matched.map((r) => [r.name, r])),
  });

  queueMicrotask(() => {
    runMirrorJob(job.id).catch((err) => {
      updateMirrorJob(job.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Mirror job failed",
      });
      clearMirrorCredentials(job.id);
    });
  });

  return { jobId: job.id };
}

async function runMirrorJob(jobId: string): Promise<void> {
  const job = getMirrorJob(jobId);
  const creds = getMirrorCredentials(jobId);
  if (!job || !creds) return;

  updateMirrorJob(jobId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  const octokit = new Octokit({ auth: creds.mineToken });
  const target = job.target.username;
  const mine = job.mine.username;

  for (const item of job.items) {
    updateMirrorItem(jobId, item.repoName, { status: "running", message: "Cloning…" });

    const workRoot = join(tmpdir(), "git-migrate", jobId);
    const repoDir = join(workRoot, `${item.repoName}.git`);
    const meta = creds.repoMeta.get(item.repoName);
    const cloneToken =
      creds.targetToken ?? (meta?.visibility === "private" ? creds.mineToken : undefined);

    try {
      await mkdir(workRoot, { recursive: true });

      const sourceOwner = meta ? parseRepoOwner(meta.fullName) : target;
      const cloneUrl = buildGithubRepoUrl(sourceOwner, item.repoName, cloneToken);
      await runGit(["clone", "--mirror", cloneUrl, repoDir], workRoot);

      updateMirrorItem(jobId, item.repoName, { message: "Rewriting history…" });
      await rewriteGitHistory(repoDir, job.rewrite);

      updateMirrorItem(jobId, item.repoName, { message: "Creating destination repo…" });
      await ensureDestinationRepo(octokit, mine, item.repoName, meta?.visibility === "private");

      updateMirrorItem(jobId, item.repoName, { message: "Preparing push…" });
      await removeUnpushableRefs(repoDir);

      updateMirrorItem(jobId, item.repoName, { message: "Pushing…" });
      const pushUrl = buildGithubRepoUrl(mine, item.repoName, creds.mineToken);
      const pushResult = await pushMirror(octokit, mine, item.repoName, repoDir, pushUrl);

      const resultUrl = `https://github.com/${mine}/${item.repoName}`;
      updateMirrorItem(jobId, item.repoName, {
        status: pushResult.ok ? "success" : "failed",
        resultUrl: pushResult.ok ? resultUrl : undefined,
        message: pushResult.message,
      });
    } catch (err: unknown) {
      updateMirrorItem(jobId, item.repoName, {
        status: "failed",
        message: extractGitError(err),
      });
    } finally {
      await rm(repoDir, { recursive: true, force: true }).catch(() => undefined);
    }

    await sleep(MIRROR_DELAY_MS);
  }

  const finalJob = getMirrorJob(jobId);
  const failedCount = finalJob?.items.filter((i) => i.status === "failed").length ?? 0;
  updateMirrorJob(jobId, {
    status: failedCount > 0 ? "failed" : "completed",
    completedAt: new Date().toISOString(),
    error: failedCount > 0 ? `${failedCount} repository mirror(s) failed` : undefined,
  });
  clearMirrorCredentials(jobId);
}

async function pushMirror(
  octokit: Octokit,
  owner: string,
  repoName: string,
  repoDir: string,
  pushUrl: string
): Promise<{ ok: boolean; message: string }> {
  try {
    await runGit(["push", "--mirror", pushUrl], repoDir);
    return { ok: true, message: "Mirrored with rewritten history" };
  } catch (err: unknown) {
    const output =
      err && typeof err === "object" && "gitOutput" in err
        ? String((err as { gitOutput?: string }).gitOutput ?? "")
        : "";

    const verified = await verifyMirrorOnGithub(octokit, owner, repoName);
    if (verified) {
      return {
        ok: true,
        message:
          "Mirrored successfully (some refs were skipped — pull request refs cannot be pushed to GitHub)",
      };
    }

    if (gitOutputLooksPartiallyPushed(output)) {
      const recheck = await verifyMirrorOnGithub(octokit, owner, repoName);
      if (recheck) {
        return {
          ok: true,
          message: "Mirrored with warnings — verify branches on GitHub",
        };
      }
    }

    return { ok: false, message: extractGitError(err) };
  }
}

async function verifyMirrorOnGithub(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    if ((repoData.size ?? 0) > 0) return true;

    const branches = await octokit.repos.listBranches({ owner, repo, per_page: 1 });
    return branches.data.length > 0;
  } catch {
    return false;
  }
}

async function ensureDestinationRepo(
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
    const status = (err as { status?: number }).status;
    if (status === 422) return;
    throw err;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
