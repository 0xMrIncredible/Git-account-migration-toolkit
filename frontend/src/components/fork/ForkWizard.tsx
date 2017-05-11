"use client";

import { useCallback, useMemo, useState } from "react";
import { RepoTable } from "@/components/check/RepoTable";
import { ForkJobProgress } from "./ForkJobProgress";
import { forkPreview, startForkJob } from "@/lib/api";
import {
  DEFAULT_REPO_FILTERS,
  LANGUAGES,
  type RepoFilters,
  type VisibilityFilter,
} from "@/lib/repoFilters";
import type { CheckRepo } from "@/types/check";

export function ForkWizard() {
  const [mineUsername, setMineUsername] = useState("");
  const [mineEmail, setMineEmail] = useState("");
  const [mineToken, setMineToken] = useState("");
  const [targetUsername, setTargetUsername] = useState("");
  const [targetToken, setTargetToken] = useState("");

  const [filters, setFilters] = useState<RepoFilters>(DEFAULT_REPO_FILTERS);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [forkLoading, setForkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previewRepos, setPreviewRepos] = useState<CheckRepo[]>([]);
  const [previewStats, setPreviewStats] = useState<{ loaded: number; matched: number } | null>(
    null
  );

  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [jobId, setJobId] = useState<string | null>(null);

  const filterSummary = useMemo(
    () => ({
      visibility: filters.visibility,
      language: filters.languages.length ? filters.languages.join(", ") : "Any",
      excludeForks: filters.excludeForks,
      excludeArchived: filters.excludeArchived,
    }),
    [filters]
  );

  const canPreview =
    mineUsername.trim() && mineEmail.trim() && mineToken.trim() && targetUsername.trim();

  async function handlePreview() {
    setError(null);
    setPreviewLoading(true);
    setJobId(null);
    try {
      const result = await forkPreview(
        { username: targetUsername, token: targetToken || undefined },
        filters,
        { username: mineUsername, token: mineToken }
      );
      setPreviewRepos(result.repos);
      setWarnings(result.warnings);
      setPreviewStats({ loaded: result.totalLoaded, matched: result.totalMatched });
      setSelectedRepos(new Set(result.repos.map((r) => r.name)));
    } catch (err) {
      setPreviewRepos([]);
      setPreviewStats(null);
      setSelectedRepos(new Set());
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleFork() {
    if (selectedRepos.size === 0) {
      setError("Select at least one repository to fork.");
      return;
    }

    setError(null);
    setForkLoading(true);
    try {
      const { jobId: id } = await startForkJob({
        mine: {
          username: mineUsername,
          email: mineEmail,
          token: mineToken,
        },
        target: {
          username: targetUsername,
          token: targetToken || undefined,
        },
        filters,
        repoNames: [...selectedRepos],
      });
      setJobId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start fork job");
    } finally {
      setForkLoading(false);
    }
  }

  const toggleRepo = useCallback((name: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const togglePage = useCallback((names: string[], selected: boolean) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      for (const name of names) {
        if (selected) next.add(name);
        else next.delete(name);
      }
      return next;
    });
  }, []);

  function toggleLanguage(lang: string) {
    setFilters((prev) => {
      const has = prev.languages.includes(lang);
      return {
        ...prev,
        languages: has
          ? prev.languages.filter((l) => l !== lang)
          : [...prev.languages, lang],
      };
    });
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handlePreview();
        }}
        className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <div>
          <h2 className="text-xl font-semibold">Fork repositories</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Fork repos from a target account into yours. No account linking — enter credentials per
            action. Your token needs <code className="text-xs">repo</code> scope.
          </p>
        </div>

        <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
          <legend className="px-1 text-sm font-medium">Your account</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm">GitHub username</span>
              <input
                required
                value={mineUsername}
                onChange={(e) => setMineUsername(e.target.value)}
                placeholder="your-username"
                className="field-input"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm">Email</span>
              <input
                required
                type="email"
                value={mineEmail}
                onChange={(e) => setMineEmail(e.target.value)}
                placeholder="you@example.com"
                className="field-input"
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm">Token</span>
            <input
              required
              type="password"
              value={mineToken}
              onChange={(e) => setMineToken(e.target.value)}
              placeholder="ghp_… — your PAT with repo scope"
              className="field-input"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
          <legend className="px-1 text-sm font-medium">Target account</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm">GitHub username</span>
              <input
                required
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                placeholder="target-username"
                className="field-input"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm">
                Token <span className="text-[var(--muted)]">(optional)</span>
              </span>
              <input
                type="password"
                value={targetToken}
                onChange={(e) => setTargetToken(e.target.value)}
                placeholder="Target PAT — private repos & flagged/restricted accounts"
                className="field-input"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-[var(--border)] pt-5">
          <legend className="text-sm font-medium">Origin filters</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm">Visibility</span>
              <select
                value={filters.visibility}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    visibility: e.target.value as VisibilityFilter,
                  }))
                }
                className="field-input"
              >
                <option value="all">Public & private</option>
                <option value="public">Public only</option>
                <option value="private">Private only</option>
              </select>
            </label>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm">Languages</span>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => {
                  const active = filters.languages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)]"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
                {filters.languages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, languages: [] }))}
                    className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
                  >
                    Clear
                  </button>
                )}
              </div>
              <span className="text-xs text-[var(--muted)]">
                {filters.languages.length === 0
                  ? "Any language"
                  : `${filters.languages.length} selected`}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.excludeForks}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, excludeForks: e.target.checked }))
                }
              />
              Exclude forks
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.excludeArchived}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, excludeArchived: e.target.checked }))
                }
              />
              Exclude archived
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={previewLoading || !canPreview}
          className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-[var(--accent-hover)]"
        >
          {previewLoading ? "Loading preview…" : "Load preview"}
        </button>

        {error && (
          <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </form>

      {warnings.length > 0 && (
        <ul className="space-y-2">
          {warnings.map((w) => (
            <li
              key={w}
              className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-sm"
            >
              {w}
            </li>
          ))}
        </ul>
      )}

      {previewStats && (
        <p className="text-sm text-[var(--muted)]">
          Loaded {previewStats.loaded} repos — {previewStats.matched} match your filters.
        </p>
      )}

      {previewRepos.length > 0 && !jobId && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={forkLoading || selectedRepos.size === 0}
              onClick={handleFork}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[var(--accent-hover)]"
            >
              {forkLoading ? "Starting…" : `Fork selected (${selectedRepos.size})`}
            </button>
          </div>

          <RepoTable
            repos={previewRepos}
            filterSummary={filterSummary}
            selectable
            showCompareStatus
            selectedRepos={selectedRepos}
            onToggleRepo={toggleRepo}
            onTogglePage={togglePage}
          />
        </div>
      )}

      {jobId && <ForkJobProgress jobId={jobId} />}
    </div>
  );
}
