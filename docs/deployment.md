# Deployment

## Render Blueprint
1. Push the repository to GitHub.
2. In Render, create a Blueprint and select this repository.
3. Review the web service and PostgreSQL resources.
4. Deploy and verify the health endpoint returns HTTP 200.
5. Run the database migration with the root workspace migration command.
6. Complete advertiser-account and payment integrations before accepting paid campaigns.

## Docker
Run docker compose up --build from the repository root. The app listens on port 4000 and PostgreSQL is exposed on port 5432 for local development.

## Environment
- DATABASE_URL: PostgreSQL connection string.
- PORT: API port; defaults to 4000.
- WEB_ORIGIN: allowed browser origin; set this to the production domain.
- PGSSL: set true only when the managed database requires TLS.

## Production gates
- Configure database backups, network restrictions, monitoring, and migrations.
- Set a real domain and HTTPS.
- Add authentication, authorization, and role-protected staff tooling before exposing campaign records.
- Configure a verified TikTok Ads advertiser integration and confirm market, account, objective, creative, and API permission eligibility.
- Configure a payment processor, verified webhooks, refunds, reconciliation, and tax handling.
- Test checkout, schedule, provider approval, pause, cancellation, refunds, and reporting end to end.
- Never mark a campaign paid, approved, in delivery, or completed based only on form submission.
