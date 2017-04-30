"use client";

import { useMemo, useState } from "react";
import { checkAccount } from "@/lib/api";
import type { CheckAccountResponse, CheckRepo } from "@/types/check";
import { CheckResults } from "./CheckResults";

const LANGUAGES = [
  "Any",
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
];

type VisibilityFilter = "all" | "public" | "private";

export function CheckAccountForm() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [language, setLanguage] = useState("Any");
  const [excludeForks, setExcludeForks] = useState(false);
  const [excludeArchived, setExcludeArchived] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckAccountResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await checkAccount(username, token || undefined);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const filteredRepos = useMemo(() => {
    if (!result) return [];
    return filterRepos(result.repos, {
      visibility,
      language,
      excludeForks,
      excludeArchived,
    });
  }, [result, visibility, language, excludeForks, excludeArchived]);

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <div>
          <h2 className="text-xl font-semibold">Check GitHub account</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            No account connection. Enter the username to inspect. Add a token only if you need
            private repos (must be that user&apos;s personal access token).
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">GitHub username</span>
          <input
            type="text"
            required
            autoComplete="off"
            placeholder="octocat"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Token <span className="font-normal text-[var(--muted)]">(optional)</span>
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder="ghp_… — target user's PAT for private repos"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
          <span className="text-xs text-[var(--muted)]">
            Not stored. Sent only to your backend for this request.
          </span>
        </label>

        <fieldset className="grid gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
          <legend className="sr-only">Preview filters</legend>
          <p className="sm:col-span-2 text-sm text-[var(--muted)]">
            Filters below apply to the results preview (client-side). Fork and mirror wizards will
            use the same options later.
          </p>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Visibility</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as VisibilityFilter)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            >
              <option value="all">Public & private</option>
              <option value="public">Public only</option>
              <option value="private">Private only</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={excludeForks}
              onChange={(e) => setExcludeForks(e.target.checked)}
              className="rounded"
            />
            Exclude forks
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={excludeArchived}
              onChange={(e) => setExcludeArchived(e.target.checked)}
              className="rounded"
            />
            Exclude archived
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-[var(--accent-hover)]"
        >
          {loading ? "Checking…" : "Check account"}
        </button>

        {error && (
          <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </form>

      {result && (
        <CheckResults
          data={result}
          filteredRepos={filteredRepos}
          filterSummary={{
            visibility,
            language,
            excludeForks,
            excludeArchived,
          }}
        />
      )}
    </div>
  );
}

function filterRepos(
  repos: CheckRepo[],
  opts: {
    visibility: VisibilityFilter;
    language: string;
    excludeForks: boolean;
    excludeArchived: boolean;
  }
): CheckRepo[] {
  return repos.filter((repo) => {
    if (opts.visibility === "public" && repo.visibility !== "public") return false;
    if (opts.visibility === "private" && repo.visibility !== "private") return false;
    if (opts.language !== "Any" && repo.language !== opts.language) return false;
    if (opts.excludeForks && repo.isFork) return false;
    if (opts.excludeArchived && repo.isArchived) return false;
    return true;
  });
}
