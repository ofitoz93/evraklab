# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

EvrakLab is a Turkish SaaS for document/permit tracking that has grown a deep **environmental consultancy** vertical on top of a generic document-management base. Two audiences share the same schema: environmental consultancy firms (`organizations.is_environmental_consultant = true`) who manage a portfolio of client companies (`consultant_clients`), and the industrial/business clients who receive that consultancy — either as full team members of their own `organizations` row, or as token-based external "client" accounts with no real dashboard access.

## Commands

```bash
npm run dev       # Vite dev server (also runs the /api/* middleware, see below)
npm run build     # vite build only — does NOT run tsc, so type errors do not fail the build
npm run lint      # ESLint (flat config, eslint-plugin-react-hooks + react-refresh)
npx tsc --noEmit -p .   # the actual type-check; run this explicitly before considering work done
```

There is no test runner/suite in this repo (no `test` script, no test files). `npm run preview` serves the built `dist/`.

`dist/` is committed to the repo — a stray `vite build` run leaves it modified even when no source changed; `git checkout -- dist/index.html` before committing if you build locally just to sanity-check.

## Data layer: Supabase, no CLI migrations

Schema changes are **not** managed via the Supabase CLI migrations folder — there isn't one. `supabase_schema.sql` at the repo root is the original base schema; everything since has been applied as one-off, descriptively-named files at the repo root (`add_*.sql`, `fix_*.sql`, `update_*.sql` — ~80 of them). When adding a schema change, follow that convention (a new root-level `add_<feature>.sql` / `fix_<bug>.sql`) rather than editing `supabase_schema.sql` in place, and check existing `add_*`/`fix_*` files for the current shape of a table before assuming `supabase_schema.sql` alone is authoritative — it's frequently out of date with what's actually been layered on top (e.g. `consultant_clients`, `env_reports`, `opinion_letters` aren't in it at all).

## Role & auth model

`profiles.role` is a plain text enum, checked via string-literal comparisons scattered across the codebase (no roles table, no central permission map): `normal`, `premium_individual`, `premium_corporate`, `corporate_chief`, `corporate_staff`, `admin`, `system_admin`, and `client`. There's also a per-org `org_role` (`owner`/`staff`/...) and a JSONB `extra_permissions` column for finer-grained per-user overrides (e.g. `can_view_all_clients`).

`src/App.tsx` computes `userRole`, `isEnvConsultant`, `userOrgId`, `userClientId`, `isPremium` etc. once at the top (session → `profiles` lookup, plus an `organizations.is_environmental_consultant` lookup) and every route guard downstream re-checks the same long OR-chain inline:
```
userRole === 'admin' || isEnvConsultant || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'corporate_staff' || userRole === 'premium_individual'
```
This exact condition is repeated ~6 times in `App.tsx` (nav links + route elements) and again in most panel files for section-level gating — when adding a role to an existing feature, grep for the condition rather than assuming one central switch controls it.

`role === 'client'` is a fully separate, isolated layout: no navbar/sidebar, only `/client-panel` is reachable. It's still a real Supabase Auth user, not a bespoke auth system — `ClientLogin.tsx` signs in with `supabase.auth.signInWithPassword({ email, password: <login_token> })`, where `login_token` is a permanent per-profile "password" added by `add_login_token_to_profiles.sql` and handed out via an emailed link.

## The three "panel" tiers

For a given organization, which panel a user lands on depends on role, not a user choice:
- **`ConsultantPanel.tsx`** (~15k lines, the largest file by far) — full owner/manager view: client portfolio, staff assignment, monthly/yearly report authoring, opinion letters, waste management, inspections, regulation compliance, evaluations, finance. It's one giant component with a 19-value `activeTab` switch (`clients`, `reports`, `legislations`, `finance_*`, `waste`, ...) rather than being split by route — each tab's data-fetching and JSX live inline in the same file. When touching one tab, search for its tab-name string rather than trying to read the whole file.
- **`CompanyPanel.tsx`** (~6.4k lines) — the same underlying org data, but for `normal`-role members of a non-consultant organization: a deliberately narrower `activeTab` set (`team`, `compliance`, `requests`, `actions`, `waste`, `inspections`), no billing/report-authoring/definitions/org-chart. `App.tsx`'s `/company` route redirects anyone who qualifies for `/consultant` there first — `CompanyPanel` is what's left over for everyone else.
- **`ClientPanel.tsx`** — the external, token-authenticated client view described above.

## Token-authenticated public routes

