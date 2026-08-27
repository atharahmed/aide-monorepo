# Aide dashboard

Vite + React + TypeScript SPA. TanStack Router (file-based) for routing,
TanStack Query for server state, Tailwind v4 + shadcn/ui primitives for the
interface.

It talks to the existing AdonisJS v5 API (`node-api`) — the same backend the v5
dashboard uses. The v7 rewrite and Tuyau's end-to-end types come later; nothing
here depends on them.

## Running it

```bash
cp .env.example .env
npm run dev --workspace frontend      # http://localhost:3000
```

`.env`:

| Variable             | Meaning                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`       | API root, **no version segment** (`http://localhost:3333`). Each call names `/v1` or `/v2` itself — the v5 dashboard baked `/v1` into its base URL and string-replaced it to reach `/v2`, which is why deep links kept breaking. |
| `VITE_COOKIE_DOMAIN` | Parent domain for the session cookie. Empty locally; `aide.app` in deployed environments so every `*.aide.app` surface shares one session.                                                                                       |

The API must be reachable at `VITE_API_URL`. CORS is already open (`origin: '*'`)
and auth is a bearer token, so no proxy is needed.

## How the data layer is arranged

| File                 | What it holds                                                                  |
| -------------------- | ------------------------------------------------------------------------------ |
| `src/lib/api.ts`     | The single HTTP client. Explicit versioned paths, bearer auth, 401 → sign-out. |
| `src/lib/queries.ts` | Every server-state read and write. One hook per endpoint.                      |
| `src/types/api.ts`   | Wire types, written against what the API actually sends.                       |

### Two things about the wire format

Both are load-bearing and neither is obvious from the Lucid models:

1. **Ids are strings.** Primary and foreign keys are Postgres `bigint`, which the
   pg driver serialises as `"2420"`, not `2420`. Every id is `Id` (a string
   alias). Request payloads still send numbers where the validator says
   `schema.number()`.
2. **SQL aggregates are strings too.** `conversation_count`, `example_count` and
   friends arrive as `"98"`. They are typed `NumericString`; run them through
   `toNumber()` before arithmetic or `toLocaleString()`.

Request payloads are not uniform — some endpoints want snake_case, some
camelCase, `/v1/tickets` splits list parameters on `-` and takes `MM-dd-yyyy`
dates, `/v1/reports/summary` takes Unix **seconds**. Where a payload in
`queries.ts` looks inconsistent it is matching a validator, not inventing a
convention.

## Session and the helpdesk panels

`aide_token` is not ours alone to define — the backend writes it directly at the
end of the Google OAuth flow, so `src/lib/auth.ts` uses Adonis's plain-cookie
encoding: base64**url** of `{"message": "<token>"}`.

The Front, Zendesk and WordPress panels are already shipped and expect an exact
exchange, described in `src/features/auth/widget-handoff.ts`:

- the panel embeds `/login` in an iframe; with no session that page posts the
  bare string `login_required` to its parent
- the panel opens `/login?source=<panel>` in a popup
- after sign-in the popup lands on `/login/widget`, which posts the user's
  `widget_token` — a bare string, not an object — to `window.opener` at the
  panel's own origin, then closes

Message payloads and target origins are part of that contract. A wrong origin
means `postMessage` silently drops the token and the panel hangs forever.

## Layout

```
src/
  routes/            file-based routes; `_authenticated/route.tsx` is the app shell
  components/ui/     shadcn primitives
  components/        app-level shared components (sidebar, page header, data viz)
  features/          per-area logic: conversations, scenarios, knowledge, agents,
                     onboarding, integrations, auth
  lib/               api client, auth cookie, query hooks, formatting
  types/api.ts       wire types
```

## Agents

`/agents` is designed but has no backend: node-api exposes no `/v1/agents`
routes. The screens are parked — the routes redirect to Home and the sidebar
entry is gone — rather than shipping a page that can only error. Deleting the
`beforeLoad` redirect in `src/routes/_authenticated/agents/*` switches the
section back on once the endpoints exist.

## Design system

Defined once in `src/styles.css`. Every colour is a full 50–950 scale
(`gray`, `success`, `destructive`, `warning`, `info`); shadcn's semantic tokens
map onto those scales rather than onto raw hexes, so dark mode is a remap of one
block. Components reference scale steps only — there are no one-off hex values.

Type is Helvetica Neue, 13–14px base, `-0.02em` tracking on headings. Radii are
8px for cards and inputs, 6px for buttons. Shadows appear on popovers and
dialogs only.

## Commands

```bash
npm run build --workspace frontend
npm run typecheck --workspace frontend    # strict, zero errors expected
npm run format --workspace frontend
```
