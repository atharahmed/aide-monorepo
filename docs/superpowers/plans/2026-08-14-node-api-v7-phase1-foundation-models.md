# node-api → AdonisJS 7, Phase 1: Foundation, Migrations, Models — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `aide-monorepo/apps/backend` (AdonisJS 7) boot against the existing `aide` Postgres database with all 71 Lucid models ported from the v5 app and proven against real data.

**Architecture:** Lucid 22 generates model columns by introspecting the live database (`node ace schema:generate` → `database/schema.ts`), so models are ported as relations, hooks and getters composed onto generated schema classes. Migrations are copied with byte-identical filenames so the existing `adonis_schema` rows mark them applied and `migration:run` is a no-op against production data. Models land first as minimal stubs — which alone proves every table name and column set matches reality — then relations are added cluster by cluster.

**Tech Stack:** AdonisJS 7.3.3, Lucid 22.4.2, `@adonisjs/auth` 10.1.0, VineJS 4, Japa 5, PostgreSQL, TypeScript 6.

## Global Constraints

- Working directory for all commands is `/Users/atharahmed/Projects/aide/aide-monorepo/apps/backend` unless stated otherwise.
- The v5 source tree is read-only reference at `/Users/atharahmed/Projects/aide/node-api`. Never modify it.
- The database is **production data**. Only `migration:run` in Task 4 writes to it; every other database interaction in this plan is read-only. No `migration:rollback`, no `migration:fresh`, no `db:wipe`, no `db:truncate` at any point.
- Filenames of ported migrations must be **byte-identical** to the v5 originals. A renamed migration file is treated by Lucid as unapplied and will attempt to re-create an existing table.
- Models use snake_case filenames (`app/models/text_classification_card.ts`), classes stay PascalCase.
- `serializeAs` options are dropped from all ported relations and columns — response shaping is transformer-driven in Phase 2.
- `@computed()` is not ported; computed properties become plain getters.
- Test command is `node ace test --files <spec-name>`; typecheck is `npm run typecheck`.
- Commit after every task. Never commit `.env`.

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `app/hash_drivers/legacy_bcrypt.ts` | Raw-bcrypt hash driver so existing `$2b$` password rows verify |
| `app/models/*.ts` (71 files) | One Lucid model per table: relations, hooks, getters |
| `app/models/index.ts` | Barrel re-exporting all 71 models; drives the parity test |
| `database/migrations/*.ts` (73 files) | Copied from v5, syntax-updated |
| `tests/unit/database.spec.ts` | Connection and table-presence checks |
| `tests/unit/hash.spec.ts` | Legacy bcrypt interop |
| `tests/unit/migrations.spec.ts` | `adonis_schema` ↔ migration-file parity |
| `tests/unit/models.spec.ts` | Per-model table/column parity, then relation preloads |

**Modified:** `config/database.ts`, `config/hash.ts`, `start/env.ts`, `package.json`, `.env`, `.env.example`, `database/schema_rules.ts`, `app/models/user.ts`, `app/validators/user.ts`, `app/transformers/user_transformer.ts`, `app/controllers/{access_tokens,new_account,profile}_controller.ts`.

**Deleted:** `database/migrations/1761885935168_create_users_table.ts`.

**Generated (committed, never hand-edited):** `database/schema.ts`.

---

### Task 1: Point the app at Postgres

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `start/env.ts`
- Modify: `config/database.ts` (replace entire file)
- Modify: `.env`, `.env.example`
- Test: `tests/unit/database.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a `pg` connection named `pg` as the default Lucid connection; env vars `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DB_NAME` typed on the `env` service.

- [ ] **Step 1: Install the Postgres driver and drop sqlite**

```bash
npm uninstall better-sqlite3
npm install pg
npm install -D @types/pg
```

- [ ] **Step 2: Add the PG variables to the env schema**

In `start/env.ts`, add this block inside the `Env.create` object, after the `Session` block:

```ts
  // Database
  PG_HOST: Env.schema.string({ format: 'host' }),
  PG_PORT: Env.schema.number(),
  PG_USER: Env.schema.string(),
  PG_PASSWORD: Env.schema.string.optional(),
  PG_DB_NAME: Env.schema.string(),
```

- [ ] **Step 3: Add the credentials to `.env` and `.env.example`**

Append to `.env` (values copied from `/Users/atharahmed/Projects/aide/node-api/.env`):

```
# Database
PG_HOST=127.0.0.1
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=<copy from node-api/.env>
PG_DB_NAME=aide
```

Append the same keys to `.env.example` with empty values. `.env` is gitignored; confirm with `git check-ignore .env` before continuing.

**Do not regenerate `APP_KEY`.** v5 encrypts widget tokens with it. Phase 1 does not use them, but a rotated key makes every existing widget token permanently undecryptable, so the value is left alone from here on.

- [ ] **Step 3b: Confirm CORS already admits the frontend**

```bash
grep -n "origin:" config/cors.ts
```

Expected: `origin: app.inDev ? true : []`. In development that already allows the Vite dev server, so **no change is needed**. Production origins are a Phase 2 deployment concern; leave the empty allowlist as the safe default.

- [ ] **Step 4: Replace `config/database.ts`**

```ts
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'pg',

  connections: {
    pg: {
      client: 'pg',

      connection: {
        host: env.get('PG_HOST'),
        port: env.get('PG_PORT'),
        user: env.get('PG_USER'),
        password: env.get('PG_PASSWORD'),
        database: env.get('PG_DB_NAME'),
      },

      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },

      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
        excludeTables: ['adonis_schema', 'adonis_schema_versions'],
      },

      debug: false,
    },
  },
})

