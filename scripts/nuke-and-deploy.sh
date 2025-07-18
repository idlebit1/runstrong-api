#!/bin/bash

# Nuclear Deploy Script - Nukes everything and deploys fresh
# Usage: ./scripts/nuke-and-deploy.sh <droplet-ip>

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <droplet-ip>"
    echo "Example: $0 64.23.176.126"
    exit 1
fi

DROPLET_IP=$1
echo "💥 Starting NUCLEAR deployment to $DROPLET_IP..."
echo "⚠️  This will DESTROY EVERYTHING and start fresh!"

echo ""
echo "🧨 Step 1: Nuking droplet completely..."
ssh root@$DROPLET_IP "cd /opt && docker-compose -f runstrong-api/docker-compose.yml down --volumes --remove-orphans 2>/dev/null || true && docker system prune -af && docker image rm -f runstrong-api_runstrong-api runstrong-api-runstrong-api 2>/dev/null || true && rm -rf runstrong-api"

echo "📁 Step 2: Transferring fresh code..."
rsync -av --exclude='node_modules' --exclude='.git' --exclude='*.log' \
    --exclude='test-markdown.html' --exclude='chatgpt-check-or-notes-ui.txt' \
    . root@$DROPLET_IP:/opt/runstrong-api/

echo "⚙️ Step 3: Setting up environment..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && cp .env.production .env"

echo "🐳 Step 4: Starting PostgreSQL..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker-compose up -d postgres"
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 15

echo "📦 Step 5: Installing dependencies and setting up database schema..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker run --rm --network runstrong-api_default \
    -e DATABASE_URL=postgresql://runstrong:runstrong_secure_password_2024@postgres:5432/runstrong_db \
    -v /opt/runstrong-api:/app -w /app node:18-alpine \
    sh -c 'npm install && npx prisma db push --force-reset'"

echo "🚀 Step 6: Building and starting application..."
ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker-compose up -d --build"

echo "⏳ Waiting for application to start..."
sleep 15

echo "✅ Step 7: Verifying deployment..."
for i in {1..5}; do
    if curl -f http://$DROPLET_IP:3000/health > /dev/null 2>&1; then
        echo "🎉 SUCCESS! Application deployed and running!"
        echo "🌐 Frontend: http://$DROPLET_IP:3000"
        echo "💚 Health: http://$DROPLET_IP:3000/health"
        
        # Show container status
        echo ""
        echo "📊 Container Status:"
        ssh root@$DROPLET_IP "cd /opt/runstrong-api && docker-compose ps"
        
        echo ""
        echo "🏁 NUCLEAR DEPLOYMENT COMPLETE! 🎉"
        exit 0
    else
        echo "⏳ Attempt $i/5: Application not ready yet, waiting..."
        sleep 10
    fi
done

echo "❌ FAILED! Application not responding after 5 attempts"
echo "📋 Check logs:"
echo "ssh root@$DROPLET_IP 'cd /opt/runstrong-api && docker-compose logs --tail=20 runstrong-api'"
exit 1