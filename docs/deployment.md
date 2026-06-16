# Deployment Documentation

## Frontend

Platform:
Vercel

URL:https://ai-ticket-platform.vercel.app/

## Backend

Platform:
Railway

## Database

Platform:
Supabase

## Required Environment Variables

### Frontend

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_BASE_URL

### Backend

SUPABASE_DB_URL
SUPABASE_URL
SUPABASE_KEY
GROQ_API_KEY
REDIS_URL

## Deployment Workflow

GitHub
→ Vercel
→ Railway
→ Supabase
