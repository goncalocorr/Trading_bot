#!/bin/bash
# Exports bot data from VPS API to local files for Claude analysis.
# Usage: ./scripts/export-analysis.sh https://your-domain.com YOUR_API_SECRET

set -e

BASE_URL="${1:?Usage: $0 <base_url> <api_secret>}"
API_SECRET="${2:?Usage: $0 <base_url> <api_secret>}"
HEADER="X-API-Key: $API_SECRET"
OUT_DIR="./analysis-data"

mkdir -p "$OUT_DIR"

echo "Fetching data from $BASE_URL ..."

curl -sf -H "$HEADER" "$BASE_URL/health" > "$OUT_DIR/health.json"
echo "  health OK"

curl -sf -H "$HEADER" "$BASE_URL/api/dashboard" > "$OUT_DIR/dashboard.json"
echo "  dashboard OK"

curl -sf -H "$HEADER" "$BASE_URL/api/dashboard/stats" > "$OUT_DIR/stats.json"
echo "  stats OK"

curl -sf -H "$HEADER" "$BASE_URL/api/dashboard/capital-history?range=ALL" > "$OUT_DIR/capital-history.json"
echo "  capital history OK"

curl -sf -H "$HEADER" "$BASE_URL/api/trades?status=closed" > "$OUT_DIR/trades-closed.json"
echo "  closed trades OK"

curl -sf -H "$HEADER" "$BASE_URL/api/trades?status=open" > "$OUT_DIR/trades-open.json"
echo "  open trades OK"

curl -sf -H "$HEADER" "$BASE_URL/api/dashboard/missed-opportunities?limit=200" > "$OUT_DIR/missed-opportunities.json"
echo "  missed opportunities OK"

# Signal debug for each configured pair
for PAIR in ETHUSDT XRPUSDT BTCUSDT; do
  curl -sf -H "$HEADER" "$BASE_URL/api/dashboard/signal-debug?pair=$PAIR&side=BUY" > "$OUT_DIR/signal-debug-${PAIR}.json" 2>/dev/null || true
done
echo "  signal debug OK"

echo ""
echo "Done! Files saved to $OUT_DIR/"
echo "Now open Claude Code and ask: 'analisa os dados do bot em analysis-data/'"
