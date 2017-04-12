import Link from "next/link";

const features = [
  {
    num: 1,
    title: "Check GitHub account",
    desc: "Enter a username and optionally a token to inspect profile and repositories.",
    href: "/check",
    ready: true,
  },
  {
    num: 2,
    title: "Fork repositories",
    desc: "Fork a target user's repos into your account with visibility and language filters.",
    href: "/fork",
    ready: true,
  },
  {
    num: 3,
    title: "Mirror & rewrite history",
    desc: "Clone, rewrite commit author info, and push to your account.",
    href: "/mirror",
    ready: true,
  },
  {
    num: 4,
    title: "Fix contributions",
    desc: "Rewrite old commit emails across your repos after changing your GitHub email.",
    href: "/rewrite",
    ready: true,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Git account migration toolkit</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Four separate tools. No GitHub account linking — you provide usernames and tokens per
          action. Tokens are sent only to your local backend and are not stored.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <article
            key={f.num}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <span className="text-xs font-medium text-[var(--muted)]">Feature {f.num}</span>
            <h2 className="mt-1 text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{f.desc}</p>
            {f.ready ? (
              <Link
                href={f.href}
                className="mt-4 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[var(--accent-hover)]"
              >
                Open
              </Link>
            ) : (
              <span className="mt-4 inline-block rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]">
                Coming soon
              </span>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
