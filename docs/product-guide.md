# Diary Product Guide

## What Diary Is

Diary is a local-first conversational memory agent.

It talks with the user once per day, chooses a small set of topics to ask about, and saves the conversation and topic updates locally.

It does not:

- judge the user
- coach the user
- score productivity
- run weekly reviews
- analyze performance

Its role is to ask, record, and keep.

## Product Structure

Diary now has four main surfaces:

1. `Settings`
2. `Topics`
3. `Today`
4. `Archive`

## Settings

The Settings page is used to configure Gemini locally.

The user can:

- save a Gemini API key
- fetch available Gemini models
- choose a model
- save an optional system prompt
- test whether the Gemini connection works

All settings are stored locally.

## Topics

Topics are the main memory units in Diary.

Examples:

- guitar practice
- family plans
- job search
- a side project
- fitness
- travel planning

Each topic can be:

- `active`
- `dormant`
- `archived`

Diary also keeps topic freshness and importance values so it can decide what matters to bring up.

## Today

The Today page runs the daily conversation.

### New user onboarding

If the user has no topics yet, Diary asks for a few focus areas and turns them into starter topics.

### Daily conversation behavior

1. Diary plans 4 to 7 topics for the session.
2. It asks one topic at a time.
3. It may ask one light follow-up when useful.
4. After planned topics, it asks:
   `Anything else from today you want me to keep?`
5. It saves the full session locally.

## Archive

The Archive page lets the user open a saved day and review:

- selected topics
- transcript
- extracted topic updates
- extra note
- local Markdown export path

## What Gets Stored

Diary stores data in SQLite and local export files.

### Main database models

- `topics`
- `topic_memories`
- `daily_sessions`
- `topic_updates`
- `conversation_plans`
- `agent_settings`

### Transcript storage

Every daily session stores the conversation transcript.

### Topic update storage

Each topic discussed in a session can create a structured update with:

- question asked
- raw answer
- follow-up if any
- final saved text
- extracted update summary

### Exports

Diary writes:

- one Markdown file per day
- a local CSV export file

## Topic Lifecycle

Topics move over time:

- active topics are in regular rotation
- dormant topics may return occasionally
- archived topics are mostly left alone

This helps Diary avoid asking about everything every day.

## Local-First Behavior

Diary is local-first by default.

That means:

- the database is local
- exports are local
- settings are local
- there is no auth
- there is no cloud sync

## Gemini Role

Gemini is optional.

When configured, it helps Diary:

- fetch available models
- test connection
- phrase questions more naturally

If Gemini is not configured, Diary still works with local fallback logic.