export default dbConfig
```

- [ ] **Step 5: Write the failing test**

Create `tests/unit/database.spec.ts`:

```ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

test.group('Database connection', () => {
  test('connects to the configured database', async ({ assert }) => {
    const result = await db.rawQuery('select current_database() as name')
    assert.equal(result.rows[0].name, env.get('PG_DB_NAME'))
  })

  test('the v5 schema is present', async ({ assert }) => {
    const result = await db.rawQuery(
      `select table_name from information_schema.tables where table_schema = 'public'`
    )
    const tables = result.rows.map((row: { table_name: string }) => row.table_name)

    assert.includeMembers(tables, ['users', 'accounts', 'tickets', 'adonis_schema'])
    assert.isAbove(tables.length, 60)
  })
})
```

- [ ] **Step 6: Run the test**

```bash
node ace test --files database
```

Expected: PASS. If it fails with a connection error, the local Postgres is not running or the credentials differ — resolve that before any later task, since everything downstream depends on this connection.

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json start/env.ts config/database.ts .env.example tests/unit/database.spec.ts
git commit -m "feat(backend): connect to the aide postgres database"
```

---

### Task 2: Legacy bcrypt hash driver

Existing `users.password` values are raw bcrypt (`$2b$…`). AdonisJS's bundled bcrypt driver emits and expects PHC-format strings (`$bcrypt$v=98$r=10$…`) and will not verify them.

**Files:**
- Modify: `package.json` (dependencies + `imports` map)
- Create: `app/hash_drivers/legacy_bcrypt.ts`
- Modify: `config/hash.ts` (replace entire file)
- Test: `tests/unit/hash.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `LegacyBcryptDriver` (named export, implements `HashDriverContract`), registered as hasher `legacy` and set as the default. Subpath imports `#hash_drivers/*` and `#mixins/*` become available.

- [ ] **Step 1: Install bcrypt and register two subpath aliases**

```bash
npm install bcrypt
npm install -D @types/bcrypt
```

In `package.json`, add these two entries to the existing `imports` object (`#mixins/*` is needed by the already-written `app/mixins/soft_delete.ts`, which currently has no alias):

```json
    "#hash_drivers/*": "./app/hash_drivers/*.js",
    "#mixins/*": "./app/mixins/*.js",
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/hash.spec.ts`:

```ts
import bcrypt from 'bcrypt'
import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import { LegacyBcryptDriver } from '#hash_drivers/legacy_bcrypt'

test.group('Legacy bcrypt hasher', () => {
  test('verifies raw bcrypt hashes created outside AdonisJS', async ({ assert }) => {
    const stored = await bcrypt.hash('secret123', 10)

    assert.isTrue(await hash.verify(stored, 'secret123'))
    assert.isFalse(await hash.verify(stored, 'wrong-password'))
  })

  test('round-trips its own hashes', async ({ assert }) => {
    const made = await hash.make('secret123')

    assert.match(made, /^\$2[aby]\$10\$/)
    assert.isTrue(await hash.verify(made, 'secret123'))
  })

  test('rejects non-bcrypt values instead of throwing', async ({ assert }) => {
    const driver = new LegacyBcryptDriver()

    assert.isFalse(driver.isValidHash('$scrypt$n=16384,r=8,p=1$c2FsdA$aGFzaA'))
    assert.isFalse(driver.isValidHash(''))
    assert.isFalse(await driver.verify('not-a-hash', 'secret123'))
  })

  test('never asks for a rehash', ({ assert }) => {
    assert.isFalse(new LegacyBcryptDriver().needsReHash('$2b$10$abc'))
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
node ace test --files hash
```

Expected: FAIL — cannot resolve `#hash_drivers/legacy_bcrypt`.

- [ ] **Step 4: Write the driver**

Create `app/hash_drivers/legacy_bcrypt.ts`:

