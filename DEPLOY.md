# DigitalOcean Deployment Guide

## Option 1: DigitalOcean App Platform (Recommended)

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
git clone https://github.com/yourusername/runstrong-api.git .

# Create production environment file
cat > .env << EOF
NODE_ENV=production
***REMOVED***
JWT_SECRET=your-secure-jwt-secret-here
ANTHROPIC_API_KEY=your-anthropic-api-key
VALID_API_KEYS=your-api-key-1,your-api-key-2
LOG_LEVEL=info
EOF

# Start the application
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
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