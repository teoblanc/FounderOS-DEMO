# Founder OS

**A personal operating system for a one-person business: a live web command
center that runs your company as a set of AI-assisted "departments."**

Founder OS turns the tabs, tools, and mental overhead of running a solo business
into one screen: unified comms, a client funnel, social growth, finances, a
knowledge graph, and a roster of named AI agents that each own a real job.

This repository is the **open-source demo build**. It ships seeded with
realistic placeholder data, so every page is alive out of the box with no
accounts, no API keys, and nothing to configure. It's the same system taught,
live, in the [Founder OS cohort](https://www.thefounderos.com); this repo lets
you explore and run it yourself.

> Want to build your own, live, with guidance? That's what the cohort is for.
> [thefounderos.com](https://www.thefounderos.com)

---

## Quick start

Requires **Node 18+**.

```bash
npm install
cp .env.example .env.local   # optional; only needed to wire live integrations
npm run dev                  # http://localhost:4100
```

A local SQLite database is **seeded with demo data on first run**, so every page
is populated immediately. No credentials are required to browse. Navigate with
the sidebar or the Command Palette (Cmd/Ctrl + K). Five themes ship, including
the Monolith default (white on black, color means status only); pick it from the
palette icon in the top bar.

```bash
npm run build && npm start   # production build
npm test                     # vitest suite
npm run typecheck            # tsc --noEmit
npm run seed                 # re-seed the demo DB (idempotent)
```

---

## What you're looking at

| Route | What it is |
| --- | --- |
| `/` | Operator console: pulse row, connections strip, agent list, knowledge core |
| `/comms` | Unified inbox: email, Slack, WhatsApp, and dictation lanes in one feed |
| `/funnel` | Living client-journey flow: a left-to-right neural view and a radial acquisition wheel, both fullscreenable |
| `/social` | Growth dashboard: per-account follower charts, audience share, posting cadence |
| `/content` | Content pipeline and calendar |
| `/finances` | Income and expense charts, money-out views, expenses by category |
| `/agents` | The AI agent roster, each with a real `run()` and last-run state |
| `/tasks` | Task board fed by the agents |
| `/skills` | Reusable, schedulable agent skills |
| `/org` | Org hierarchy: operator, conductor, pillars, workers |
| `/brain` | The knowledge core and graph (see **Knowledge layer** below) |
| `/workflows` | Multi-step tool workflows |
| `/integrations` | Live connections board with honest status for every connector |
| `/analytics` | Real connector numbers and sparkline history |
| `/roadmap`, `/reference` | Phases and quarters, and the reference model |
| `/personas` | Persona templates that reskin the OS for other business types |

---

## Architecture: larp-first, real-ready

This is the load-bearing design rule. The demo looks alive because of rich
seeded data, but **every page and API route reads through a repository layer**
(never a raw query), and **every connector returns an honest status** (it never
fakes "connected"). Swapping seeded tables for live sources is a repo-level
change, not a rewrite.

- **`lib/data.ts`**: `getDb()` app singleton; seeds on first touch.
- **`lib/db.ts`**: `openDb()` plus typed repositories (`agents`, `departments`,
  `social`, `funnel`, `finances`, and more).
- **`lib/seed.ts`**: all seeded demo content lives here.
- **`lib/schemas.ts`**: Zod schemas validate every row on the way **out** of the
  DB, so bad data fails loud.
- **`lib/connectors/*`**: 20+ connector groups (email/IMAP, Slack, Stripe,
  Notion, calendar, CRM, social, and more). Each returns a typed
  `ConnectorStatus` of `connected`, `not_configured`, or `error`: always the
  truth, never a fake green light.
- **`lib/agents/*`**: every seeded agent maps one-to-one to a runtime agent with
  a real `run()`; runs persist and surface on `/agents`.

New data means a new repo method, a Zod schema, a seed entry, and a test. Keep
it that way.

---

## Knowledge layer: G-Brain and Optimal Engine

The `/brain` graph you see in the demo is the visible surface of a two-part
knowledge system that powers the production build.

### G-Brain, the knowledge base

Plain **Markdown files are the source of truth**. They're chunked and embedded
into a vector store, so one store answers both **keyword** and **semantic**
queries (hybrid retrieval with reciprocal-rank fusion). If the vector backend is
unreachable, retrieval falls back to a local grep over the markdown: fewer
smarts, zero downtime. The demo ships a stub provider; the production provider
reads a live markdown store and a vector index.

### Optimal Engine, the governed memory runtime

Where G-Brain stores documents, **Optimal Engine governs what the OS actually
"knows."** It's the system of record for memory, organized as a
**Tenant, Organization, Workspace, Node** topology, with a disciplined truth
lifecycle:

```
Source -> Signal -> Claim -> Fact -> Memory
```

Raw sources produce signals; signals become claims; claims are reviewed and
promoted into verified facts; facts distill into durable memories the agents
draw on. Agents may write sources, signals, and pending claims, but **facts are
promotion-gated**: nothing becomes "known" without passing review. That keeps
the OS's memory trustworthy as it scales across workspaces.

Together: **G-Brain is the library; Optimal Engine is the librarian and the
system of record.** The agents query both before they act.

---

## The full plan (production)

The demo is self-contained (Next.js plus seeded SQLite). The production build
keeps the same repo-layer contract and swaps in real backends:

- **Hosting: [Railway](https://railway.app).** The Next.js app deploys as a
  Railway service; the seeded SQLite store is replaced by a managed database,
  and the knowledge services (G-Brain retrieval and Optimal Engine) run as
  companion services alongside it. Env vars are managed per environment.
- **Knowledge: G-Brain and Optimal Engine** become the live knowledge and memory
  layer behind `/brain` and every agent.
- **Connectors go live.** Because each connector already reports honest status,
  wiring a real source (IMAP inboxes, Slack, Stripe, Notion, a CRM, calendar,
  social) is just supplying credentials. The UI immediately reflects real state
  instead of seeded data.
- **Agents run for real.** Each agent's `run()` executes against the live
  connectors and the knowledge layer, on a schedule, with runs persisted.

Same interface you see in this demo, backed by your real business instead of
placeholder data.

---

## Project structure

```
app/                 Next.js App Router; one folder per view plus /api routes
components/          UI: dashboard sections, graphs, terminal primitives
lib/
  data.ts db.ts      repository layer plus app DB singleton
  seed.ts            all seeded demo content
  schemas.ts         Zod schemas (validate every DB/API boundary)
  connectors/        20+ honest-status integrations
  agents/            agent registry plus runtimes
  knowledge-graph.ts, memory-core.ts   brain graph plus memory model
scripts/             seed plus doc-generation scripts
tests/               vitest suite (one file per module)
```

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to
`.env.local` and fill in only what you want to wire up; everything else stays in
honest "not configured" mode. `.env.local` is gitignored.

**Never commit real keys.** The demo runs fully without any of them.

---

## Tech stack

- **Next.js 15** (App Router, server components) plus **TypeScript**
- **Tailwind CSS**: monochrome "Monolith" theme with pickable colorways
- **better-sqlite3** (local/Railway) or **Cloudflare D1** (Workers): same
  seeded schema, backend picked automatically at runtime
- **Zod**: schema validation at every boundary
- **Vitest**: test suite
- **Vercel AI SDK**: agent LLM calls
- **d3-force**, **lucide-react**, **simple-icons**: graph physics and iconography

---

## Testing

```bash
npm test          # run the full vitest suite
npm run typecheck # tsc --noEmit
```

Tests live in `tests/`, one file per module, using an in-memory SQLite pattern
so they never touch the seeded dev DB.

---

## Deploying to Railway

1. Create a Railway project and point it at this repo.
2. Set the build command to `npm run build` and the start command to `npm start`
   (the app serves on the `PORT` Railway provides).
3. Add a database service and any connector credentials as environment variables
   in the Railway dashboard.
4. Deploy. The knowledge services (G-Brain and Optimal Engine) run as companion
   services and are referenced by URL from the app's environment.

---

## Deploying to Cloudflare Workers

An alternative to Railway for running the same seeded demo on Cloudflare's
edge, via the [OpenNext Cloudflare adapter](https://opennextjs.dev/cloudflare).
`better-sqlite3` is a native addon and can never run in a Workers isolate, so
this path swaps it for [Cloudflare D1](https://developers.cloudflare.com/d1/)
(D1 is SQLite, so the schema carries over almost unchanged) — `lib/db.ts`
picks the right backend automatically depending on where it's running, so
local dev, tests, and the Railway path above are completely unaffected.

1. **Create the D1 database:**
   ```bash
   npx wrangler d1 create founder-os-demo
   ```
   Copy the `database_id` it prints into `wrangler.jsonc`'s `d1_databases[0]`
   entry (replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`).
2. **Apply the schema:**
   ```bash
   npx wrangler d1 migrations apply DB --remote
   ```
   (drop `--remote` to apply against the local Miniflare simulation first, for
   the preview step below).
3. **Preview locally** — builds the app and boots it under `workerd`
   (Cloudflare's actual Workers runtime) against a local D1 simulation, so you
   can click through the whole seeded app before touching your real account:
   ```bash
   npm run preview
   ```
4. **Deploy:**
   ```bash
   npm run deploy
   ```
5. **Secrets** — Workers don't read `.env.local`; set anything you want live
   with `npx wrangler secret put KEY_NAME` instead (see `.env.example` for the
   full list).

**What's different on this deployment, and why that's expected:** a Workers
isolate can never spawn a process or read a local filesystem — that's not a
missing feature, it's fundamental to the sandbox. So a handful of connectors
that are inherently tied to one physical machine report themselves honestly
"not configured" here instead of attempting the call: the `gbrain` CLI,
WhatsApp Desktop's local database, Wispr Flow, the Obsidian vault, the
tmux/Homebrew local-stack checks, and PDF bank-statement upload (which shells
out to `pdftotext`). Everything else — every page, every connector that talks
to a real HTTP API, and CSV bank-statement upload — works the same as on
Railway. This mirrors the app's own connector philosophy (`ConnectorStatus`
never fakes "connected"), just applied to a platform constraint instead of a
missing credential.

---

## Note on the demo data

This is a demo build. All names, companies, clients, financial figures, and
social numbers are **placeholder data**. Nothing here is real.

## License

MIT. See [`LICENSE`](LICENSE).

---

Built as the reference implementation for **Founder OS**.
[thefounderos.com](https://www.thefounderos.com)
