#!/bin/bash

# Quick Deploy Script for RunStrong API
# Usage: ./scripts/quick-deploy.sh <droplet-ip>

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <droplet-ip>"
    echo "Example: $0 64.23.176.126"
    exit 1
fi

DROPLET_IP=$1
echo "🚀 Starting quick deployment to $DROPLET_IP..."

echo "📁 Step 1: Transferring files..."
rsync -av --exclude='node_modules' --exclude='.git' --exclude='*.log' \
    --exclude='test-markdown.html' --exclude='chatgpt-check-or-notes-ui.txt' \
    . root@$DROPLET_IP:/opt/runstrong-api/

echo "⚙️ Step 2: Setting up environment..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && cp .env.production .env"

echo "🐳 Step 3: Starting database..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker-compose up -d postgres"
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 15

echo "🗄️ Step 4: Resetting database schema (avoiding migration bullshit)..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker run --rm --network runstrong-api_default \
    -e DATABASE_URL=postgresql://runstrong:runstrong_secure_password_2024@postgres:5432/runstrong_db \
    -v /opt/runstrong-api:/app -w /app node:18-alpine \
    sh -c 'npm install && npx prisma db push --force-reset'"

echo "🏷️ Step 5: Baselining migrations..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker run --rm --network runstrong-api_default \
    -e DATABASE_URL=postgresql://runstrong:runstrong_secure_password_2024@postgres:5432/runstrong_db \
    -v /opt/runstrong-api:/app -w /app node:18-alpine \
    sh -c 'npx prisma migrate resolve --applied 20250716190000_postgresql_init && \
           npx prisma migrate resolve --applied 20250716223248_init_user_auth'"

echo "🚀 Step 6: Starting application..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker-compose up -d"

echo "⏳ Waiting for application to start..."
sleep 10

echo "✅ Step 7: Verifying deployment..."
if curl -f http://$DROPLET_IP:3000/health > /dev/null 2>&1; then
    echo "🎉 SUCCESS! Application deployed and running!"
    echo "🌐 Frontend: http://$DROPLET_IP:3000"
    echo "💚 Health: http://$DROPLET_IP:3000/health"
    
    # Show container status
    echo ""
    echo "📊 Container Status:"
    ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker-compose ps"
else
    echo "❌ FAILED! Application not responding"
    echo "📋 Check logs:"
    echo "ssh root@$DROPLET_IP 'cd /opt/runstrong-api && docker-compose logs runstrong-api --tail=20'"
    exit 1
fi

echo ""
echo "🏁 Deployment complete! No more database bullshit! 🎉"