# SaaS template conversion: implementation inventory

The target is a reusable SaaS starter with authentication, billing, credits,
admin operations, object storage, Trigger.dev, and an optional Replicate AI job
integration. Creem stays the default payment provider. Waffo remains disabled
until its real sandbox and production acceptance work is complete.

## Ownership map

| Area | Keep and generalize | Remove from the starter |
| --- | --- | --- |
| Web | Auth, dashboard shell, pricing, settings, billing, admin, optional blog and redemption | Transcription editor, recorder, upload workflow, subtitle/translation/share pages, transcription marketing pages |
| API | Auth, payments, subscriptions, credits, admin, storage primitives | `/api/transcriptions/**`, transcription admin/user routes, public transcription shares, transcription cleanup and webhook routes |
| Server | Credit and subscription services, payment providers, Replicate request/signature primitives, R2 core | Transcription service, access policy, media pipeline, transcription-specific R2 helpers and cleanup tasks |
| Database | Users, auth, orders, subscriptions, credits, Waffo ledger, redemption and contacts | Transcription jobs, segments, speakers, artifacts, shares and failure archives in new-install schema |
| Build | Next apps, Drizzle, Trigger, i18n and package tooling | Transcription-only assets, tools, examples and dependencies after reference checks |

## Migration rules

Existing migration files are immutable history. New installations need a clean
schema generated from the current starter schema; upgrades from an existing
database need additive migrations followed by a separate archival and deletion
decision for transcription data. No production database or object storage data
is changed by this conversion.

Credit balances and historical payment/order snapshots must not be rewritten.
An AI job reservation must be idempotent and account for the source of each
credit. A failed job can release only the still-valid part of the reservation;
an ambiguous remote submission cannot be retried as a fresh paid prediction.

## Release gates

1. Empty database migration and first-run bootstrap work.
2. Authentication, Creem billing, Waffo billing, subscription renewal and
   refunds pass regression checks.
3. Replicate is optional: missing credentials do not block the core app.
4. AI jobs are isolated by user and survive duplicate, stale and missing
   callbacks without double charging or double releasing credits.
5. No transcription routes, task registrations or user-facing entry points
   appear in production builds.

## Database paths

- New empty database: use `pnpm db:migrate:starter`. The dedicated
  `drizzle-starter` baseline creates only SaaS, payment and AI job tables.
  `pnpm test:starter` executes that SQL against an empty PGlite database.
- Production starter databases use `pnpm db:migrate:starter:prod`. The migration
  commands check the database shape before running; the bare `pnpm db:migrate`
  command intentionally fails until a path is chosen. Re-running the starter
  command is allowed only against an already migrated starter database.
- Use `pnpm db:generate:starter` for starter schema changes. The historical
  `db:generate:local/prod` and `db:push:local/prod` commands reject starter
  databases; bare generate, push and migrate commands intentionally fail.
- Existing MP3ToText database: keep the historical `drizzle` migrations.
  The additive AI jobs migration is safe to apply through the existing
  `pnpm db:migrate:local` or `pnpm db:migrate:prod` path. Do not run the starter
  baseline on an existing database. Both payment and AI service suites run
  against the starter baseline via `pnpm test:payments:starter` and
  `pnpm test:ai:starter`.
- The old transcription tables are intentionally left in existing databases.
  Archival and deletion require a separate data-retention decision. No
  production migration or storage deletion is part of this conversion.

## Optional Replicate setup

Copy the non-secret settings from `.env.replicate.example` into the API and
Trigger.dev environment. Keep `REPLICATE_ENABLED=false` until the Replicate
token, webhook signing secret, public HTTPS API URL, R2 credentials and
`AI_FEATURES` are configured. Each feature maps a public key to a pinned
64-character model version and a positive integer credit cost. The current
starter UI submits a `prompt` field; choose a model version that accepts that
input. The server, not the browser, selects the model and price.

The callback verifies Replicate's signature and a job-specific token. A
five-minute Trigger.dev reconciliation task reads known prediction IDs and
finishes jobs when callbacks are missed. An ambiguous prediction submission
keeps its credit reservation and appears as `unknown`; it is never
automatically resubmitted or refunded because a remote prediction may exist.
An `unknown` job older than ten minutes triggers a reconciliation failure for
operator review. Check the Replicate dashboard using the job creation time,
then settle the job manually only after establishing whether a prediction ran.
The admin `/admin/ai-jobs` page lists stale reservations and unknown submissions.
An admin may release a reservation only after confirming no remote prediction
exists and recording evidence. The decision and credit movement are stored in
the credit transaction ledger. Known prediction IDs remain for automatic
reconciliation; failed R2 output persistence retries through reconciliation.
Disabling `REPLICATE_ENABLED` stops new submissions but does not stop
reconciliation while `REPLICATE_API_TOKEN` remains available. Keep the token,
webhook secret, R2 access and Trigger.dev schedule until all existing jobs are
terminal or reviewed.

Creem remains the default payment provider. Waffo remains optional and its
production acceptance depends on the separate Waffo rollout checklist. New
projects must configure their own provider products, webhook URLs, support
email, brand assets, pricing copy and legal pages before public launch.

## Branding and launch content

The default site name, metadata and browser/share images are generic starter
assets. Set `SUPPORT_EMAIL` in the web and API environments before launch;
without it, support email links and reply-to headers are omitted. After editing
the brand name and English metadata in
`packages/shared/src/i18n/locales/en.json`, run
`node scripts/generate-og-image.mjs` to regenerate the favicon, app icons and
OG image. The old transcription privacy policy and terms remain historical
content in the dictionary. Replace and review both documents for the actual
product before public launch; the starter does not supply legal advice or a
publishable generic policy.

The `/privacy` and `/terms` pages show an unpublished notice by default.
`LEGAL_CONTENT_READY=true` enables the policy pages only after their English
dictionary content no longer contains the old product's transcription terms.
Production web builds run `scripts/starter/check-launch.mjs`, which also requires
valid public HTTPS web/API origins and `SUPPORT_EMAIL`. The check must pass before
publishing; an unpublished notice is not a substitute for approved legal text.

The local `env/manifest.json` may still contain legacy transcription keys and
project-specific origins. Remove those keys and add `REPLICATE_ENABLED`,
`AI_FEATURES`, `SUPPORT_EMAIL`, and `LEGAL_CONTENT_READY` in each project's own
environment configuration. Do not copy another project's domains, secrets, or
Redis namespace. Set `REDIS_KEY_PREFIX` uniquely for every deployment.
