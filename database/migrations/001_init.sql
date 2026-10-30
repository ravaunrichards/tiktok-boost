CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  tiktok_username VARCHAR(24) NOT NULL,
  objective_id VARCHAR(64) NOT NULL,
  package_id VARCHAR(100) NOT NULL,
  package_name VARCHAR(120) NOT NULL,
  tier_name VARCHAR(32) NOT NULL,
  budget_usd NUMERIC(12,2) NOT NULL CHECK (budget_usd > 0),
  region VARCHAR(80) NOT NULL,
  start_mode VARCHAR(16) NOT NULL CHECK (start_mode IN ('immediate','scheduled')),
  scheduled_for TIMESTAMPTZ,
  pacing VARCHAR(16) NOT NULL CHECK (pacing IN ('accelerated','balanced','steady')),
  goal_milestone BIGINT,
  post_url TEXT,
  tracking_metrics TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  consent_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved_for_setup','awaiting_payment','scheduled','submitted_to_ads','in_delivery','paused','completed','rejected','cancelled')),
  payment_status VARCHAR(24) NOT NULL DEFAULT 'not_started' CHECK (payment_status IN ('not_started','pending','paid','failed','refunded')),
  provider_campaign_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((start_mode='immediate' AND scheduled_for IS NULL) OR (start_mode='scheduled' AND scheduled_for IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS campaigns_email_created_idx ON campaigns (email,created_at DESC);
CREATE INDEX IF NOT EXISTS campaigns_status_created_idx ON campaigns (status,created_at DESC);
CREATE INDEX IF NOT EXISTS campaigns_scheduled_idx ON campaigns (scheduled_for) WHERE status='scheduled';

CREATE TABLE IF NOT EXISTS campaign_events (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  actor VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS campaign_events_campaign_idx ON campaign_events (campaign_id,created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_metric_snapshots (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  metric_key VARCHAR(40) NOT NULL,
  metric_value NUMERIC(18,2) NOT NULL CHECK (metric_value>=0),
  reporting_source VARCHAR(80) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS campaign_metrics_campaign_idx ON campaign_metric_snapshots (campaign_id,captured_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at=NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS campaigns_set_updated_at ON campaigns;
CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
