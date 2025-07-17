# RunStrong AI Coach API

A Node.js API for the RunStrong AI running coach with JWT authentication and interactive training day features.

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL)
- Git

### Option 1: Automated Setup (Recommended)
```bash
git clone <repository-url>
cd runstrong-api
npm install
./scripts/dev-setup.sh
npm start
```

### Option 2: Manual Setup
```bash
git clone <repository-url>
cd runstrong-api
npm install
npm run setup  # Starts database and runs migrations
npm start
```

### ⚠️ Don't forget!
- Edit `.env` and add your Anthropic API key
- Open http://localhost:3000 to test
- Register a new account and try the interactive training features

## Features

### Authentication
- JWT-based user authentication
- User registration and login
- Token refresh mechanism
- Secure password hashing with bcrypt

### AI Coach Integration
- Anthropic Claude integration
- Conversation management
- Context-aware responses
- Training plan generation

### Interactive Training Days
- ✅ **Checkboxes** - Mark items as complete
- 📝 **Notes** - Add personal notes to any item
- ✂️ **Strikethrough** - Mark items as done
- ➕ **Add Items** - Add custom training tasks
- 💾 **Auto-save** - Changes saved automatically

### File Management
- Markdown file storage and display
- Training plan persistence
- User profile management
- File versioning

## Testing Locally

### Quick Setup
1. Copy environment file: `cp .env.example .env`
2. Install dependencies: `npm install`
3. Start server: `npm run dev`

### Testing with curl

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Chat with AI Coach:**
```bash
curl -X POST http://localhost:3000/api/coach/chat \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey test-key-123' \
  -d '{"message": "How should I start running?", "userId": "test-user"}'
```

**Save User Profile:**
```bash
curl -X POST http://localhost:3000/api/coach/files/profile.json \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey test-key-123' \
  -d '{"content": {"name": "Test User", "age": 30, "experience": "beginner"}, "userId": "test-user"}'
```

**Generate Training Plan:**
```bash
curl -X POST http://localhost:3000/api/coach/training-plan \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey test-key-123' \
  -d '{"userProfile": {"age": 30, "experience": "beginner"}, "goals": {"distance": "5K", "timeframe": "8 weeks"}, "userId": "test-user"}'
```

### Automated Testing
Run the test script for comprehensive testing:
```bash
./test_commands.sh
```

## API Endpoints

### Authentication

All endpoints require authentication via `Authorization` header:
- JWT: `Bearer <token>`
- API Key: `ApiKey <key>`

### Coach Endpoints

#### Chat with AI Coach
```
POST /api/coach/chat
Content-Type: application/json

{
  "message": "How should I train for a 5K race?",
  "userId": "user123"
}
```

#### Generate Training Plan
```
POST /api/coach/training-plan
Content-Type: application/json

{
  "userProfile": {
    "age": 30,
    "experience": "beginner",
    "currentMileage": 10
  },
  "goals": {
    "distance": "5K",
    "timeframe": "8 weeks"
  },
  "userId": "user123"
}
```

### File Operations

#### Save File
```
POST /api/coach/files/profile.json
Content-Type: application/json

{
  "content": {
    "name": "John Doe",
    "age": 30,
    "experience": "intermediate"
  },
  "userId": "user123"
}
```

#### Read File
```
GET /api/coach/files/profile.json?userId=user123
```

#### List Files
```
GET /api/coach/files?userId=user123
```

#### Delete File
```
DELETE /api/coach/files/profile.json?userId=user123
```

### Health Check
```
GET /health
```

## File Structure

```
src/
├── index.js              # Main application entry point
├── middleware/
│   ├── auth.js           # Authentication middleware
│   └── errorHandler.js   # Error handling middleware
├── routes/
│   └── coach.js          # Coach API routes
├── services/
│   ├── anthropicService.js   # Anthropic API integration
│   └── virtualFileSystem.js  # Virtual file system service
└── utils/
    └── logger.js         # Logging utility
```

## Usage Notes

- User files are stored in `src/data/userFiles/{userId}/`
- File operations are sandboxed to prevent directory traversal
- The AI coach has access to user profile and workout history for context
- Rate limiting is set to 100 requests per 15 minutes per IP
- All file operations accept JSON content only