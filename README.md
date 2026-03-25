# Diary

Diary is a local-first journaling MVP. It asks the user a fixed set of daily questions, records the answers, and saves the results locally in SQLite, Markdown, and CSV.

## Stack

- Backend: FastAPI, SQLModel, SQLite, APScheduler
- Frontend: Next.js, TypeScript, Tailwind CSS
- Storage: local SQLite database plus local Markdown and CSV exports

## Project Structure

```text
backend/
frontend/
docs/
README.md
```

## Backend Features

- CRUD for tracked items
- Sequential daily check-in flow
- Automatic seed data for 5 default tracked items
- Local exports
  - SQLite records
  - Markdown file per day in `backend/exports/markdown/`
  - CSV file in `backend/exports/daily_entries.csv`

## API Endpoints

- `POST /tracked-items`
- `GET /tracked-items`
- `PATCH /tracked-items/{id}`
- `DELETE /tracked-items/{id}`
- `POST /daily-checkin/start`
- `POST /daily-checkin/answer`
- `POST /daily-checkin/complete`
- `GET /daily-logs/{date}`

## Local Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend starts on `http://127.0.0.1:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://127.0.0.1:3000`.

If needed, set `NEXT_PUBLIC_API_BASE_URL` before starting the frontend. The default is `http://127.0.0.1:8000`.

## Default Seed Items

Diary automatically creates these tracked items the first time the local database is initialized:

- Sleep
- Exercise
- Study
- Project Progress
- Job Applications

## Daily Check-in Flow

1. Create tracked items on the settings page.
2. Start a daily check-in for a date.
3. Answer each active item in order.
4. Leave an answer blank to use `default_text_if_empty`.
5. Add an optional extra note.
6. Complete the check-in to save SQLite rows, Markdown, and CSV output.

## Tests

```bash
python -m pytest backend/tests -q
```

## Notes

- Data is stored locally by default.
- There is no auth, cloud sync, analytics, judgement, or coaching logic.
- APScheduler is initialized for future local scheduling support, but this MVP does not run scheduled jobs yet.
