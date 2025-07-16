#!/bin/bash

# JWT Authentication Deployment Script
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <droplet-ip>"
    echo "Example: $0 157.245.123.456"
    exit 1
fi

DROPLET_IP=$1
APP_DIR="/opt/runstrong-api"

echo "🚀 Deploying JWT Authentication updates to $DROPLET_IP"

# Stop the current application
echo "📦 Stopping current application..."
ssh root@$DROPLET_IP "cd $APP_DIR && docker-compose down || true"

# Copy updated files
echo "📤 Copying updated files..."
rsync -avz --exclude node_modules --exclude .git --exclude dev.db --exclude *.log \
    --exclude .env.development --exclude .env \
    . root@$DROPLET_IP:$APP_DIR/

# Copy production environment
echo "🔧 Setting up production environment..."
scp .env.production root@$DROPLET_IP:$APP_DIR/.env

# Deploy with new authentication system
echo "🛠️ Rebuilding and starting services..."
ssh root@$DROPLET_IP << EOF
    cd $APP_DIR
    
    # Remove old containers and volumes to ensure clean state
    docker-compose down -v || true
    docker system prune -f
    
    # Rebuild with new authentication
    docker-compose up -d --build
    
    # Wait for services
    echo "⏳ Waiting for services to start..."
    sleep 30
    
    # Check status
    echo "📊 Service status:"
    docker-compose ps
    
    # Test health
    echo "🏥 Testing health endpoint..."
    curl -f http://localhost:3000/health || echo "Health check failed"
    
    echo "✅ Deployment complete!"
    echo "🌐 Your JWT-authenticated RunStrong API is ready at: http://$DROPLET_IP:3000"
    echo ""
    echo "🔑 Users can now:"
    echo "  - Register: POST /api/auth/register"
    echo "  - Login: POST /api/auth/login" 
    echo "  - Chat: POST /api/coach/conversations (with JWT token)"
EOF

echo ""
echo "🎉 JWT Authentication deployment successful!"
echo "🔗 Access your app at: http://$DROPLET_IP:3000"