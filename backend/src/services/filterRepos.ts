import type { CheckRepo } from "../types/check.js";

export type VisibilityFilter = "all" | "public" | "private";

export interface RepoFilters {
  visibility: VisibilityFilter;
  languages: string[];
  excludeForks: boolean;
  excludeArchived: boolean;
}

export function filterRepos(repos: CheckRepo[], filters: RepoFilters): CheckRepo[] {
  return repos.filter((repo) => {
    if (filters.visibility === "public" && repo.visibility !== "public") return false;
    if (filters.visibility === "private" && repo.visibility !== "private") return false;
    if (filters.languages.length > 0 && (!repo.language || !filters.languages.includes(repo.language))) {
      return false;
    }
    if (filters.excludeForks && repo.isFork) return false;
    if (filters.excludeArchived && repo.isArchived) return false;
    return true;
  });
}