```ts
import bcrypt from 'bcrypt'
import type { HashDriverContract } from '@adonisjs/core/types/hash'

const ROUNDS = 10

/**
 * Matches raw bcrypt output ($2a$/$2b$/$2y$ + cost + 53 char salt-and-digest).
 * Deliberately does NOT match AdonisJS's PHC-wrapped bcrypt format — those
 * values never appear in this database.
 */
const RAW_BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/

/**
 * Verifies the raw bcrypt hashes written by the v5 application. The bundled
 * AdonisJS bcrypt driver cannot read them: it expects PHC-format strings.
 */
export class LegacyBcryptDriver implements HashDriverContract {
  isValidHash(value: string): boolean {
    return RAW_BCRYPT.test(value)
  }

  async make(value: string): Promise<string> {
    return bcrypt.hash(value, ROUNDS)
  }

  async verify(hashedValue: string, plainValue: string): Promise<boolean> {
    if (!this.isValidHash(hashedValue)) {
      return false
    }
    return bcrypt.compare(plainValue, hashedValue)
  }

  needsReHash(): boolean {
    return false
  }
}
```

- [ ] **Step 5: Replace `config/hash.ts`**

```ts
import { defineConfig } from '@adonisjs/core/hash'
import { LegacyBcryptDriver } from '#hash_drivers/legacy_bcrypt'

/**
 * The v5 application hashed passwords with raw bcrypt at 10 rounds. Every
 * existing row is in that format, so it stays the default hasher.
 */
const hashConfig = defineConfig({
  default: 'legacy',

  list: {
    legacy: () => new LegacyBcryptDriver(),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
node ace test --files hash
npm run typecheck
```

Expected: PASS for both.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app/hash_drivers config/hash.ts tests/unit/hash.spec.ts
git commit -m "feat(backend): add legacy bcrypt hasher for existing password rows"
```

---

### Task 3: Port the 73 migrations

**Files:**
- Delete: `database/migrations/1761885935168_create_users_table.ts`
- Create: `database/migrations/*.ts` (73 files copied from v5)
- Test: `tests/unit/migrations.spec.ts`

**Interfaces:**
- Consumes: the `pg` connection from Task 1
- Produces: a migrations directory where exactly one file (`1768620764696_create_access_tokens_table.ts`) is unapplied.

- [ ] **Step 1: Record the actual `adonis_schema` row format**

The parity test in Step 5 asserts on the stored `name` format. Confirm it rather than assuming:

```bash
node ace repl
```

Then in the REPL:

```js
const db = await import('@adonisjs/lucid/services/db')
await db.default.from('adonis_schema').select('name').orderBy('id').limit(3)
```

Expected shape: `database/migrations/1637742137061_users` (path-prefixed, no extension). **If the stored format differs, adjust the `expected` construction in Step 5 to match — do not adjust the database.** Record the observed format in the commit message.

- [ ] **Step 2: Delete the starter's conflicting users migration**

```bash
rm database/migrations/1761885935168_create_users_table.ts
```

It creates `users` with a `full_name` column. The real table has `name`, `first_name` and `last_name`, and is created by v5's `1637742137061_users.ts`.

- [ ] **Step 3: Copy the v5 migrations verbatim**

```bash
cp /Users/atharahmed/Projects/aide/node-api/database/migrations/*.ts database/migrations/
ls database/migrations/*.ts | wc -l
```

Expected: `74` (73 copied + the access-tokens migration).

- [ ] **Step 4: Apply the v5 → v7 syntax transform**

```bash
sed -i '' \
  -e "s|import BaseSchema from '@ioc:Adonis/Lucid/Schema'|import { BaseSchema } from '@adonisjs/lucid/schema'|" \
  -e 's/public async up()/async up()/' \
  -e 's/public async down()/async down()/' \
  database/migrations/*.ts

grep -rl "@ioc:" database/migrations/ || echo "no @ioc: imports remain"
```

Expected: `no @ioc: imports remain`.

- [ ] **Step 5: Write the parity test**

Create `tests/unit/migrations.spec.ts`:

```ts
import { readdir } from 'node:fs/promises'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'

const ACCESS_TOKENS = 'database/migrations/1768620764696_create_access_tokens_table'

test.group('Migration history parity', () => {
  test('every ported migration is already recorded as applied', async ({ assert }) => {
    const files = (await readdir(app.makePath('database/migrations')))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => `database/migrations/${name.replace(/\.ts$/, '')}`)

    const rows = await db.from('adonis_schema').select('name')
    const applied = new Set(rows.map((row: { name: string }) => row.name))

    const pending = files.filter((file) => !applied.has(file)).sort()

    assert.deepEqual(pending, [ACCESS_TOKENS])
  })

  test('no applied migration is missing from the repo', async ({ assert }) => {
    const files = new Set(
      (await readdir(app.makePath('database/migrations')))
        .filter((name) => name.endsWith('.ts'))
        .map((name) => `database/migrations/${name.replace(/\.ts$/, '')}`)
    )

    const rows = await db.from('adonis_schema').select('name')
    const orphaned = rows
      .map((row: { name: string }) => row.name)
      .filter((name: string) => !files.has(name))

    assert.deepEqual(orphaned, [])
  })
})
```

- [ ] **Step 6: Run the test**

```bash
node ace test --files migrations
npm run typecheck
```

Expected: PASS. A failure here means a filename drifted during the copy, or `adonis_schema` does not hold what the design assumed. **Stop and report rather than working around it** — Task 4 runs migrations against production data and depends entirely on this result.

- [ ] **Step 7: Commit**

```bash
git add database/migrations tests/unit/migrations.spec.ts
git commit -m "feat(backend): port 73 v5 migrations with filenames preserved"
```

---

### Task 4: Create the `auth_access_tokens` table

This is the only step in the plan that writes to the database.

**Files:**
- Test: `tests/unit/migrations.spec.ts` (extend)

**Interfaces:**
- Consumes: the verified parity from Task 3
- Produces: an `auth_access_tokens` table, enabling `DbAccessTokensProvider` in Phase 2.

- [ ] **Step 1: Confirm exactly one migration is pending**

```bash
node ace migration:status
```

Expected: every row `completed` except `1768620764696_create_access_tokens_table`, which reads `pending`. **If any other migration reads `pending`, stop — running would attempt to re-create a live table.**

- [ ] **Step 2: Run the migration**

```bash
node ace migration:run
```

Expected: one migration executed.

- [ ] **Step 3: Add the verification test**

Append to `tests/unit/migrations.spec.ts`:

```ts
test.group('Access tokens table', () => {
  test('auth_access_tokens exists with the expected columns', async ({ assert }) => {
    const result = await db.rawQuery(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'auth_access_tokens'`
    )
    const columns = result.rows.map((row: { column_name: string }) => row.column_name)

    assert.includeMembers(columns, [
      'id',
      'tokenable_id',
      'type',
      'name',
      'hash',
      'abilities',
      'created_at',
      'updated_at',
      'last_used_at',
      'expires_at',
    ])
  })
})
```

- [ ] **Step 4: Run the tests**

```bash
node ace test --files migrations
```

Expected: PASS, including the parity test — which now reports zero pending migrations, so update the first assertion to `assert.deepEqual(pending, [])` and remove the now-unused `ACCESS_TOKENS` constant.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/migrations.spec.ts
git commit -m "feat(backend): create auth_access_tokens table"
```

---

### Task 5: Generate the schema classes

**Files:**
- Create: `database/schema.ts` (generated)
- Modify: `database/schema_rules.ts`

**Interfaces:**
- Consumes: the `pg` connection and `schemaGeneration` config from Task 1
- Produces: one exported schema class per table — `UserSchema`, `AccountSchema`, `TicketSchema`, … — each extending `BaseModel` with `@column()` declarations. Every model in Tasks 7–14 composes one of these.

- [ ] **Step 1: Generate**

```bash
node ace schema:generate
```

- [ ] **Step 2: Inspect the output**

```bash
grep -c "^export class" database/schema.ts
grep -n "class UserSchema" -A 40 database/schema.ts
```

Expected: a class count matching the table count from Task 1's test, and `UserSchema` containing `name`, `firstName`, `lastName`, `accountId`, `widgetSettings`, `emailPreferences`, `widgetToken`, `deletedAt` — and **no** `fullName`.

- [ ] **Step 3: Type the JSON columns**

Check what the generator emitted for the `jsonb` columns:

```bash
grep -n "widgetSettings\|emailPreferences\|utilsConfig" database/schema.ts
```

If they are typed `any`, replace `database/schema_rules.ts` with:

```ts
import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Shapes for the jsonb columns the v5 app declared as bare `object`.
 * Kept in one place so the generated schema stays typed across regenerations.
 */
