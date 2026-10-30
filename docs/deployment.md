# Deployment

## Render service
TikBoost uses the repository Dockerfile so the deployment does not run `corepack enable` against Render's read-only system pnpm shim.

1. Connect `ravaunrichards/tiktok-boost` on branch `main`.
2. Select Docker runtime and repository-root Dockerfile.
3. Keep health check at `/api/health`; use `/api/ready` for database readiness monitoring.
4. Add `DATABASE_URL`, `PGSSL=true` when required, and the PayPal secrets listed in `docs/paypal-setup.md`.
5. On startup, the API applies any unapplied SQL migrations in `database/migrations`.
6. Confirm `/api/health` returns HTTP 200 and `/api/ready` returns HTTP 200 before accepting requests.

The existing Render service `tikboost-app` was initially configured with the Node build command `corepack enable && pnpm install && pnpm build`. That command failed because Corepack attempted to unlink `/usr/bin/pnpm` on Render's read-only filesystem. The Dockerfile and Render Blueprint have been corrected. The existing service's runtime/build configuration still needs to be switched to Docker in Render if it is not already linked to the Blueprint.

## Database
A PostgreSQL database is required for campaign intake and payments. Do not point TikBoost at another application's database. Use a dedicated Render PostgreSQL instance or a dedicated Supabase project. The account currently has no available additional Render Free Postgres slot; the paid Render Postgres create request returned a billing-card requirement. Until a dedicated `DATABASE_URL` is added, the app can boot in degraded mode but campaign intake, payments and readiness will remain unavailable.

## Environment variables
- `DATABASE_URL`: dedicated TikBoost PostgreSQL connection string.
- `PGSSL`: `true` if the provider requires TLS.
- `PORT`: Render supplies this; the container listens on it.
- `WEB_ORIGIN`: allowed browser origin (the TikBoost site URL).
- `PUBLIC_APP_URL`: public TikBoost site URL used for PayPal return/cancel URLs.
- `PAYPAL_MODE`: `sandbox` for testing; `live` only after all tests pass.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: PayPal REST app credentials.
- `PAYPAL_WEBHOOK_ID`: webhook ID from the PayPal Developer Dashboard.
- `ADMIN_API_KEY`: long random secret for protected staff review endpoints.

Never commit secrets to GitHub. Store them only in Render environment variables.

## Production gates
- Configure a dedicated database, backups, access restrictions, and TLS.
- Configure PayPal Sandbox credentials and subscribe the webhook URL before testing.
- Run sandbox create-order, buyer approval, capture, duplicate-webhook, refund and reconciliation tests.
- Switch to PayPal Live only after the business account is verified and sandbox flows pass.
- Configure eligible TikTok Ads advertiser access and complete creative, audience, account and market eligibility checks.
- Add a protected staff console, customer authentication, support and privacy/retention workflows before broad launch.
- Never mark an ad as live or completed solely because an invoice was paid.
