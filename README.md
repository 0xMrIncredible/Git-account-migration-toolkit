# GitMigrate

Git account toolkit with separate features — no GitHub OAuth or linked accounts. You enter usernames and tokens per action.

| Feature | Status |
|---------|--------|
| 1. Check GitHub account | ✅ Implemented |
| 2. Fork repositories | ✅ Implemented |
| 3. Mirror & rewrite history | ✅ Implemented |
| 4. Fix contributions (rewrite emails) | ✅ Implemented |

## Stack

- **Backend**: TypeScript, Fastify, Octokit
- **Frontend**: Next.js 15, React 19, Tailwind CSS 4

## Prerequisites

- Node.js 20+
- npm 10+ (workspaces)

## Setup

```bash
cd E:/Project/Git-Work/Migrate
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

## Run (development)

Terminal 1 — backend:

```bash
npm run dev:backend
```

Terminal 2 — frontend:

```bash
npm run dev:frontend
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Feature 1: http://localhost:3000/check
- Feature 2: http://localhost:3000/fork
- Feature 3: http://localhost:3000/mirror
- Feature 4: http://localhost:3000/rewrite

## Feature 1 — Check account

**Inputs**

- GitHub username (required)
- Token (optional) — to include **private** repos, use the **target user's** personal access token with `repo` scope. Tokens are not stored; they are only sent to your local backend for that request.

**Outputs**

- Profile summary
- Repository list (public, or public + private with valid token)
- Language breakdown
- API rate limit info
- Client-side preview filters (visibility, language, exclude forks/archived)

## Feature 2 — Fork repositories

**Your account**

- GitHub username, email, token (required — `repo` scope)

**Target account**

- GitHub username (required)
- Token (optional — target's PAT to include private repos)

**Flow**

1. Set origin filters (visibility, languages, exclude forks/archived)
2. Load preview → select repos
3. Fork selected → job runs with live progress

**Notes**

- Already-forked repos are marked **skipped**
- Tokens are not stored after the job finishes
- ~1.2s delay between forks to respect rate limits

## Feature 3 — Mirror & rewrite history

**Your account**

- GitHub username, email, token (required — `repo` scope)

**Target account**

- GitHub username (required)
- Token (optional — target's PAT to clone private repos)

**Rewrite options**

- Author name (defaults to your username)
- **All commits** or **only commits matching** given email(s)

**Flow**

1. Set filters → load preview → select repos
2. Clone mirror → rewrite history → create repo if needed → force push
3. Live job progress per repo

**Requirements**

- [Git](https://git-scm.com/) must be installed and available in PATH (Git for Windows on Windows)

## Feature 4 — Fix contributions (rewrite emails)

Use this when you changed your GitHub email and contributions disappeared from your profile. GitHub attributes contributions by the **email in each commit** — old commits still use the removed address.

**Your account**

- GitHub username (required)
- New email (required) — must be **verified** in GitHub Settings → Emails
- Token (required — `repo` scope)
- Old email(s) to replace (required) — include every address you previously used, plus GitHub noreply emails if you committed with those

**Optional**

- Author name (defaults to your username)
- Repository filters (visibility, language, exclude forks/archived)

**Flow**

1. Load preview of your repos → select which to rewrite
2. Clone mirror → rewrite commits matching old emails → force push back to the same repo
3. Live job progress per repo

**Requirements**

- Git installed (same as Mirror)
- Destructive: all commit SHAs change; collaborators must re-clone

**After the job**

- Wait a few hours for GitHub to recalculate your contribution graph
- Commits only count if the new email is verified on your account

## API

```http
POST /api/v1/check
Content-Type: application/json

{
  "targetUsername": "octocat",
  "targetToken": "ghp_..." 
}
```

```http
POST /api/v1/fork/preview
POST /api/v1/fork/jobs
POST /api/v1/mirror/preview
POST /api/v1/mirror/jobs
POST /api/v1/rewrite/preview
POST /api/v1/rewrite/jobs
GET /api/v1/jobs/:id
```

```http
GET /health
```

## Security

- Run locally; do not expose the backend to the public internet without hardening.
- Never commit tokens or `.env` files.
- Private repos for another user are only visible when using **their** PAT (or a token with explicit access).

## Project layout

```
Migrate/
├── backend/          # Fastify API
├── frontend/         # Next.js UI
├── package.json      # npm workspaces
└── README.md
```
