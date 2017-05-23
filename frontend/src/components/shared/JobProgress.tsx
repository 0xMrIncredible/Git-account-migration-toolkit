"use client";

import { useEffect, useMemo, useState } from "react";
import { getJob } from "@/lib/api";
import type { JobResponse } from "@/types/job";

const PAGE_SIZES = [10, 25, 50, 100] as const;

interface JobProgressProps {
  jobId: string;
  title: string;
  onDone?: (job: JobResponse) => void;
}

export function JobProgress({ jobId, title, onDone }: JobProgressProps) {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const data = await getJob(jobId);
        if (!active) return;
        setJob(data);

        if (data.status === "completed" || data.status === "failed") {
          onDone?.(data);
          return;
        }
        timer = setTimeout(poll, 1500);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load job");
      }
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, onDone]);

  useEffect(() => {
    setPage(1);
  }, [jobId, pageSize]);

  const totalItems = job?.items.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    if (!job) return [];
    const start = (page - 1) * pageSize;
    return job.items.slice(start, start + pageSize);
  }, [job, page, pageSize]);

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  if (error) {
    return (
      <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
        {error}
      </p>
    );
  }

  if (!job) {
    return <p className="text-sm text-[var(--muted)]">Loading job status…</p>;
  }

  const done = job.status === "completed" || job.status === "failed";

  return (
    <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <MiniStat label="Success" value={job.summary.success} tone="success" />
        <MiniStat label="Skipped" value={job.summary.skipped} tone="neutral" />
        <MiniStat label="Failed" value={job.summary.failed} tone="danger" />
        <MiniStat label="Running" value={job.summary.running} tone="neutral" />
        <MiniStat label="Pending" value={job.summary.pending} tone="neutral" />
      </div>

      {job.error && done && (
        <p className="text-sm text-[var(--warning)]">{job.error}</p>
      )}

      {!done && (
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{
              width: `${Math.round(
                ((job.summary.success + job.summary.skipped + job.summary.failed) /
                  job.summary.total) *
                  100
              )}%`,
            }}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-3 py-2">
          <p className="text-xs text-[var(--muted)]">
            {totalItems === 0
              ? "No repositories"
              : `Showing ${rangeStart}–${rangeEnd} of ${totalItems}`}
          </p>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)]"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[var(--bg)] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Repository</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-[var(--muted)]">
                    No repositories in this job.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const url = item.resultUrl ?? item.forkUrl;
                  return (
                    <tr key={item.repoName} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">{item.repoName}</td>
                      <td className="px-3 py-2">
                        <ItemStatusBadge status={item.status} />
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            {item.message ?? url}
                          </a>
                        ) : (
                          item.message ?? "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-end border-t border-[var(--border)] px-3 py-2">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: JobResponse["status"] }) {
  const styles: Record<JobResponse["status"], string> = {
    pending: "bg-[var(--bg)] text-[var(--muted)]",
    running: "bg-[var(--accent)]/20 text-[var(--accent)]",
    completed: "bg-[var(--success)]/20 text-[var(--success)]",
    failed: "bg-[var(--danger)]/20 text-[var(--danger)]",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

function ItemStatusBadge({ status }: { status: JobResponse["items"][number]["status"] }) {
  const styles: Record<string, string> = {
    pending: "text-[var(--muted)]",
    running: "text-[var(--accent)]",
    success: "text-[var(--success)]",
    skipped: "text-[var(--warning)]",
    failed: "text-[var(--danger)]",
  };
  return <span className={`text-xs capitalize ${styles[status]}`}>{status}</span>;
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "danger"
        ? "text-[var(--danger)]"
        : "text-[var(--text)]";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
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
