# Diary Architecture

Diary is a local-first journaling app with a FastAPI backend, SQLite database, and a minimal Next.js frontend.

## Backend
- FastAPI exposes CRUD for tracked items and a three-step daily check-in flow.
- SQLModel maps SQLite tables for tracked items, daily logs, and item entries.
- APScheduler is initialized for future local scheduling needs, but the MVP does not run automated jobs yet.
- Markdown and CSV exports are written to `backend/exports/`.

## Frontend
- Next.js App Router pages provide settings, check-in, and archive views.
- The UI talks to the local backend over HTTP and keeps interactions simple and sequential.
