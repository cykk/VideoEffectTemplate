# Cloudflare Workers Web Deployment

## Scope

Only `apps/web` moves to Cloudflare Workers. `apps/api`, PostgreSQL/Neon, Redis, R2 and Trigger.dev remain on their existing VPS/managed services. No D1 migration is included. The web Worker contains the rendering/UI runtime and a compatibility API proxy; browser API, Better Auth and SSE traffic should go directly to the existing API origin.

The current adapter is `vinext` with Cloudflare's Vite plugin. `vinext` is still actively developed and does not implement all Next.js internals. Keep the current Next/Vercel build available until real-account and real-browser acceptance is complete.

## Build and local preview

Prerequisites: Node 22+, pnpm 10, a Cloudflare account, and Wrangler authentication (`pnpm --filter @markless/web exec wrangler login`).

1. Copy the checked-in `.env.web.cloudflare.example` to the ignored local `.env.web.cloudflare` and set `NEXT_PUBLIC_WEB_URL` to the actual preview origin, preferably the isolated preview Worker `workers.dev` URL. Do not put database, auth, storage, Stripe or other secrets in this file.
2. Set `BETTER_AUTH_TRUSTED_ORIGINS` on the VPS API to include the exact preview origin. The API's SSE CORS helper derives allowed origins from this list. Restart/redeploy the API as required.
3. Run `pnpm run cf:env:check`, `pnpm run cf:build`, then `pnpm run cf:dry-run`.
4. Run `pnpm run cf:preview` and, in a second terminal, `pnpm run cf:smoke`. Manually exercise login/signup, OAuth or magic links if enabled, dashboard bootstrap, upload, transcription polling, live SSE events, signed file URLs, checkout return, locale redirects, and admin access.
5. After deploying the isolated preview Worker, verify its routes, CORS preflight, auth cookies and SSE in an actual browser before promoting.

`NEXT_PUBLIC_*` values are compiled into browser assets at build time. Changing Worker `vars` alone does not change client URLs; rebuild for a different web/API origin. The Worker `API_UPSTREAM_URL` is runtime-only for the server-side compatibility proxy.

## Preview to production

Preview uses the default Wrangler environment and worker name `mp3totext-web-preview`. Production uses Wrangler's `production` environment and worker name `mp3totext-web`; its public web origin is `https://mp3totext.io` while its API origin remains `https://api.mp3totext.io`.

Before production promotion:

- Add the preview origin to VPS Better Auth trusted origins and confirm auth redirects/cookies. Keep production origin already trusted.
- Verify custom auth cookie domain behavior (`mp3totext.io`) on the preview. Do not weaken cookie settings to make a preview pass; workers.dev is cross-site relative to `api.mp3totext.io`, so use a preview subdomain under `mp3totext.io` if cross-site cookie policy prevents authentication.
- Keep the existing Vercel deployment and DNS/proxy route unchanged during the observation window.
- Run `pnpm run cf:build:prod`, `pnpm run cf:deploy:prod` after preview acceptance. Configure the production custom domain/route for the production Worker through Cloudflare. Do not attach the existing production hostname to the preview Worker.
- Use Cloudflare Worker versions/traffic controls for promotion where available. Observe login, transcription completion, SSE reconnect, billing callbacks, 5xx rate, CPU duration and asset errors.

## Rollback

The API and data services are not changed by this migration. If the Worker fails, remove/disable the Cloudflare route/custom domain or restore the previous DNS/origin route to Vercel. Keep the Vercel project, environment variables and last known good build intact. Since the frontend client now uses the configured API origin, build the fallback Vercel deployment with the same production public API/auth/SSE URLs (or revert that frontend commit) rather than assuming same-origin `/api` traffic.

## Runtime notes and known limits

- Blog Markdown is parsed with `gray-matter` during the build and emitted as generated TypeScript. The Worker does not read a filesystem at request time. Add new blog documents before running either web build.
- This build does not enable response/page caching. That is deliberate until account-specific HTML/RSC, auth cookies, dashboard responses and error responses have been audited. Only content-hashed static assets receive immutable cache headers.
- Cloudflare builds set Next image `unoptimized` mode because vinext does not currently provide the Next `/_next/image` optimizer route. Images load from their original URLs; Vercel builds retain the existing optimization behavior. Add Cloudflare Images or another optimizer only if resizing becomes necessary.
- `next/font/google` is downloaded/self-hosted during build where supported; verify the generated font assets and licensing/network behavior in CI.
- Next-only implementation internals, the proxy/middleware path, admin routes, settings/search params, not-found, sitemap and server-rendered async pages passed a local smoke run, but vinext's compatibility analyzer is not a production conformance test. It scanned stale `.next-web` outputs as well, so its low compatibility percentage was not a reliable source-only score.
- Worker deployment requires Node compatibility. The current Worker remains small (about 810 KiB gzipped in Wrangler dry run), but each route must be observed with production-like traffic.
- `.env.web.cloudflare` and `.env.web.cloudflare.production` contain public build-time values only and are ignored by Git; the committed `.example` files are templates. Cloudflare secrets, if needed later, belong in `wrangler secret`, never in vars or committed templates.
