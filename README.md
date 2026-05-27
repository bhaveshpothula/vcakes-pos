# 🍰 Sweet Delight - Bakery Sales & Inventory Manager

A production-ready, full-stack, Progressive Web Application (PWA) designed to completely replace paper-based sales logging with a secure, transaction-safe, cloud-based POS and inventory management system.

## 🚀 Tech Stack

- **Frontend**: Next.js 15/16 (App Router), TypeScript, Tailwind CSS (v4), Framer Motion, Lucide icons, Recharts (analytics graphs).
- **Backend**: Next.js API Route endpoints.
- **ORM & Database**: Prisma ORM, PostgreSQL (`pg` connection pools + `PrismaPg` driver adapter).
- **Authentication**: Secure cookie-based JWT sessions (using Edge-compatible `jose`), roles (Admin / Staff), and `bcryptjs` password hashing.
- **PWA & Offline Capability**: Service Worker (`sw.js`) offline asset caching, offline billing queue in `localStorage` with automatic background syncing when coming back online.

---

## 🔒 Security & Data Safety (Highest Priority)

1. **Transaction Safety**: All sales billing and stock adjustments run inside atomic database transactions (`prisma.$transaction`). If any product goes out of stock due to concurrency during a checkout, the database instantly rolls back.
2. **Never Lose Data (Automatic Backups)**: A custom JSON-based database backup engine exports all tables (Users, Categories, Items, Sales, SaleItems, Inventory logs, and Audit logs) and writes them to the database `BackupLog` table (for cloud storage) and to the local `backups/` directory (for double-redundancy).
3. **Soft Deletions**: Deleting products, categories, or sales performs a soft-delete (sets `isDeleted: true`) rather than purging rows. Categories cascade soft-delete to their items. Transactions can be cancelled to restore stock.
4. **Audit Logs**: Every write operation (add item, edit category, adjust stock, login success/failure, restore database) registers a detailed log entry indicating *who*, *what*, *when*, and the *raw JSON payload* of changes.
5. **Secure Authentication & Middleware**: Role-based access rules are checked in Edge Middleware (`src/middleware.ts`). Staff cannot access analytics dashboards, backups, staff registrations, or modify items/categories.

---

## 📂 Project Structure

```
/bakery-pos/
├── prisma/
│   ├── schema.prisma       # Relational Database Models
│   ├── seed.ts             # Preload categories, items, and credentials
│   └── migrations/
├── public/
│   ├── sw.js               # Service Worker for PWA offline cache
│   └── manifest.json       # PWA Application manifest
├── src/
│   ├── app/                # Pages and API routes
│   │   ├── api/            # Secure endpoint API handlers
│   │   ├── login/          # Secure Login portal
│   │   ├── pos/            # Touch POS billing grid & PrintReceipt Modal
│   │   ├── dashboard/      # Metrics, line charts, & quick restock
│   │   ├── inventory/      # Products, Categories, Stock +/-
│   │   ├── reports/        # Transaction search, filters, CSV exporter
│   │   ├── audit-logs/     # Admin audit events reader
│   │   └── backups/        # JSON Backups lists and Staff account register
│   ├── components/         # Navbar, ThemeToggle, and Toast Notification
│   ├── context/            # Global AppContext (auth session, offline monitor)
│   ├── lib/                # db pool helper, JWT auth, audit logging
│   └── middleware.ts       # Secure Edge route-role interceptor
```

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- **Bun** (Recommended) or Node.js (v18+)

### 2. Install Dependencies
```bash
bun install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bakery_pos?schema=public"
JWT_SECRET="generate-a-secure-random-key-here"
CRON_SECRET="optional-cron-secret-for-auto-backups"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Migrate and Seed Database
Generate the client, push the schemas to PostgreSQL, and seed preloaded items and credentials:
```bash
# Generate Prisma Client typings
bunx prisma generate

# Create tables in PostgreSQL
bunx prisma db push

# Seed default items & users
bunx prisma db seed
```

**Seed Credentials Created:**
*   **Admin**: `admin@bakery.com` (password: `admin123`)
*   **Staff**: `staff@bakery.com` (password: `staff123`)

### 5. Start Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📈 Database Schema Models

- **User**: Name, Email, passwordHash, role (`ADMIN`/`STAFF`), isActive, isDeleted.
- **Category**: Name, isDeleted.
- **Item**: Name, price, stock, lowStockThreshold, isActive, isDeleted, CategoryId.
- **Sale**: Transaction ID (Format: `SD-YYMMDD-RAND`), totalAmount, notes, Billed StaffId.
- **SaleItem**: Billed ItemName (immutable historic copy), price at sale time, quantity, total.
- **InventoryLog**: Stock change details, previousQty, currentQty, LogType (`SALE`/`MANUAL_UPDATE`/`INITIAL`/`RESTORE`).
- **AuditLog**: Action performed, targetTable, targetId, details (JSON string), User ID.
- **BackupLog**: fileName, backupType (`AUTO`/`MANUAL`), status (`SUCCESS`/`FAILED`), dataContent (JSON backup text), errorLog.

---

## 🚀 Production Deployment Guide

### Database Setup (Supabase / Neon)
1. Register on [Neon](https://neon.tech/) or [Supabase](https://supabase.com/).
2. Create a new PostgreSQL Database.
3. Copy the database connection URL (ensure it includes `sslmode=require`).

### Frontend & API Deployment (Vercel)
1. Import your repository into [Vercel](https://vercel.com).
2. Set Environment Variables in the project configuration:
   - `DATABASE_URL` (Neon Connection String)
   - `JWT_SECRET` (A strong cryptographical string)
   - `CRON_SECRET` (A string shared between Vercel Cron and the application)
3. Deploy! Next.js will build and serve your app.

### Setting Up Daily Backups (Vercel Cron)
To run automatic daily backups at 00:00:
1. Create a `vercel.json` file in your root folder:
```json
{
  "crons": [
    {
      "path": "/api/backup/cron",
      "schedule": "0 0 * * *",
      "headers": {
        "Authorization": "Bearer YOUR_CRON_SECRET_HERE"
      }
    }
  ]
}
```
2. Redeploy. Vercel will call your Cron endpoint daily, creating backups.
