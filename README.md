# A Mustafa Traders Chat Dashboard

A responsive Facebook, Instagram, and WhatsApp conversation dashboard for A Mustafa Traders. It is built with Next.js App Router, TypeScript, Tailwind CSS, and optional Supabase realtime data.

## Run locally

1. Run \`npm install\`.
2. Copy \`.env.example\` to \`.env.local\`.
3. Leave the environment values empty to use the built-in AMT demo conversations.
4. Run \`npm run dev\` and open [http://localhost:3000](http://localhost:3000).

## Optional Supabase connection

Run \`supabase/schema.sql\` in the Supabase SQL editor, optionally run \`supabase/seed.sql\`, then add your Supabase project URL, anon key, and service role key to \`.env.local\`. The anon key is used by the existing browser/dashboard client. Privileged server code can use \`getSupabaseAdminClient\` from \`lib/supabase-admin.ts\`; the module is server-only and must never be imported into client components. Keep \`SUPABASE_SERVICE_ROLE_KEY\` private.

To enable WhatsApp conversations on an existing database, run \`supabase/migrations/20261011000000_add_whatsapp_platform.sql\` in the SQL editor. Store each WhatsApp customer thread in \`conversations\` with \`platform = 'whatsapp'\`, and its incoming/outgoing messages in \`messages\`; the dashboard loads these rows and receives realtime updates.

The dashboard is intentionally read-only. Authentication and reply controls should be added before production use.

## Website visitor tracking API

The public A Mustafa Traders website posts `page_view`, `page_duration`, and `identify` actions to `/api/track`. The browser only sends its `visitor_key` and a unique `page_visit_key`; all database writes use the server-only `SUPABASE_SERVICE_ROLE_KEY`. The API accepts requests from `https://www.amustafatraders.com` and `https://amustafatraders.com` by default. Set `WEBSITE_TRACKING_ALLOWED_ORIGINS` in the dashboard deployment to the exact comma-separated website origins when changing the allowed origins.

Before deploying this API update, run `supabase/migrations/20261011010000_add_website_page_visit_key.sql` in the Supabase SQL editor. It adds a unique page visit key so retries do not create duplicate page-history rows and duration updates target the existing visit. The dashboard no longer records its own page visits; only the public website tracker should populate the visitor list.
