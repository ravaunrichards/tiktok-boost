# TikBoost

A standalone campaign-planning, order-intake and PayPal-checkout platform for compliant TikTok promotion.

## Included
- Seven campaign objectives and five package sizes per objective: Micro, Small, Medium, Large, Enterprise.
- Follower planning milestones from 100 through 1,000,000. These are goals, not guaranteed follower quantities.
- Immediate or scheduled campaign-request start, requested duration and accelerated, balanced, or steady pacing.
- Responsive web app, Express API, PostgreSQL schema and versioned migrations, validation, rate limiting, campaign event history and staff review endpoints.
- PayPal Orders v2 checkout, server-side capture, webhook signature verification, duplicate-event protection, and payment reconciliation tables.
- Docker Compose, Dockerfile, Render Blueprint, CI workflow, tests, and deployment/security documentation.

## Operating boundary
TikBoost is an advertising and campaign workflow. It does not automate follows, likes, comments, shares, views, or engagement exchanges. Follower goals are planning milestones and results are variable. Likes, comments, and shares are reporting metrics, not products sold as guaranteed quantities.

A submitted campaign begins in `pending_review`. Staff must approve it before PayPal checkout is available. A successful payment advances the request to `approved_for_setup`; it does not claim an ad was submitted, approved by TikTok, served, or completed. Live advertising requires a verified TikTok Ads advertiser integration and eligible advertiser credentials.

## PayPal
PayPal is the only payment provider implemented for customer campaign transactions. The server creates Orders v2 orders, captures approved orders, checks captured amounts against the stored invoice amount, and verifies webhook signatures with PayPal before recording events. See [docs/paypal-setup.md](docs/paypal-setup.md).

The PayPal app credentials and webhook ID are deployment secrets and are intentionally not committed. The web checkout remains disabled until credentials are configured. Do not use live credentials until sandbox checkout and webhook tests pass.

## Database
The schema is PostgreSQL. Migrations are versioned in `database/migrations` and the API runs pending migrations at startup whenever `DATABASE_URL` is set. The health endpoint is a liveness check; `/api/ready` reports whether the database is reachable.

Run the full local stack with `docker compose up --build`. This creates a local PostgreSQL database and the web/API container.

## Quick start
Requirements: Node.js 22, pnpm 9+, PostgreSQL 14+.

1. Copy `.env.example` to `.env` and configure `DATABASE_URL`.
2. Run `pnpm install`.
3. Run `pnpm db:migrate`.
4. Run `pnpm dev`.
5. Open `http://localhost:5173`.

The API listens on port 4000. The web app proxies `/api` requests to it.

## Build and verification
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

See [docs/deployment.md](docs/deployment.md), [docs/security-and-trust.md](docs/security-and-trust.md), and [docs/package-catalog.md](docs/package-catalog.md).

TikBoost is independent and is not affiliated with, endorsed by, or sponsored by TikTok or ByteDance.
