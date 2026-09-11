-- ============================================================================
-- AI Compliance Monitoring System — PostgreSQL schema
--
-- Design principles:
--   * Product identity (products) is separate from platform listing data
--     (product_listings), which is separate from evaluation results
--     (product_evaluations).
--   * Evaluations are append-only: history is preserved, never overwritten.
--   * JSONB is used only for variable scraper/AI payloads, never as a
--     replacement for relational columns.
--   * This file is idempotent and safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- platforms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platforms (
  id         SERIAL PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- products — stable, platform-independent product identity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            BIGSERIAL PRIMARY KEY,
  identity_hash TEXT NOT NULL UNIQUE,      -- sha1 of normalised name|brand|weight
  name          TEXT NOT NULL,
  brand         TEXT,
  weight        TEXT,
  category      TEXT,
  image_url     TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- product_listings — one row per (product, platform) listing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_listings (
  id                  BIGSERIAL PRIMARY KEY,
  product_id          BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  platform_id         INTEGER NOT NULL REFERENCES platforms(id) ON DELETE RESTRICT,
  listing_key         TEXT NOT NULL,       -- stable platform-specific id (url/product id)
  platform_product_id TEXT,
  product_url         TEXT,
  price               NUMERIC(12, 2),
  mrp                 NUMERIC(12, 2),
  discount            NUMERIC(6, 2),
  availability        TEXT NOT NULL DEFAULT 'unknown',
  weight              TEXT,
  store_name          TEXT,
  image_url           TEXT,
  raw_listing         JSONB,               -- full scraper payload (variable shape)
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_listing UNIQUE (product_id, platform_id, listing_key)
);

-- ---------------------------------------------------------------------------
-- scan_runs — one row per /evaluate/stream request
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_runs (
  id                 BIGSERIAL PRIMARY KEY,
  query              TEXT NOT NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at        TIMESTAMPTZ,
  duration_ms        INTEGER,
  status             TEXT NOT NULL DEFAULT 'running',
  products_found     INTEGER NOT NULL DEFAULT 0,
  products_evaluated INTEGER NOT NULL DEFAULT 0,
  error              TEXT,
  CONSTRAINT chk_scan_runs_status CHECK (status IN ('running', 'completed', 'failed'))
);

-- ---------------------------------------------------------------------------
-- product_evaluations — append-only evaluation results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_evaluations (
  id                    BIGSERIAL PRIMARY KEY,
  scan_run_id           BIGINT REFERENCES scan_runs(id) ON DELETE SET NULL,
  product_listing_id    BIGINT NOT NULL REFERENCES product_listings(id) ON DELETE CASCADE,
  rule_score            INTEGER,
  ai_score              INTEGER,
  final_score           INTEGER NOT NULL,
  risk                  TEXT NOT NULL,
  deep_scrape_available BOOLEAN NOT NULL DEFAULT false,
  raw_product           JSONB NOT NULL,          -- product snapshot handed to the frontend
  violations            JSONB NOT NULL DEFAULT '[]'::jsonb,
  passed_rules          JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_rules           INTEGER,
  ai_analysis           JSONB,                   -- full AI payload
  evaluated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- rules — compliance rule catalogue (seeded from the rule engine)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rules (
  id             SERIAL PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  category       TEXT,
  severity       TEXT,
  penalty        INTEGER NOT NULL DEFAULT 0,
  regulatory_ref TEXT,
  enabled        BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes for dashboard / history queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_name           ON products (lower(name));
CREATE INDEX IF NOT EXISTS idx_listings_product        ON product_listings (product_id);
CREATE INDEX IF NOT EXISTS idx_listings_platform       ON product_listings (platform_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_scan_run    ON product_evaluations (scan_run_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_listing     ON product_evaluations (product_listing_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluated_at ON product_evaluations (evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_final_score ON product_evaluations (final_score);
CREATE INDEX IF NOT EXISTS idx_evaluations_risk        ON product_evaluations (risk);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at    ON scan_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_runs_status        ON scan_runs (status);
