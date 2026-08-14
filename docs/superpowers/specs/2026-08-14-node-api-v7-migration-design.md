# node-api v5 → AdonisJS 7: Phase 1 (foundation, migrations, models)

**Date:** 2026-08-14
**Status:** Approved design, ready for implementation planning
**Scope of this document:** Phase 1 only — foundation, migrations, models. Endpoints are Phase 2 and get their own spec.

## Context

`/Users/atharahmed/Projects/aide/node-api` is an AdonisJS **v5** application. `aide-monorepo/apps/backend` is a fresh AdonisJS **7** API starter kit. The goal is to move the API to v7 so the already-built frontend (`aide-monorepo/apps/frontend`) can talk to a real backend instead of MSW mocks.

### What exists in v5

| Area | Count | Lines |
| --- | ---: | ---: |
| Migrations | 73 | 2,090 |
| Models | 68 | 4,581 |
| Controllers | 40 | 10,651 |
| Services | 25 | 7,962 |
| Bull jobs | 12 | 1,047 |
| Ace commands | 14 | 1,652 |
| Middleware | 5 | 241 |

Auth is OAT (opaque access tokens) stored in **Redis**, with a custom `legacy` hash driver. 35 models use `adonis-lucid-soft-deletes`.

### What exists in v7 target

`@adonisjs/core` 7.3.3, `@adonisjs/lucid` 22.4.2, `@adonisjs/auth` 10.1.0, `@vinejs/vine` 4, Tuyau registry, `BaseTransformer`, and a custom `ApiSerializer` provider that wraps responses in `data`. Currently: sqlite, one `User` model, three controllers.

### The finding that shapes this phase

**Lucid 22 generates models' columns from the database, not from migrations.** `node ace schema:generate` introspects the live connection (`OrmSchemaGeneratorConfig` takes `connectionName`, `excludeTables`, `schemas`; column metadata comes from Knex) and writes `database/schema.ts`. Models then compose the generated class:

```ts
export default class User extends compose(UserSchema, withAuthFinder(hash)) { … }
```

So the ~4,600 lines of `@column()` declarations in `app/Models` do not get ported — they get generated. Porting models means porting **relations, hooks and computed properties only**.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Database | Point v7 at the existing production Postgres (`aide`) | Real schema and real data; no import step |
| Access tokens | Add one new `auth_access_tokens` migration | The only new migration. Enables native `tokensGuard` + `DbAccessTokensProvider`, drops Redis from the auth path. Existing v5 sessions are invalidated — everyone logs in once |
| Response shape (Phase 2) | Starter's transformers + `data` wrapping, camelCase | Cleaner long-term and what the starter was built for. Frontend adapts feature by feature, alongside each endpoint |
| Soft deletes | Hand-rolled mixin | `adonis-lucid-soft-deletes@2.1.0` peers at `@adonisjs/lucid ^21`; target is 22. Lucid 22 has no built-in soft deletes. Verified `beforeFind`/`beforeFetch`/`beforePaginate`/`@computed` all still exist |
| Migrations | Port all 73 verbatim | History parity; lets v7 rebuild the schema from zero for CI or a new dev machine |
| Sequencing | Foundation → all models → vertical endpoint slices (Phase 2) | Lucid relations are typed in both directions, so a half-ported model graph does not compile. Doing them in one pass removes that churn from every later slice |

## Goal and completion criteria

`apps/backend` boots against the existing `aide` Postgres, every table is typed in `database/schema.ts`, all 68 models are ported with relations, hooks and computed properties intact.

**Done when both hold:**

1. `npm run typecheck` passes in `apps/backend`.
2. A unit test imports every model, resolves its table, and runs `.query().limit(1)` against the real database without error, preloading each declared relation on that row.

That test is the only meaningful proof available in this phase — it catches table-name, column and relation-key drift against real data, and there are no endpoints yet to test through.

## Design

### 1. Foundation

