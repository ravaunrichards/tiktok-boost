ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS access_token_hash CHAR(64);

CREATE TABLE IF NOT EXISTS campaign_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'paypal' CHECK (provider='paypal'),
  paypal_order_id VARCHAR(80) NOT NULL UNIQUE,
  paypal_capture_id VARCHAR(80),
  amount_usd NUMERIC(12,2) NOT NULL CHECK (amount_usd > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
  status VARCHAR(20) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','approved','completed','failed','refunded')),
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS campaign_payments_campaign_idx
  ON campaign_payments(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS campaign_payments_status_idx
  ON campaign_payments(status, created_at DESC);

CREATE TABLE IF NOT EXISTS paypal_webhook_events (
  event_id VARCHAR(100) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  verification_status VARCHAR(20) NOT NULL CHECK (verification_status='SUCCESS'),
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at=NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS campaign_payments_set_updated_at ON campaign_payments;
CREATE TRIGGER campaign_payments_set_updated_at
  BEFORE UPDATE ON campaign_payments
  FOR EACH ROW EXECUTE FUNCTION set_payment_updated_at();
