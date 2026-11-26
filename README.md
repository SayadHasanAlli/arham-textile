# Arham Textile – Worker Production Management System

Full-stack production management platform built with **React + Vite + Tailwind CSS**, **FastAPI + SQLAlchemy 2.0 + Alembic**, and **Supabase PostgreSQL**.

## Local Development

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Run Security & RBAC Verification
With FastAPI running on port 8000:
```bash
cd backend
python scripts/verify_security.py
```

## Production Deployment Guide

### 1. Database (Supabase PostgreSQL)
- Already hosted on Supabase. Use the **Transaction/Session Pooler** connection string for `DATABASE_URL`.

### 2. Backend (Render or Railway)
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt && alembic upgrade head`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment Variables:
  - `DATABASE_URL` = your Supabase PostgreSQL URL
  - `SECRET_KEY` = strong 32+ character random string (`python -c "import secrets; print(secrets.token_hex(32))"`)
  - `ENVIRONMENT` = `production`
  - `CORS_ORIGINS` = `https://your-frontend-domain.vercel.app`

### 3. Frontend (Vercel)
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable:
  - `VITE_API_BASE_URL` = `https://your-backend-domain.onrender.com`
- `vercel.json` is included for React Router SPA routing.

### 4. First-Time Production Security Step
Log in as `admin` (`Admin@123`), go to **Settings**, and immediately change the default admin password.
