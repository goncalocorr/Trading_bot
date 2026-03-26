CREATE TABLE IF NOT EXISTS trades (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pair VARCHAR(20) NOT NULL,
  side ENUM('BUY', 'SELL') NOT NULL,
  order_type ENUM('MARKET', 'LIMIT') NOT NULL,
  exchange_order_id BIGINT UNSIGNED DEFAULT NULL,
  exchange_client_order_id VARCHAR(100) DEFAULT NULL,
  oco_order_list_id BIGINT UNSIGNED DEFAULT NULL,
  quantity DECIMAL(24, 12) NOT NULL,
  entry_price DECIMAL(24, 12) NOT NULL,
  exit_price DECIMAL(24, 12) DEFAULT NULL,
  stop_loss DECIMAL(24, 12) NOT NULL,
  take_profit DECIMAL(24, 12) NOT NULL,
  score_total TINYINT UNSIGNED NOT NULL,
  score_breakdown JSON NOT NULL,
  indicators_snapshot JSON NOT NULL,
  sentiment_snapshot JSON NOT NULL,
  metadata JSON DEFAULT NULL,
  status ENUM('open', 'closed', 'cancelled') NOT NULL DEFAULT 'open',
  result_pnl DECIMAL(24, 12) DEFAULT NULL,
  result_percent DECIMAL(12, 6) DEFAULT NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME DEFAULT NULL,
  duration_seconds INT UNSIGNED DEFAULT NULL,
  trigger_source ENUM('webhook', 'auto', 'manual') NOT NULL,
  cancel_reason VARCHAR(100) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_trades_pair_status (pair, status),
  KEY idx_trades_opened_at (opened_at),
  KEY idx_trades_status (status),
  KEY idx_trades_trigger_source (trigger_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  trade_id BIGINT UNSIGNED DEFAULT NULL,
  pair VARCHAR(20) NOT NULL,
  role ENUM('entry', 'protection', 'exit', 'adjustment') NOT NULL,
  side ENUM('BUY', 'SELL') NOT NULL,
  order_type ENUM('MARKET', 'LIMIT', 'OCO') NOT NULL,
  exchange_order_id BIGINT UNSIGNED DEFAULT NULL,
  exchange_order_list_id BIGINT UNSIGNED DEFAULT NULL,
  exchange_client_order_id VARCHAR(100) DEFAULT NULL,
  quantity DECIMAL(24, 12) NOT NULL,
  price DECIMAL(24, 12) DEFAULT NULL,
  stop_price DECIMAL(24, 12) DEFAULT NULL,
  status ENUM('pending', 'open', 'filled', 'cancelled', 'failed') NOT NULL DEFAULT 'pending',
  metadata JSON DEFAULT NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_trade_id (trade_id),
  KEY idx_orders_pair_status (pair, status),
  KEY idx_orders_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capital_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  capital_value DECIMAL(24, 12) NOT NULL,
  realized_profit DECIMAL(24, 12) NOT NULL DEFAULT 0,
  unrealized_pnl DECIMAL(24, 12) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_capital_history_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('daily', 'weekly', 'monthly') NOT NULL,
  period VARCHAR(50) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_reports_type_period (type, period),
  KEY idx_reports_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS missed_opportunities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pair VARCHAR(20) NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  score TINYINT UNSIGNED NOT NULL,
  reason VARCHAR(255) NOT NULL,
  indicators_snapshot JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_missed_opportunities_pair_timestamp (pair, timestamp),
  KEY idx_missed_opportunities_score (score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
