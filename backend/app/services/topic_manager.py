from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from ..models.daily_session import DailySession
from ..models.item_entry import EntryStatus
from ..models.topic import Topic, TopicStatus
from ..models.topic_memory import TopicMemory
from ..models.topic_update import TopicUpdate
from ..models.tracked_item import TrackedItem
from .topic_extractor import detect_new_topic_candidates


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


CADENCE_TO_DAYS = {
    "daily": 1,
    "every_few_days": 3,
    "weekly": 7,
    "biweekly": 14,
    "monthly": 30,
    "sporadic": 21,
}


def cadence_days(topic: Topic) -> int:
    return CADENCE_TO_DAYS.get(topic.cadence_hint, 7)


def sync_topics_from_tracked_items(session: Session) -> None:
    tracked_items = list(session.exec(select(TrackedItem)))
    for tracked_item in tracked_items:
        topic = session.exec(
            select(Topic).where(Topic.source_tracked_item_id == tracked_item.id)
        ).first()
        if not topic:
            topic = Topic(
                title=tracked_item.name,
                description=f"Legacy tracked item: {tracked_item.name}",
                status=TopicStatus.active if tracked_item.is_active else TopicStatus.dormant,
                importance_score=0.65,
                recency_score=0.65,
                cadence_hint="daily" if tracked_item.sort_order <= 2 else "weekly",
                source_question=tracked_item.question,
                default_text_if_empty=tracked_item.default_text_if_empty,
                source_tracked_item_id=tracked_item.id,
            )
            session.add(topic)
            continue

        topic.title = tracked_item.name
        topic.source_question = tracked_item.question
        topic.default_text_if_empty = tracked_item.default_text_if_empty
        if topic.status != TopicStatus.archived:
            topic.status = TopicStatus.active if tracked_item.is_active else TopicStatus.dormant
        topic.updated_at = utc_now()
        session.add(topic)

    session.commit()


def refresh_topic_lifecycle(topic: Topic) -> tuple[Topic, bool]:
    now = utc_now()
    cadence = cadence_days(topic)
    last_touch = ensure_utc(topic.last_updated_at or topic.last_asked_at or topic.created_at)
    days_since_touch = max((now - last_touch).days, 0)

    topic.recency_score = max(0.1, 1 - (days_since_touch / max(cadence * 3, 1)))
    archive_candidate = days_since_touch >= cadence * 10 and topic.status != TopicStatus.archived

    if topic.status != TopicStatus.archived:
        if days_since_touch >= cadence * 4:
            topic.status = TopicStatus.dormant
        else:
            topic.status = TopicStatus.active

    topic.updated_at = now
    return topic, archive_candidate


def apply_completed_session(session: Session, daily_session: DailySession, updates: list[TopicUpdate]) -> list[Topic]:
    touched_topics: list[Topic] = []
    now = utc_now()

    for update in updates:
        topic = session.get(Topic, update.topic_id)
        if not topic:
            continue
        topic.last_asked_at = now
        if update.status != EntryStatus.empty:
            topic.last_updated_at = now
        topic.recency_score = 1.0
        topic.importance_score = min(1.0, topic.importance_score + 0.03)
        if topic.status != TopicStatus.archived:
            topic.status = TopicStatus.active
        topic.updated_at = now
        session.add(topic)
        session.add(
            TopicMemory(
                topic_id=topic.id,
                daily_session_id=daily_session.id,
                memory_text=update.update_summary,
            )
        )
        touched_topics.append(topic)

    session.commit()
    return touched_topics


def create_topics_from_extra_note(session: Session, daily_session: DailySession, extra_note: str | None) -> list[Topic]:
    if not extra_note or extra_note.strip() == "":
        return []

    existing_titles = {topic.title.lower() for topic in session.exec(select(Topic))}
    created_topics: list[Topic] = []

    for title, memory_text in detect_new_topic_candidates(extra_note):
        if title.lower() in existing_titles:
            continue
        topic = Topic(
            title=title,
            description="Created from a daily conversation note.",
            status=TopicStatus.active,
            importance_score=0.55,
            recency_score=0.8,
            cadence_hint="weekly",
            default_text_if_empty=f"No update recorded for {title} today.",
            last_updated_at=utc_now(),
        )
        session.add(topic)
        session.commit()
        session.refresh(topic)
        session.add(
            TopicMemory(
                topic_id=topic.id,
                daily_session_id=daily_session.id,
                memory_text=memory_text,
            )
        )
        session.commit()
        existing_titles.add(title.lower())
        created_topics.append(topic)

    return created_topics
