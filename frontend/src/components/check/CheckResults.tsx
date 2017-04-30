import type { CheckAccountResponse, CheckRepo } from "@/types/check";
import { RepoTable } from "./RepoTable";

interface FilterSummary {
  visibility: string;
  language: string;
  excludeForks: boolean;
  excludeArchived: boolean;
}

interface CheckResultsProps {
  data: CheckAccountResponse;
  filteredRepos: CheckRepo[];
  filterSummary: FilterSummary;
}

export function CheckResults({ data, filteredRepos, filterSummary }: CheckResultsProps) {
  const { profile, summary, rateLimit, tokenInfo, warnings } = data;

  return (
    <div className="space-y-6">
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

      <section className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatarUrl}
          alt=""
          width={80}
          height={80}
          className="rounded-full"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-xl font-semibold">
            <a href={profile.htmlUrl} target="_blank" rel="noreferrer">
              @{profile.login}
            </a>
            {profile.name && (
              <span className="ml-2 font-normal text-[var(--muted)]">{profile.name}</span>
            )}
          </h3>
          {profile.bio && <p className="text-sm text-[var(--muted)]">{profile.bio}</p>}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {profile.company && (
              <div>
                <dt className="inline text-[var(--muted)]">Company: </dt>
                <dd className="inline">{profile.company}</dd>
              </div>
            )}
            {profile.location && (
              <div>
                <dt className="inline text-[var(--muted)]">Location: </dt>
                <dd className="inline">{profile.location}</dd>
              </div>
            )}
            <div>
              <dt className="inline text-[var(--muted)]">Public repos (profile): </dt>
              <dd className="inline">{profile.publicRepos}</dd>
            </div>
            <div>
              <dt className="inline text-[var(--muted)]">Followers: </dt>
              <dd className="inline">{profile.followers}</dd>
            </div>
            <div>
              <dt className="inline text-[var(--muted)]">Following: </dt>
              <dd className="inline">{profile.following}</dd>
            </div>
            <div>
              <dt className="inline text-[var(--muted)]">Joined: </dt>
              <dd className="inline">{formatDate(profile.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Repos loaded" value={summary.totalRepos} />
        <StatCard label="Public" value={summary.publicCount} />
        <StatCard label="Private" value={summary.privateCount} />
        <StatCard label="Forks" value={summary.forkCount} />
        <StatCard label="Archived" value={summary.archivedCount} />
        <StatCard label="Filtered preview" value={filteredRepos.length} highlight />
        <StatCard label="API rate remaining" value={rateLimit.remaining} sub={`/ ${rateLimit.limit}`} />
        <StatCard
          label="Rate reset"
          value={formatTime(rateLimit.resetAt)}
          sub="UTC"
        />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <p>
          <span className="text-[var(--muted)]">Token: </span>
          {tokenInfo.message ?? "—"}
          {tokenInfo.ownerLogin && (
            <span className="text-[var(--muted)]"> (owner: @{tokenInfo.ownerLogin})</span>
          )}
        </p>
      </section>

      {summary.languages.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h4 className="mb-4 font-semibold">Languages (all loaded repos)</h4>
          <ul className="space-y-2">
            {summary.languages.map((lang) => (
              <li key={lang.language} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0">{lang.language}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${lang.percentage}%` }}
                  />
                </div>
                <span className="w-16 text-right text-[var(--muted)]">
                  {lang.count} ({lang.percentage}%)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RepoTable repos={filteredRepos} filterSummary={filterSummary} />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-[var(--accent)]/50 bg-[var(--accent)]/10"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {value}
        {sub && <span className="text-sm font-normal text-[var(--muted)]"> {sub}</span>}
      </p>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
