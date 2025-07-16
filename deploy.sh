#!/bin/bash

# RunStrong API Deployment Script
# This script deploys the application to a DigitalOcean droplet

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DROPLET_IP=""
DROPLET_USER="root"
APP_DIR="/opt/runstrong-api"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            DROPLET_IP="$2"
            shift 2
            ;;
        -u|--user)
            DROPLET_USER="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 -h <droplet-ip> [-u <user>]"
            echo "Options:"
            echo "  -h, --host    Droplet IP address"
            echo "  -u, --user    SSH user (default: root)"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$DROPLET_IP" ]]; then
    echo -e "${RED}Error: Droplet IP address is required${NC}"
    echo "Usage: $0 -h <droplet-ip> [-u <user>]"
    exit 1
fi

echo -e "${GREEN}🚀 Deploying RunStrong API to $DROPLET_IP${NC}"

# Check if .env file exists
if [[ ! -f ".env" ]]; then
    echo -e "${YELLOW}⚠️  No .env file found. Please create one based on .env.example${NC}"
    echo "Required environment variables:"
    echo "  - JWT_SECRET"
    echo "  - ANTHROPIC_API_KEY"
    echo "  - VALID_API_KEYS"
    echo "  - DB_PASSWORD"
    exit 1
fi

# Create deployment directory on droplet
echo -e "${GREEN}📁 Creating deployment directory...${NC}"
ssh "$DROPLET_USER@$DROPLET_IP" "mkdir -p $APP_DIR"

# Copy files to droplet
echo -e "${GREEN}📤 Copying files to droplet...${NC}"
rsync -avz --exclude node_modules --exclude .git --exclude dev.db --exclude *.log . "$DROPLET_USER@$DROPLET_IP:$APP_DIR/"

# Install dependencies and deploy
echo -e "${GREEN}🔧 Installing dependencies and deploying...${NC}"
ssh "$DROPLET_USER@$DROPLET_IP" << EOF
    cd $APP_DIR
    
    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
    fi
    
    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        echo "Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    
    # Stop existing containers
    echo "Stopping existing containers..."
    docker-compose down || true
    
    # Remove old images
    echo "Removing old images..."
    docker system prune -f
    
    # Build and start services
    echo "Building and starting services..."
    docker-compose up -d --build
    
    # Wait for services to be ready
    echo "Waiting for services to be ready..."
    sleep 30
    
    # Check service status
    echo "Checking service status..."
    docker-compose ps
    
    # Test health endpoint
    echo "Testing health endpoint..."
    curl -f http://localhost:3000/health || echo "Health check failed"
EOF

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${GREEN}🌐 Your application should be available at: http://$DROPLET_IP:3000${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Set up Nginx reverse proxy (optional)"
echo "2. Configure SSL with Let's Encrypt (optional)"
echo "3. Set up monitoring and backups"
echo ""
echo -e "${GREEN}📊 To check logs:${NC}"
echo "ssh $DROPLET_USER@$DROPLET_IP 'cd $APP_DIR && docker-compose logs -f'"