- Add `pg`. Change the default connection from sqlite to pg; the sqlite connection block is deleted rather than left dormant, since nothing will use it (`.env.test` overrides only `SESSION_DRIVER`, so tests share the same connection, and the Phase 1 verification test is read-only by design).
- `config/database.ts`: replace the sqlite default with a `pg` connection reading `PG_HOST`/`PG_PORT`/`PG_USER`/`PG_PASSWORD`/`PG_DB_NAME`. Keep `schemaGeneration.enabled: true` and `rulesPaths`. Add `excludeTables: ['adonis_schema', 'adonis_schema_versions']` so migration bookkeeping tables do not become model schemas.
- `start/env.ts`: add the `PG_*` variables.
- `config/hash.ts`: add a `legacy` driver and make it the default. It is a thin wrapper over `bcrypt` with 10 rounds.
- `config/cors.ts`: allow the frontend origin.
- `apps/backend/.env`: PG credentials, `APP_KEY`.

**Why a custom hash driver rather than Adonis's bundled bcrypt:** the bundled driver emits and expects PHC-format strings (`$bcrypt$v=98$r=10$…`). Existing rows hold raw `$2b$` hashes, which it will not verify. The v5 `LegacyHashDriver` is plain `bcrypt.hash(value, 10)` / `bcrypt.compare`; the v7 equivalent implements `HashDriverContract` with the same two calls plus `needsReHash() => false`.

**APP_KEY:** v5 uses `Encryption.decrypt` on widget tokens. If widget auth is ever ported, `APP_KEY` must match v5's or those tokens become undecryptable. Out of scope here; recorded so the value is not regenerated casually.

### 2. Migrations

Copy all 73 files to `apps/backend/database/migrations/` with **byte-identical filenames**. Lucid tracks applied migrations by filename in `adonis_schema`; identical names mean the existing rows already mark them applied, so `migration:run` is a no-op against the production schema.

Syntax changes are mechanical and uniform:

- `import BaseSchema from '@ioc:Adonis/Lucid/Schema'` → `import { BaseSchema } from '@adonisjs/lucid/schema'`
- Drop `public` modifiers on `up()` / `down()`
- `protected tableName` is unchanged

**The starter kit's two existing migrations must be reconciled first:**

- `1761885935168_create_users_table.ts` — **delete it.** It creates a `users` table with `full_name`, which collides with v5's `1637742137061_users.ts` (`name`, `first_name`, `last_name`, and no `full_name`). The v5 migration is authoritative.
- `1768620764696_create_access_tokens_table.ts` — **keep as-is.** Its timestamp already sorts after v5's highest (`1702000051000`), so it runs last on a fresh database and is the one new migration this project adds.

**Safety gate — must be the first executed step:** query `adonis_schema` and confirm its `name` values match the copied filenames exactly. `migration:run` must not be issued against the production database until that check passes. This has not been verified yet — the database was not reachable from the environment this design was written in.

### 3. Schema generation

Run `node ace schema:generate`. Output is `database/schema.ts`, committed to the repo, regenerated whenever the schema changes.

`database/schema_rules.ts` gains rules for columns the generator cannot type on its own — principally `json`/`jsonb`, which v5 declared as bare `object`: `users.widget_settings`, `users.email_preferences`, `accounts.utils_config`. These get real interfaces so downstream code is typed rather than `any`.

### 4. Models

68 files move to `app/models/*.ts` with snake_case filenames (v7 convention; `#models/*` import alias already configured).

Each model becomes:

```ts
export default class User extends compose(UserSchema, SoftDeletes) {
  // relations, hooks, getters
}
```

Per-model changes:

