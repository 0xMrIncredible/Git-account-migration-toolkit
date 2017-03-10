import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 64 * 1024 * 1024;

export async function assertGitAvailable(): Promise<void> {
  try {
    await runGit(["--version"], process.cwd());
  } catch {
    throw new Error("Git is not installed or not available in PATH.");
  }
}

export async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    });
    return `${stdout}${stderr}`.trim();
  } catch (err: unknown) {
    const execErr = err as { code?: number; stdout?: string; stderr?: string; message?: string };
    const gitError = new Error(execErr.message ?? "Git command failed") as Error & {
      code?: number;
      stdout?: string;
      stderr?: string;
      gitOutput?: string;
    };
    gitError.code = execErr.code;
    gitError.stdout = execErr.stdout;
    gitError.stderr = execErr.stderr;
    gitError.gitOutput = `${execErr.stdout ?? ""}${execErr.stderr ?? ""}`.trim();
    throw gitError;
  }
}

/** GitHub mirror clones include PR refs that cannot be pushed back to GitHub. */
export async function removeUnpushableRefs(repoDir: string): Promise<void> {
  for (const prefix of ["refs/pull/", "refs/changes/"]) {
    try {
      const refs = await runGit(["for-each-ref", "--format=%(refname)", prefix], repoDir);
      for (const ref of refs.split("\n").filter(Boolean)) {
        await runGit(["update-ref", "-d", ref], repoDir);
      }
    } catch {
      /* prefix may not exist */
    }
  }
}

export function extractGitError(err: unknown): string {
  const output =
    err && typeof err === "object" && "gitOutput" in err
      ? String((err as { gitOutput?: string }).gitOutput ?? "")
      : err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr?: string }).stderr ?? "")
        : "";

  const errorLine = output
    .split("\n")
    .map((l) => l.trim())
    .find(
      (l) =>
        l &&
        !l.startsWith("To https://") &&
        !l.startsWith("To http://") &&
        !/^\*\s*\[/.test(l) &&
        (l.includes("error:") ||
          l.includes("fatal:") ||
          l.includes("rejected") ||
          l.includes("denied") ||
          l.includes("! [") ||
          l.includes("remote:"))
    );

  if (errorLine) return errorLine.slice(0, 240);

  const firstMeaningful = output
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("To https://") && !l.startsWith("To http://"));

  if (firstMeaningful) return firstMeaningful.slice(0, 240);
  if (err instanceof Error) return err.message.slice(0, 240);
  return "Mirror failed";
}

export function gitOutputLooksPartiallyPushed(output: string): boolean {
  return (
    /\*\s*\[new branch\]/i.test(output) ||
    /\*\s*\[new tag\]/i.test(output) ||
    /\*\s*\[updated branch\]/i.test(output) ||
    /^\s*\*\s+\[.*->.*\]/m.test(output)
  );
}

export function buildEnvFilter(rewrite: {
  authorName: string;
  authorEmail: string;
  mode: "all" | "matchEmails";
  matchEmails: string[];
}): string {
  const name = shellEscape(rewrite.authorName);
  const email = shellEscape(rewrite.authorEmail);
  const assign = [
    `GIT_AUTHOR_NAME="${name}"`,
    `GIT_AUTHOR_EMAIL="${email}"`,
    `GIT_COMMITTER_NAME="${name}"`,
    `GIT_COMMITTER_EMAIL="${email}"`,
  ]
    .map((v) => `export ${v}`)
    .join("; ");

  if (rewrite.mode === "all") {
    return assign;
  }

  const emails = rewrite.matchEmails.map((e) => shellEscape(e.trim())).filter(Boolean);
  if (emails.length === 0) {
    return assign;
  }

  const checks = emails
    .flatMap((e) => [
      `[ "$GIT_AUTHOR_EMAIL" = "${e}" ]`,
      `[ "$GIT_COMMITTER_EMAIL" = "${e}" ]`,
    ])
    .join(" || ");

  return `if ${checks}; then ${assign}; fi`;
}

function shellEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$");
}

export async function rewriteGitHistory(
  repoDir: string,
  rewrite: Parameters<typeof buildEnvFilter>[0]
): Promise<void> {
  const envFilter = buildEnvFilter(rewrite);

  await runGit(
    [
      "-c",
      "filter.branch.smudge=",
      "-c",
      "filter.branch.clean=",
      "filter-branch",
      "-f",
      "--env-filter",
      envFilter,
      "--tag-name-filter",
      "cat",
      "--",
      "--branches",
      "--tags",
    ],
    repoDir
  );

  try {
    const refs = await runGit(
      ["for-each-ref", "--format=%(refname)", "refs/original/"],
      repoDir
    );
    for (const ref of refs.split("\n").filter(Boolean)) {
      await runGit(["update-ref", "-d", ref], repoDir);
    }
  } catch {
    /* backup refs may not exist */
  }

  await runGit(["reflog", "expire", "--expire=now", "--all"], repoDir);
  await runGit(["gc", "--prune=now", "--aggressive"], repoDir);
}
