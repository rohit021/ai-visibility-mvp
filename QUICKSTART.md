# 🚀 QUICK START GUIDE

Get the AI Visibility Tool running in 10 minutes!

---

## Step 1: Prerequisites

Make sure you have:
- ✅ Node.js 18+ installed
- ✅ MySQL 8+ installed and running
- ✅ OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

---

## Step 2: Setup

```bash
# Clone/download the project
cd ai-visibility-mvp

# Run the setup script
./setup.sh

# OR do it manually:
npm install
cp .env.example .env
# Edit .env with your credentials
mysql -u root -p < database-schema.sql
npm run seed
```

---

## Step 3: Configure .env

Edit `.env` file:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE    # ⚠️ CHANGE THIS
DB_NAME=college_ai_visibility

JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRATION=7d

OPENAI_API_KEY=sk-YOUR_KEY_HERE         # ⚠️ CHANGE THIS

PORT=3000
NODE_ENV=development
```

---

## Step 4: Start the Server

```bash
npm run start:dev
```

You should see:
```
🚀 Application is running on: http://localhost:3000/api
```

---

## Step 5: Test the API

### Option A: Use Postman

1. Import `postman-collection.json` in Postman
2. Set variables: `baseUrl`, `token`, `collegeId`
3. Test all endpoints!

### Option B: Use cURL

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@college.edu",
    "password": "password123",
    "fullName": "Admin User"
  }'

# Save the token from response!
export TOKEN="your_token_here"

# 2. Create College
curl -X POST http://localhost:3000/api/colleges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "collegeName": "Test College",
    "city": "Delhi",
    "state": "Delhi",
    "programs": ["BTech"],
    "website": "https://example.com"
  }'

# Save college ID!
export COLLEGE_ID=1

# 3. Execute AI Queries (THE MAGIC!)
curl -X POST http://localhost:3000/api/ai-queries/execute/$COLLEGE_ID \
  -H "Authorization: Bearer $TOKEN"

# This will take ~30 minutes (50 queries × 350ms rate limiting)
# Check progress in terminal logs!

# 4. View Dashboard
curl -X GET http://localhost:3000/api/dashboard/$COLLEGE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## Step 6: Check Results

After queries complete:

```bash
# Calculate visibility score
curl -X POST http://localhost:3000/api/analytics/calculate/$COLLEGE_ID \
  -H "Authorization: Bearer $TOKEN"

# View dashboard
curl -X GET http://localhost:3000/api/dashboard/$COLLEGE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎯 What You'll See

The dashboard returns:

```json
{
  "college": {
    "name": "Test College",
    "visibilityPercentage": 43.3,
    "rankAmongCompetitors": 3
  },
  "trends": [...],
  "topWins": [
    "ChatGPT mentioned you #1 for 'Best infrastructure...'"
  ],
  "gaps": [
    "Not mentioned in 'placement queries'"
  ]
}
```

---

## 🐛 Troubleshooting

### "Database connection failed"
```bash
# Check MySQL is running
sudo systemctl status mysql

# Verify credentials in .env
```

### "OpenAI API error"
```bash
# Check your API key
# Verify you have credits: https://platform.openai.com/account/billing
```

### "Port 3000 already in use"
```bash
# Change PORT in .env to 3001
```

---

## ✅ You're Ready!

The MVP is fully functional with:
- ✅ User authentication
- ✅ College management
- ✅ AI query execution
- ✅ Analytics & dashboard
- ✅ 50 pre-configured prompts

**Next:** Build a simple frontend or integrate with your existing app!

---

## 📚 Full Documentation

Check `README.md` for:
- Complete API documentation
- All endpoints
- Response examples
- Architecture details

---

**Happy coding! 🚀**