- **Columns:** deleted. Supplied by the generated schema class.
- **`public x: T`** → **`declare x: T`**.
- **Relation types:** import from `@adonisjs/lucid/types/relations`.
- **Computed properties (7 models):** port as plain getters, not `@computed()`. Response shapes are transformer-driven now, and transformers pick getters explicitly (the starter's `UserTransformer` already picks `initials` this way). `@computed()` still exists in Lucid 22 if it turns out to be needed.
- **Hooks:** `@beforeSave`, `@beforeCreate`, `@beforeFind` etc. port with the same decorators.
- **`Account.ts`** is the only model importing from `App/Services` (`ZendeskService`, `FieldsService`). Those methods are deferred — the model ports without them, and each returns with the endpoint slice that needs it. This keeps the 8k-line service layer out of Phase 1.

#### Reconciling the starter kit's `User`

The starter's `User` model, `UserTransformer`, `signupValidator` and all three of its controllers reference **`fullName`**. That column does not exist in the `aide` database — v5's `users` table has `name`, `first_name` and `last_name`. The moment `schema.ts` is regenerated from the real database, `UserSchema` loses `fullName` and those four files stop typechecking.

They are therefore in scope for Phase 1, minimally:

- `app/models/user.ts` — rewritten onto the real schema: `compose(UserSchema, SoftDeletes, withAuthFinder(hash))`, v5's `initials` getter (which reads `name`), the `beforeSave` password hook, the `beforeCreate` defaults hook (`widgetSettings`, `emailPreferences`, `widgetToken`), and the `account` / `responseTopic` / `activeIntegrations` relations.
- `app/validators/user.ts`, `app/transformers/user_transformer.ts`, `app/controllers/{access_tokens,new_account,profile}_controller.ts` — `fullName` → `name`. No behaviour change beyond the field rename; these are the starter's own auth endpoints and get their real Phase 2 treatment alongside the rest of the auth slice.

`typecheck` passing is part of this phase's completion criteria, so this cannot be deferred.

### 5. SoftDeletes mixin

`app/mixins/soft_deletes.ts`. Surface is deliberately small, driven by actual usage in the v5 codebase (`withTrashed()` at 5 call sites, `restore()` at 1, and `.delete()` relied on implicitly):

- `deletedAt` handling and an overridden instance `delete()` that sets `deleted_at` instead of issuing `DELETE`
- `beforeFind` / `beforeFetch` / `beforePaginate` hooks adding `where deleted_at is null`
- `static withTrashed()` — query builder with the filter skipped
- `static onlyTrashed()` — inverse filter
- `restore()` — clears `deleted_at`
- `forceDelete()` — real `DELETE`

`onlyTrashed()` and `forceDelete()` have no current callers but are included: they are a few lines each and their absence is the kind of gap that gets discovered mid-slice.

### 6. Verification

`tests/unit/models.spec.ts` iterates every exported model and, for each: resolves `Model.table`, runs `.query().limit(1)`, and asserts no error. Relations are exercised by preloading each declared relation on that same single row.

This runs against the real `aide` database. It is read-only.

## Known bad code found during analysis

Recorded here so it is fixed deliberately rather than faithfully reproduced.

1. **Routes bound to controllers that do not exist.** `start/routes.ts:93-115` wires `SnippetController` (8 routes) and `ProcessController` (7 routes). Neither file exists under `app/Controllers/Http/`. Only `Admin/SnippetController.ts` exists. These ~15 routes are dead in production today and are not ported.
2. **`Admin/IntegrationController.ts:13`** calls `(q as any).åwithTrashed()` — a stray `å` character. Throws at runtime if that branch is reached.
3. **`WorkflowController.ts` is 2,472 lines**; `Widget/CardController.ts` is 1,259; `MacroController.ts` is 942. Phase 2 concern, noted so it is planned for rather than discovered.
4. **Duplicated model families.** `Shopify*` (Customer/Order/Fulfillment/LineItem) and `Ecomm*` (Customer/Order/Fulfillment/OrderLineItem) look like the same concept at two generations. Both port in Phase 1; consolidation is a separate decision needing product input.

## Assumptions to verify before implementation

1. `adonis_schema` in the `aide` database contains 73 rows whose `name` values match the v5 migration filenames. **Unverified** — database was not reachable when this design was written. Blocks the migration step.
2. `auth_access_tokens` does not already exist in the database.
3. The `aide` database reachable at `127.0.0.1:5432` is a current copy of the production schema.
4. `users.password` values are raw bcrypt (`$2a$`/`$2b$` prefix). If any predate bcrypt, the legacy driver needs a second verification path.

## Out of scope for Phase 1

Controllers, routes, transformers, validators, middleware, Bull jobs, webhook handlers, ace commands, the scheduler, mail, Ally OAuth, Redis. The 8k-line service layer moves with the endpoint slices that need it, in Phase 2.

## Phase 2 preview (not designed here)

Endpoint migration proceeds as vertical full-stack slices: validator → controller → transformer → route → frontend queries switched off MSW → that mock handler deleted. The frontend's `src/mocks/handlers/` files are the contract (~90 endpoints) and are annotated as such. `handlers/agents.ts` is explicitly provisional — it has no v5 backend and maps to future `generative_configs` work.
