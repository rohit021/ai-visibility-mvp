# AI Visibility Tool for Indian Colleges - MVP

Complete backend MVP built with NestJS, MySQL, and OpenAI API.

## 🎯 Features Included

### ✅ Day 1-2: Authentication
- User registration with JWT
- Login with secure password hashing (bcrypt)
- JWT-based authentication
- Protected routes

### ✅ Day 3-4: College Management
- Register college profile
- Add/manage competitors (max 5)
- College CRUD operations
- 90-day trial period

### ✅ Day 5-7: AI Query Engine
- OpenAI (ChatGPT) integration
- Query execution with rate limiting
- Response parsing (extract college mentions)
- Store results with competitor analysis
- Manual trigger API

### ✅ Day 8-14: Analytics & Dashboard
- Calculate visibility scores
- Weekly trend analysis
- Competitor comparison
- Category-wise breakdown
- Dashboard API with comprehensive data

---

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18 or higher)
2. **MySQL** (v8.0 or higher)
3. **OpenAI API Key**

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Setup Database

```bash
# Login to MySQL
mysql -u root -p

# Run the schema
mysql -u root -p < database-schema.sql
```

This will create:
- Database: `college_ai_visibility`
- All required tables

### Step 3: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required environment variables:**

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
DB_NAME=college_ai_visibility

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRATION=7d

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# App
PORT=3000
NODE_ENV=development
```

### Step 4: Seed Default Prompts

```bash
npm run seed
```

This will insert 50 default prompts into the database.

### Step 5: Run the Application

```bash
# Development mode (with hot-reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at: **http://localhost:3000/api**

---

## 📚 API Endpoints

### Authentication

```bash
# Register
POST /api/auth/register
Body: {
  "email": "admin@amity.edu",
  "password": "password123",
  "fullName": "John Doe"
}

# Login
POST /api/auth/login
Body: {
  "email": "admin@amity.edu",
  "password": "password123"
}

# Get Profile (Protected)
GET /api/auth/profile
Headers: Authorization: Bearer <token>
```

### College Management

```bash
# Create College (Protected)
POST /api/colleges
Headers: Authorization: Bearer <token>
Body: {
  "collegeName": "Amity University Gurugram",
  "city": "Gurugram",
  "state": "Haryana",
  "website": "https://www.amity.edu",
  "nirfRank": 55,
  "programs": ["BTech", "MBA", "BBA"],
  "specializations": ["CSE", "ECE", "Mechanical"]
}

# Get All Colleges
GET /api/colleges
Headers: Authorization: Bearer <token>

# Get Single College
GET /api/colleges/:id
Headers: Authorization: Bearer <token>

# Add Competitor
POST /api/colleges/:id/competitors
Headers: Authorization: Bearer <token>
Body: {
  "competitorCollegeName": "SRM University Delhi NCR",
  "competitorCity": "Sonepat",
  "competitorNirfRank": 42
}

# Get Competitors
GET /api/colleges/:id/competitors
Headers: Authorization: Bearer <token>
```

### Prompts

```bash
# Get All Prompts
GET /api/prompts
Headers: Authorization: Bearer <token>

# Get Prompts by Category
GET /api/prompts/category/program_specific
Headers: Authorization: Bearer <token>
```

### AI Queries (Core Feature)

```bash
# Execute Queries for College (Manual Trigger)
POST /api/ai-queries/execute/:collegeId
Headers: Authorization: Bearer <token>

# This will:
# 1. Get all prompts (50 default)
# 2. Replace placeholders with college data
# 3. Execute each query via ChatGPT
# 4. Parse responses for college mentions
# 5. Store results in database

# Get Query History
GET /api/ai-queries/:collegeId?limit=50
Headers: Authorization: Bearer <token>

# Get Single Query Details
GET /api/ai-queries/:collegeId/:queryId
Headers: Authorization: Bearer <token>
```

### Analytics

```bash
# Get Latest Visibility Score
GET /api/analytics/visibility-score/:collegeId
Headers: Authorization: Bearer <token>

# Get Trend Data (Last 12 weeks)
GET /api/analytics/trends/:collegeId?weeks=12
Headers: Authorization: Bearer <token>

# Calculate Score for Current Week
POST /api/analytics/calculate/:collegeId
Headers: Authorization: Bearer <token>
```

### Dashboard

```bash
# Get Complete Dashboard
GET /api/dashboard/:collegeId
Headers: Authorization: Bearer <token>

# Returns:
# - College info
# - Current visibility score
# - Trend data (12 weeks)
# - Recent activity
# - Top wins
# - Gaps identified

# Get Quick Summary
GET /api/dashboard/:collegeId/summary
Headers: Authorization: Bearer <token>
```

---

## 🔥 Complete Testing Flow

### 1. Register & Login

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@amity.edu",
    "password": "password123",
    "fullName": "Amity Admin"
  }'

# Response: { "user": {...}, "access_token": "eyJhbGc..." }

# Save the token!
export TOKEN="your_token_here"
```

### 2. Create College

```bash
curl -X POST http://localhost:3000/api/colleges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "collegeName": "Amity University Gurugram",
    "city": "Gurugram",
    "state": "Haryana",
    "website": "https://www.amity.edu",
    "nirfRank": 55,
    "programs": ["BTech", "MBA", "BBA"],
    "specializations": ["CSE", "ECE", "Mechanical"]
  }'

# Response: { "id": 1, "collegeName": "Amity...", ... }

