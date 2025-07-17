#!/bin/bash

# RunStrong API Development Setup Script
# This script sets up the development environment for the RunStrong API

set -e

echo "🏃‍♂️ Setting up RunStrong API for local development..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your Anthropic API key"
    echo "   The database URL should be: postgresql://runstrong:runstrong_dev_password@localhost:5432/runstrong_db"
fi

# Start PostgreSQL in Docker
echo "🐘 Starting PostgreSQL database..."
docker run --name runstrong-postgres \
  -e POSTGRES_USER=runstrong \
  -e POSTGRES_PASSWORD=runstrong_dev_password \
  -e POSTGRES_DB=runstrong_db \
  -p 5432:5432 -d postgres:15 2>/dev/null || {
    echo "   PostgreSQL container already exists, starting it..."
    docker start runstrong-postgres
}

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 8

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate dev --name init

# Generate Prisma client
echo "⚙️  Generating Prisma client..."
npx prisma generate

echo "✅ Development setup complete!"
echo ""
echo "🚀 To start the server:"
echo "   npm start"
echo ""
echo "🌐 Application will be available at:"
echo "   http://localhost:3000"
echo ""
echo "📊 To view the database:"
echo "   npm run db:studio"
echo ""
echo "🛑 To stop the database:"
echo "   npm run db:stop"