export interface WidgetSettings {
  settings: Array<{ name: string; active: boolean }>
}

export interface EmailPreferences {
  weekly_summary: boolean
  onboarding_sequences: boolean
  event_based: boolean
  marketing: boolean
  event_invitations: boolean
}

export interface UtilsConfig {
  chat_settings?: Record<string, unknown>
  custom_workflow_conditions?: Array<Record<string, unknown>>
  [key: string]: unknown
}

const jsonImport = (typeName: string) => ({
  tsType: `${typeName} | null`,
  decorators: [{ name: 'column' }],
  imports: [
    {
      source: '#database/schema_rules',
      typeImports: [typeName],
    },
  ],
})

export default {
  tables: {
    users: {
      columns: {
        widget_settings: jsonImport('WidgetSettings'),
        email_preferences: jsonImport('EmailPreferences'),
      },
    },
    accounts: {
      columns: {
        utils_config: jsonImport('UtilsConfig'),
      },
    },
  },
} satisfies SchemaRules
```

Then regenerate:

```bash
node ace schema:generate
grep -n "widgetSettings\|emailPreferences\|utilsConfig" database/schema.ts
```

Expected: the three columns now carry the interface types.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: FAIL — four files reference `fullName`, which `UserSchema` no longer has. That is exactly what Task 6 fixes; do not patch them here.

- [ ] **Step 5: Commit**

```bash
git add database/schema.ts database/schema_rules.ts
git commit -m "feat(backend): generate lucid schema classes from the aide database"
```

---

### Task 6: Reconcile the starter kit's `User`

`schema.ts` no longer has `fullName`, so the starter's model, validator, transformer and three controllers do not compile.

**Files:**
- Modify: `app/models/user.ts`
- Modify: `app/validators/user.ts`
- Modify: `app/transformers/user_transformer.ts`
- Modify: `app/controllers/new_account_controller.ts`
- Modify: `app/controllers/access_tokens_controller.ts`

**Interfaces:**
- Consumes: `UserSchema` from `#database/schema`, `SoftDeletes` from `#mixins/soft_delete`
- Produces: `User` (default export of `#models/user`) with `initials` getter, `accessTokens` provider and `currentAccessToken`. Task 8 adds its relations and hooks.

