# CRM AI

A multi-tenant SaaS CRM designed to aggregate and analyze events from AI phone bots and chatbots.

This project is being built as a production-grade full-stack TypeScript application with a strong focus on:

- Clean architecture
- Event-driven ingestion
- Multi-tenant data isolation
- Observability
- Internship-level engineering standards

---

# 🚀 Tech Stack

## Core Framework
- **Next.js 16 (App Router)**
- **TypeScript**
- **Turbopack**

Used for:
- Full-stack development (frontend + API routes)
- Modern routing architecture
- Type-safe backend logic

---

## Database Layer
- **PostgreSQL**
- **Prisma ORM**

Prisma configuration:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

A Prisma singleton is used to prevent multiple client instances during development:

```ts
// src/lib/prisma.ts

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

---

## Authentication
- **Auth.js (NextAuth)**
- **@auth/prisma-adapter**

Planned for:
- Session management
- Role-based access control (RBAC)
- Workspace-level multi-tenancy

Authentication providers will be configured in Phase 1.

---

## UI System
- **Tailwind CSS**
- **shadcn/ui**

Components installed:
- Button
- Input
- Card
- Dialog
- Dropdown
- Table
- Badge

Used to build a clean SaaS-style dashboard interface.

---

## Validation & Forms
- **Zod**
- **React Hook Form**
- **@hookform/resolvers**

Used for:
- Type-safe API validation
- Webhook payload validation
- Form handling

---

## Analytics & Utilities
- **Recharts** (dashboard charts)
- **Day.js** (date utilities)
- **UUID** (event IDs)

---

## Observability
- **Sentry (SaaS)**

Configured under:
- Organization: `NeurOps`
- Project: `crm-ai`

Used for:
- Runtime error tracking
- API route monitoring
- Production debugging

---

# 🛠 Environment Setup

## 1. Install Dependencies

```bash
npm install
```

## 2. Node Version

Requires:

```
Node >= 20.19
```

Recommended:

```
Node v22.12.0
```

If using NVM:

```bash
nvm install 22.12.0
nvm use 22.12.0
```

---

## 3. Environment Variables

Create a `.env` file:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/crm"
```

Database provisioning (Docker or local Postgres) is required.

---

## 4. Generate Prisma Client

```bash
npx prisma generate
```

---

## 5. Run Development Server

```bash
npm run dev
```

App will run at:

```
http://localhost:3000
```

---

# 📂 Project Structure

```
src/
 ├── app/           # App Router pages & API routes
 ├── lib/           # Shared utilities (Prisma client)
 ├── server/        # Business logic layer (planned)
 ├── types/         # Shared TypeScript types
prisma/
 └── schema.prisma  # Database schema
```

---

# ✅ Phase 0 — Completed

- Next.js full-stack setup
- TypeScript strict configuration
- Prisma ORM configured
- Prisma client generated
- Tailwind + shadcn UI system
- Sentry integration
- Modern Node environment
- Clean project structure

---

# 🔜 Phase 1 — In Progress

Planned models:
- Workspace
- User
- WorkspaceMember (RBAC)
- Contact
- Conversation
- Event (idempotent ingestion)

Upcoming features:
- Webhook ingestion endpoint
- Event normalization layer
- Multi-tenant data isolation
- Dashboard analytics queries

---

# 🧠 Architectural Direction

This CRM is being designed as:

- A multi-tenant SaaS
- Event-driven analytics platform
- AI chatbot + phone call ingestion system
- Production-grade full-stack TypeScript application

The stack and architecture are intentionally chosen to reflect real-world startup engineering practices.

---

# 📌 Status

Infrastructure and tooling complete.  
Ready for domain modeling and backend architecture implementation.
