# Diary

Diary is a local-first conversational memory agent.

It opens a daily conversation, chooses which topics to ask about, asks naturally, records the transcript and topic updates locally, creates new topics when appropriate, and lets old topics become dormant or archived over time.

Diary does not provide coaching, judgement, scoring, productivity analysis, or weekly reviews.

## Main Product Pages

- `Settings`
- `Topics`
- `Today`
- `Archive`

## Stack

- Backend: FastAPI, SQLModel, SQLite
- Frontend: Next.js, TypeScript, Tailwind CSS
- Local exports: Markdown and CSV

## Core Models

- `topics`
- `topic_memories`
- `daily_sessions`
- `topic_updates`
- `conversation_plans`
- `agent_settings`

Legacy compatibility models may still exist in the codebase for migration purposes, but they are no longer part of the primary product UX.

## Main Features

### Settings

The Settings page lets the user:

- save a Gemini API key locally
- fetch available Gemini models
- choose a Gemini model
- save an optional system prompt
- test the Gemini connection

### Topics

The Topics page lets the user:

- create topics
- edit topics
- change lifecycle state
- adjust cadence hints
- adjust importance

Topic states:

- `active`
- `dormant`
- `archived`

### Today

The Today page:

- plans a topic set for the day
- asks about one topic at a time
- optionally asks a light follow-up
- asks `Anything else from today you want me to keep?`
- stores transcript and topic updates locally

If the user is new and has no topics yet, Today provides a lightweight onboarding path that creates starter topics from the user's own focus areas.

### Archive

The Archive page shows:

- saved daily sessions
- selected topics for the day
- transcript
- extracted topic updates
- extra note
- local Markdown path

## Local Setup

From the repository root:

### 1. Install backend dependencies

```powershell
py -3.13 -m pip install -r backend\requirements.txt
```

### 2. Start the backend

```powershell
py -3.13 -m uvicorn backend.app.main:app --reload --app-dir .
```

The backend runs at `http://127.0.0.1:8000`.

### 3. Start the frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

The frontend runs at `http://127.0.0.1:3000`.

### 4. Open the app

Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Daily Flow

1. Open `Settings` and optionally configure Gemini.
2. Open `Topics` and review or create topics.
3. Open `Today`.
4. Review the planned topics for the day.
5. Start the conversation.
6. Reply topic by topic.
7. Add anything else from the day.
8. Save the session.
9. Review it later in `Archive`.

## Local Exports

By default, Diary writes local exports to:

- Markdown: `backend/exports/markdown/`
- CSV: `backend/exports/daily_entries.csv`

The app also exposes the export folder path in the UI.

## Tests

```powershell
python -m pytest backend\tests -q
```

## Notes

- SQLite is the primary local store.
- There is no auth.
- There is no cloud sync.
- Gemini usage is optional; the product still works locally without it, using fallback planning/question phrasing.
