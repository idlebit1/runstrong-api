#!/bin/bash

# RunStrong API Test Commands
# Make sure the server is running: npm run dev

BASE_URL="http://localhost:3000"
API_KEY="test-key-123"

echo "=== RunStrong API Test Commands ==="
echo "Make sure server is running: npm run dev"
echo ""

echo "1. Health Check"
echo "curl $BASE_URL/health"
curl $BASE_URL/health
echo -e "\n\n"

echo "2. Chat with AI Coach"
echo "curl -X POST $BASE_URL/api/coach/chat \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: ApiKey $API_KEY' \\"
echo "  -d '{\"message\": \"How should I start running?\", \"userId\": \"test-user\"}'"
curl -X POST $BASE_URL/api/coach/chat \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey test-key-123' \
  -d '{"message": "How should I start running?", "userId": "test-user"}'
echo -e "\n\n"

echo "3. Save User Profile"
echo "curl -X POST $BASE_URL/api/coach/files/profile.json \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: ApiKey $API_KEY' \\"
echo "  -d '{\"content\": {\"name\": \"Test User\", \"age\": 30, \"experience\": \"beginner\"}, \"userId\": \"test-user\"}'"
curl -X POST $BASE_URL/api/coach/files/profile.json \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey test-key-123' \
  -d '{"content": {"name": "Test User", "age": 30, "experience": "beginner"}, "userId": "test-user"}'
echo -e "\n\n"

echo "4. Read User Profile"
echo "curl -H 'Authorization: ApiKey $API_KEY' '$BASE_URL/api/coach/files/profile.json?userId=test-user'"
curl -H 'Authorization: ApiKey test-key-123' '$BASE_URL/api/coach/files/profile.json?userId=test-user'
echo -e "\n\n"

echo "5. Generate Training Plan"
echo "curl -X POST $BASE_URL/api/coach/training-plan \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: ApiKey $API_KEY' \\"
echo "  -d '{\"userProfile\": {\"age\": 30, \"experience\": \"beginner\", \"currentMileage\": 5}, \"goals\": {\"distance\": \"5K\", \"timeframe\": \"8 weeks\"}, \"userId\": \"test-user\"}'"
curl -X POST $BASE_URL/api/coach/training-plan \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey test-key-123' \
  -d '{"userProfile": {"age": 30, "experience": "beginner", "currentMileage": 5}, "goals": {"distance": "5K", "timeframe": "8 weeks"}, "userId": "test-user"}'
echo -e "\n\n"

echo "6. List All Files"
echo "curl -H 'Authorization: ApiKey $API_KEY' '$BASE_URL/api/coach/files?userId=test-user'"
curl -H 'Authorization: ApiKey test-key-123' '$BASE_URL/api/coach/files?userId=test-user'
echo -e "\n\n"