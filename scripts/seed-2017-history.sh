#!/usr/bin/env bash
# Backdate GitMigrate repo history (2017-01 .. 2017-06) with a fixed author.
# Usage: bash scripts/seed-2017-history.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GIT_AUTHOR_NAME="0xMrIncredible"
export GIT_AUTHOR_EMAIL="stevenpearson22@gmail.com"
export GIT_COMMITTER_NAME="0xMrIncredible"
export GIT_COMMITTER_EMAIL="stevenpearson22@gmail.com"

commit_at() {
  local date="$1"
  local message="$2"
  shift 2
  export GIT_AUTHOR_DATE="$date"
  export GIT_COMMITTER_DATE="$date"
  git add "$@"
  git commit -m "$message"
}

if git rev-parse HEAD >/dev/null 2>&1; then
  echo "Repository already has commits. Aborting to avoid rewriting history."
  exit 1
fi

# Ensure we are on main/master
if ! git rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then
  git checkout -b main 2>/dev/null || git checkout -b master
fi

# --- January 2017 ---
commit_at "2017-01-08 10:15:00 -0500" "chore: add readme and gitignore" \
  .gitignore README.md

commit_at "2017-01-22 14:40:00 -0500" "chore: npm workspace root" \
  package.json

commit_at "2017-01-29 16:05:00 -0500" "feat(backend): scaffold api package" \
  backend/package.json backend/tsconfig.json backend/.env.example

# --- February 2017 ---
commit_at "2017-02-07 11:20:00 -0500" "feat(backend): fastify entry and github helpers" \
  backend/src/index.ts backend/src/lib/githubRepo.ts backend/src/lib/githubUrl.ts backend/src/types/check.ts

commit_at "2017-02-19 09:50:00 -0500" "feat(backend): check account route" \
  backend/src/routes/check.ts backend/src/services/checkAccount.ts backend/src/services/listTargetRepos.ts backend/src/services/filterRepos.ts

commit_at "2017-02-28 18:30:00 -0500" "feat(backend): fork preview and jobs" \
  backend/src/routes/fork.ts backend/src/services/forkService.ts backend/src/services/compareRepos.ts backend/src/routes/jobs.ts backend/src/store/jobs.ts backend/src/types/job.ts

# --- March 2017 ---
commit_at "2017-03-10 13:10:00 -0400" "feat(backend): mirror service and git runner" \
  backend/src/routes/mirror.ts backend/src/services/mirrorService.ts backend/src/lib/gitRunner.ts

commit_at "2017-03-24 15:45:00 -0400" "feat(backend): rewrite contributions api" \
  backend/src/routes/rewrite.ts backend/src/services/rewriteContributionsService.ts

commit_at "2017-03-31 10:00:00 -0400" "feat(backend): enrich first commit dates" \
  backend/src/services/enrichFirstCommit.ts

# --- April 2017 ---
commit_at "2017-04-12 12:25:00 -0400" "feat(frontend): next.js app shell" \
  frontend/package.json frontend/tsconfig.json frontend/next.config.ts frontend/postcss.config.mjs frontend/.env.example frontend/next-env.d.ts \
  frontend/src/app/layout.tsx frontend/src/app/page.tsx frontend/src/app/globals.css

commit_at "2017-04-26 17:15:00 -0400" "feat(frontend): api client and shared types" \
  frontend/src/lib/api.ts frontend/src/lib/filterRepos.ts frontend/src/lib/repoFilters.ts \
  frontend/src/types/check.ts frontend/src/types/job.ts frontend/src/types/fork.ts frontend/src/types/mirror.ts frontend/src/types/rewrite.ts

commit_at "2017-04-30 19:40:00 -0400" "feat(frontend): check account ui" \
  frontend/src/app/check/page.tsx frontend/src/components/check/CheckAccountForm.tsx frontend/src/components/check/CheckResults.tsx frontend/src/components/check/RepoTable.tsx

# --- May 2017 ---
commit_at "2017-05-11 09:35:00 -0400" "feat(frontend): fork wizard" \
  frontend/src/app/fork/page.tsx frontend/src/components/fork/ForkWizard.tsx frontend/src/components/fork/ForkJobProgress.tsx

commit_at "2017-05-23 14:55:00 -0400" "feat(frontend): mirror wizard and job progress" \
  frontend/src/app/mirror/page.tsx frontend/src/components/mirror/MirrorWizard.tsx frontend/src/components/shared/JobProgress.tsx

commit_at "2017-05-30 11:10:00 -0400" "feat(frontend): rewrite contributions wizard" \
  frontend/src/app/rewrite/page.tsx frontend/src/components/rewrite/RewriteWizard.tsx

# --- June 2017 ---
commit_at "2017-06-09 16:20:00 -0400" "chore: lock workspace dependencies" \
  package-lock.json

commit_at "2017-06-20 13:05:00 -0400" "chore: seed script for backdated history" \
  scripts/seed-2017-history.sh

echo ""
echo "Done. $(git rev-list --count HEAD) commits on $(git branch --show-current)."
echo "Author: $(git log -1 --format='%an <%ae>')"
echo "First:  $(git log --reverse -1 --format='%ai %s')"
echo "Last:   $(git log -1 --format='%ai %s')"
