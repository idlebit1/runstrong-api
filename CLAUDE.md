# Claude AI Assistant Notes

This file contains instructions and context for Claude AI when working on this project.

## Local Development Setup Requirements

**IMPORTANT**: This project requires PostgreSQL for local development. Do NOT use SQLite.

### Quick Setup Commands
```bash
# 1. Run the setup script (recommended)
./scripts/dev-setup.sh

# 2. OR manual setup:
npm run setup
npm start
```

### Database Requirements
- **Local Development**: PostgreSQL in Docker
- **Production**: PostgreSQL 
- **DO NOT use SQLite** - this causes schema mismatches

### Common Issues and Solutions

#### "Server won't start" or "Can't reach localhost"
1. **Check if PostgreSQL is running**:
   ```bash
   docker ps | grep postgres
   ```

2. **Start PostgreSQL if not running**:
   ```bash
   npm run db:start
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

4. **Check environment**:
   - Ensure `.env` exists with correct `DATABASE_URL`
   - Should be: `postgresql://runstrong:runstrong_dev_password@localhost:5432/runstrong_db`

#### Port 3000 already in use (COMMON ISSUE)
**ALWAYS CHECK THIS FIRST** before trying to start the server:
```bash
# Check if server is already running
curl -s http://localhost:3000/health

# If server responds, it's already running - no need to start again
# If no response, then kill any lingering processes:
lsof -ti:3000 | xargs kill -9
```

**Claude Assistant**: Before running `npm start`, ALWAYS check if the server is already running with `curl -s http://localhost:3000/health`. If it responds with status "OK", the server is already running and you should NOT try to start it again.

#### Database connection issues
```bash
# Reset everything
npm run db:reset
```

### Project Architecture

- **Authentication**: JWT-based with user registration/login
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: Vanilla HTML/CSS/JS with interactive training features
- **Backend**: Express.js with Anthropic Claude integration

### Key Features
- User authentication and authorization
- AI-powered training conversation
- Interactive training day features (checkboxes, notes, strikethrough)
- File management for training plans
- Auto-save functionality

### Development Workflow
1. Always start with `./scripts/dev-setup.sh` for new environments
2. Use `npm run dev` for development with auto-reload
3. Use `npm run db:studio` to view database
4. Test interactive features at http://localhost:3000

### Deployment
- Production uses Docker with PostgreSQL
- Deploy script: `./deploy-jwt.sh <ip-address>`
- Environment files: `.env` (local), `.env.production` (prod)

## Assistant Guidelines

When helping with this project:

1. **ALWAYS check if the server is already running** with `curl -s http://localhost:3000/health` before trying to start it
2. **Always check if PostgreSQL is running** before debugging server issues
3. **Use the setup script** for first-time setup
4. **Refer to README.md** for comprehensive documentation
5. **Remember the interactive training features** - this is a key differentiator
6. **Use PostgreSQL consistently** across all environments

### Interactive Training Features
The app has special interactive features for training day files:
- Checkboxes that can be toggled
- Click items to add notes or strikethrough
- Add new items with "+ Add Item" button
- Auto-save all changes via PUT /api/coach/files/:filename

These features work on any markdown file with list items.