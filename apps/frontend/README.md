# Aide dashboard

Vite + React + TypeScript SPA. TanStack Router (file-based) for routing,
TanStack Query for server state, Tailwind v4 + shadcn/ui primitives for the
interface.

## Phase 1: everything runs on mocks

The app boots standalone with no backend. Every request is intercepted by MSW at
the **real API paths** (`/v1/...`, `/v2/...`) and answered from an in-memory
store, so the data layer is written exactly as it will be against the live API.

```bash
npm run dev --workspace frontend      # http://localhost:3000
```

Sign in with any email and password.

### Where the fake data lives

All of it is in `src/mocks/` — nothing outside that directory knows the API is
fake.

| File | What it holds |
|---|---|
| `src/mocks/seed.ts` | **The demo dataset.** The tenant, team, 200+ conversations, topic taxonomy, scenarios, macros, knowledge, agents. Deterministic seed, dates relative to today. |
| `src/mocks/db.ts` | In-memory store. Mutations land here, so creating a scenario or replying to a conversation persists for the session. |
| `src/mocks/handlers/*.ts` | One file per API area. Each handler adds 150–400ms latency so loading states are visible. |
| `src/mocks/utils.ts` | Ticket filtering, mirroring `TicketService.search` on the backend. |

To change what the demo shows, edit `seed.ts`. Nothing else needs to move.

### Response shapes

`src/types/api.ts` mirrors what the AdonisJS backend actually serialises —
snake_case field names, `paginationMeta`, `conjunctions` on workflows, the `/me`
payload with its team flags. Those names come from the v5 controllers and must
not be tidied up: Phase 2 depends on them matching.

## Phase 2: connecting the real API

```bash
VITE_USE_MOCKS=false npm run dev --workspace frontend
```

That skips the MSW worker; `src/lib/api.ts` then talks to `VITE_API_URL`. Because
the mocks live at the network layer with the real paths and shapes, no component
changes are needed. Tuyau types can then be adopted per feature.

Two things stay behind:

- **`src/mocks/handlers/agents.ts`** — the Agents section has no backend yet. It
  is marked `PROVISIONAL API` and survives the cutover.
- The rest of `src/mocks/` — kept for tests and offline demos.

## Layout

```
src/
  routes/            file-based routes; `_app.tsx` is the authenticated shell
  components/ui/     shadcn primitives
  components/        app-level shared components (sidebar, page header, data viz)
  features/          per-area logic: conversations, scenarios, knowledge, agents,
                     onboarding (the ported action engine), integrations, auth
  lib/               api client, auth cookie, query hooks, formatting
  types/api.ts       wire types
  mocks/             the mock API (see above)
```

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
