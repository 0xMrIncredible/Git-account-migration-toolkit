export function buildGithubRepoUrl(
  owner: string,
  repo: string,
  token?: string
): string {
  const path = `${owner}/${repo}.git`;
  if (token?.trim()) {
    return `https://x-access-token:${encodeURIComponent(token.trim())}@github.com/${path}`;
  }
  return `https://github.com/${path}`;
}