- [ ] **Step 1: Replace `app/models/user.ts`**

```ts
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { UserSchema } from '#database/schema'
import { SoftDeletes } from '#mixins/soft_delete'

export default class User extends compose(UserSchema, SoftDeletes, withAuthFinder(hash)) {
  static accessTokens = DbAccessTokensProvider.forModel(User)
  declare currentAccessToken?: AccessToken

  /**
   * Ported from v5. Reads `name`, which is the column this database has —
   * the starter kit's version read a `full_name` column that does not exist.
   */
  get initials() {
    const name = this.name
    if (!name) {
      return ''
    }

    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }

    return name[0].toUpperCase()
  }
}
```

Note: v5 hashed passwords in a `@beforeSave` hook calling `Hash.use('legacy')`. That hook is **not** ported — `withAuthFinder` already hashes on save using the default hasher, which Task 2 set to `legacy`. Porting both would double-hash every password.

- [ ] **Step 2: Update the validator**

In `app/validators/user.ts`, change `fullName` to `name` in `signupValidator`:

```ts
export const signupValidator = vine.create({
  name: vine.string().nullable(),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})
```

- [ ] **Step 3: Update the transformer**

In `app/transformers/user_transformer.ts`, replace `'fullName'` with `'name'` in the `pick` array.

- [ ] **Step 4: Update the controller**

In `app/controllers/new_account_controller.ts`, change the destructure and create call:

