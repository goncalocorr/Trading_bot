# Trading Bot

Crypto trading bot for Binance Spot with an Express backend, React dashboard, MySQL storage, Telegram notifications, backtesting, and Docker deployment.

## Features

- Binance Spot only, with Testnet-first support
- Signal intake from TradingView webhooks, internal auto-scan, and manual dashboard actions
- Multi-timeframe scoring with RSI, EMA/SMA, candlestick patterns, sentiment, and order book analysis
- ATR-based stop-loss and take-profit planning
- Break-even stop promotion after +1R and one-trade-per-pair cooldown protection
- Daily drawdown protection and max open trade limits
- React dashboard with active trades, capital chart, trade history, backtest UI, and settings
- Scheduled daily, weekly, and monthly reports
- Docker Compose stack with MySQL and phpMyAdmin

## Project Structure

```text
/trading-bot
  /backend
  /frontend
  docker-compose.yml
  README.md
```

## Local Development Setup

1. Create the backend environment file:

```bash
cd backend
cp .env.example .env
```

2. Fill in your Binance, Telegram, and MySQL credentials in `backend/.env`.

3. Install backend dependencies:

```bash
cd backend
npm install
```

4. Install frontend dependencies:

```bash
cd frontend
npm install
```

5. Start MySQL locally or with Docker.

6. Start the backend:

```bash
cd backend
npm run dev
```

7. Start the frontend:

```bash
cd frontend
npm run dev
```

8. Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3000/health`

## Binance Testnet Setup

1. Create a Binance account.
2. Open Binance Spot Testnet and create API keys.
3. Put the keys in `backend/.env`:

```env
BINANCE_API_KEY=your_key
BINANCE_SECRET=your_secret
BINANCE_TESTNET=true
BINANCE_TESTNET_BASE_URL=https://testnet.binance.vision
```

4. Fund the Spot Testnet wallet with test balances from the Testnet tools.
5. Keep `TRADING_PAIRS=BTCUSDT` for the first tests.

Important:

- This bot is written for Binance Spot, not futures.
- In spot mode, `SELL` signals are treated as exits for existing spot holdings rather than opening naked short positions.

## Telegram Bot Setup

1. Open Telegram and message `@BotFather`.
2. Create a new bot with `/newbot`.
3. Copy the bot token into `backend/.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
```

4. Send a message to your new bot.
5. Get your chat ID using a Telegram updates lookup or a helper bot.
6. Put the chat ID into:

```env
TELEGRAM_CHAT_ID=your_chat_id
```

## TradingView Webhook Setup

1. Create an alert in TradingView.
2. Set the webhook URL to:

```text
http://your-server-or-local-ip:3000/webhook
```

3. Use a JSON payload like:

```json
{
  "secret": "your_webhook_secret",
  "pair": "BTCUSDT",
  "side": "BUY",
  "metadata": {
    "source": "tradingview"
  }
}
```

4. Set the same secret in `backend/.env`:

```env
WEBHOOK_SECRET=your_webhook_secret
```

## Running Backtests

Warning:

Backtest sentiment is assumed neutral and order book pressure is approximated from candle close position within the candle range. These are known approximations — real historical sentiment and depth data are not available from free sources. Results should be used for strategy validation, not as exact performance predictions.

You can run backtests from the React dashboard or directly via API:

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d "{\"pair\":\"BTCUSDT\",\"dateFrom\":\"2025-01-01\",\"dateTo\":\"2025-02-01\",\"timeframe\":\"15m\"}"
```

The response includes:

- total return percent
- win rate
- max drawdown
- trade list
- capital curve

## Docker Deployment

1. Create `backend/.env` on the server.
2. Adjust DB credentials if needed.
3. Start the full stack:

```bash
docker compose up -d --build
```

4. Access:

- Frontend: `http://your-server-ip`
- Backend: `http://your-server-ip:3000`
- phpMyAdmin: `http://your-server-ip:8080`

## VPS Deployment Guide

Example targets:

- DigitalOcean Ubuntu droplet
- Hetzner cloud VPS

Recommended steps:

1. Provision a VPS with Docker and Docker Compose installed.
2. Clone this repository to the server.
3. Create `backend/.env`.
4. Run:

```bash
docker compose up -d --build
```

5. Install PM2 if you want a non-Docker Node process manager workflow:

```bash
npm install -g pm2
```

6. Example PM2 backend start:

```bash
cd backend
pm2 start server.js --name trading-bot-backend
pm2 save
pm2 startup
```

If you use Docker in production, PM2 is usually unnecessary because container restart policy already handles process recovery.

## Environment Variables

Use the template from `backend/.env.example`.

Main variables:

```env
BINANCE_API_KEY=
BINANCE_SECRET=
BINANCE_TESTNET=true
WEBHOOK_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
DB_HOST=localhost
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=tradingbot
TRADING_PAIRS=BTCUSDT
SCORE_THRESHOLD=8
RISK_PER_TRADE=0.01
COMPOUND_RATIO=0.5
DAILY_DRAWDOWN_LIMIT=0.05
MAX_OPEN_TRADES=3
MAX_OPEN_TRADES_PER_PAIR=1
PAIR_COOLDOWN_MINUTES=30
MIN_ATR_PERCENT=0.25
EMA_COMPRESSION_THRESHOLD_PERCENT=0.15
PORT=3000
FRONTEND_PORT=5173
```

## API Overview

- `GET /health`
- `POST /webhook`
- `GET /api/dashboard`
- `GET /api/dashboard/capital-history`
- `GET /api/dashboard/stats`
- `GET /api/dashboard/settings`
- `PATCH /api/dashboard/settings`
- `GET /api/trades`
- `GET /api/trades/active`
- `POST /api/trades/manual`
- `DELETE /api/trades/:id/cancel`
- `POST /api/backtest`

## Notes

- Install dependencies before first run.
- The backend initializes the database schema on startup.
- News, Fear & Greed, and macro-event integrations depend on external APIs.
