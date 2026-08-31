# Loan Management SaaS Architecture

## Overview
This repository uses an npm workspace monorepo architecture cleanly separating the Express + Node.js backend from the React + Vite + TypeScript frontend.

## Monorepo Layout
```
loan-platform/
├── frontend/             # React + Vite + Tailwind CSS + TanStack Query + Axios
├── backend/              # Node.js + Express + TypeScript + Mongoose
├── .github/workflows/    # CI Pipeline
├── docs/                 # Architectural & Module documentation
├── docker-compose.yml    # Development environment
├── docker-compose.prod.yml # Production environment (Nginx static serving)
├── .env.example          # Environment variable template
└── README.md             # Setup and developer workflow instructions
```

## Backend Architecture
The backend uses a modular domain structure under `src/modules/`.

```
backend/src/
├── config/             # Zod environment schema & Mongoose connection
├── common/             # Standardized operational errors, logger, & middlewares
│   ├── errors/         # AppError class hierarchy
│   ├── logger/         # Structured logger (Pino)
│   └── middleware/     # Error handler, Zod request validator
├── middleware/         # App-wide Express middlewares
├── modules/            # Modular domain subdirectories
│   ├── auth/           # Authentication placeholder module (feature/authentication)
│   ├── users/          # User management placeholder module
│   ├── tenants/        # Multi-tenant management placeholder module
│   ├── persons/        # Borrower profiles placeholder module
│   ├── loans/          # Loan lifecycle placeholder module
│   ├── payments/       # Payment handling placeholder module
│   ├── dashboard/      # Analytics placeholder module
│   ├── reports/        # PDF/CSV generation placeholder module
│   ├── notifications/  # Email/SMS placeholder module
│   └── audit/          # Compliance logging placeholder module
└── app.ts              # Express initialization & health probes
```

### Health Endpoints
- `GET /health`: Liveness probe. Returns HTTP 200 `{ status: "ok", uptime: <number>, timestamp: <iso> }`.
- `GET /health/ready`: Readiness probe. Checks Mongoose connection state (`readyState === 1`). Returns HTTP 200 `{ status: "ready", db: "connected" }` or HTTP 503 if disconnected.

### Graceful Shutdown
The backend listens for `SIGINT` and `SIGTERM` signals. When triggered, it stops accepting HTTP connections, closes the active Mongoose database connection, and exits cleanly with code 0.

## Frontend Architecture
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS v3, React Router v6, TanStack Query v5, and Axios.

```
frontend/src/
├── api/                # Axios client with interceptors & health API functions
├── components/
│   ├── layout/         # MainLayout, Header, Sidebar
│   └── ui/             # Reusable UI primitives (Button, Card, Input, Badge, LoadingSpinner)
├── pages/              # Module placeholder pages matching domain modules
├── router/             # React Router route registry
├── App.tsx             # Root provider shell
├── index.css           # Tailwind v3 directives & Google Fonts
└── main.tsx            # Entry mounting script
```

## Production Serving
In production:
1. Backend transpiles TypeScript to `dist/server.js` run directly via Node.js.
2. Frontend runs a multi-stage Docker build producing optimized static SPA assets served by `nginx:alpine` using fallback SPA routing (`try_files $uri /index.html`).
