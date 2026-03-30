# AI Study OS (Pro) 🚀

A scalable AI-powered learning platform built with NestJS, TypeScript, PostgreSQL, Redis, and OpenAI.

## Features ✨

### 1. ✍️ AI Essay Engine
- Advanced rubric parsing and checklist generation
- High-scoring outline AI planning
- Iterative paragraph generation
- Self-evaluating AI loops targeting 90%+ scores
- Automated weak-part improvement loops

### 2. 🎙️ Lecture Intelligence System
- Whisper AI transcription for audio/video lectures
- Automated transcript cleaning (removes filler words, improves grammar)
- Key concept extraction (definitions, formulas)
- Automatic summaries (short + detailed)
- Exam question prediction

### 3. 🧠 Learning OS & AI Tutor
- Spaced Repetition System (SRS) using the SM-2 algorithm
- Comprehensive Quiz module (MCQ + Short Answer)
- AI Tutor with Vector Database (RAG) providing context-aware answers
- "Explain like I'm 5" to "College Academic" explanations
- Step-by-step problem solver for math and complex reasoning

## Tech Stack 🛠

- **Backend Framework:** NestJS (TypeScript Strict Mode)
- **Database:** PostgreSQL (with Prisma ORM)
- **Cache & Message Broker:** Redis
- **Background Jobs:** BullMQ
- **AI Integration:** OpenAI API (GPT-4.1 / GPT-5-mini fallback, Whisper, Embeddings)
- **Authentication:** JWT + Passport
- **Storage:** Amazon S3 / Cloudflare R2
- **Deployment:** Docker Multi-stage + Railway

## Local Development 💻

### Prerequisites
- Node.js v20+
- Docker & Docker Compose
- OpenAI API Key

### Setup

1. Copy env file and fill in your secrets:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your OPENAI_API_KEY
   ```

2. Start the database and Redis using Docker Compose:
   ```bash
   docker-compose up -d db redis
   ```

3. Install dependencies and run migrations:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate dev
   ```

4. Start the development server:
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3001/v1`
API Documentation (Swagger): `http://localhost:3001/api/docs`

## Railway Deployment Guide 🚂

This application is fully optimized for production deployment on [Railway](https://railway.app). 

### Step 1: Provision Infrastructure
1. Create a new Railway Project
2. Add a **PostgreSQL** Database plugin
3. Add a **Redis** plugin

### Step 2: Deploy the App
1. Connect your GitHub repository to Railway
2. Railway will automatically detect the `railway.json` and `Dockerfile`
3. Add the following Environment Variables in the Railway dashboard:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connects from your Railway Postgres plugin |
| `REDIS_URL` | Connects from your Railway Redis plugin |
| `JWT_SECRET` | A strong random string for signing JWTs |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `NODE_ENV` | Set to `production` |
| `PORT` | Set to `3001` (or Railway's default) |

### Step 3: Database Migration
Since the Dockerfile automatically runs `npx prisma migrate deploy` before startup, your database schema will be updated automatically every deployment!

### Step 4: Add Cloud Storage (Optional)
If you want to host audio files in production, configure an S3 bucket or Cloudflare R2 instance and add these env variables:
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`

## Project Architecture 🏗

The codebase follows Domain-Driven Design (DDD) principles with clear module boundaries:

```
src/
├── ai/             # Core AI orchestration, OpenAI wrapper, fallback logic
├── auth/           # JWT, Passport, User registration/login
├── common/         # Global filters, decorators, interceptors, DTOs
├── essay/          # Rubric evaluation and essay generation loops
├── health/         # System monitoring
├── learning/       # Spaced repetition, Flashcards, Quizzes, Analytics
├── lecture/        # File upload, Transcription, Insight extraction
├── prisma/         # Database service wrapper
├── queue/          # BullMQ worker processors and service integrations
└── tutor/          # RAG chat engine, explanations, problem-solving
```
