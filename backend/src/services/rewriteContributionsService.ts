import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Octokit } from "@octokit/rest";
import { buildGithubRepoUrl } from "../lib/githubUrl.js";
import { parseRepoOwner } from "../lib/githubRepo.js";
import {
  assertGitAvailable,
  extractGitError,
  gitOutputLooksPartiallyPushed,
  removeUnpushableRefs,
  rewriteGitHistory,
  runGit,
} from "../lib/gitRunner.js";
import { enrichReposWithFirstCommitDate } from "./enrichFirstCommit.js";
import { filterRepos } from "./filterRepos.js";
import { listTargetRepos, verifyTokenOwner } from "./listTargetRepos.js";
import type { RepoFilters } from "./filterRepos.js";
import type { CheckRepo } from "../types/check.js";
import type { RewriteOptions } from "../types/job.js";
import {
  clearRewriteCredentials,
  createRewriteJob,
  getRewriteCredentials,
  getRewriteJob,
  setRewriteCredentials,
  updateRewriteItem,
  updateRewriteJob,
} from "../store/jobs.js";
import type { JobItem } from "../types/job.js";

const REWRITE_DELAY_MS = 2000;

export interface RewritePreviewInput {
  mine: { username: string; token: string };
  filters: RepoFilters;
}

export interface RewritePreviewResult {
  repos: CheckRepo[];
  warnings: string[];
  totalLoaded: number;
  totalMatched: number;
}

export async function previewRewrite(input: RewritePreviewInput): Promise<RewritePreviewResult> {
  await verifyTokenOwner(input.mine.token, input.mine.username);

  const { repos, warnings } = await listTargetRepos(
    input.mine.username,
    input.mine.token
  );
  const filtered = filterRepos(repos, input.filters);
  const enriched = await enrichReposWithFirstCommitDate(filtered, input.mine.token);

  return {
    repos: enriched.repos,
    warnings: [...warnings, ...enriched.warnings],
    totalLoaded: repos.length,
    totalMatched: filtered.length,
  };
}

export interface StartRewriteJobInput {
  mine: { username: string; email: string; token: string };
  filters: RepoFilters;
  rewrite: RewriteOptions;
  repoNames?: string[];
}

export async function startRewriteJob(input: StartRewriteJobInput): Promise<{ jobId: string }> {
  await verifyTokenOwner(input.mine.token, input.mine.username);
  await assertGitAvailable();

  if (input.rewrite.matchEmails.length === 0) {
    throw new Error("Enter at least one old email address to replace.");
  }

  const { repos, warnings } = await listTargetRepos(
    input.mine.username,
    input.mine.token
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

  const username = input.mine.username.trim().replace(/^@/, "");

  const job = createRewriteJob({
    type: "rewrite",
    mine: { username, email: input.mine.email },
    filters: input.filters,
    rewrite: input.rewrite,
    items,
    warnings: [
      ...warnings,
      "Rewriting history is destructive — all collaborators must re-clone affected repos.",
      "Ensure your new email is verified in GitHub Settings → Emails before expecting contributions to appear.",
    ],
  });

  setRewriteCredentials(job.id, {
    mineToken: input.mine.token,
    repoMeta: new Map(matched.map((r) => [r.name, r])),
  });

  queueMicrotask(() => {
    runRewriteJob(job.id).catch((err) => {
      updateRewriteJob(job.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Rewrite job failed",
      });
      clearRewriteCredentials(job.id);
    });
  });

  return { jobId: job.id };
}

async function runRewriteJob(jobId: string): Promise<void> {
  const job = getRewriteJob(jobId);
  const creds = getRewriteCredentials(jobId);
  if (!job || !creds) return;

  updateRewriteJob(jobId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  const octokit = new Octokit({ auth: creds.mineToken });
  const owner = job.mine.username;

  for (const item of job.items) {
    updateRewriteItem(jobId, item.repoName, { status: "running", message: "Cloning…" });

    const workRoot = join(tmpdir(), "git-migrate", "rewrite", jobId);
    const repoDir = join(workRoot, `${item.repoName}.git`);
    const meta = creds.repoMeta.get(item.repoName);
    const repoOwner = meta ? parseRepoOwner(meta.fullName) : owner;

    try {
      await mkdir(workRoot, { recursive: true });

      const cloneUrl = buildGithubRepoUrl(repoOwner, item.repoName, creds.mineToken);
      await runGit(["clone", "--mirror", cloneUrl, repoDir], workRoot);

      updateRewriteItem(jobId, item.repoName, { message: "Rewriting commit emails…" });
      await rewriteGitHistory(repoDir, job.rewrite);

      updateRewriteItem(jobId, item.repoName, { message: "Preparing push…" });
      await removeUnpushableRefs(repoDir);

      updateRewriteItem(jobId, item.repoName, { message: "Force pushing…" });
      const pushUrl = buildGithubRepoUrl(repoOwner, item.repoName, creds.mineToken);
      const pushResult = await pushRewritten(octokit, repoOwner, item.repoName, repoDir, pushUrl);

      const resultUrl = `https://github.com/${repoOwner}/${item.repoName}`;
      updateRewriteItem(jobId, item.repoName, {
        status: pushResult.ok ? "success" : "failed",
        resultUrl: pushResult.ok ? resultUrl : undefined,
        message: pushResult.message,
      });
    } catch (err: unknown) {
      updateRewriteItem(jobId, item.repoName, {
        status: "failed",
        message: extractGitError(err),
      });
    } finally {
      await rm(repoDir, { recursive: true, force: true }).catch(() => undefined);
    }

    await sleep(REWRITE_DELAY_MS);
  }

  const finalJob = getRewriteJob(jobId);
  const failedCount = finalJob?.items.filter((i) => i.status === "failed").length ?? 0;
  updateRewriteJob(jobId, {
    status: failedCount > 0 ? "failed" : "completed",
    completedAt: new Date().toISOString(),
    error: failedCount > 0 ? `${failedCount} repository rewrite(s) failed` : undefined,
  });
  clearRewriteCredentials(jobId);
}

async function pushRewritten(
  octokit: Octokit,
  owner: string,
  repoName: string,
  repoDir: string,
  pushUrl: string
): Promise<{ ok: boolean; message: string }> {
  try {
    await runGit(["push", "--mirror", pushUrl], repoDir);
    return { ok: true, message: "History rewritten and pushed" };
  } catch (err: unknown) {
    const output =
      err && typeof err === "object" && "gitOutput" in err
        ? String((err as { gitOutput?: string }).gitOutput ?? "")
        : "";

    if (await verifyRepoOnGithub(octokit, owner, repoName)) {
      return {
        ok: true,
        message:
          "Pushed successfully (some refs were skipped — pull request refs cannot be pushed to GitHub)",
      };
    }

    if (gitOutputLooksPartiallyPushed(output) && (await verifyRepoOnGithub(octokit, owner, repoName))) {
      return { ok: true, message: "Pushed with warnings — verify branches on GitHub" };
    }

    return { ok: false, message: extractGitError(err) };
  }
}

async function verifyRepoOnGithub(
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
