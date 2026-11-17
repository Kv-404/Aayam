-- OAuth 2.1 authorization server for the remote MCP endpoint (`server/src/edge/oauth.ts`).
-- Additive only. Codes, refresh tokens, transaction ids, CSRF tokens, and client secrets are stored as
-- SHA-256 hex hashes; the plain values only ever leave in a response. Every row has `expires_at`
-- (ISO text) and is pruned opportunistically by the Worker.

-- Registered (DCR) clients and cached client ID metadata documents (CIMD, `is_cimd = 1`, 10 minutes).
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_uri TEXT,
  redirect_uris TEXT NOT NULL,
  grant_types TEXT NOT NULL,
  response_types TEXT NOT NULL,
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  client_secret_hash TEXT,
  is_cimd INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mcp_oauth_clients_expires ON mcp_oauth_clients (expires_at);

-- One authorize → Google → consent round, 10 minutes. `data` is the pending request as JSON.
CREATE TABLE IF NOT EXISTS mcp_oauth_transactions (
  tx_hash TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mcp_oauth_transactions_expires ON mcp_oauth_transactions (expires_at);

-- Single-use authorization codes, 90 seconds.
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mcp_oauth_codes_expires ON mcp_oauth_codes (expires_at);

-- Rotating refresh tokens, 30 days. A used token is kept 5 minutes so a replay revokes its family.
CREATE TABLE IF NOT EXISTS mcp_oauth_refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  data TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mcp_oauth_refresh_tokens_expires ON mcp_oauth_refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS mcp_oauth_refresh_tokens_family ON mcp_oauth_refresh_tokens (family_id);

-- Revoked access tokens (`jti:<jti>`) and refresh token families (`family:<id>`).
CREATE TABLE IF NOT EXISTS mcp_oauth_revocations (
  id TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mcp_oauth_revocations_expires ON mcp_oauth_revocations (expires_at);
