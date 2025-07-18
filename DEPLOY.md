# DigitalOcean Deployment Guide

## FASTEST OPTION: Quick Deploy Script

**Use this for rapid deployments to avoid database migration bullshit:**

```bash
# Create the quick deploy script
./scripts/quick-deploy.sh 64.23.176.126
```

**What this script does:**
1. Transfers files with rsync (fast, excludes bloat)
2. Sets up production environment 
3. Force resets database schema (avoids migration conflicts)
4. Baselines migrations properly
5. Starts application
6. Verifies deployment

---

## Option 1: DigitalOcean App Platform

### 1. Prepare Your Repository
```bash
# Push your code to GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/runstrong-api.git
git push -u origin main
```

### 2. Create App on DigitalOcean
1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Select "GitHub" as source
4. Choose your repository and branch
5. Configure build settings:
   - Build Command: `npm ci`
   - Run Command: `npm start`
   - Environment: Node.js
   - HTTP Port: 3000

### 3. Set Environment Variables
In the App Platform console, add these environment variables:
```
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret-here
ANTHROPIC_API_KEY=your-anthropic-api-key
VALID_API_KEYS=your-api-key-1,your-api-key-2
LOG_LEVEL=info
```

### 4. Deploy
- Click "Create Resources"
- Wait for deployment to complete
- Your API will be available at: `https://your-app-name.ondigitalocean.app`

## Option 2: DigitalOcean Droplet with Docker

### 1. Create Droplet
1. Create a new Droplet (Ubuntu 22.04 LTS)
2. Choose size: Basic $6/month (1GB RAM, 1 vCPU)
3. Add SSH key
4. Create droplet

### 2. Setup Droplet
```bash
# Connect to your droplet
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Create app directory
mkdir -p /opt/runstrong-api
cd /opt/runstrong-api
```

### 3. Deploy Application
```bash
# Clone your repository
# git clone https://github.com/yourusername/runstrong-api.git .

Option 1: Use Personal Access Token
# Generate a token at https://github.com/settings/tokens
# Then clone with:
git clone https://idlebit1:<your-token>@github.com/idlebit1/runstrong-api.git .

Option 2: Use SSH (recommended)
# Generate SSH key on droplet
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy public key and add to GitHub
cat ~/.ssh/id_ed25519.pub

# Clone with SSH
git clone git@github.com:idlebit1/runstrong-api.git .

Option 3: Clone from local machine and transfer
# On your local machine
scp -r /Users/reschkek/code/runstrong-api root@your-droplet-ip:/opt/runstrong-api

Option 3 is fastest since you already have the code locally.

# CRITICAL: Use this sequence to avoid database migration issues

# Create production environment file
cp .env.production .env

# IMPORTANT: Force reset database schema (avoids migration conflicts)
docker-compose up -d postgres
sleep 10

# Reset and push schema directly (MUCH FASTER than migrations)
docker run --rm --network runstrong-api_default \
  -e DATABASE_URL=postgresql://runstrong:runstrong_secure_password_2024@postgres:5432/runstrong_db \
  -v /opt/runstrong-api:/app -w /app node:18-alpine \
  sh -c 'npm install && npx prisma db push --force-reset'

# Baseline migrations to prevent startup failures
docker run --rm --network runstrong-api_default \
  -e DATABASE_URL=postgresql://runstrong:runstrong_secure_password_2024@postgres:5432/runstrong_db \
  -v /opt/runstrong-api:/app -w /app node:18-alpine \
  sh -c 'npx prisma migrate resolve --applied 20250716190000_postgresql_init && \
         npx prisma migrate resolve --applied 20250716223248_init_user_auth'

# Start the application
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f runstrong-api --tail=20
```

### 4. Setup Nginx (Optional)
```bash
# Install Nginx
apt install nginx -y

# Create Nginx config
cat > /etc/nginx/sites-available/runstrong-api << EOF
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/runstrong-api /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 5. SSL with Let's Encrypt
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d your-domain.com
```

## Option 3: Docker Registry + Droplet

### 1. Build and Push Image
```bash
# Build image
docker build -t runstrong-api .

# Tag for registry
docker tag runstrong-api registry.digitalocean.com/your-registry/runstrong-api:latest

# Push to DO Container Registry
docker push registry.digitalocean.com/your-registry/runstrong-api:latest
```

### 2. Deploy on Droplet
```bash
# On your droplet
doctl registry login
docker pull registry.digitalocean.com/your-registry/runstrong-api:latest
docker run -d --name runstrong-api --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-secret \
  -e ANTHROPIC_API_KEY=your-key \
  -e VALID_API_KEYS=your-api-keys \
  registry.digitalocean.com/your-registry/runstrong-api:latest
```

## Testing Deployment

```bash
# Health check
curl https://your-app-url/health

# API test
curl -X POST https://your-app-url/api/coach/chat \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey your-api-key' \
  -d '{"message": "Hello", "userId": "test"}'
```

## Monitoring

### Check Logs
```bash
# App Platform
# View logs in the DigitalOcean console

# Docker
docker-compose logs -f

# Check container status
docker-compose ps
```

### Performance Monitoring
Consider adding:
- DigitalOcean Monitoring
- Log aggregation (Papertrail, Loggly)
- Error tracking (Sentry)
- Uptime monitoring (UptimeRobot)

## Scaling

### App Platform
- Increase instance size in console
- Enable auto-scaling

### Droplet
- Upgrade droplet size
- Add load balancer
- Use multiple droplets

## Security Checklist

- [ ] Use strong JWT secrets
- [ ] Rotate API keys regularly
- [ ] Enable firewall (UFW)
- [ ] Use SSL/TLS certificates
- [ ] Regular security updates
- [ ] Monitor for suspicious activity
- [ ] Backup user data regularly
