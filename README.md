# Loan Management SaaS Platform

Comprehensive enterprise multi-tenant Loan Management System built with React, Node.js, Express, TypeScript, and MongoDB.

## Project Structure
```
loan-platform/
├── frontend/             # React 18, Vite, TypeScript, Tailwind CSS v3, TanStack Query, Axios
├── backend/              # Node.js, Express, TypeScript, Mongoose
├── .github/workflows/    # CI Pipeline configuration
├── docs/                 # Architectural documentation
├── docker-compose.yml    # Development environment compose
├── docker-compose.prod.yml # Production environment compose (Nginx static serving)
├── .env.example          # Template environment variables
└── README.md             # Developer & operations guide
```

---

## Technical Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v3 (PostCSS) with custom design tokens
- **Routing**: React Router v6
- **Server State**: TanStack Query v5
- **HTTP Client**: Axios with error normalization interceptors

### Backend
- **Runtime**: Node.js 18+ & Express
- **Language**: TypeScript (Strict Mode)
- **ODM**: Mongoose 8 (MongoDB)
- **Validation**: Zod schema validation
- **Logging**: Pino structured logger
- **Security**: Helmet, CORS, AppError handling hierarchy

---

## Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB server or Docker instance (`mongo:7.0`)
- **Docker & Docker Compose** (Optional for containerized workflow)

---

## Installation

From the monorepo root:

```bash
# Clean dependency installation for all workspace packages
npm install
```

---

## Local Development Commands

### 1. MongoDB Execution
Run MongoDB locally or via Docker:

```bash
# Start MongoDB via Docker
docker run -d -p 27017:27017 --name loan_mongodb mongo:7.0
```

### 2. Environment Setup
Copy `.env.example` to `.env` in the root (or backend/frontend directories if needed):

```bash
cp .env.example .env
```

### 3. Run Backend & Frontend Concurrently
Run both dev servers simultaneously from the root:

```bash
npm run dev
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api/v1`
- **Health Check**: `http://localhost:5000/health`
- **Readiness Check**: `http://localhost:5000/health/ready`

### 4. Run Backend Independently
```bash
npm run dev --workspace=backend
```

### 5. Run Frontend Independently
```bash
npm run dev --workspace=frontend
```

---

## Testing & Quality Assurance

### Run Unit & Endpoint Tests
```bash
npm run test
```

### Run ESLint Checks
```bash
npm run lint
```

### Run TypeScript Strict Typechecking
```bash
npm run typecheck
```

### Build Production Assets
```bash
npm run build
```

---

## Health API Endpoints

### `GET /health` (Liveness Probe)
Verifies that the Node.js application process is active and running.
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "uptime": 45.2,
  "timestamp": "2026-08-31T08:50:00.000Z"
}
```

### `GET /health/ready` (Readiness Probe)
Verifies that the MongoDB database connection is established (`readyState === 1`).
- **Response (Connected)**: `200 OK`
```json
{
  "status": "ready",
  "db": "connected",
  "timestamp": "2026-08-31T08:50:00.000Z"
}
```
- **Response (Disconnected)**: `503 Service Unavailable`
```json
{
  "status": "unhealthy",
  "db": "disconnected",
  "timestamp": "2026-08-31T08:50:00.000Z"
}
```

---

## Docker Workflows

### Development Docker Environment (Hot-reloading)
```bash
docker-compose up --build
```
- Frontend dev server: `http://localhost:5173`
- Backend API server: `http://localhost:5000`

### Production Docker Environment (Nginx Static Serving)
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```
- Frontend (Nginx static assets): `http://localhost:8080`
- Backend API container: `http://localhost:5000`