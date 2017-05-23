"use client";

import { useCallback, useMemo, useState } from "react";
import { RepoTable } from "@/components/check/RepoTable";
import { JobProgress } from "@/components/shared/JobProgress";
import { mirrorPreview, startMirrorJob } from "@/lib/api";
import {
  DEFAULT_REPO_FILTERS,
  LANGUAGES,
  type RepoFilters,
  type VisibilityFilter,
} from "@/lib/repoFilters";
import type { CheckRepo } from "@/types/check";

type RewriteMode = "all" | "matchEmails";

export function MirrorWizard() {
  const [mineUsername, setMineUsername] = useState("");
  const [mineEmail, setMineEmail] = useState("");
  const [mineToken, setMineToken] = useState("");
  const [targetUsername, setTargetUsername] = useState("");
  const [targetToken, setTargetToken] = useState("");

  const [authorName, setAuthorName] = useState("");
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("all");
  const [matchEmailsRaw, setMatchEmailsRaw] = useState("");

  const [filters, setFilters] = useState<RepoFilters>(DEFAULT_REPO_FILTERS);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previewRepos, setPreviewRepos] = useState<CheckRepo[]>([]);
  const [previewStats, setPreviewStats] = useState<{ loaded: number; matched: number } | null>(
    null
  );

  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [jobId, setJobId] = useState<string | null>(null);

  const effectiveAuthorName = authorName.trim() || mineUsername.trim();

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

  function parseMatchEmails(raw: string): string[] {
    return raw
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
  }

  async function handlePreview() {
    setError(null);
    setPreviewLoading(true);
    setJobId(null);
    try {
      const result = await mirrorPreview(
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

  async function handleMirror() {
    if (selectedRepos.size === 0) {
      setError("Select at least one repository to mirror.");
      return;
    }

    if (rewriteMode === "matchEmails" && parseMatchEmails(matchEmailsRaw).length === 0) {
      setError("Enter at least one email to match when using match-by-email mode.");
      return;
    }

    setError(null);
    setMirrorLoading(true);
    try {
      const { jobId: id } = await startMirrorJob({
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
        rewrite: {
          authorName: effectiveAuthorName,
          authorEmail: mineEmail,
          mode: rewriteMode,
          matchEmails: parseMatchEmails(matchEmailsRaw),
        },
        repoNames: [...selectedRepos],
      });
      setJobId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start mirror job");
    } finally {
      setMirrorLoading(false);
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
          <h2 className="text-xl font-semibold">Mirror & rewrite history</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Clone target repos, rewrite commit author info to yours, and force-push to your
            account. Requires Git installed locally. Creates new repos under your account if
            missing.
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

        <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
          <legend className="px-1 text-sm font-medium">Rewrite author</legend>
          <label className="block space-y-1.5">
            <span className="text-sm">
              Author name <span className="text-[var(--muted)]">(defaults to your username)</span>
            </span>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={mineUsername || "Your display name"}
              className="field-input"
            />
          </label>
          <div className="space-y-2">
            <span className="text-sm">Rewrite mode</span>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="rewriteMode"
                  checked={rewriteMode === "all"}
                  onChange={() => setRewriteMode("all")}
                />
                All commits
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="rewriteMode"
                  checked={rewriteMode === "matchEmails"}
                  onChange={() => setRewriteMode("matchEmails")}
                />
                Only matching emails
              </label>
            </div>
          </div>
          {rewriteMode === "matchEmails" && (
            <label className="block space-y-1.5">
              <span className="text-sm">Emails to replace</span>
              <textarea
                value={matchEmailsRaw}
                onChange={(e) => setMatchEmailsRaw(e.target.value)}
                rows={3}
                placeholder="old@example.com&#10;other@example.com"
                className="field-input resize-y"
              />
              <span className="text-xs text-[var(--muted)]">One per line or comma-separated</span>
            </label>
          )}
          <p className="text-xs text-[var(--warning)]">
            Rewriting history changes all commit SHAs. Push uses --mirror (force). Use only for
            repos you have rights to migrate.
          </p>
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
              </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              Author: {effectiveAuthorName} &lt;{mineEmail}&gt;
            </p>
            <button
              type="button"
              disabled={mirrorLoading || selectedRepos.size === 0}
              onClick={handleMirror}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[var(--accent-hover)]"
            >
              {mirrorLoading ? "Starting…" : `Mirror selected (${selectedRepos.size})`}
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

      {jobId && <JobProgress jobId={jobId} title="Mirror job" />}
    </div>
  );
}
