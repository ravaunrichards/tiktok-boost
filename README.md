# TikBoost

A standalone campaign-planning and order-intake platform for compliant TikTok promotion.

## Included
- Seven separate campaign objectives and five package sizes per objective: Micro, Small, Medium, Large, Enterprise.
- Follower planning milestones from 100 through 1,000,000. These are goals, not guaranteed follower quantities.
- Immediate or scheduled campaign-request start, plus accelerated, balanced, or steady pacing.
- Responsive web app, Express API, PostgreSQL persistence, migration, validation, rate limiting, and campaign event history.
- Docker Compose, Render Blueprint, CI workflow, tests, and deployment/security documentation.

## Operating boundary
TikBoost is an advertising and campaign workflow. It does not automate follows, likes, comments, shares, views, or engagement exchanges. Follower goals are planning milestones and results are variable. Likes, comments, and shares are reporting metrics, not products sold as guaranteed quantities.

A submitted campaign begins in pending_review. This starter does not claim an ad was submitted, approved, served, paid, or completed. Live advertising requires a verified TikTok Ads advertiser integration and payment-provider configuration. Those credentials are not fabricated or committed.

## Quick start
Requirements: Node.js 20+, pnpm 9+, PostgreSQL 14+.

1. Copy .env.example to .env and configure DATABASE_URL.
2. Run pnpm install.
3. Run pnpm db:migrate.
4. Run pnpm dev.
5. Open http://localhost:5173.

The API listens on port 4000. The web app proxies /api requests to it. For the full local stack, run docker compose up --build.

## Build and verification
- pnpm build
- pnpm test
- pnpm typecheck

See docs/deployment.md and docs/package-catalog.md.

TikBoost is independent and is not affiliated with, endorsed by, or sponsored by TikTok or ByteDance.
