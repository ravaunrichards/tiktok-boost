# Architecture

- apps/web: responsive Vite and TypeScript customer interface.
- apps/api: Express JSON API, validation, campaign intake, and static production hosting.
- packages/catalog: shared campaign objectives and package data.
- database/migrations: PostgreSQL campaign requests, event history, and metric snapshots.
- docs: operational, policy, and deployment notes.

Campaign request, payment, and delivery state are separate. A submitted request begins in pending_review. The API does not claim money was collected or advertising was activated. The next operational phase adds verified advertising and payment adapters, then role-protected operator tooling.
