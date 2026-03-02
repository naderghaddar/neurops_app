CRM AI — Phase 0 Setup Documentation
Overview

Phase 0 established a production-ready full-stack foundation for a multi-tenant CRM that will ingest analytics from AI phone bots and chatbots. This phase focused entirely on infrastructure, tooling, and environment configuration.

Core Stack
1. Next.js (App Router, TypeScript)

Created with:

npx create-next-app@latest crm --typescript --tailwind --eslint --app

Purpose

Full-stack framework (frontend + API routes)

Modern App Router architecture

Type-safe development

Single-repo SaaS structure

Configuration:

TypeScript enabled

Tailwind enabled

App Router enabled

React Compiler disabled (stability over experimental features)

@/* import alias configured

2. Prisma ORM + PostgreSQL

Installed:

npm install prisma @prisma/client
npx prisma init

Final schema.prisma configuration:

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

Created a Prisma singleton:

src/lib/prisma.ts

Purpose

Database access layer

Strongly typed queries

Foundation for multi-tenant architecture

Database not fully provisioned yet (local Postgres setup pending).

3. Authentication (Auth.js)

Installed:

npm install next-auth
npm install @auth/prisma-adapter

Purpose

Session management

Multi-tenant RBAC (Workspace-based access)

Protected routes

Auth providers not yet configured.

4. Validation & Forms

Installed:

npm install zod react-hook-form @hookform/resolvers

Purpose

API validation

Webhook payload validation

Type-safe form handling

5. UI System

Tailwind CSS

shadcn/ui components installed (Button, Card, Input, Dialog, Table, etc.)

Purpose

Clean SaaS-style dashboard

Reusable UI primitives

Accessible components

6. Analytics & Charts

Installed:

npm install recharts dayjs uuid

Purpose

CRM dashboards

Time-based analytics

Event metrics visualization

7. Error Monitoring (Sentry)

Installed and configured via:

npm install @sentry/nextjs
npx @sentry/wizard -i nextjs

Configuration:

Sentry SaaS (not self-hosted)

Project created under NeurOps organization

Browser events not routed through Next.js server

Purpose

Runtime error tracking

API monitoring

Production observability

8. Node Version Upgrade

Upgraded to:

Node v22.12.0

Reason:

Prisma requires Node ≥ 20.19

Ensures compatibility with modern ecosystem

Current Project Structure
src/
 ├── app/
 ├── lib/
 │   └── prisma.ts
 ├── server/
 ├── types/
prisma/
 └── schema.prisma
What Is Fully Set Up

Next.js full-stack app

TypeScript environment

Prisma ORM configured

Prisma client generated

Tailwind + shadcn UI

Sentry integrated

Modern Node version

App runs successfully at:

http://localhost:3000
What Still Needs Setup (Next Phase)

Local PostgreSQL instance

Prisma models (Workspace, User, RBAC, Contact, Event)

Authentication providers

Webhook ingestion endpoint

Dashboard analytics queries

Status

Environment and infrastructure complete.
Ready to begin Phase 1: domain modeling and backend architecture.