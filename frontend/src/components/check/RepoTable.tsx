"use client";

import { useEffect, useMemo, useState } from "react";
import type { CheckRepo, CompareStatus } from "@/types/check";

type SortColumn =
  | "name"
  | "compareStatus"
  | "language"
  | "visibility"
  | "stargazersCount"
  | "forksCount"
  | "createdAt"
  | "updatedAt";

type SortDirection = "asc" | "desc";

interface ColumnFilters {
  name: string;
  compareStatus: "all" | CompareStatus;
  language: string;
  visibility: "all" | "public" | "private";
  starsMin: string;
  forksMin: string;
  firstCommitFrom: string;
  firstCommitTo: string;
  commitFrom: string;
  commitTo: string;
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

const EMPTY_FILTERS: ColumnFilters = {
  name: "",
  compareStatus: "all",
  language: "",
  visibility: "all",
  starsMin: "",
  forksMin: "",
  firstCommitFrom: "",
  firstCommitTo: "",
  commitFrom: "",
  commitTo: "",
};

interface RepoTableProps {
  repos: CheckRepo[];
  filterSummary: {
    visibility: string;
    language: string;
    excludeForks: boolean;
    excludeArchived: boolean;
  };
  selectable?: boolean;
  selectedRepos?: Set<string>;
  onToggleRepo?: (repoName: string) => void;
  onTogglePage?: (repoNames: string[], selected: boolean) => void;
  showCompareStatus?: boolean;
}

export function RepoTable({
  repos,
  filterSummary,
  selectable = false,
  selectedRepos,
  onToggleRepo,
  onTogglePage,
  showCompareStatus = false,
}: RepoTableProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const languageOptions = useMemo(() => {
    const langs = new Set<string>();
    for (const repo of repos) {
      if (repo.language) langs.add(repo.language);
    }
    return [...langs].sort((a, b) => a.localeCompare(b));
  }, [repos]);

  const processedRepos = useMemo(() => {
    let list = [...repos];

    const nameQ = columnFilters.name.trim().toLowerCase();
    if (nameQ) {
      list = list.filter((r) => r.name.toLowerCase().includes(nameQ));
    }

    if (showCompareStatus && columnFilters.compareStatus !== "all") {
      list = list.filter((r) => r.compareStatus === columnFilters.compareStatus);
    }

    if (columnFilters.language) {
      list = list.filter((r) => r.language === columnFilters.language);
    }

    if (columnFilters.visibility !== "all") {
      list = list.filter((r) => r.visibility === columnFilters.visibility);
    }

    const starsMin = parseOptionalInt(columnFilters.starsMin);
    if (starsMin !== null) {
      list = list.filter((r) => r.stargazersCount >= starsMin);
    }

    const forksMin = parseOptionalInt(columnFilters.forksMin);
    if (forksMin !== null) {
      list = list.filter((r) => r.forksCount >= forksMin);
    }

    if (columnFilters.firstCommitFrom) {
      const after = startOfDay(columnFilters.firstCommitFrom).getTime();
      list = list.filter((r) => repoFirstCommitTime(r) >= after);
    }

    if (columnFilters.firstCommitTo) {
      const before = endOfDay(columnFilters.firstCommitTo).getTime();
      list = list.filter((r) => repoFirstCommitTime(r) <= before);
    }

    if (columnFilters.commitFrom) {
      const after = startOfDay(columnFilters.commitFrom).getTime();
      list = list.filter((r) => repoCommitTime(r) >= after);
    }

    if (columnFilters.commitTo) {
      const before = endOfDay(columnFilters.commitTo).getTime();
      list = list.filter((r) => repoCommitTime(r) <= before);
    }

    list.sort((a, b) => compareRepos(a, b, sortColumn, sortDirection));
    return list;
  }, [repos, columnFilters, sortColumn, sortDirection, showCompareStatus]);

  const totalPages = Math.max(1, Math.ceil(processedRepos.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [columnFilters, sortColumn, sortDirection, pageSize, repos]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRepos = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedRepos.slice(start, start + pageSize);
  }, [processedRepos, page, pageSize]);

  const pageRepoNames = useMemo(() => pageRepos.map((r) => r.name), [pageRepos]);
  const allPageSelected =
    selectable &&
    pageRepoNames.length > 0 &&
    pageRepoNames.every((name) => selectedRepos?.has(name));
  const somePageSelected =
    selectable && pageRepoNames.some((name) => selectedRepos?.has(name));

  function handleTogglePageSelect() {
    if (!onTogglePage) return;
    onTogglePage(pageRepoNames, !allPageSelected);
  }

  function handleSelectAll() {
    if (!onTogglePage) return;
    onTogglePage(repos.map((r) => r.name), true);
  }

  function handleUnselectAll() {
    if (!onTogglePage || !selectedRepos?.size) return;
    onTogglePage([...selectedRepos], false);
  }

  const selectedCount = selectedRepos?.size ?? 0;

  const rangeStart = processedRepos.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, processedRepos.length);

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection(column === "updatedAt" || column === "createdAt" || column === "stargazersCount" || column === "forksCount" ? "desc" : "asc");
    }
  }

  function updateFilter<K extends keyof ColumnFilters>(key: K, value: ColumnFilters[K]) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearColumnFilters() {
    setColumnFilters(EMPTY_FILTERS);
  }

  const hasColumnFilters = Object.entries(columnFilters).some(([key, val]) => {
    if (key === "visibility" || key === "compareStatus") return val !== "all";
    return String(val).trim() !== "";
  });

  const columnCount =
    (selectable ? 1 : 0) + (showCompareStatus ? 1 : 0) + 7;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-semibold">Repositories</h4>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Form filters: visibility={filterSummary.visibility}, language={filterSummary.language}
            {filterSummary.excludeForks ? ", no forks" : ""}
            {filterSummary.excludeArchived ? ", no archived" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {selectable && (
            <>
              <span className="text-xs text-[var(--muted)]">
                {selectedCount} of {repos.length} selected
              </span>
              <button type="button" onClick={handleSelectAll} className="btn-secondary">
                Select all
              </button>
              <button
                type="button"
                onClick={handleUnselectAll}
                disabled={selectedCount === 0}
                className="btn-secondary disabled:opacity-40"
              >
                Unselect all
              </button>
            </>
          )}
          {hasColumnFilters && (
            <button
              type="button"
              onClick={clearColumnFilters}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              Clear column filters
            </button>
          )}
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="repo-table-wrap">
        <table className="repo-table text-left text-sm">
          <colgroup>
            {selectable && <col style={{ width: "2.5rem" }} />}
            <col style={{ width: showCompareStatus ? (selectable ? "22%" : "24%") : selectable ? "26%" : "28%" }} />
            {showCompareStatus && <col style={{ width: "11%" }} />}
            <col style={{ width: showCompareStatus ? "10%" : selectable ? "11%" : "12%" }} />
            <col style={{ width: showCompareStatus ? "8%" : selectable ? "9%" : "10%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: showCompareStatus ? "13%" : "15%" }} />
            <col style={{ width: showCompareStatus ? "13%" : "15%" }} />
          </colgroup>
          <thead className="bg-[var(--bg)]">
            <tr className="text-[var(--muted)]">
              {selectable && (
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = Boolean(somePageSelected && !allPageSelected);
                    }}
                    onChange={handleTogglePageSelect}
                    title="Select all on this page"
                    aria-label="Select all on this page"
                  />
                </th>
              )}
              <SortHeader label="Name" column="name" active={sortColumn} direction={sortDirection} onSort={toggleSort} />
              {showCompareStatus && (
                <SortHeader
                  label="Compare status"
                  column="compareStatus"
                  active={sortColumn}
                  direction={sortDirection}
                  onSort={toggleSort}
                  title="Your account vs target repository"
                />
              )}
              <SortHeader label="Language" column="language" active={sortColumn} direction={sortDirection} onSort={toggleSort} />
              <SortHeader label="Visibility" column="visibility" active={sortColumn} direction={sortDirection} onSort={toggleSort} />
              <SortHeader label="Stars" column="stargazersCount" active={sortColumn} direction={sortDirection} onSort={toggleSort} />
              <SortHeader label="Forks" column="forksCount" active={sortColumn} direction={sortDirection} onSort={toggleSort} />
              <SortHeader
                label="First commit"
                column="createdAt"
                active={sortColumn}
                direction={sortDirection}
                onSort={toggleSort}
                title="Oldest commit on the default branch"
              />
              <SortHeader
                label="Last commit"
                column="updatedAt"
                active={sortColumn}
                direction={sortDirection}
                onSort={toggleSort}
                title="Last push date"
              />
            </tr>
            <tr className="border-t border-[var(--border)]">
              {selectable && <th className="px-2 py-2" />}
              <th className="px-2 py-2">
                <input
                  type="text"
                  placeholder="Filter name…"
                  value={columnFilters.name}
                  onChange={(e) => updateFilter("name", e.target.value)}
                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-normal text-[var(--text)]"
                />
              </th>
              {showCompareStatus && (
                <th className="px-2 py-2">
                  <select
                    value={columnFilters.compareStatus}
                    onChange={(e) =>
                      updateFilter("compareStatus", e.target.value as ColumnFilters["compareStatus"])
                    }
                    className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-normal text-[var(--text)]"
                  >
                    <option value="all">All</option>
                    <option value="missing">Missing</option>
                    <option value="forked">Forked</option>
                    <option value="exists">Exists</option>
                  </select>
                </th>
              )}
              <th className="px-2 py-2">
                <select
                  value={columnFilters.language}
                  onChange={(e) => updateFilter("language", e.target.value)}
                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-normal text-[var(--text)]"
                >
                  <option value="">All</option>
                  {languageOptions.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2 py-2">
                <select
                  value={columnFilters.visibility}
                  onChange={(e) => updateFilter("visibility", e.target.value as ColumnFilters["visibility"])}
                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-normal text-[var(--text)]"
                >
                  <option value="all">All</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </th>
              <th className="px-2 py-2">
                <input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={columnFilters.starsMin}
                  onChange={(e) => updateFilter("starsMin", e.target.value)}
                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-normal text-[var(--text)]"
                />
              </th>
              <th className="px-2 py-2">
                <input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={columnFilters.forksMin}
                  onChange={(e) => updateFilter("forksMin", e.target.value)}
                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-normal text-[var(--text)]"
                />
              </th>
              <th className="px-2 py-2">
                <DateRangeFilter
                  from={columnFilters.firstCommitFrom}
                  to={columnFilters.firstCommitTo}
                  onFromChange={(v) => updateFilter("firstCommitFrom", v)}
                  onToChange={(v) => updateFilter("firstCommitTo", v)}
                  fromTitle="First commit on or after"
                  toTitle="First commit on or before"
                />
              </th>
              <th className="px-2 py-2">
                <DateRangeFilter
                  from={columnFilters.commitFrom}
                  to={columnFilters.commitTo}
                  onFromChange={(v) => updateFilter("commitFrom", v)}
                  onToChange={(v) => updateFilter("commitTo", v)}
                  fromTitle="Last commit on or after"
                  toTitle="Last commit on or before"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRepos.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-8 text-center text-[var(--muted)]">
                  No repositories match the current filters.
                </td>
              </tr>
            ) : (
              pageRepos.map((repo) => (
                <tr key={repo.fullName} className="border-t border-[var(--border)] hover:bg-[var(--bg)]/40">
                  {selectable && (
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedRepos?.has(repo.name) ?? false}
                        onChange={() => onToggleRepo?.(repo.name)}
                        aria-label={`Select ${repo.name}`}
                      />
                    </td>
                  )}
                  <td className="px-2 py-2 align-middle">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="cell-name-link"
                        title={repo.name}
                      >
                        {repo.name}
                      </a>
                      {repo.isFork && (
                        <span className="shrink-0 text-xs text-[var(--muted)]">fork</span>
                      )}
                      {repo.isArchived && (
                        <span className="shrink-0 text-xs text-[var(--warning)]">archived</span>
                      )}
                    </div>
                  </td>
                  {showCompareStatus && (
                    <td className="px-2 py-2 align-middle">
                      <CompareStatusBadge
                        status={repo.compareStatus}
                        compareUrl={repo.compareUrl}
                        detail={repo.compareDetail}
                      />
                    </td>
                  )}
                  <td className="cell-truncate px-2 py-2 text-[var(--muted)]" title={repo.language ?? undefined}>
                    {repo.language ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    <Badge
                      label={repo.visibility}
                      tone={repo.visibility === "private" ? "warning" : "neutral"}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">{repo.stargazersCount}</td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">{repo.forksCount}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-[var(--muted)]">
                    {formatOptionalDate(repoFirstCommitTimeIso(repo))}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-[var(--muted)]">
                    {formatDate(repo.pushedAt ?? repo.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--muted)]">
          Showing {rangeStart}–{rangeEnd} of {processedRepos.length}
          {processedRepos.length !== repos.length && (
            <span> (from {repos.length} after form filters)</span>
          )}
        </p>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </section>
  );
}

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  fromTitle,
  toTitle,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromTitle: string;
  toTitle: string;
}) {
  return (
    <div className="date-filter flex flex-col gap-1">
      <label className="text-[10px] font-normal leading-none text-[var(--muted)]">
        From
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="mt-0.5 w-full min-w-0 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs font-normal text-[var(--text)]"
          title={fromTitle}
        />
      </label>
      <label className="text-[10px] font-normal leading-none text-[var(--muted)]">
        To
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="mt-0.5 w-full min-w-0 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs font-normal text-[var(--text)]"
          title={toTitle}
        />
      </label>
    </div>
  );
}

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
  title,
}: {
  label: string;
  column: SortColumn;
  active: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  title?: string;
}) {
  const isActive = active === column;
  return (
    <th className="whitespace-nowrap px-2 py-2 font-medium">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-[var(--text)]"
        title={title ?? `Sort by ${label}`}
      >
        {label}
        <span className={`text-xs ${isActive ? "text-[var(--accent)]" : "opacity-40"}`}>
          {isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = buildPageList(page, totalPages);

  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <PageButton disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Prev
      </PageButton>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-[var(--muted)]">
            …
          </span>
        ) : (
          <PageButton key={p} active={p === page} onClick={() => onPageChange(p)}>
            {p}
          </PageButton>
        )
      )}
      <PageButton disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </PageButton>
    </nav>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-w-[2rem] rounded px-2 py-1 text-xs disabled:opacity-40 ${
        active
          ? "bg-[var(--accent)] text-white"
          : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function CompareStatusBadge({
  status,
  compareUrl,
  detail,
}: {
  status?: CompareStatus;
  compareUrl?: string;
  detail?: string;
}) {
  if (!status) {
    return <span className="text-xs text-[var(--muted)]">—</span>;
  }

  const label =
    status === "missing" ? "Missing" : status === "forked" ? "Forked" : "Exists";

  const tone =
    status === "missing"
      ? "success"
      : status === "forked"
        ? "accent"
        : "warning";

  const badge = (
    <span
      className={`inline rounded px-1.5 py-0.5 text-xs whitespace-nowrap ${
        tone === "success"
          ? "bg-emerald-500/15 text-emerald-400"
          : tone === "accent"
            ? "bg-[var(--accent)]/20 text-[var(--accent)]"
            : "bg-[var(--warning)]/20 text-[var(--warning)]"
      }`}
      title={detail}
    >
      {label}
    </span>
  );

  if (compareUrl && status !== "missing") {
    return (
      <a href={compareUrl} target="_blank" rel="noreferrer" title={detail} className="hover:opacity-80">
        {badge}
      </a>
    );
  }

  return badge;
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "warning";
}) {
  return (
    <span
      className={`inline rounded px-1.5 py-0.5 text-xs capitalize ${
        tone === "warning"
          ? "bg-[var(--warning)]/20 text-[var(--warning)]"
          : "bg-[var(--bg)] text-[var(--muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function compareStatusOrder(status?: CompareStatus): string {
  if (!status) return "z";
  return status;
}

function compareRepos(
  a: CheckRepo,
  b: CheckRepo,
  column: SortColumn,
  direction: SortDirection
): number {
  let cmp = 0;

  switch (column) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "compareStatus":
      cmp = compareStatusOrder(a.compareStatus).localeCompare(compareStatusOrder(b.compareStatus));
      break;
    case "language":
      cmp = (a.language ?? "").localeCompare(b.language ?? "");
      break;
    case "visibility":
      cmp = a.visibility.localeCompare(b.visibility);
      break;
    case "stargazersCount":
      cmp = a.stargazersCount - b.stargazersCount;
      break;
    case "forksCount":
      cmp = a.forksCount - b.forksCount;
      break;
    case "createdAt":
      cmp = repoFirstCommitTime(a) - repoFirstCommitTime(b);
      break;
    case "updatedAt":
      cmp = repoCommitTime(a) - repoCommitTime(b);
      break;
  }

  return direction === "asc" ? cmp : -cmp;
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "…")[] = [1];

  if (current > 3) pages.push("…");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("…");

  pages.push(total);
  return pages;
}

function repoFirstCommitTimeIso(repo: CheckRepo): string | null {
  return repo.firstCommitAt ?? repo.createdAt ?? null;
}

function repoFirstCommitTime(repo: CheckRepo): number {
  const iso = repoFirstCommitTimeIso(repo);
  return iso ? new Date(iso).getTime() : 0;
}

function formatOptionalDate(iso: string | null): string {
  if (!iso) return "—";
  return formatDate(iso);
}

function repoCommitTime(repo: CheckRepo): number {
  return new Date(repo.pushedAt ?? repo.updatedAt).getTime();
}

function startOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
