import type { CheckAccountResponse, LanguageStat } from "../types/check.js";
import { parseRateLimit } from "../lib/githubRepo.js";
import { enrichReposWithFirstCommitDate } from "./enrichFirstCommit.js";
import { listTargetRepos, resolveTargetProfile, verifyTokenOwner } from "./listTargetRepos.js";

function buildLanguageStats(
  repos: Awaited<ReturnType<typeof listTargetRepos>>["repos"]
): LanguageStat[] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return [...counts.entries()]
    .map(([language, count]) => ({
      language,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function checkAccount(
  targetUsername: string,
  targetToken?: string
): Promise<CheckAccountResponse> {
  const username = targetUsername.trim().replace(/^@/, "");
  const warnings: string[] = [];

  let profile;
  try {
    profile = await resolveTargetProfile(targetUsername, targetToken);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    const message = err instanceof Error ? err.message : "Unknown error";
    if (status === 404 || message.includes("not found")) {
      throw new Error(
        targetToken?.trim()
          ? `GitHub user "${username}" is not visible publicly. Ensure the token belongs to @${username}.`
          : `GitHub user "${username}" was not found.`
      );
    }
    throw err;
  }

  if (profile.profileHidden) {
    warnings.push(
      `Public profile for @${username} is hidden or restricted. Data loaded using the target token.`
    );
  }

  const { repos: allRepos, warnings: listWarnings } = await listTargetRepos(
    targetUsername,
    targetToken
  );
  warnings.push(...listWarnings);

  let tokenInfo: CheckAccountResponse["tokenInfo"] = {
    provided: false,
    valid: false,
    ownerLogin: null,
    canSeePrivateRepos: false,
    message: null,
  };

  const rateLimit = parseRateLimit(profile.headers);

  if (targetToken?.trim()) {
    try {
      const { login } = await verifyTokenOwner(targetToken, username);
      tokenInfo = {
        provided: true,
        valid: true,
        ownerLogin: login,
        canSeePrivateRepos: login.toLowerCase() === username.toLowerCase(),
        message:
          profile.profileHidden || login.toLowerCase() === username.toLowerCase()
            ? "Token belongs to this user — all accessible repos included."
            : "Token is valid but does not belong to the target user.",
      };
    } catch {
      tokenInfo = {
        provided: true,
        valid: false,
        ownerLogin: null,
        canSeePrivateRepos: false,
        message: "Token is invalid or expired.",
      };
      warnings.push("The provided token could not be validated.");
    }
  } else {
    tokenInfo.message = "No token provided — only public repositories are listed.";
    if (profile.publicRepos === 0 && !profile.profileHidden) {
      warnings.push("This user has no public repositories.");
    }
    if (profile.profileHidden) {
      warnings.push("This account requires a target token to list repositories.");
    }
  }

  const enriched = await enrichReposWithFirstCommitDate(allRepos, targetToken);
  warnings.push(...enriched.warnings);
  const repos = enriched.repos;

  const publicCount = repos.filter((r) => r.visibility === "public").length;
  const privateCount = repos.filter((r) => r.visibility === "private").length;

  return {
    profile: {
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      company: profile.company,
      location: profile.location,
      blog: profile.blog,
      publicRepos: profile.publicRepos,
      followers: profile.followers,
      following: profile.following,
      createdAt: profile.createdAt,
      htmlUrl: profile.htmlUrl,
    },
    repos,
    summary: {
      totalRepos: repos.length,
      publicCount,
      privateCount,
      forkCount: repos.filter((r) => r.isFork).length,
      archivedCount: repos.filter((r) => r.isArchived).length,
      languages: buildLanguageStats(repos),
    },
    rateLimit,
    tokenInfo,
    warnings,
  };
}
