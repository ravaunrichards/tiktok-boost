# PayPal checkout and webhook setup

TikBoost uses PayPal Orders v2 for all campaign payments. It does not collect or store customer card details.

## Required PayPal app values
Create a REST app in the PayPal Developer Dashboard. Start with Sandbox credentials. Configure these environment variables on the TikBoost API service:

- `PAYPAL_MODE=sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PUBLIC_APP_URL=https://<your-tikboost-domain>`
- `ADMIN_API_KEY=<long-random-secret>`

Never place the client secret or admin key in frontend code or Git.

## Webhook registration
Register this HTTPS listener in the same PayPal REST app:

`https://<your-tikboost-domain>/api/paypal/webhook`

Subscribe at minimum to:
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.DENIED`
- `CHECKOUT.ORDER.APPROVED`

Copy the returned webhook ID into `PAYPAL_WEBHOOK_ID`. The API calls PayPal's webhook verification endpoint and only records events whose verification status is `SUCCESS`. Event IDs are stored uniquely to avoid replayed deliveries being processed twice.

## Customer checkout lifecycle
1. Customer submits a campaign request. TikBoost stores a SHA-256 hash of a cryptographically random access token and returns the raw token once to the browser session.
2. New requests are `pending_review`. No payment button is displayed yet.
3. Staff reviews the request using the protected admin API and approves it for payment. This moves it to `awaiting_payment`.
4. The customer checks their private request status. PayPal's hosted button appears only when PayPal credentials are present and the request is approved.
5. The server creates the PayPal order using the amount stored with the approved package. The customer approves it in PayPal; the server captures the order.
6. TikBoost checks the completed capture amount and currency against the stored campaign invoice before marking the payment paid.
7. Verified webhook events provide a second reconciliation path for completed captures and refunds.

## Staff review API
Supply the `X-Admin-API-Key` header. Do not expose this key to browsers or customers.

List requests:
```http
GET /api/admin/campaigns
X-Admin-API-Key: <ADMIN_API_KEY>
```

Approve a request for PayPal checkout:
```http
POST /api/admin/campaigns/<campaign-uuid>/approve
X-Admin-API-Key: <ADMIN_API_KEY>
```

Reject a pending request:
```http
POST /api/admin/campaigns/<campaign-uuid>/reject
X-Admin-API-Key: <ADMIN_API_KEY>
```

## Testing and go-live
1. Test end-to-end using Sandbox payer and business accounts.
2. Confirm order amount, currency, campaign association and captured amount.
3. Replay a webhook and verify the duplicate is acknowledged without duplicating payment state changes.
4. Test a refund and reconcile it with the PayPal dashboard.
5. Only then replace Sandbox credentials with Live credentials, register the Live webhook and set `PAYPAL_MODE=live`.

The code is deployed-ready but cannot process real transactions until the owner supplies and configures the verified PayPal REST app credentials and webhook ID. PayPal account and country eligibility must be confirmed in the PayPal account itself.
