# Diary Architecture

## Overview

Diary is a local-first conversational memory agent.

The architecture is organized around topics and daily conversation sessions, with optional Gemini integration for model listing, connection testing, and more natural prompt phrasing.

## Backend Architecture

### Primary Domain Models

#### `topics`

Stores long-lived user topics.

Key fields:

- `status`
- `importance_score`
- `recency_score`
- `cadence_hint`
- `last_asked_at`
- `last_updated_at`

#### `topic_memories`

Stores durable snippets linked to a topic and optionally a session.

#### `daily_sessions`

Stores one top-level conversation session per day.

Includes:

- transcript
- selected topic ids
- archive candidate ids
- extra note
- markdown path

#### `topic_updates`

Stores per-topic question/answer results for a session.

Includes:

- question text
- raw answer
- optional follow-up
- final saved text
- extracted update summary

#### `conversation_plans`

Stores the selected topics and plan data for a day.

#### `agent_settings`

Stores local Gemini provider configuration:

- provider
- api_key
- model_name
- optional system_prompt

## Main Services

### `topic_manager.py`

Responsibilities:

- sync legacy tracked items into topics if old data exists
- update lifecycle and freshness
- write topic memories
- create new topics from extra notes

### `conversation_planner.py`

Responsibilities:

- select 4 to 7 topics for the day
- balance active and dormant topics
- identify archive candidates
- write a reusable plan row

### `question_designer.py`

Responsibilities:

- generate friendly, concrete prompts
- use Gemini when configured
- fall back to local heuristics when Gemini is unavailable

### `topic_extractor.py`

Responsibilities:

- normalize answers
- detect blank/default cases
- summarize updates
- detect candidate new topics from extra notes

### `gemini_client.py`

Responsibilities:

- call Gemini REST endpoints directly
- list models
- test connection
- send simple generation requests

## Daily Runtime Flow

1. User opens `Today`.
2. Backend loads or computes a conversation plan.
3. Planner selects a small set of topics.
4. Question designer produces the opening message and later follow-ups.
5. The frontend renders a plain chat transcript and sends user messages.
6. The backend agent decides what topic or follow-up comes next.
7. Topic updates are stored incrementally as the chat progresses.
8. After enough coverage, the agent asks for any final note.
9. On completion:
   - transcript is finalized
   - topic memories are written
   - new topics may be created
   - Markdown is written
   - CSV is regenerated

## Frontend Architecture

### Settings

- local Gemini configuration
- model fetch
- connection test

### Topics

- topic creation and lifecycle management

### Today

- chat transcript UI
- single message box and send action
- backend-driven conversation flow
- onboarding when no topics exist

### Archive

- session list
- transcript review
- extracted topic updates

## Local-First Properties

- SQLite is the primary store
- Markdown and CSV are written locally
- no auth
- no cloud sync
- no remote analytics

## Migration Strategy

Tracked items are no longer part of the primary product.

If an older local database already contains tracked items, the backend can still mirror them into topics so prior structure is not lost immediately.