```ts
    const { name, email, password } = await request.validateUsing(signupValidator)

    const user = await User.create({ name, email, password })
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: PASS. If `access_tokens_controller.ts` or `profile_controller.ts` still error, they reference `fullName` indirectly through the transformer — re-check Step 3.

- [ ] **Step 6: Commit**

```bash
git add app/models/user.ts app/validators/user.ts app/transformers/user_transformer.ts app/controllers
git commit -m "fix(backend): point starter User at the real users table columns"
```

---

### Task 7: Model stubs and the parity test

Creating all 71 models as stubs first means the parity test can run before any relation work — it proves every table name and column set matches the real database, which is the single highest-value check in this phase.

**Files:**
- Create: `app/models/*.ts` (70 files; `user.ts` exists from Task 6)
- Create: `app/models/index.ts`
- Test: `tests/unit/models.spec.ts`

**Interfaces:**
- Consumes: schema classes from `#database/schema`, `SoftDeletes` from `#mixins/soft_delete`
- Produces: a default-exported model class per file, all re-exported by name from `#models/index`. Tasks 8–14 add relations to these same files.

- [ ] **Step 1: Write one stub by hand to fix the pattern**

Create `app/models/account.ts`:

```ts
import { compose } from '@adonisjs/core/helpers'
import { AccountSchema } from '#database/schema'
import { SoftDeletes } from '#mixins/soft_delete'

export default class Account extends compose(AccountSchema, SoftDeletes) {}
```

And a model without soft deletes — create `app/models/ticket_inbox.ts`:

```ts
import { TicketInboxSchema } from '#database/schema'

export default class TicketInbox extends TicketInboxSchema {}
```

The rule: a model composes `SoftDeletes` **iff** its v5 source imports it. The 35 that do are listed in Step 2.

- [ ] **Step 2: Create the remaining 68 stubs**

These 35 models compose `SoftDeletes` (v5 sources import `@ioc:Adonis/Addons/LucidSoftDeletes`):

`APIToken`, `Account`, `ActiveIntegration`, `Charge`, `ChatSuggestedAction`, `CollectableField`, `ComplianceRequest`, `Feedback`, `GenerativeConfig`, `Integration`, `KnowledgeDocument`, `KnowledgeEntity`, `KnowledgeWebsite`, `Link`, `Macro`, `Process`, `QaEmbedExample`, `Response`, `ResponseTopic`, `Snippet`, `SnippetGroup`, `StripeCustomer`, `StripeInvoice`, `TextClassificationCard`, `TextClassificationCardExample`, `TextClassificationCardIntegrationSetting`, `TextClassificationLabel`, `Ticket`, `TicketUser`, `User`, `Workflow`, `WorkflowAction`, `WorkflowCollectableField`, `WorkflowCondition`, `WorkflowMacro`

The other 36 extend their schema class directly:

`AccountDocument`, `AideEmailUnsubscribe`, `AideExecutedMacro`, `CachedLlmGeneration`, `CardAggregate`, `EcommCollection`, `EcommCustomer`, `EcommFulfillment`, `EcommOrder`, `EcommOrderLineItem`, `EcommProduct`, `EcommProductInCollection`, `EcommProductVariant`, `ExecutedWorkflow`, `GenerativeContext`, `HelpCenter`, `IntegratedContact`, `MacroAction`, `PasswordReset`, `ProcessStep`, `ShopifyCustomer`, `ShopifyFulfillment`, `ShopifyLineItem`, `ShopifyOrder`, `TextClassificationTicketLabel`, `TicketComment`, `TicketCommentArticleSearch`, `TicketCommentAttachable`, `TicketCommentAttachment`, `TicketCommentError`, `TicketEcommAttachable`, `TicketInbox`, `TicketShopifyAttachable`, `TicketSource`, `UserInvitation`, `WidgetUsageLogs`

Filenames are the snake_case of the class name (`APIToken` → `api_token.ts`, `TextClassificationCard` → `text_classification_card.ts`, `WidgetUsageLogs` → `widget_usage_logs.ts`). The schema class name is the class name + `Schema`; verify each against `grep "^export class" database/schema.ts` — if a generated name differs from the guess (pluralisation or acronym casing), the generated name wins.

- [ ] **Step 3: Create the barrel**

Create `app/models/index.ts` with exactly one line per model — all 71 names from Step 2, sorted alphabetically by class name, each following this form:

```ts
export { default as APIToken } from '#models/api_token'
export { default as Account } from '#models/account'
export { default as AccountDocument } from '#models/account_document'
export { default as ActiveIntegration } from '#models/active_integration'
export { default as AideEmailUnsubscribe } from '#models/aide_email_unsubscribe'
```

…continuing through `export { default as WorkflowMacro } from '#models/workflow_macro'`. The file must have 71 export lines; Step 4's first test asserts that count.

- [ ] **Step 4: Write the parity test**

Create `tests/unit/models.spec.ts`:

```ts
import { test } from '@japa/runner'
import * as models from '#models/index'
import type { BaseModel } from '@adonisjs/lucid/orm'

const entries = Object.entries(models) as Array<[string, typeof BaseModel]>

test.group('Model schema parity', () => {
  test('all 71 models are exported', ({ assert }) => {
    assert.lengthOf(entries, 71)
  })

  for (const [name, Model] of entries) {
    test(`${name} queries its table`, async ({ assert }) => {
      assert.isString(Model.table)
      const rows = await Model.query().limit(1)
      assert.isArray(rows)
    })
  }
})
```

- [ ] **Step 5: Run the test**

```bash
node ace test --files models
npm run typecheck
```

Expected: PASS for all 71. A failure names the model whose table or column set does not match the database — usually a wrong schema class or a mis-derived filename. Fix the model, not the database.

- [ ] **Step 6: Commit**

```bash
git add app/models tests/unit/models.spec.ts
git commit -m "feat(backend): add all 71 lucid models with schema parity test"
```

---

## Tasks 8–14: Relations, hooks and getters

27 of the 71 models have no relations, hooks or computed properties in v5 and are **complete as stubs**: `AideEmailUnsubscribe`, `ChatSuggestedAction`, `CollectableField`, `ComplianceRequest`, `EcommCollection`, `EcommProduct`, `EcommProductInCollection`, `EcommProductVariant`, `Feedback`, `IntegratedContact`, `KnowledgeWebsite`, `Link`, `PasswordReset`, `QaEmbedExample`, `ShopifyLineItem`, `StripeCustomer`, `StripeInvoice`, `TextClassificationTicketLabel`, `TicketCommentAttachment`, `TicketCommentError`, `TicketEcommAttachable`, `TicketInbox`, `TicketShopifyAttachable`, `TicketSource`, `WidgetUsageLogs`, `WorkflowAction`, `WorkflowCondition`.

The remaining 44 are split across Tasks 8–14 by domain. **Every one of these tasks follows the same five steps and the same transformation rules**, given once here.

### Transformation rules

Applied to each model, reading the v5 source at `/Users/atharahmed/Projects/aide/node-api/app/Models/<ClassName>.ts`:

| v5 | v7 |
| --- | --- |
| `import { belongsTo, BelongsTo, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'` | `import { belongsTo, hasMany } from '@adonisjs/lucid/orm'` + `import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'` |
| `import { beforeSave } from '@ioc:Adonis/Lucid/Orm'` | `import { beforeSave } from '@adonisjs/lucid/orm'` |
| `import Account from 'App/Models/Account'` | `import Account from '#models/account'` |
| `public account: BelongsTo<typeof Account>` | `declare account: BelongsTo<typeof Account>` |
| `public static async hook(...)` | `static async hook(...)` |
| `@computed()` + `public get x()` | plain `get x()`, decorator removed |
| `{ serializeAs: 'active_integrations' }` | option removed entirely |
| `{ localKey, foreignKey, pivotTable, pivotColumns }` | unchanged — copy verbatim |
| `import { uuid } from 'uuidv4'` | `import { randomUUID } from 'node:crypto'` |
| `@column()` declarations | **deleted** — supplied by the schema class |

Two behaviours that must **not** be ported:

- Any `@beforeSave` hook that hashes a password. `withAuthFinder` already does this; porting both double-hashes.
- Any method importing from `App/Services`. Only `Account.ts` has these (`ZendeskService`, `FieldsService`) — they return with their endpoint slice in Phase 2.

### Worked example

v5 `app/Models/User.ts` relations:

```ts
  @belongsTo(() => Account)
  public account: BelongsTo<typeof Account>

  @belongsTo(() => ResponseTopic, {
    localKey: 'userId',
    foreignKey: 'id',
    serializeAs: 'response_topic',
  })
  public responseTopic: BelongsTo<typeof ResponseTopic>

  @hasMany(() => ActiveIntegration, {
    localKey: 'accountId',
    foreignKey: 'accountId',
    serializeAs: 'active_integrations',
  })
  public activeIntegrations: HasMany<typeof ActiveIntegration>
```

become, appended to the v7 `app/models/user.ts` body:

```ts
  @belongsTo(() => Account)
  declare account: BelongsTo<typeof Account>

  @belongsTo(() => ResponseTopic, { localKey: 'userId', foreignKey: 'id' })
  declare responseTopic: BelongsTo<typeof ResponseTopic>

  @hasMany(() => ActiveIntegration, { localKey: 'accountId', foreignKey: 'accountId' })
  declare activeIntegrations: HasMany<typeof ActiveIntegration>
```

with imports:

```ts
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Account from '#models/account'
import ActiveIntegration from '#models/active_integration'
import ResponseTopic from '#models/response_topic'
```

### The five steps, per task

- [ ] **Step 1:** Extend `tests/unit/models.spec.ts` with a group for this cluster that preloads every relation the task adds. Pattern:

```ts
test.group('<Cluster> relations', () => {
  test('User relations resolve', async ({ assert }) => {
    const rows = await User.query().preload('account').preload('activeIntegrations').limit(1)
    assert.isArray(rows)
  })
})
```

One `test` per model, naming every relation that model declares. `preload` on an empty result set still validates the relation's keys against the schema, so this passes on tables with no rows.

- [ ] **Step 2:** Run it and watch it fail — `node ace test --files models`. Expected: `Cannot preload "<name>", it is not defined as a relationship`.

- [ ] **Step 3:** Port the relations, hooks and getters for each model in the task's list, applying the rules above.

- [ ] **Step 4:** Run `node ace test --files models` and `npm run typecheck`. Both must pass, including every earlier cluster's group.

- [ ] **Step 5:** Commit with `feat(backend): port <cluster> model relations`.

---

### Task 8: Account and User

**Files:** `app/models/account.ts`, `app/models/user.ts`

**Interfaces:**
- Consumes: all 71 stubs from Task 7
- Produces: `Account` with 23 relations, `User` with 3 relations. Every later cluster's `belongsTo(() => Account)` resolves against this.

`Account` (v5 `app/Models/Account.ts`, 446 lines) is the largest model in the codebase: 23 relations, 3 hooks, 6 computed properties. Port the relations, the `beforeFind`/`beforeFetch`/`beforePaginate` hooks, and the 6 computed properties as plain getters. **Skip** every method importing `ZendeskService`, `FieldsService`, or `BillingStatus` from `App/Services` — and skip the now-unused imports with them.

`User` (v5 `app/Models/User.ts`): 3 relations as shown in the worked example, plus the `@beforeCreate` defaults hook. Port that hook, replacing `uuid()` with `randomUUID()`:

```ts
  @beforeCreate()
  static saveDefaultSettings(user: User) {
    user.widgetSettings = {
      settings: [
        { name: 'intent_feedback', active: true },
        { name: 'ai_response', active: true },
        { name: 'draft_feedback', active: true },
        { name: 'macros', active: true },
      ],
    }

    user.emailPreferences = {
      weekly_summary: true,
      onboarding_sequences: true,
      event_based: true,
      marketing: true,
      event_invitations: true,
    }

    user.widgetToken = randomUUID()
  }
```

Do **not** port `hashPassword` — see the rules above.

---

### Task 9: Ticket cluster

**Files:** `app/models/ticket.ts`, `ticket_comment.ts`, `ticket_comment_attachable.ts`, `ticket_comment_article_search.ts`, `ticket_user.ts`

**Interfaces:**
- Consumes: `Account`, `User` from Task 8
- Produces: `Ticket` (20 relations, 3 query hooks), `TicketComment` (12), `TicketCommentAttachable` (4), `TicketCommentArticleSearch` (1), `TicketUser` (2 relations, 3 hooks).

`Ticket`'s three hooks are `beforeFind`/`beforeFetch`/`beforePaginate` — these coexist with the `SoftDeletes` mixin's hooks of the same names, since Lucid runs all registered hooks. Port them as written.

---

### Task 10: Classification and cards cluster

**Files:** `app/models/text_classification_card.ts`, `text_classification_label.ts`, `text_classification_card_integration_setting.ts`, `text_classification_card_example.ts`, `card_aggregate.ts`

**Interfaces:**
- Consumes: `Account`, `Ticket`
- Produces: `TextClassificationCard` (10 relations), `TextClassificationLabel` (3), `TextClassificationCardIntegrationSetting` (1), `TextClassificationCardExample` (1 getter), `CardAggregate` (2).

---

### Task 11: Workflow and macro cluster

**Files:** `app/models/workflow.ts`, `executed_workflow.ts`, `workflow_macro.ts`, `workflow_collectable_field.ts`, `macro.ts`, `macro_action.ts`, `aide_executed_macro.ts`

**Interfaces:**
- Consumes: `Account`, `Ticket`, `CollectableField`
- Produces: `Workflow` (6 relations), `ExecutedWorkflow` (7), `WorkflowMacro` (2), `WorkflowCollectableField` (1), `Macro` (3), `MacroAction` (1), `AideExecutedMacro` (1).

---

### Task 12: Knowledge and content cluster

**Files:** `app/models/knowledge_document.ts`, `knowledge_entity.ts`, `help_center.ts`, `snippet.ts`, `snippet_group.ts`, `process.ts`, `process_step.ts`, `response.ts`, `response_topic.ts`

**Interfaces:**
- Consumes: `Account`, `User`
- Produces: `KnowledgeDocument` (4 relations), `KnowledgeEntity` (1), `HelpCenter` (1), `Snippet` (4), `SnippetGroup` (1), `Process` (3), `ProcessStep` (5 relations + 3 getters), `Response` (1), `ResponseTopic` (1).

---

### Task 13: Commerce cluster

**Files:** `app/models/ecomm_customer.ts`, `ecomm_order.ts`, `ecomm_order_line_item.ts`, `ecomm_fulfillment.ts`, `shopify_customer.ts`, `shopify_order.ts`, `shopify_fulfillment.ts`, `charge.ts`

**Interfaces:**
- Consumes: `Account`
- Produces: `EcommCustomer` (1), `EcommOrder` (1), `EcommOrderLineItem` (2), `EcommFulfillment` (1 getter), `ShopifyCustomer` (2), `ShopifyOrder` (1), `ShopifyFulfillment` (1 getter), `Charge` (1).

---

### Task 14: Platform cluster

**Files:** `app/models/api_token.ts`, `account_document.ts`, `active_integration.ts`, `integration.ts`, `generative_config.ts`, `generative_context.ts`, `cached_llm_generation.ts`, `user_invitation.ts`

**Interfaces:**
- Consumes: `Account`, `User`, `Ticket`
- Produces: `APIToken` (1), `AccountDocument` (1), `ActiveIntegration` (2), `Integration` (2), `GenerativeConfig` (2), `GenerativeContext` (1), `CachedLlmGeneration` (9), `UserInvitation` (2 relations + 2 getters).

---

### Task 15: Phase gate

**Files:** none created; verification only.

- [ ] **Step 1: Confirm every relation is accounted for**

```bash
cd /Users/atharahmed/Projects/aide/node-api
grep -rhoE '@(belongsTo|hasMany|hasOne|manyToMany|hasManyThrough)\(' app/Models | wc -l
cd /Users/atharahmed/Projects/aide/aide-monorepo/apps/backend
grep -rhoE '@(belongsTo|hasMany|hasOne|manyToMany|hasManyThrough)\(' app/models | wc -l
```

Expected: both print `151`. A shortfall names work missed in Tasks 8–14; find it with a per-model diff of the two counts.

- [ ] **Step 2: Full suite and typecheck**

```bash
node ace test
npm run typecheck
npm run lint
```

Expected: all pass.

- [ ] **Step 3: Confirm the database was not mutated beyond Task 4**

```bash
node ace migration:status
```

Expected: every migration `completed`, none pending.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore(backend): phase 1 complete — foundation, migrations, 71 models"
```

---

## What Phase 1 deliberately leaves out

Controllers, routes, transformers, validators beyond the starter's own, middleware, Bull jobs, webhook handlers, ace commands, the scheduler, mail, Ally OAuth and Redis. The v5 service layer moves with the endpoint slices that need it, in Phase 2.

Also unported by design: the ~15 routes in v5's `start/routes.ts:93-115` bound to `SnippetController` and `ProcessController`, neither of which exists.
