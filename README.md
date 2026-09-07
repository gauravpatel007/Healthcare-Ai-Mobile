# LifeOS Backend — AI-Powered Healthcare Operating System

A production-ready **FastAPI** backend for the LifeOS frontend, providing 80+ REST API endpoints across 16 healthcare modules.


Quick Start :

Frontend :
```bash
cd frontend-react
npm install
npm run dev
```
Backend :
```bash
python -m venv venv
venv\Scripts\activate 
pip install -r requirements.txt
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

Chatbot :
```bash
cd "G:\Languages\Healthcare AI\R1"
venv\Scripts\activate
cd backend\chatbot
python -m pip install -r requirements.txt
python app.py
```
FOR SOS Audio : ngrok http 8000

## 🏗️ Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py             # Pydantic Settings
│   ├── database.py           # Async SQLAlchemy engine
│   ├── dependencies.py       # Auth & DB dependencies
│   ├── exceptions.py         # Centralized error handling
│   ├── middleware.py          # CORS & logging
│   ├── models/               # 11 SQLAlchemy ORM models
│   ├── schemas/               # 15 Pydantic schema modules
│   ├── routers/               # 17 API routers
│   ├── services/              # AI, file upload, analytics
│   └── utils/                 # Security, helpers (BMI/BMR)
├── alembic/                   # Database migrations
├── seeds/                     # Sample data seeder
├── docker-compose.yml         # One-command deployment
└── Dockerfile
```

## 🚀 Quick Start

### 1. Run the Backend

**Option A: Local Development (Windows/Mac/Linux)**
```bash
# 1. Create and activate a virtual environment (from the root folder)
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Change into the backend directory
cd backend

# 4. Start PostgreSQL locally (ensure it's running on port 5432)
# Make sure to update the .env file with your PostgreSQL credentials!

# 5. Run the server
python -m uvicorn app.main:app --reload --port 8000

# 6. (Optional) Seed sample data
python -m seeds.seed_data
```

**Option B: Docker**
*(Note: Because of the recent folder restructure, running via Docker might require updating `docker-compose.yml` to `cd backend` before running uvicorn)*
```bash
# Start PostgreSQL + FastAPI (from the root folder)
docker-compose up -d --build

# Seed the database
docker-compose exec app bash -c "cd backend && python -m seeds.seed_data"
```

### 2. Run the Frontend (React Version)

The frontend has been migrated to a modern React application using Vite.

1. Open a new terminal.
2. Change into the React frontend directory:
```bash
cd frontend-react
```
3. Install the dependencies (only needed once):
```bash
npm install
```
4. Start the development server:
```bash
npm run dev
```
5. The application will be available in your browser, typically at: `http://localhost:5173/`

### 3. Run the Chatbot

The project includes an AI Chatbot backend that runs separately.

1. Open a new terminal.
2. Run the following commands:
```bash
cd "G:\Languages\Healthcare AI\R1"
venv\Scripts\activate
cd backend\chatbot
python -m pip install -r requirements.txt
python app.py
```

3. Create a `.env` file in the `backend\chatbot` folder and add your API keys:
```env
PINECONE_API_KEY=your_pinecone_key_here
OPENAI_API_KEY=your_groq_key_here
```

4. Start the chatbot:
```bash
python app.py
```

## 📚 API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## 🔐 Authentication

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@lifeos.com","password":"Test123!","name":"Test User"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gaurav@lifeos.com","password":"password123"}'

# Use the access_token in subsequent requests:
# Authorization: Bearer <access_token>
```
<!-- I have uploaded Landing page in Landing page 2.0 folder  -->

### Seeded Credentials
| Email | Password | Role |
|-------|----------|------|
| gaurav@lifeos.com | password123 | patient |

## 📡 API Modules

| Module | Prefix | Endpoints |
|--------|--------|-----------|
| Authentication | `/api/v1/auth` | register, login, refresh, logout, me |
| Users | `/api/v1/users` | profile, settings, export |
| Dashboard | `/api/v1/dashboard` | summary, health-score |
| Medical Records | `/api/v1/records` | CRUD + file upload + AI summary |
| Medicines | `/api/v1/medicines` | CRUD + interactions + refill |
| Appointments | `/api/v1/appointments` | CRUD + AI suggestions |
| Emergency | `/api/v1/emergency` | contacts, SOS, QR data, donor |
| Family | `/api/v1/family` | members + vaccinations |
| Trackers | `/api/v1/trackers` | water, sleep, health metrics, BMI |
| Expenses | `/api/v1/expenses` | CRUD + summary |
| Challenges | `/api/v1/challenges` | progress, complete, streak, badges |
| Analytics | `/api/v1/analytics` | timeline, graphs, risk, predictions |
| AI Chat | `/api/v1/ai/chat` | chat, history, tips |
| AI Symptoms | `/api/v1/ai/symptoms` | analyze |
| AI Nutrition | `/api/v1/ai/nutrition` | plan, stats, recommendations |
| AI Fitness | `/api/v1/ai/fitness` | workouts, weekly plan, steps, stats |
| AI Mental | `/api/v1/ai/mental` | mood, journal, stress, screening |

## 🤖 AI Integration (Groq)

Set your Groq API key in `.env`:
```
GROQ_API_KEY=your-groq-api-key
```

If no key is provided, AI features use intelligent local fallbacks.

## 🛠️ Tech Stack

- **Framework**: FastAPI 0.115
- **Database**: PostgreSQL 16 + SQLAlchemy 2.0 (async)
- **Auth**: JWT (python-jose) + bcrypt
- **Validation**: Pydantic v2
- **AI**: Groq SDK (Llama 3.3 70B)
- **Migrations**: Alembic
- **Deployment**: Docker + docker-compose

## 📋 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL connection string |
| `SECRET_KEY` | (change me) | JWT signing key |
| `GROQ_API_KEY` | (empty) | Groq API key for AI features |
| `CORS_ORIGINS` | `localhost:3000,5500` | Allowed CORS origins |
| `DEBUG` | `true` | Enable debug mode |
| `MAX_FILE_SIZE_MB` | `10` | Max upload file size |
