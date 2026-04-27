# Luna

Luna is a repository intelligence dashboard that combines GitHub data, AI-assisted summaries, and architecture analysis to help teams understand codebases faster.

With Luna, you can:
- Browse repository activity and contributor trends
- Generate plain-language commit and project summaries
- Visualize code structure and module dependencies
- Ask repository-aware questions through an AI chat interface
- Save frequently used repositories as favorites

## Demo Features

### Overview
- Project description generated from recent commit history
- Recent activity and project direction summaries
- Recent commits list with basic commit type tagging

### Data
- Core repository KPIs (commits, contributors, pull requests)
- Time-series activity charts for commit volume and code changes
- Selectable time ranges (7, 30, 90 days)

### Structure
- File and code metrics (total files, code files, complexity, code smells)
- High-level architecture view grouped by modules
- File-level dependency exploration and import relationships

### Luna AI Chat
- Repository-context chat powered by vector search + OpenAI
- Two response modes:
  - `basic`: non-technical explanations
  - `expert`: technical explanations with code-focused detail

### Settings
- Theme and typography preferences
- Technical detail level for AI-generated overview content
- Model preference UI (current backend routes use fixed model values)

## Tech Stack

- Frontend: React + Vite + TypeScript (`client/`)
- Backend: Express (`api/`)
- GitHub Integration: `@octokit/rest`
- AI + Embeddings: OpenAI + LangChain
- Vector Store: ChromaDB
- Persistence: Supabase (analysis cache + favorites)
- Charts/UI: Recharts + Tailwind utility classes + component libraries

## Project Structure

```text
.
├── api/
│   ├── routes/
│   │   ├── chat.js
│   │   ├── commits.js
│   │   ├── favorites.js
│   │   ├── stats.js
│   │   ├── structure.js
│   │   └── index.js
│   ├── utils/
│   │   ├── state.js
│   │   └── supabase.js
│   └── server.js
├── client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── context/
│   │   │   ├── App.tsx
│   │   │   └── routes.tsx
│   │   ├── styles/
│   │   └── main.tsx
│   └── vite.config.ts
├── supabase-schema.sql
└── package.json
```

## Prerequisites

Before running Luna locally, make sure you have:

- Node.js 18+ (Node.js 20 recommended)
- npm
- A GitHub personal access token (for repository API access)
- An OpenAI API key
- A running Supabase project
- ChromaDB running locally at `http://localhost:8000`

## Getting Started

### 1) Clone and install dependencies

```bash
git clone <your-fork-or-repo-url>
cd luna_main
npm install
cd client
npm install
```

### 2) Configure environment variables

Create `api/.env`:

```env
GITHUB_TOKEN=your_github_token
OPENAI_TOKEN=your_openai_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3000
```

Notes:
- `PORT` is optional and defaults to `3000`.
- The frontend currently expects the API at `http://localhost:3000`.

### 3) Initialize Supabase schema

Run the SQL in `supabase-schema.sql` in your Supabase SQL Editor.

This creates:
- `repo_analysis` for cached repository analysis and metrics
- `repo_favorites` for saved repositories

### 4) Start ChromaDB

Start a local ChromaDB server on `localhost:8000`.

If you use Docker, one option is:

```bash
docker run -p 8000:8000 chromadb/chroma
```

## Run Locally

Open two terminals.

### Terminal 1: Backend API

From the repository root:

```bash
node api/server.js
```

API runs at `http://localhost:3000` by default.

### Terminal 2: Frontend

From `client/`:

```bash
npm run dev
```

Vite will print the frontend URL (typically `http://localhost:5173`).

## API Overview

Base URL: `http://localhost:3000`

### Chat and Indexing

- `POST /index`
  - Body: `{ "owner": "string", "repo": "string" }`
  - Indexes repository files into ChromaDB for AI retrieval.

- `POST /chat`
  - Body: `{ "owner": "string", "repo": "string", "question": "string", "mode": "basic|expert" }`
  - Returns an AI answer plus source file paths.

### Commit Summary

- `POST /commit`
  - Body: `{ "owner": "string", "repo": "string" }`
  - Returns latest commit metadata and plain-language explanation.

### Repository Data

- `GET /repos`
  - Lists repositories for the authenticated GitHub user.

- `GET /stats?owner=<owner>&repo=<repo>`
  - Returns summary repo stats for recent activity.

- `GET /commits?owner=<owner>&repo=<repo>&limit=20`
  - Returns recent commits (formatted).

- `GET /contributors?owner=<owner>&repo=<repo>`
  - Returns contributor list.

- `GET /activity?owner=<owner>&repo=<repo>&days=30`
  - Returns activity timeline data for charts.

### Structure and Architecture

- `GET /structure/metrics?owner=<owner>&repo=<repo>`
  - Returns cached file/quality metrics.

- `POST /structure/refresh-metrics`
  - Body: `{ "owner": "string", "repo": "string", "technicalLevel": "low|medium|high" }`
  - Refreshes overview and metrics cache.

- `GET /structure/overview?owner=<owner>&repo=<repo>`
  - Returns top language breakdown + overview text.

- `GET /structure/dependencies?owner=<owner>&repo=<repo>`
  - Returns detected dependency lists from package files.

- `GET /structure/status?owner=<owner>&repo=<repo>`
  - Returns whether analysis should be re-run.

- `POST /structure/analyze`
  - Body: `{ "owner": "string", "repo": "string", "forceReindex": true }`
  - Generates deterministic file graph + high-level architecture + quality estimates.

### Favorites

- `GET /favorites`
  - Returns saved repository favorites.

- `POST /favorites`
  - Body: `{ "repo": "owner/name" }`
  - Adds or updates a favorite.

- `DELETE /favorites`
  - Body: `{ "repo": "owner/name" }`
  - Removes a favorite.

## How Analysis Works

Luna's architecture analysis combines deterministic parsing with AI-assisted interpretation:

1. Fetches repository tree from GitHub
2. Filters out non-code, hidden, and large files
3. Extracts imports (`import`, `require`, dynamic import, and Python import patterns)
4. Resolves local module relationships to build a dependency graph
5. Groups files into high-level modules for architecture visualization
6. Uses AI to estimate complexity and potential code smells
7. Caches analysis data in Supabase

For chat, Luna retrieves relevant chunks from ChromaDB and sends contextual prompts to OpenAI.

## Troubleshooting

- `GITHUB_TOKEN not configured`
  - Add `GITHUB_TOKEN` to `api/.env` and restart the backend.

- `Supabase not configured`
  - Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, and run `supabase-schema.sql`.

- Chat/indexing errors around Chroma
  - Ensure ChromaDB is running on `http://localhost:8000`.

- Empty charts or missing commit details
  - Confirm token scopes and repository access permissions.

- CORS or connection errors from frontend
  - Verify backend is running on `http://localhost:3000`.

## Known Limitations

- Some UI settings (like model selection) may not yet be wired through all backend endpoints.
- Large repositories can take noticeable time on first analysis/indexing.
- Analysis quality depends on repository accessibility and completeness of fetched content.
- Current backend CORS settings are permissive for local development.

## Security Notes

- Never commit secrets. Keep `api/.env` local only.
- Use minimal-scope GitHub and Supabase credentials for development.

## Contributing

Contributions are welcome. For substantial changes:

1. Open an issue describing the proposal
2. Create a feature branch
3. Submit a pull request with clear testing notes

## License

No license file is currently included. Add a `LICENSE` file if you plan to distribute this project publicly.
