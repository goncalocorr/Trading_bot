#!/bin/bash
set -e

echo "=== Trading Bot VPS Setup ==="

# 1. Check required files
if [ ! -f ".env" ]; then
  echo "ERROR: .env not found in project root. Copy .env.example and fill in values."
  exit 1
fi

if [ ! -f "backend/.env" ]; then
  echo "ERROR: backend/.env not found. Copy backend/.env.example and fill in values."
  exit 1
fi

# 2. Check required env vars
source .env
if [ -z "$MYSQL_ROOT_PASSWORD" ] || [ "$MYSQL_ROOT_PASSWORD" = "CHANGE_ME_strong_random_password_here" ]; then
  echo "ERROR: Set a real MYSQL_ROOT_PASSWORD in .env"
  exit 1
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "CHANGE_ME_another_strong_password" ]; then
  echo "ERROR: Set a real DB_PASSWORD in .env"
  exit 1
fi

# 3. Check API_SECRET in backend
if ! grep -q "API_SECRET=.\+" backend/.env; then
  echo "WARNING: API_SECRET is empty in backend/.env. Generate one:"
  echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
fi

# 4. Create certbot dirs
mkdir -p certbot/conf certbot/www
echo "Created certbot directories."

# 5. Initial SSL certificate (if domain is configured)
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "your-domain.com" ]; then
  echo "Requesting SSL certificate for $DOMAIN..."
  echo "NOTE: Make sure DNS A record points to this server's IP first."
  echo ""
  echo "For first-time setup, temporarily edit frontend/nginx.conf:"
  echo "  1. Comment out the 'server { listen 443 ...' block"
  echo "  2. Run: docker compose up -d frontend"
  echo "  3. Run: docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
  echo "  4. Uncomment the 443 block back"
  echo "  5. Run: docker compose up -d"
else
  echo "DOMAIN not set — skipping SSL. Set it in .env for HTTPS."
fi

# 6. Build and start
echo ""
echo "Building and starting services..."
docker compose build
docker compose up -d

echo ""
echo "=== Setup Complete ==="
echo "Services:"
echo "  Frontend: http://$(hostname -I | awk '{print $1}')"
echo "  Health:   http://$(hostname -I | awk '{print $1}')/health"
echo ""
echo "Logs: docker compose logs -f"
echo "Stop: docker compose down"
