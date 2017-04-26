export const LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C",
  "C++",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Shell",
  "HTML",
  "CSS",
  "Vue",
  "Dart",
] as const;

export type VisibilityFilter = "all" | "public" | "private";

export interface RepoFilters {
  visibility: VisibilityFilter;
  languages: string[];
  excludeForks: boolean;
  excludeArchived: boolean;
}

export const DEFAULT_REPO_FILTERS: RepoFilters = {
  visibility: "all",
  languages: [],
  excludeForks: false,
  excludeArchived: false,
};
