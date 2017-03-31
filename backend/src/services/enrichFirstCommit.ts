import { Octokit } from "@octokit/rest";
import { parseRepoOwner } from "../lib/githubRepo.js";
import type { CheckRepo } from "../types/check.js";

const CONCURRENCY = 8;

export async function enrichReposWithFirstCommitDate(
  repos: CheckRepo[],
  token?: string
): Promise<{ repos: CheckRepo[]; warnings: string[] }> {
  if (repos.length === 0) return { repos, warnings: [] };

  const octokit = new Octokit(token?.trim() ? { auth: token.trim() } : undefined);
  const enriched = [...repos];
  const warnings: string[] = [];
  let failed = 0;

  for (let i = 0; i < repos.length; i += CONCURRENCY) {
    const batch = repos.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (repo) => {
        const owner = parseRepoOwner(repo.fullName);
        const firstCommitAt = await fetchFirstCommitDate(octokit, owner, repo.name);
        if (firstCommitAt === null) {
          failed += 1;
        }
        const idx = enriched.findIndex((r) => r.name === repo.name);
        if (idx >= 0) {
          enriched[idx] = { ...enriched[idx], firstCommitAt };
        }
      })
    );
  }

  if (failed > 0) {
    warnings.push(
      `Could not resolve the oldest commit for ${failed} repo(s) (empty repo or API limit).`
    );
  }

  return { repos: enriched, warnings };
}

async function fetchFirstCommitDate(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string | null> {
  try {
    const res = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 1,
    });

    const commits = res.data;
    if (!commits.length) return null;

    const lastUrl = parseLastPageUrl(res.headers.link);
    if (!lastUrl) {
      return commitDate(commits[0]);
    }

    const lastRes = await octokit.request({ method: "GET", url: lastUrl });
    const lastCommits = lastRes.data as typeof commits;
    if (!lastCommits.length) return commitDate(commits[0]);

    return commitDate(lastCommits[0]);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 409 || status === 404) return null;
    return null;
  }
}

function commitDate(commit: {
  commit: { author?: { date?: string | null } | null };
}): string | null {
  return commit.commit.author?.date ?? null;
}

function parseLastPageUrl(linkHeader: string | undefined): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.trim().match(/<([^>]+)>;\s*rel="last"/);
    if (match) return match[1];
  }
  return null;
}
