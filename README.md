# LocalLead

LocalLead is a production-oriented Next.js application for discovering local businesses, checking their public web presence, scoring website opportunities, and managing a qualified prospect list. It never contacts businesses automatically.

## What is included

- Location-first, step-based search workflow with explicit business categories and qualification filters
- Asynchronous discovery jobs with persisted stages, cancellation, progress events, and partial-failure-safe processing
- Replaceable `BusinessDataProvider` interface with realistic mock and Geoapify adapters
- Official-site classification that rejects directory and social profile URLs as official websites
- Lightweight public website analysis with explicit, evidence-based factors
- Separate, transparent 0–100 opportunity score
- Dashboard, saved searches, lead pipeline, filters, sorting, pagination, detail drawer, notes, and statuses
- CSV and XLSX export for all or selected leads
- PostgreSQL schema, indexes, deduplication, Supabase RLS, and ownership policies
- Zod API validation and Vitest coverage for normalization, validation, deduplication, website classification, scoring, and repository flow

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project for persistent/production use (optional in demo mode)
- A Geoapify API key only when using the real provider

## Install and run

```bash
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:3000`. For credential-free local development, explicitly set `DEMO_MODE=true` and `BUSINESS_DATA_PROVIDER=mock`. Demo records are kept in the git-ignored `.locallead/demo-db.json` file so searches survive route recompilation and local restarts. Production rejects demo mode and never falls back to local files.

## Supabase setup

1. Create a Supabase project.
2. Set `DATABASE_URL` to the port 5432 Session Pooler URL and run `npm run db:migrate`. The migration runner applies every pending file in `supabase/migrations` exactly once.
3. Copy the project URL and anon key into `.env`.
4. Copy the service-role key into the server-only variable. Never expose or prefix it with `NEXT_PUBLIC_`.
5. Set `DEMO_MODE=false` in production. API clients must send a Supabase access token as `Authorization: Bearer <token>`.

The service-role client is instantiated only in server modules. RLS additionally restricts every user-owned table to `auth.uid()`.

## Environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged server persistence |
| `DATABASE_URL` | Server only | Exact Supabase session-pooler URL for migrations |
| `BUSINESS_DATA_PROVIDER` | Server only | `geoapify` in production; `mock` is development-only |
| `BUSINESS_DATA_PROVIDER_API_KEY` | Server only | Optional generic fallback for the Geoapify key |
| `GEOAPIFY_API_KEY` | Server only | Geoapify geocoding and places key |
| `WEBSITE_ENRICHMENT_API_KEY` | Server only | Reserved for a future external enrichment provider; currently unused |
| `WEBSITE_ANALYSIS_ENABLED` | Server only | Enables public website analysis |
| `WEBSITE_ANALYSIS_TIMEOUT_MS` | Server only | Per-site request timeout |
| `PROVIDER_REQUEST_DELAY_MS` | Server only | Compliant delay between provider calls |
| `PROVIDER_MAX_RETRIES` | Server only | Exponential-backoff retry limit |
| `DEMO_MODE` | Server only | Enables the local demo identity |

## Provider configuration and compliance

The real adapter uses Geoapify. Its official documentation describes the Places API and permits storing results, subject to retained source attribution. Geoapify and OpenStreetMap attribution is written into each job’s activity stream. Confirm the current plan, attribution, local privacy obligations, and intended commercial use before production deployment.

Set:

```dotenv
BUSINESS_DATA_PROVIDER=geoapify
GEOAPIFY_API_KEY=
```

The adapter geocodes the selected location, searches within the configured radius, applies a conservative category map, delays requests, and retries transient failures with exponential backoff. It does not bypass quotas or access controls. Provider-supplied data varies; LocalLead does not invent ratings, reviews, or business size.

## Architecture

```text
Next.js UI → validated API routes → discovery job service
                                      ├─ BusinessDataProvider (mock / Geoapify)
                                      ├─ website enrichment + classification
                                      ├─ public website analysis
                                      └─ transparent opportunity scoring
                                                   ↓
                                       repository (local JSON / Supabase)
```

The in-process job runner is deliberately behind a service boundary. For serverless production, call the same discovery service from a durable queue worker (Supabase Queues, Inngest, Trigger.dev, Cloud Tasks, etc.) so work survives process recycling. The UI polls persisted job state and does not hold a long browser request open.

## Replacing the business provider

1. Implement `providers/business/BusinessDataProvider.ts`.
2. Normalize every provider payload to `NormalizedBusiness`.
3. Add the provider to `providers/business/index.ts` and select it through `BUSINESS_DATA_PROVIDER`.
4. Document the provider’s limits, storage rights, attribution, allowed fields, and category mapping.
5. Add normalization and error tests. No UI or scoring code should consume provider-specific fields.

## Commands

```bash
npm run dev      # local app
npm run build    # production compilation
npm run lint     # static analysis
npm run typecheck # strict TypeScript check
npm test         # unit + repository flow tests
npm run db:migrate # apply pending Supabase migrations
npm start        # serve production build
```

## Production deployment

Deploy to Vercel's Node.js runtime, configure the environment variables in the project, apply migrations before the first production request, and keep `DEMO_MODE=false`. Discovery is claimed atomically and scheduled with Next.js `after()` inside a request-scoped function with a 300-second maximum duration; progress and results live in Supabase, never process memory. Restrict provider keys where supported, set quota alerts, publish privacy/terms pages, and review retention requirements before handling real business data.

## Safety notes

Website analysis requests only the supplied public homepage, follows normal HTTP redirects, uses an identifying user agent, enforces a timeout, and never attempts CAPTCHA, login, anti-bot, robots, or rate-limit bypass. A single unavailable website becomes an analysis note and does not fail the discovery job.
