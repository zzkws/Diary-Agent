from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date

from sqlmodel import Session, select

from ..models.agent_setting import AgentSetting
from ..models.conversation_plan import ConversationPlan
from ..models.topic import Topic, TopicStatus
from .question_designer import design_topic_question_with_llm
from .topic_manager import refresh_topic_lifecycle, sync_topics_from_tracked_items


@dataclass
class PlannedTopic:
    topic: Topic
    question: str
    rationale: str
    revival: bool = False


def build_daily_plan(
    session: Session,
    plan_date: date,
    setting: AgentSetting | None = None,
) -> tuple[list[PlannedTopic], list[Topic], ConversationPlan]:
    sync_topics_from_tracked_items(session)
    all_topics = list(session.exec(select(Topic).where(Topic.status != TopicStatus.archived)))

    refreshed_topics: list[Topic] = []
    archive_candidates: list[Topic] = []
    for topic in all_topics:
        topic, archive_candidate = refresh_topic_lifecycle(topic)
        session.add(topic)
        refreshed_topics.append(topic)
        if archive_candidate:
            archive_candidates.append(topic)
    session.commit()

    active_topics = sorted(
        [topic for topic in refreshed_topics if topic.status == TopicStatus.active],
        key=lambda topic: (topic.importance_score * 0.65) + (topic.recency_score * 0.35),
        reverse=True,
    )
    dormant_topics = sorted(
        [topic for topic in refreshed_topics if topic.status == TopicStatus.dormant],
        key=lambda topic: (topic.importance_score * 0.55) + (topic.recency_score * 0.45),
        reverse=True,
    )

    target_count = min(max(4, min(len(refreshed_topics), 4)), 7)
    selected: list[PlannedTopic] = []

    for topic in active_topics[: max(target_count - 1, 0)]:
        selected.append(
            PlannedTopic(
                topic=topic,
                question=design_topic_question_with_llm(topic, setting),
                rationale="recently active",
            )
        )

    if dormant_topics and len(selected) < target_count:
        revival_topic = dormant_topics[0]
        if revival_topic.id not in {entry.topic.id for entry in selected}:
            selected.append(
                PlannedTopic(
                    topic=revival_topic,
                    question=design_topic_question_with_llm(revival_topic, setting, revival=True),
                    rationale="revived",
                    revival=True,
                )
            )

    for topic in active_topics + dormant_topics:
        if len(selected) >= min(max(len(refreshed_topics), 1), 7):
            break
        if topic.id in {entry.topic.id for entry in selected}:
            continue
        selected.append(
            PlannedTopic(
                topic=topic,
                question=design_topic_question_with_llm(topic, setting),
                rationale="kept in rotation",
            )
        )

    if not selected and refreshed_topics:
        fallback_topic = sorted(refreshed_topics, key=lambda topic: topic.importance_score, reverse=True)[0]
        selected.append(
            PlannedTopic(
                topic=fallback_topic,
                question=design_topic_question_with_llm(fallback_topic, setting),
                rationale="fallback",
            )
        )

    plan_payload = [
        {
            "topic_id": entry.topic.id,
            "title": entry.topic.title,
            "status": entry.topic.status.value,
            "question": entry.question,
            "rationale": entry.rationale,
            "importance_score": entry.topic.importance_score,
            "recency_score": entry.topic.recency_score,
        }
        for entry in selected
    ]

    conversation_plan = session.exec(
        select(ConversationPlan).where(ConversationPlan.plan_date == plan_date)
    ).first()
    if not conversation_plan:
        conversation_plan = ConversationPlan(plan_date=plan_date)

    conversation_plan.selected_topic_ids_json = json.dumps([entry.topic.id for entry in selected])
    conversation_plan.archive_candidate_ids_json = json.dumps([topic.id for topic in archive_candidates])
    conversation_plan.plan_json = json.dumps(plan_payload)
    session.add(conversation_plan)
    session.commit()
    session.refresh(conversation_plan)

    return selected, archive_candidates, conversation_plan