# Save the college ID!
export COLLEGE_ID=1
```

### 3. Add Competitors

```bash
curl -X POST http://localhost:3000/api/colleges/$COLLEGE_ID/competitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "competitorCollegeName": "SRM University Delhi NCR",
    "competitorCity": "Sonepat",
    "competitorNirfRank": 42
  }'

# Add 2-3 more competitors
```

### 4. Execute AI Queries (THE MAGIC! ✨)

```bash
curl -X POST http://localhost:3000/api/ai-queries/execute/$COLLEGE_ID \
  -H "Authorization: Bearer $TOKEN"

# This will:
# - Execute 50 prompts via ChatGPT
# - Take ~30 minutes (rate limiting)
# - Store all results in database
#
# Response: {
#   "success": true,
#   "totalQueries": 50,
#   "successfulQueries": 48,
#   "failedQueries": 2
# }
```

### 5. Calculate Visibility Score

```bash
curl -X POST http://localhost:3000/api/analytics/calculate/$COLLEGE_ID \
  -H "Authorization: Bearer $TOKEN"

# Response: {
#   "visibilityPercentage": 43.3,
#   "mentionsCount": 65,
#   "totalQueries": 150,
#   "rankAmongCompetitors": 3,
#   ...
# }
```

### 6. View Dashboard

```bash
curl -X GET http://localhost:3000/api/dashboard/$COLLEGE_ID \
  -H "Authorization: Bearer $TOKEN"

# Response: Full dashboard with trends, scores, gaps, wins
```

---

## 📊 Database Schema

The application uses 7 main tables:

1. **users** - Authentication
2. **colleges** - College profiles
3. **competitors** - Competitor tracking
4. **prompt_library** - 50 default prompts
5. **ai_queries** - Query execution results
6. **visibility_scores** - Calculated scores
7. **recommendations** - (Future: action items)

---

## 🔧 Development

```bash
# Run in development mode (hot-reload)
npm run start:dev

# Build for production
npm run build

# Run tests
npm run test

# Lint code
npm run lint
```

---

## 📁 Project Structure

```
src/
├── auth/                  # Authentication module
│   ├── dto/               # Data transfer objects
│   ├── guards/            # JWT auth guard
│   ├── strategies/        # Passport strategies
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   └── auth.module.ts
│
├── colleges/              # College management
│   ├── dto/
│   ├── colleges.service.ts
│   ├── colleges.controller.ts
│   └── colleges.module.ts
│
├── prompts/               # Prompt library
│   ├── prompts.service.ts
│   ├── prompts.controller.ts
│   └── prompts.module.ts
│
├── ai-engine/             # AI Query Engine (CORE)
│   ├── services/
│   │   ├── openai.service.ts           # ChatGPT integration
│   │   ├── response-parser.service.ts   # Parse AI responses
│   │   └── query-executor.service.ts    # Orchestrator
│   ├── ai-engine.controller.ts
│   └── ai-engine.module.ts
│
├── analytics/             # Analytics & Scoring
│   ├── services/
│   │   └── visibility-calculator.service.ts
│   ├── analytics.service.ts
│   ├── analytics.controller.ts
│   └── analytics.module.ts
│
├── dashboard/             # Dashboard API
│   ├── dashboard.service.ts
│   ├── dashboard.controller.ts
│   └── dashboard.module.ts
│
├── database/              # Database layer
│   ├── entities/          # TypeORM entities
│   │   ├── user.entity.ts
│   │   ├── college.entity.ts
│   │   ├── competitor.entity.ts
│   │   ├── prompt-library.entity.ts
│   │   ├── ai-query.entity.ts
│   │   └── visibility-score.entity.ts
│   └── seeders/           # Database seeders
│       ├── prompt-seeder.ts
│       └── seed.ts
│
├── main.ts               # Application entry point
└── app.module.ts         # Root module
```

---

## 💰 OpenAI Cost Estimation

For 1 college running 50 prompts:

- Model: `gpt-4o-mini`
- Cost per query: ~$0.0005
- 50 queries = ~$0.025 (₹2)
- Monthly (weekly runs) = ~₹8 per college

Very affordable! 💰

---

## 🎯 Next Steps

### Immediate (Production Ready)

1. Add email reports
2. Add cron scheduler for daily queries
3. Add recommendation engine
4. Build simple frontend dashboard

### Future Enhancements

1. Add Claude & Perplexity integration
2. Real-time WebSocket updates
3. Advanced analytics (ML)
4. Mobile app
5. Admin panel

---

## ❓ Troubleshooting

### Database connection failed

```bash
# Check MySQL is running
sudo systemctl status mysql

# Check credentials in .env
cat .env
```

### OpenAI API errors

```bash
# Verify API key
echo $OPENAI_API_KEY

# Check account has credits
# Visit: https://platform.openai.com/account/billing
```

### Port already in use

```bash
# Change PORT in .env
PORT=3001
```

---

## 🤝 Support

For issues, questions, or feature requests:
- Check the code comments
- Review API endpoints above
- Test with curl/Postman

---

## 📝 License

MIT License - feel free to use for your project!

---

## ✨ Built With

- **NestJS** - Progressive Node.js framework
- **TypeORM** - ORM for TypeScript
- **MySQL** - Relational database
- **OpenAI API** - ChatGPT integration
- **JWT** - Authentication
- **bcrypt** - Password hashing

---

**Ready to run! Just follow the Quick Start guide above.** 🚀

Everything is production-ready and well-structured for future enhancements!
