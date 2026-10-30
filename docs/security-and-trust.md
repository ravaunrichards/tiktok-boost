# Security and trust

- Never request a TikTok password, session cookie, one-time code, or personal access token from a customer.
- Do not implement bots, follow exchanges, engagement exchanges, fake accounts, automated likes, fake views, or artificial sharing.
- Do not promise fixed follower, like, comment, share, or view quantities.
- Store provider secrets only in deployment secret stores or environment variables. Never commit .env files.
- Validate all customer input server-side. Apply request-size limits and rate limits.
- Restrict database access to the API service. Use TLS where required and managed backups in production.
- Add authenticated customer order history and role-protected staff tooling before exposing personal campaign data.
- Record provider events and payment webhooks with idempotency keys before changing campaign or payment state.
- Publish privacy and retention terms before launch.
