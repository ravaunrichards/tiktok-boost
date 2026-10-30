# Security and trust

- Never request a TikTok password, session cookie, one-time code, or personal access token from a customer.
- Do not implement bots, follow exchanges, engagement exchanges, fake accounts, automated likes, fake views, or artificial sharing.
- Do not promise fixed follower, like, comment, share, or view quantities.
- Store all provider secrets only in Render environment variables or another secret manager. Never commit `.env` files.
- PayPal orders are created and captured server-side; the browser receives only the public PayPal client ID.
- Verify PayPal webhook signatures against the configured webhook ID before changing any payment state.
- Store webhook event IDs with a unique key to prevent duplicate processing.
- Campaign access tokens are generated with cryptographic randomness; only SHA-256 hashes are stored in PostgreSQL.
- Admin review endpoints require `X-Admin-API-Key` and are disabled when `ADMIN_API_KEY` is missing.
- Validate all customer input server-side. Apply request-size limits and rate limits.
- Restrict database access to the API service. Use TLS where required and managed backups in production.
- Add full customer authentication, role-protected staff console, monitoring, refunds/reconciliation and published privacy/retention terms before broad launch.
