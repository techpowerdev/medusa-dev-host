# medusa-dev-host

One local Medusa app shared by every `@khumkha/medusa-*` plugin, for checking a plugin change on a real screen (each plugin's `AGENTS.md`, rule 13). It is Medusa's [DTC starter](https://github.com/medusajs/dtc-starter) with the plugins registered in `apps/backend/medusa-config.ts`; the starter's own README follows below.

## Rules for the shared host

- **One plugin at a time.** `medusa plugin:develop` / `plugin:publish` from one plugin rewrites `apps/backend/.yalc` and restarts the backend, so only one plugin may target the host at any moment. Say in the handoff that you used it.
- **Leave it on `develop`.** When done, the host must run the `develop` of every plugin, so merged work can be tried before a release: stop your `plugin:develop`, check out `develop` in the plugin repo, then `plugin:publish` there and `plugin:add` here (see "Running").
- **Change only your plugin's part** of this repo: its block in `medusa-config.ts`, its keys in `apps/backend/.env.template`, its scripts in `apps/backend/src/scripts/`, and its section in this README, through a pull request to this repo. Never change another plugin's block.
- **Migrations from unmerged branches stay in the database.** If the host's database stops matching `main`, recreate it: `dropdb`/`createdb medusa_dev_host` in the PostgreSQL container, then `npx medusa db:migrate` and the seed steps below.

## Running

Services: PostgreSQL comes from `../medusa-voucher/docker-compose.yml` (port 5433, database `medusa_dev_host`, user `postgres`/`postgres`); Mailpit from `./docker-compose.yml` (SMTP 1025, inbox http://localhost:8025). No Redis.

Plugins are installed the way Medusa's [plugin guide](https://docs.medusajs.com/learn/fundamentals/plugins/create) describes: from the local registry (yalc), never from GitHub or npm.

1. In the plugin repo: `pnpm medusa plugin:publish`.
2. Here: `docker compose up -d`, then in `apps/backend`: `npx medusa plugin:add @khumkha/medusa-<name>`, `npx medusa db:migrate`, `npx medusa develop` (admin at http://localhost:9000/app). After `plugin:add`, delete `apps/backend/node_modules/.vite` or the admin keeps serving the old plugin UI. Undo the `pnpm-lock.yaml` change `plugin:add` makes (`git checkout pnpm-lock.yaml`).
3. In `apps/storefront`: `pnpm dev` (http://localhost:8000/th; the publishable key is in its `.env.local`).

While working on a plugin, keep `npx medusa plugin:develop` running in the plugin repo after steps 1–2, as Medusa recommends:

- It publishes only when a file changes (not when it starts), then this backend restarts by itself. Run `npx medusa db:migrate` here after a migration is added.
- The admin then loads the plugin's admin from its source folder, with hot reload. `admin.vite` in `medusa-config.ts` dedupes the packages the dashboard shares with plugins; without it a plugin page using `@medusajs/dashboard` hooks fails with "useLocation() may be used only in the context of a <Router>".
- The first time, and after stopping it, delete `apps/backend/node_modules/.vite` and restart `npx medusa develop`.

## Seeded data

- Admin: `admin@example.test` / `supersecret` (local only). Test customer: `somchai@example.test` (made-up).
- Regions: Thailand (THB, store default) with "Email delivery" (0 THB) and Manual Payment (system provider: authorizes only, capture in the admin); Europe (EUR) from the starter's seed.

## Plugins

### @khumkha/medusa-voucher

- Env: `VOUCHER_ENCRYPTION_KEY`, `VOUCHER_SHIPPING_OPTION_ID`. Options in `medusa-config.ts`: `timezone: "Asia/Bangkok"`.
- "Email delivery" (`so_01M5PN3MBQXTKZ7172FGYAAMP6`) belongs to the "Digital vouchers" stock location and is the shipping option the plugin records Voucher fulfillments with. The old "Email delivery" at "European Warehouse" was deleted.
- Product "Central Gift Voucher": variant "500 THB" is a Voucher product (`vprod_01M5P09YKVJB75F3JWEHX6EP5A`); the old "50 EUR" variant is for the Europe region.
- Scripts (`apps/backend/src/scripts`, run with `npx medusa exec ./src/scripts/<file> [args]`): `deliver-order-vouchers.ts <order_id>`, `retry-voucher-deliveries.ts`, `mark-expired-vouchers.ts`.
- Notification module: `@perseidesjs/notification-nodemailer` sending to Mailpit.

---

<p align="center">
  <a href="https://www.medusajs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>
<h1 align="center">
  Medusa DTC Starter
</h1>

<h4 align="center">
  <a href="https://docs.medusajs.com">Documentation</a> |
  <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
  Building blocks for digital commerce
</p>
<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/develop/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Medusa is released under the MIT license." />
  </a>
  <a href="https://circleci.com/gh/medusajs/medusa">
    <img src="https://circleci.com/gh/medusajs/medusa.svg?style=shield" alt="Current CircleCI build status." />
  </a>
  <a href="https://github.com/medusajs/medusa/blob/develop/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
    <a href="https://www.producthunt.com/posts/medusa"><img src="https://img.shields.io/badge/Product%20Hunt-%231%20Product%20of%20the%20Day-%23DA552E" alt="Product Hunt"></a>
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

# Medusa DTC Starter

A production-ready monorepo starter for direct-to-consumer ecommerce stores powered by Medusa and Next.js. Includes a fully featured storefront with product browsing, cart, checkout, customer accounts, and order management.

## Features

- All of [Medusa's commerce features](https://docs.medusajs.com/resources/commerce-modules)
- Multi-region support with automatic country detection
- Product catalog with variant selection
- Cart with promotion codes
- Multi-step checkout with shipping and payment
- Customer accounts with order history and address management
- Order transfer between accounts

## Getting Started

### Deploy with Medusa Cloud

The fastest way to get started is deploying with [Medusa Cloud](https://cloud.medusajs.com):

1. [Create a Medusa Cloud account](https://cloud.medusajs.com)
2. Deploy this starter directly from your dashboard

### Local Installation

> **Prerequisites:**
>
> - [Node.js](https://nodejs.org/) v22.22+
> - [PostgreSQL](https://www.postgresql.org/) v15+
> - [pnpm](https://pnpm.io/) v10+

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/medusajs/dtc-starter.git
cd dtc-starter
pnpm install
```

2. Set up environment variables for the backend:

```bash
cp apps/backend/.env.template apps/backend/.env
```

3. Set the database URL in `apps/backend/.env`:

```bash
# Replace with actual database URL, make sure the database exists.
DATABASE_URL=postgres://postgres:@localhost:5432/medusa-dtc-starter
```

4. Run migrations (this also seeds initial store data):

```bash
cd apps/backend
pnpm medusa db:migrate
```

5. Add admin user:

```bash
cd apps/backend
pnpm medusa user -e admin@test.com -p supersecret
```

6. Start Medusa backend:

```bash
cd apps/backend
pnpm dev
```

7. Open the admin dashboard at `localhost:9000/app` and log in. Retrieve your publishable API key at Settings > Publishable API key.

8. Set up environment variables for the storefront:

```bash
cp apps/storefront/.env.template apps/storefront/.env.local
```

9. Update `apps/storefront/.env.local` with your Medusa publishable API key:

```bash
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_6c3...
```

10. Start the storefront:

```bash
cd apps/storefront
pnpm dev
```

The storefront runs on `http://localhost:8000`.

You can also start both the backend and storefront from the root:

```bash
pnpm dev
```

## Project Structure

```text
apps/
├── backend/      # Medusa application: API routes, workflows, modules, admin extensions
└── storefront/   # Next.js storefront (optional)
```

## Building with AI Agents

This repo is set up for AI coding agents such as Claude Code, Cursor, and Codex:

- [`AGENTS.md`](./AGENTS.md) holds the project's commands, conventions, and off-limits paths. `CLAUDE.md` points to it.
- Installed `@medusajs/*` packages ship their own `AGENTS.md` in `node_modules`, documenting the API of the exact version you have installed.
- Install the [Medusa agent skills](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/agentic-skills) and [MCP server](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/mcp-server) for documentation-backed answers:

```bash
claude mcp add --transport http medusa https://docs.medusajs.com/mcp
```

- If you deploy on [Medusa Cloud](https://cloud.medusajs.com), add the Medusa Cloud MCP server so your agent can inspect deployments, build and runtime logs, environment variables, and your store's data. It authenticates with your Medusa Cloud account:

```bash
claude mcp add --transport http medusa-cloud https://cloud.medusajs.com/mcp
```

## Configuration

The storefront is configured via environment variables in `apps/storefront/.env.local`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Publishable API key from your Medusa backend | — |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | URL of your Medusa backend | `http://localhost:9000` |
| `NEXT_PUBLIC_DEFAULT_REGION` | Default region country code | `dk` |
| `NEXT_PUBLIC_BASE_URL` | Base URL of the storefront | `https://localhost:8000` |
| `NEXT_PUBLIC_STRIPE_KEY` | Stripe publishable key (optional) | — |

## Resources

- [Medusa Documentation](https://docs.medusajs.com)
- [Medusa Cloud](https://cloud.medusajs.com)
- [Build with AI agents](https://docs.medusajs.com/learn/introduction/build-with-llms-ai)
- [Medusa docs for LLMs (`llms.txt`)](https://docs.medusajs.com/llms.txt)
