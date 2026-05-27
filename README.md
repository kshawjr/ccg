# True Colors Assessment

A Next.js 14 (App Router) app that delivers a personality assessment to candidates via
tokenized links and writes the results back to Zoho CRM.

- **Frontend:** Next.js 14, TypeScript, plain CSS (no Tailwind / UI lib)
- **DB:** Supabase Pro (service-role only — no public RLS reads)
- **CRM:** Zoho REST API v6 (US data center, OAuth refresh-token flow, no SDK)
- **Deploy target:** `truecolors.corporatecleaninggroup.com` on Vercel

---

## Quick start

```bash
cp .env.example .env.local
# fill in every value (Supabase, Zoho, ADMIN_API_KEY)

npm install
npm run dev
# http://localhost:3000
```

The root path is a friendly placeholder. The real experience lives at
`http://localhost:3000/[token]`. Mint a token with the admin endpoint (see below).

---

## 1. Supabase setup

1. Create a Supabase project (Pro tier).
2. In the SQL editor, paste and run [`supabase/schema.sql`](./supabase/schema.sql).
   That creates the `assessment_progress` table, the `updated_at` trigger, an index on
   `(zoho_module, zoho_record_id)`, and enables RLS (no permissive policies — service
   role bypasses it).
3. Copy two values into `.env.local`:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` key
     **(server-only; do not expose to the browser)**

The client never reads or writes Supabase directly. All access goes through Next.js
route handlers using the service role key.

---

## 2. Zoho CRM setup

### 2a. Create the custom fields on the **Deals** module

Settings → Customization → Modules → Deals → Layouts → add these fields:

| Field label             | Type          | API name (must match exactly) |
| ----------------------- | ------------- | ----------------------------- |
| True Colors Orange      | Number        | `True_Colors_Orange`          |
| True Colors Blue        | Number        | `True_Colors_Blue`            |
| True Colors Gold        | Number        | `True_Colors_Gold`            |
| True Colors Green       | Number        | `True_Colors_Green`           |
| True Colors Primary     | Picklist      | `True_Colors_Primary` — values: `Orange`, `Blue`, `Gold`, `Green` |
| True Colors Completed At | Date/Time    | `True_Colors_Completed_At`    |

> If your CRM admin already uses different API names, change them once in
> `lib/zoho.ts` (`ZOHO_FIELDS` constant) instead of renaming in Zoho.

### 2b. Get a refresh token (Zoho self-client flow)

1. Go to <https://api-console.zoho.com> (US data center) → **Add Client** → **Self Client**.
2. Note the `Client ID` and `Client Secret`. Drop them in `.env.local`:
   - `ZOHO_CLIENT_ID`
   - `ZOHO_CLIENT_SECRET`
3. In the Self Client tab → **Generate Code**.
4. Scope: `ZohoCRM.modules.deals.ALL,ZohoCRM.modules.ALL,ZohoCRM.settings.ALL`
   (at minimum: read + update on Deals).
5. Time duration: 10 minutes. Scope description: anything.
6. Copy the generated `code` (it expires fast). Then exchange it for a refresh token:

   ```bash
   curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
     -d "grant_type=authorization_code" \
     -d "client_id=$ZOHO_CLIENT_ID" \
     -d "client_secret=$ZOHO_CLIENT_SECRET" \
     -d "code=PASTE_THE_CODE_HERE"
   ```

   The response contains `refresh_token` (long-lived) and an `access_token` (1 hour).
   Save the `refresh_token` as `ZOHO_REFRESH_TOKEN` in `.env.local`.
   The app refreshes the access token on demand and caches it in-process.

> Non-US data centers: also set `ZOHO_ACCOUNTS_BASE` (e.g. `https://accounts.zoho.eu`)
> and `ZOHO_API_BASE` (e.g. `https://www.zohoapis.eu`).

---

## 3. Mint a token (admin)

Pick a long random `ADMIN_API_KEY` (e.g. `openssl rand -hex 32`) and put it in
`.env.local`. Then:

```bash
curl -X POST http://localhost:3000/api/admin/generate \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{"module":"Deals","recordId":"4567890000001234567"}'
```

Response:

```json
{
  "token": "uOlw7sJ5R4qZ3aXkQbE_2-XV",
  "url": "https://truecolors.corporatecleaninggroup.com/uOlw7sJ5R4qZ3aXkQbE_2-XV",
  "firstName": "Andrea",
  "lastName": "Sample"
}
```

Send that URL to the candidate. They land on a prefilled welcome modal, work through
six short rounds, and the results are pushed to the Deal in Zoho automatically.

---

## 4. Customizing the candidate copy

There are two strings hardcoded with a `TODO` comment in
[`app/[token]/Assessment.tsx`](./app/%5Btoken%5D/Assessment.tsx):

```ts
const RECIPIENT_NAME = 'Andrea';
const FRANCHISE_NAME = 'Corporate Cleaning Group';
```

These appear in the welcome modal body and the "Sent to Andrea ✓" sync confirmation.
Swap them in code today; later, we can move these into a `franchise_config` table or
an env var per deployment.

---

## 5. Deploy to Vercel

1. Push to GitHub. In Vercel: **Add New Project** → import the repo.
2. Framework preset: Next.js (auto-detected).
3. **Environment variables** — add every value from `.env.example` to **Production**
   (and **Preview** if you want preview deploys to hit Zoho/Supabase).
4. Deploy. Then add the custom domain:
   - Project → Settings → Domains → add `truecolors.corporatecleaninggroup.com`.
   - In your DNS, add a CNAME for `truecolors` → `cname.vercel-dns.com`.
5. Hit `https://truecolors.corporatecleaninggroup.com/<token>` to verify.

### Notes on the runtime

- All API routes use `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`.
- The Supabase service-role key and Zoho refresh token are server-side only — never
  exposed to the browser.
- The default 300s Vercel function timeout is more than enough; submit + Zoho write
  typically finish in <2s.

---

## 6. Flow summary

```
admin POST /api/admin/generate          → creates assessment_progress row + token
candidate GET /[token]                   → server reads row, renders Assessment
candidate ranks cards                    → debounced POST /api/save/[token]
candidate finishes row 6                 → POST /api/submit/[token]
  → calculate scores + primary
  → PUT to Zoho Deals (custom fields)
  → mark assessment_progress complete
  → respond { ok, scores, primary }
```

If the Zoho write fails, the assessment is **not** marked complete and the API returns
`502`. The candidate sees a retry button and can resend without re-taking the quiz.

---

## 7. Useful local commands

```bash
npm run dev         # next dev
npm run build       # production build (also runs type-check)
npm run typecheck   # tsc --noEmit
```