Several features are reachable with no login, gated only by a token in the URL, and are therefore defined in *both* the pre-session and post-session route blocks of `App.tsx`: `ExternalSignPage` (`/sign-report/:token`, wet-signature-style report sign-off via `signature_link_token`), `InspectionPage` (`/inspect/:token`, QR-code-scanned field inspection form via `qr_token`), `ClientEvaluationPage` (`/evaluate-client/:token`, one-time staff-evaluation survey via `evaluation_client_tokens`, checks `is_used`/`expires_at`). Follow this same pattern (route in both blocks, expiring/single-use token row in its own table) for any new no-login flow.

## Document & report data model

- `documents` is the central table for anything in "Evraklar": linked to `user_definitions` (a single table for both `category='doc_type'` and `category='location'` tag values, scoped per-user or per-org), with `organization_id`/`uploader_id`/`billing_org_id` kept distinct because a document's *owner*, *uploader*, and *whose storage quota it counts against* can all differ (see quota section). `is_archived` is a soft-delete/supersede flag, not a hard delete.
- `env_reports` (monthly/yearly environmental reports) stores all form answers as a single `form_data` JSONB blob rather than columns — `EnvReportForm.tsx` writes it (multi-step wizard), `EnvReportView.tsx` reads it back into a fixed, hand-coded print/PDF layout (`window.print()`, A4 CSS). Every field renderer in the form has a matching, separately-hand-coded renderer in the view — they are **not** driven by the same schema/list, so a new field added to the form is invisible in the printable output until you also add it to `EnvReportView.tsx`. Per-field images (dropped onto a field in the form) are stored under a `${fieldKey}__img: {url, width}` key inside the same `form_data` blob, purely by convention — there's no dedicated column/table for them.
- `opinion_letters`, waste records (`WasteManagement.tsx` + static `wasteCodes.ts`), and regulation compliance (`regulation_articles` / `client_regulation_articles`, approval workflow, per-article compliance actions) are separate verticals with their own tables, each surfaced through a `ConsultantPanel`/`CompanyPanel` tab.

## Storage quota

Both `organizations` and `profiles` carry independent `storage_limit` columns (shared org quota vs. an individual's personal quota) plus a `storage_preference` (`supabase` storage or bring-your-own Google Drive, with OAuth tokens on the org row). The `add_storage_limit(target_id, is_corporate, bytes_to_add)` RPC is the only place quota is ever incremented — purchases go through `Pricing.tsx` (subscriptions + storage, org owners) or `Storage.tsx` (personal-quota-only purchase for `corporate_chief`/`corporate_staff` linked to a company, who are routed away from `/pricing`). `pricing_settings` (a JSON key/value table editable from `AdminPanel`) drives both the subscription and storage price tables.

## AI/analysis: two unrelated code paths, one unused dependency

`aiService.ts` (used by `AddDocument.tsx`'s "AI mode") does **not** call any LLM — it's local, rule-based text/keyword matching over PDF text extracted by `localScanner.ts`, against a static `DOCUMENT_KNOWLEDGE_BASE`. Separately, `api/parse-pdf.ts` (used for parsing regulation PDFs) calls Google Gemini (`gemini-2.5-flash`) directly via `fetch`, falling back to the local extractor on failure. The `openai` package in `package.json` is not imported anywhere — don't assume it's wired up to anything.

## `api/` — dual dev/prod execution

`api/parse-pdf.ts` and `api/google-oauth.ts` are written as Vercel serverless functions (`vercel.json` has the SPA rewrite) and are deployed that way in prod. In dev, since Vite doesn't run Vercel functions, `vite.config.ts` defines a custom `configureServer` middleware that intercepts `/api/parse-pdf` and `/api/google-oauth` and calls the exact same handler logic directly — keep the handler's core logic in the plain exported function (`parsePdfLogic`, `googleOauthLogic`) rather than in the Vercel-specific default export, so both paths keep working. `vite.config.ts` also proxies `/marker-api` to `http://127.0.0.1:8001` for an optional local PDF-OCR "marker" service (`localScanner.ts`) that most contributors won't have running — code calling it must tolerate it being absent.

## Two recurring footguns in this codebase's style

- **Tailwind class names must be static strings.** Anything shaped like `` `text-${color}-600` `` will not be generated by Tailwind's JIT scanner (no safelist is configured) and silently renders unstyled. Use a `Record<string, string>` lookup of full class names instead (see `SECTION_COLOR_CLASSES` in `EnvReportForm.tsx`).
- **Small "layout wrapper" components must be module-scope, not defined inside the page component.** The codebase's convention is to define page-local render-helper *functions* (`renderXxx()`, called as `{renderXxx()}`) freely inside a component — that's fine. But an actual JSX-tag component (`<Section>...</Section>`) defined inside another component's body gets a new function identity on every re-render, so React unmounts/remounts its whole subtree on every keystroke, dropping focus of any input inside it. Define any real `<Component>` used as a JSX tag above/outside the component that renders it.
