import { Octokit } from "@octokit/rest";
import { mapGithubRepo } from "../lib/githubRepo.js";
import type { CheckRepo } from "../types/check.js";

export interface ListTargetReposResult {
  repos: CheckRepo[];
  warnings: string[];
  profileHidden?: boolean;
}

export async function listTargetRepos(
  targetUsername: string,
  targetToken?: string
): Promise<ListTargetReposResult> {
  const warnings: string[] = [];
  const username = targetUsername.trim().replace(/^@/, "");

  if (targetToken?.trim()) {
    const tokenResult = await listReposViaTargetToken(username, targetToken.trim());
    if (tokenResult) {
      if (tokenResult.profileHidden) {
        warnings.push(
          `Public profile for @${username} is not visible (restricted or flagged). Repositories loaded using the target token.`
        );
      }
      return {
        repos: tokenResult.repos,
        warnings: [...warnings, ...tokenResult.warnings],
        profileHidden: tokenResult.profileHidden,
      };
    }
  }

  const publicOctokit = new Octokit();
  try {
    await publicOctokit.users.getByUsername({ username });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      if (targetToken?.trim()) {
        throw new Error(
          `GitHub user "${username}" is not visible publicly. Provide the target account's personal access token — it must belong to @${username}.`
        );
      }
      throw new Error(`GitHub user "${username}" was not found.`);
    }
    throw err;
  }

  const publicRepos: CheckRepo[] = [];
  for await (const response of publicOctokit.paginate.iterator(
    publicOctokit.repos.listForUser,
    { username, per_page: 100 }
  )) {
    for (const repo of response.data) {
      publicRepos.push(mapGithubRepo(repo, "public"));
    }
  }

  if (!targetToken?.trim() && publicRepos.length === 0) {
    warnings.push("No token provided — only public repositories are listed.");
  }

  return {
    repos: publicRepos.sort((a, b) => a.name.localeCompare(b.name)),
    warnings,
    profileHidden: false,
  };
}

async function listReposViaTargetToken(
  username: string,
  token: string
): Promise<{ repos: CheckRepo[]; warnings: string[]; profileHidden: boolean } | null> {
  const authOctokit = new Octokit({ auth: token });
  let authUser;
  try {
    const authRes = await authOctokit.users.getAuthenticated();
    authUser = authRes.data;
  } catch {
    return null;
  }

  if (authUser.login.toLowerCase() !== username.toLowerCase()) {
    return {
      repos: [],
      warnings: [
        `Target token belongs to @${authUser.login}, not @${username}. Cannot load @${username}'s repos with this token.`,
      ],
      profileHidden: false,
    };
  }

  const repos: CheckRepo[] = [];
  for await (const response of authOctokit.paginate.iterator(
    authOctokit.repos.listForAuthenticatedUser,
    { per_page: 100, affiliation: "owner" }
  )) {
    for (const repo of response.data) {
      repos.push(mapGithubRepo(repo, repo.private ? "private" : "public"));
    }
  }

  let profileHidden = false;
  try {
    await new Octokit().users.getByUsername({ username });
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) {
      profileHidden = true;
    }
  }

  return {
    repos: repos.sort((a, b) => a.name.localeCompare(b.name)),
    warnings: [],
    profileHidden,
  };
}

export async function resolveTargetProfile(
  targetUsername: string,
  targetToken?: string
): Promise<{
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
  profileHidden: boolean;
  headers: Record<string, unknown>;
}> {
  const username = targetUsername.trim().replace(/^@/, "");
  const publicOctokit = new Octokit();

  try {
    const res = await publicOctokit.users.getByUsername({ username });
    return {
      login: res.data.login,
      name: res.data.name,
      avatarUrl: res.data.avatar_url,
      bio: res.data.bio,
      company: res.data.company,
      location: res.data.location,
      blog: res.data.blog,
      publicRepos: res.data.public_repos,
      followers: res.data.followers,
      following: res.data.following,
      createdAt: res.data.created_at,
      htmlUrl: res.data.html_url,
      profileHidden: false,
      headers: res.headers as unknown as Record<string, unknown>,
    };
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status !== 404 || !targetToken?.trim()) throw err;

    const authOctokit = new Octokit({ auth: targetToken.trim() });
    const authRes = await authOctokit.users.getAuthenticated();
    const user = authRes.data;

    if (user.login.toLowerCase() !== username.toLowerCase()) {
      throw new Error(`GitHub user "${username}" was not found.`);
    }

    return {
      login: user.login,
      name: user.name ?? null,
      avatarUrl: user.avatar_url,
      bio: user.bio ?? null,
      company: user.company ?? null,
      location: user.location ?? null,
      blog: user.blog ?? null,
      publicRepos: user.public_repos ?? 0,
      followers: 0,
      following: 0,
      createdAt: user.created_at ?? new Date(0).toISOString(),
      htmlUrl: user.html_url ?? `https://github.com/${user.login}`,
      profileHidden: true,
      headers: authRes.headers as unknown as Record<string, unknown>,
    };
  }
}

export async function verifyTokenOwner(
  token: string,
  expectedUsername: string
): Promise<{ login: string }> {
  const octokit = new Octokit({ auth: token.trim() });
  try {
    const res = await octokit.users.getAuthenticated();
    const login = res.data.login;
    if (login.toLowerCase() !== expectedUsername.trim().replace(/^@/, "").toLowerCase()) {
      throw new Error(
        `Token belongs to @${login}, not @${expectedUsername}. Use a token for your account.`
      );
    }
    return { login };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Token belongs to")) throw err;
    throw new Error("Your token is invalid or expired.");
  }
}
