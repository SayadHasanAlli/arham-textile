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
