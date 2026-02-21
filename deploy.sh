#!/bin/bash
# Mission Control — VPS Deployment Script
# Run on VPS: bash deploy.sh

set -e

echo "🚀 Deploying Mission Control to VPS..."

# 1. Clone or update repo
DEPLOY_DIR="/opt/mission-control"
REPO="git@github.com:choichjj11-del/mission-control.git"

if [ -d "$DEPLOY_DIR" ]; then
  echo "📦 Updating existing deployment..."
  cd "$DEPLOY_DIR"
  git fetch origin
  git reset --hard origin/main
else
  echo "📦 Fresh clone..."
  git clone "$REPO" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# 2. Check .env exists
if [ ! -f "$DEPLOY_DIR/server/.env" ]; then
  echo ""
  echo "⚠️  server/.env not found! Create it from template:"
  echo "   cp server/.env.example server/.env"
  echo "   nano server/.env"
  echo ""
  echo "Required keys:"
  echo "   OPENAI_API_KEY=sk-..."
  echo "   ELEVENLABS_API_KEY=xi_..."
  echo "   AUTH_TOKEN=your-secret-token"
  echo "   TELEGRAM_BOT_TOKEN=..."
  echo ""
  exit 1
fi

# 3. Build and start with Docker
echo "🐳 Starting Docker containers..."
docker compose down 2>/dev/null || true
docker compose up -d --build

# 4. Wait and check health
echo "⏳ Waiting for server to start..."
sleep 5
if curl -sf http://localhost:3000/api/health > /dev/null; then
  echo "✅ Mission Control is running!"
  echo "   Local:  http://localhost:3000"
  echo "   Health: http://localhost:3000/api/health"
else
  echo "❌ Server failed to start. Check logs:"
  echo "   docker compose logs mission-control"
  exit 1
fi

echo ""
echo "📝 Next steps:"
echo "   1. Set up Nginx reverse proxy (see nginx.conf)"
echo "   2. Test: curl http://localhost:3000/api/health"
echo "   3. Open dashboard: http://dashboard.lucyhome.ai"
