import { Octokit } from "@octokit/rest";
import type { CheckRepo, CompareStatus } from "../types/check.js";
import { verifyTokenOwner } from "./listTargetRepos.js";

interface MineRepoMeta {
  htmlUrl: string;
  isFork: boolean;
  parentFullName: string | null;
  sourceFullName: string | null;
}

export async function enrichReposWithCompareStatus(
  repos: CheckRepo[],
  mine: { username: string; token: string },
  targetUsername: string
): Promise<{ repos: CheckRepo[]; warnings: string[] }> {
  const warnings: string[] = [];
  await verifyTokenOwner(mine.token, mine.username);

  const target = targetUsername.trim().replace(/^@/, "");
  const index = await loadMineRepoIndex(mine.token);

  const enriched = repos.map((repo) => {
    const status = resolveCompareStatus(target, repo.name, index);
    const meta = index.get(repo.name.toLowerCase());
    return {
      ...repo,
      compareStatus: status,
      compareUrl: meta?.htmlUrl,
      compareDetail: compareDetail(status, meta, target, repo.name),
    };
  });

  return { repos: enriched, warnings };
}

async function loadMineRepoIndex(token: string): Promise<Map<string, MineRepoMeta>> {
  const octokit = new Octokit({ auth: token.trim() });
  const index = new Map<string, MineRepoMeta>();

  for await (const response of octokit.paginate.iterator(
    octokit.repos.listForAuthenticatedUser,
    { per_page: 100, affiliation: "owner" }
  )) {
    for (const repo of response.data) {
      const extended = repo as typeof repo & {
        parent?: { full_name?: string } | null;
        source?: { full_name?: string } | null;
      };
      index.set(repo.name.toLowerCase(), {
        htmlUrl: repo.html_url,
        isFork: repo.fork ?? false,
        parentFullName: extended.parent?.full_name ?? null,
        sourceFullName: extended.source?.full_name ?? null,
      });
    }
  }

  return index;
}

function resolveCompareStatus(
  targetUsername: string,
  repoName: string,
  index: Map<string, MineRepoMeta>
): CompareStatus {
  const meta = index.get(repoName.toLowerCase());
  if (!meta) return "missing";

  const expected = `${targetUsername}/${repoName}`.toLowerCase();
  if (meta.isFork && isForkOfTarget(meta, expected)) return "forked";

  return "exists";
}

function isForkOfTarget(meta: MineRepoMeta, expectedFullName: string): boolean {
  return (
    meta.parentFullName?.toLowerCase() === expectedFullName ||
    meta.sourceFullName?.toLowerCase() === expectedFullName
  );
}

function compareDetail(
  status: CompareStatus,
  meta: MineRepoMeta | undefined,
  targetUsername: string,
  repoName: string
): string {
  switch (status) {
    case "missing":
      return "Not on your account";
    case "forked":
      return `Forked from @${targetUsername}/${repoName}`;
    case "exists":
      if (meta?.isFork) return "Same name — fork of another repo";
      return "Same name on your account";
    default:
      return "";
  }
}
