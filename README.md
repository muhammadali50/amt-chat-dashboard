# A Mustafa Traders private dashboard

Next.js App Router dashboard for conversations and website visitors. All dashboard pages, images, and APIs require an admin session. Only the standalone login form, login/logout handlers, compiled static UI assets, and write-only website tracking endpoint are public. Page components, data functions, and API handlers also enforce authentication independently of the request proxy. No database credentials or direct Supabase access are included in browser code.

## Private configuration

Use Node.js 22 LTS or newer (Next.js requires at least 20.9). Run `npm ci`. Copy `.env.example` to the ignored `.env.local`, and edit it privately in your editor. In hosting, set the same values through the project's secret/environment manager. Never paste passwords or keys into chat, command arguments, source files, or `NEXT_PUBLIC_` variables.

- `ADMIN_PASSWORD`: unique, randomly generated password, 20–1024 characters. A password manager can generate and store it.
- `SESSION_SECRET`: independent random secret of at least 32 characters, generated privately with a password manager.
- `APP_ORIGIN`: exact dashboard origin, such as `https://dashboard.your-domain.com`, without a trailing slash. Production requires HTTPS. For `npm run dev`, use `http://localhost:3000`.
- `AUTH_REDIS_REST_URL` and `AUTH_REDIS_REST_TOKEN`: HTTPS Redis REST endpoint and private token (for example, Upstash). It must support GET, SET with EX, DEL, and EVAL. All dashboard instances must use the same store and secret. Use an isolated database and a no-eviction policy; eviction of rate-limit keys weakens throttling.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase settings. Remove the old `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` settings.
- `WEBSITE_TRACKING_ALLOWED_ORIGINS`: exact comma-separated public website origins. The existing AMT origins are the defaults.

Missing/invalid auth settings or an unavailable session store block private access. There is no development authentication bypass. Production cookies use `__Host-`, Secure, HttpOnly, SameSite=Strict, Path=/, and an eight-hour absolute lifetime. Local development uses an HTTP-compatible cookie name. Password or session-secret rotation invalidates all sessions. Logout deletes the shared session before expiring the cookie; a store failure returns 503 and must be retried.

Login accepts at most 30 attempts globally per 15-minute fixed window using an atomic Redis Lua counter, including successful attempts. This protects across server instances and cannot be bypassed with forged forwarding headers. The global limit deliberately trades availability for resistance to distributed guessing; an attacker can temporarily prevent new logins. Existing sessions continue working. Protect the deployment with hosting-level request limits as appropriate. Login/logout require an exact Origin match and reject cross-site Fetch Metadata; all other dashboard operations are read-only. A proxy must preserve the browser's Origin header.

## Database migration and deployment

1. Back up the database. For a fresh project, apply `supabase/schema.sql`. Do not run demo seeds on a production database.
2. Apply SQL files in `supabase/migrations` in filename order, skipping those already recorded as applied. The added foundational visitor migration handles the visitor tables that were previously absent from this repository. The final `20261029000000_private_dashboard.sql` runs atomically, removes **all existing policies** and anonymous/authenticated grants on the four dashboard tables, and removes those tables from public realtime publication. The service role retains access. Review other applications that use these tables before applying it: browser clients using anon or Supabase authenticated credentials will lose access. Trusted server integrations using service-role credentials continue working.
3. Set all private environment settings in the hosting secret manager. Build with `npm run build`; serve with `npm start` on a Next.js-capable host. Static export is unsupported. Use HTTPS and keep the Redis store private. Do not add CDN caching for dashboard responses or bypass the application proxy.
4. Deploy only after settings and SQL are ready. Verify anonymous REST reads against all four Supabase tables are denied, and check actual policies, views, grants, and any other externally provisioned objects in the live project. Database owner/service-role access remains privileged by design.
5. Verify login, both dashboard pages, message refresh, visitor history, logout, and the public website's tracking requests in the deployed environment.

## Public website tracking impact

`/api/track` remains public and write-only so the public AMT website can record `page_view`, `page_duration`, and `identify` without the admin password. Its allowed-origin CORS rules and payload remain compatible; no visitor website script change is required. It uses server-only Supabase credentials, so the private-data migration does not revoke its access. Request bodies now have a streamed 16 KiB limit, including requests without Content-Length.

Origin/CORS is a browser control, not proof of a real visitor: non-browser callers can forge Origin and submit fabricated telemetry. Visitor keys identify telemetry records, not authenticated people; `identify` is self-reported. This change does not establish trustworthy visitor identity or eliminate telemetry spam. Restricting this endpoint to admins would stop public website tracking. The actual website script and live deployment were not available for end-to-end verification. Dashboard conversation updates now poll authenticated APIs every 10 seconds instead of subscribing to public Supabase realtime.

## Verification

Run `npm run build`, `npx tsc --noEmit`, `npm audit`, `npm run scan:secrets`, and `npm run test:security`. The security suite starts three production servers and an isolated TLS Redis REST test double, uses ephemeral random credentials, and tests direct URLs and APIs, forged sessions, shared sessions, expiry, CSRF, atomic shared throttling, logout revocation, missing settings, store outages, headers, and tracking origin compatibility. It requires Node.js and OpenSSL and does not use live infrastructure or secrets. It simulates Redis expiration; it does not certify a managed Redis provider. See `SECURITY-REVIEW.md` for findings and verification limits.

Native browser regression: run `npm run test:browser` on a machine with Chromium installed (or set `CHROMIUM_PATH`). It serves the actual login HTML on loopback with dummy data, reproduces the old `no-referrer` policy sending `Origin: null`, and verifies the configured `same-origin` policy preserves the native form Origin. Cross-site referrers remain suppressed, and missing/null/foreign Origin requests are still rejected by the server.
